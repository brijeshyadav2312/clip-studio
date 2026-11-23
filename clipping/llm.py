"""Minimal LLM client (Gemini or OpenAI) returning parsed JSON.

No SDKs, no async: a single POST with a JSON schema instruction. If the provider
is not configured or fails, callers fall back to the heuristic ranker.
"""

from __future__ import annotations

import json
import re
from typing import Any

import requests

from .config import Settings
from .utils import ToolError, log


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json(text: str) -> Any:
    text = _strip_fences(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Last resort: grab the outermost object/array.
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ToolError("The language model did not return valid JSON.")


def _gemini(system: str, user: str, settings: Settings) -> Any:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.35,
            "responseMimeType": "application/json",
            "maxOutputTokens": 8192,
        },
    }
    resp = requests.post(
        url,
        params={"key": settings.gemini_api_key},
        json=payload,
        timeout=settings.llm_timeout,
    )
    if resp.status_code != 200:
        raise ToolError(f"Gemini API error {resp.status_code}: {resp.text[:400]}")
    data = resp.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts)
    except (KeyError, IndexError) as exc:
        raise ToolError(f"Unexpected Gemini response: {str(data)[:400]}") from exc
    return _extract_json(text)


def _openai(system: str, user: str, settings: Settings) -> Any:
    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": settings.openai_model,
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {settings.openai_api_key}"},
        json=payload,
        timeout=settings.llm_timeout,
    )
    if resp.status_code != 200:
        raise ToolError(f"OpenAI API error {resp.status_code}: {resp.text[:400]}")
    data = resp.json()
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise ToolError(f"Unexpected OpenAI response: {str(data)[:400]}") from exc
    return _extract_json(text)


def complete_json(system: str, user: str, settings: Settings) -> Any:
    provider = (settings.llm_provider or "heuristic").lower()
    if provider == "gemini":
        if not settings.gemini_api_key:
            raise ToolError("GEMINI_API_KEY is not set")
        return _gemini(system, user, settings)
    if provider == "openai":
        if not settings.openai_api_key:
            raise ToolError("OPENAI_API_KEY is not set")
        return _openai(system, user, settings)
    raise ToolError(f"Unknown LLM provider: {provider}")


def provider_available(settings: Settings) -> bool:
    provider = (settings.llm_provider or "heuristic").lower()
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "openai":
        return bool(settings.openai_api_key)
    return False


def log_provider(settings: Settings) -> None:
    if provider_available(settings):
        model = settings.gemini_model if settings.llm_provider == "gemini" else settings.openai_model
        log(f"[llm] using {settings.llm_provider}/{model}")
    else:
        log("[llm] no API key configured - using heuristic highlight ranking")
