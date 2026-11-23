# YouTube Clipping Tools: Market Research, Build-vs-Buy Analysis, and Product Blueprint

**Date:** 23 November 2026
**Scope:** AI tools that turn long-form YouTube videos into short vertical clips (Shorts / Reels / TikToks), plus a practical plan for building your own.

---

## 1. Executive summary

**Short answer: yes, you can build your own — and a small team can reach feature parity with the commercial tools. But you should not build it to save money at low volume. Build it because you want control, a niche workflow, or a product to sell.**

Three findings drive the recommendation:

1. **The commercial market is mature and cheap at low volume.** Entry plans run $9–$30/month; a 1,000-clip/month plan (Klap Pro+) is ~$94.50/month. Building a comparable tool costs 200–800 engineering hours plus ongoing maintenance. At fewer than ~300–500 source videos/month, buying is cheaper than building.
2. **The hard parts are no longer AI research.** Transcription, highlight detection, and reframing are commodity building blocks (Whisper, LLMs, MediaPipe/YOLO, ffmpeg). The real moat is **clip-selection quality, reframe accuracy, editor UX, and distribution/publishing** — i.e. product engineering, not ML research.
3. **A hybrid architecture wins.** Own the pipeline, editor, branding, and data; rent the intelligence (LLM APIs) and use open-source media tooling. This gets you to a usable product in ~6–10 weeks and a sellable SaaS in ~4–6 months with 2 developers.

**Recommended path:**

| Your goal | Recommendation |
|---|---|
| Clips for your own channel, < 30 videos/month | **Buy** Opus Clip / Klap / Vizard (or run the open-source repo locally) |
| Internal tool for an agency/team, 30–300 videos/month | **Build a thin internal tool** on open-source core (6–10 weeks) |
| Launch a commercial clipping SaaS | **Hybrid build** — own pipeline + editor + publishing + billing (4–6 months, 2 devs) |
| White-label fast, premium pricing | **Build on Klap/Vizard API** — viable only at agency prices ($99+/mo), because API costs are ~$8 per 10-clip video |

**Critical caveat:** the economics only work if you avoid reselling a vendor API at consumer prices. Klap's API is **$0.44 per input video + $0.32 per short + $0.48 per export** — roughly **$8.44 for one video cut into 10 exported shorts**. A $29/month consumer plan cannot absorb that. Your own pipeline costs **~$0.20–$0.60 per video** at scale.

---

## 2. Market landscape (verified pricing, November 2026)

### 2.1 Head-to-head

| Tool | Free tier | Paid entry | Scale tier | Notable strengths | Main weakness |
|---|---|---|---|---|---|
| **Opus Clip** | Yes (watermark, 1080p, 3-day export) | Starter **$15/mo**, Pro **$29/mo**, Business custom | Credit packs | Best-known brand; strongest AI feature set (virality score, auto hook, AI reframe, dynamic layouts, b-roll, dubbing, eye contact, speech cleanup); Premiere/Resolve export; API + MCP on Pro | Credits expire; best features gated to Pro/Business; credit pricing gets expensive at volume |
| **Klap** | Limited trial | **$14.50/mo** (100 clips, annual) | **$39.50/mo** (300 clips), **$94.50/mo** (1,000 clips) | Best price-per-clip; 99+ languages; unlimited social accounts; analytics on all plans; clean API ($0.44/video, $0.32/short, $0.48/export); MCP + Zapier/Make/n8n | Fewer editing/branding features than Opus; watermark on lower tiers |
| **Vizard** | 60 credits/mo, 720p, watermark | Creator (credit-based, up to 50% annual discount) | Business (credits, seats) | 10-hour uploads, 4K export, 100 clips per video, team brand kits, API, social scheduling, 30+ languages | Pricing is credit-opaque; some features behind Business |
| **Submagic** | Trial | ~₹666/mo (~$8) Starter, ~₹1,666 (~$19) Pro, ~₹4,999 (~$57) Business (India pricing) | Custom | Best-in-class animated captions and short-form editor; auto zoom, eye contact, bad-take removal, b-roll, translator; API | Clipping is secondary to captioning/editing; short source limits (2–30 min depending on plan) |
| **Choppity** | 45 min analysis | **$24/mo** (3 h), Creator **$32/mo** (5 h), Team **$48/mo** | Enterprise/white-label | Editor + scheduler + screen recorder in one; transcript editing; profanity censor; API/MCP | Less AI "wow" than Opus; analysis-hours model |
| **2short.ai** | 30 min/mo | **$9.90/mo** (5 h), Pro **$19.90/mo** (15 h), Premium **$49.90/mo** (50 h) | — | Cheapest unlimited 1080p exports; face tracking; brand presets; simple UX | Requires captions; lighter editing and branding |
| **CapCut / Descript / VEED** | Yes | $10–$30/mo | Team plans | General editors with auto-captions and some auto-clipping; huge ecosystems | Clipping is a side feature, not a focused workflow |

### 2.2 What buyers actually pay for

Across review sites and vendor positioning, the purchase drivers are consistently:

1. **Clip-selection quality** — does the AI find a self-contained moment with a hook and a payoff?
2. **Reframe accuracy** — is the active speaker centered, and does it handle two-person podcasts, gameplay, and screen shares?
3. **Caption quality and style** — word-level timing, templates, fonts, emoji, profanity handling, translation.
4. **Editing speed** — transcript-based editing, trim, split, undo; not a full NLE.
5. **Publishing** — direct post/schedule to YouTube Shorts, TikTok, Reels, LinkedIn, X, Facebook.
6. **Brand consistency** — brand kits, logos, intros/outros, custom fonts, templates.
7. **Volume economics** — credits/minutes that match real usage without surprise overages.

### 2.3 Open-source baseline

| Project | License | Stars | What it gives you |
|---|---|---|---|
| [AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) | MIT | ~6.5k | End-to-end CLI: yt-dlp → faster-whisper → LLM highlight ranking (GPT/Gemini) → ffmpeg + OpenCV face-tracking crop. Also has an API mode via MuAPI. Best starting reference. |
| [ClipsAI](https://github.com/ClipsAI/clipsai) | MIT | ~633 | Python library for transcript-based clip finding + speaker-aware reframing (WhisperX + pyannote). Good for audio-centric content. |
| faster-whisper / WhisperX | MIT / BSD | large | Fast ASR with word-level timestamps; WhisperX adds alignment + diarization. |
| ffmpeg | LGPL/GPL | — | Cutting, scaling, caption burn-in, NVENC encoding. |
| MediaPipe | Apache-2.0 | — | Face landmarks, face detection, tracking. |
| Remotion | Commercial license (free for individuals/small teams) | — | Programmatic motion-graphics rendering in React. Check license before commercial use. |
| Ultralytics YOLO | **AGPL-3.0** | — | Person/object detection. **AGPL is a problem for closed-source SaaS** — buy a commercial license or use an alternative (RF-DETR, YOLO-NAS, MediaPipe). |

The open-source repos prove the pipeline works, but they are **CLI tools, not products**: no editor, no brand kits, no publishing, no billing, no teams, no 4K, weak reframing, and brittle YouTube ingestion.

---

## 3. Build vs buy: the honest economics

### 3.1 Cost per 60-minute source video, 10 clips

Assumptions: 1080p source, 10 clips of 30–60 s, 1080×1920 output, burned captions, GPU worker at $0.34/hr (RTX 4090 class).

| Step | DIY resource | DIY cost |
|---|---|---|
| Ingest | upload / yt-dlp, ~1.5 GB | $0.01 |
| ASR | faster-whisper large-v3, ~6 min GPU | $0.03 |
| Diarization | pyannote, +2 min GPU | $0.01 |
| Highlight selection | ~25k input / 4k output tokens, Gemini 3.8 Flash ($0.75/$3.75 per 1M) | $0.03 |
| Reframe analysis | MediaPipe/YOLO, ~3 min | $0.02 |
| Render | ffmpeg + NVENC, ~4 min | $0.02 |
| Storage + CDN | ~500 MB-month + delivery | $0.05 |
| **Subtotal** | | **~$0.17** |
| **With retries/inefficiency (2–3×)** | | **~$0.35–$0.50** |

**Vendor API comparison (Klap):** $0.44 + (10 × $0.32) + (10 × $0.48) = **$8.44 per video**.
**Consumer plan comparison:** Klap Pro+ at **$94.50/mo for 1,000 clips** covers ~100 such videos — i.e. **~$0.95 per video**, cheaper than DIY at that volume once you count engineering time.

### 3.2 Fixed costs of building

| Item | Monthly |
|---|---|
| App hosting (Fly/Railway/Vercel) | $20–$60 |
| Postgres + Redis | $0–$50 |
| Object storage (Cloudflare R2, no egress) | $5–$30 |
| GPU (serverless, pay-per-second) | $10–$100 at 100–300 videos/mo |
| LLM/ASR APIs | $5–$50 |
| Monitoring/email/auth | $0–$40 |
| **Total** | **~$40–$330** |

Plus **one-time engineering**: ~250–450 hours for a solid internal MVP, ~1,200–2,000 hours for a commercial SaaS with editor, publishing, billing, and teams.

### 3.3 Break-even math

| Volume (videos/mo) | Buy (Klap plan/API) | DIY run cost | DIY wins after |
|---|---|---|---|
| 20 | ~$15–$40 | ~$40 + build time | Never (at low volume) |
| 100 | ~$95 (plan) / $844 (API) | ~$60–$100 | Only vs API, not vs plan |
| 500 | ~$450–$500 | ~$150–$250 | ~12–24 months (incl. build) |
| 2,000 | ~$1,800–$2,000 | ~$400–$700 | ~3–6 months |

**Conclusion:** build for **control, customization, compliance, or resale** — not for cost savings below ~500 videos/month.

---

## 4. The product: full feature specification ("everything the popular tools do")

This is the parity checklist. Group features into tiers so you can ship progressively.

### Tier 1 — Core clipping (must have)

- **Ingest:** local upload (up to 10–30 GB), YouTube URL, Google Drive, Dropbox, Zoom, Twitch, Vimeo, Rumble, direct MP4 URL, connected-channel auto-import.
- **Transcription:** 30–100+ languages, auto language detection, word-level timestamps, speaker diarization, custom vocabulary/brand terms, SRT/TXT/VTT export.
- **Clip detection:** LLM over transcript with an explicit virality rubric (hook, self-containedness, emotional peak, insight, conflict, quotable, story payoff, practical value); chunking with overlap for long videos; dedupe by overlap; configurable clip count and length buckets (0–1, 1–3, 3–5, 5–10, 10–15 min).
- **Scoring:** 0–100 virality score, hook sentence, one-line reason, suggested title/description/hashtags.
- **Prompt controls:** "clip by topic", "clip this timeframe", "make it shorter/punchier", reprompt/regenerate.
- **Reframe:** auto face/person tracking, active-speaker switching, smoothing, manual keyframe override, 9:16 / 1:1 / 4:5 / 16:9 / custom.
- **Captions:** animated word-level captions, 10–30 templates, font upload, colors, emoji, keyword highlighting, profanity censor (beep/mute/blur), bilingual captions.
- **Render/export:** 720p/1080p/2K/4K, 30/60 fps, watermark-free, bulk export, MP4 + SRT, Premiere Pro / DaVinci Resolve XML/EDL.

### Tier 2 — Editor and branding (the differentiator)

- Timeline editor with multi-track video/audio/text/overlay; transcript-based editing (delete words → cut video); split, trim, ripple, undo/redo.
- Layout engine: single speaker, split-screen podcast, screen-share + face, gameplay, dynamic layout switching, auto zoom, progress bars, transitions.
- Brand kit: logo, colors, fonts, intro/outro cards, watermark, saved templates (multiple per workspace), asset library (images, video, audio, SFX), brand vocabulary.
- Audio: silence/filler removal, bad-take removal, speech enhancement/denoise, loudness normalization, background music with ducking.
- AI extras: auto hook title, b-roll (stock + AI-generated), AI voice-over, dubbing/translation, eye-contact correction, video upscaling, sound effects.

### Tier 3 — Distribution and collaboration

- Publish/schedule to YouTube Shorts, TikTok, Instagram Reels, Facebook, LinkedIn, X, Pinterest, Threads, Bluesky; multi-account per platform; best-time suggestions.
- Shareable review links, comments, approvals, version history.
- Workspaces, seats, roles/permissions, sub-teams, collections, storage quotas, usage reporting.
- Analytics: views/engagement per clip and per platform, plus "which hooks/clips performed best" feedback into the model.

### Tier 4 — Platform and enterprise

- Public REST API + webhooks; Zapier/Make/n8n; MCP server; CMS integrations.
- White-label/embeddable editor; custom domains.
- SSO/SAML, SOC 2, MSA, data residency, retention controls, audit logs.
- On-prem/private deployment (a real differentiator for media companies and sports leagues).

---

## 5. Architecture blueprint

### 5.1 Pipeline

```
Ingest ──► Normalize ──► ASR + diarization ──► Transcript store
                                                   │
                              ┌────────────────────┴────────────────────┐
                              ▼                                         ▼
                    LLM highlight ranking                    Audio/visual signals
                    (chunk + overlap + dedupe)               (energy, laughter, faces,
                              │                               scene changes, emotion)
                              └────────────────┬────────────────────────┘
                                               ▼
                                      Candidate clips + scores
                                               ▼
                              Reframe plan (per-frame crop path)
                                               ▼
                         Render (ffmpeg filter graph / Remotion)
                                               ▼
                        Captions burn-in + brand kit + audio mix
                                               ▼
                                  MP4 / SRT / XML + thumbnails
                                               ▼
                                   Publish / schedule / analytics
```

### 5.2 Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js 15 (App Router), Tailwind, shadcn/ui | Fast iteration, good video UI ecosystem |
| Preview | Remotion Player | Frame-accurate preview of the same composition you render |
| API | Next route handlers or Fastify | Keep TypeScript end-to-end |
| Workers | Python + FastAPI + Celery/RQ (or Temporal at scale) | Media/ML ecosystem is Python |
| Queue | Redis + BullMQ / Celery | Simple, reliable; Temporal if you need durable long jobs |
| DB | Postgres (Neon/Supabase) + Prisma/Drizzle | Relational fits projects/clips/credits |
| Storage | Cloudflare R2 + CDN | Zero egress fees — critical for video |
| ASR | faster-whisper large-v3 (GPU); Gemini 3.5 Transcribe (~$0.005/min) as fallback | Cheap and accurate; no GPU required for fallback |
| Diarization | pyannote 3.1 (check model license) or Gemini transcribe diarization | Speaker-aware captions and reframing |
| LLM | Gemini 3.8 Flash (cheap, 1M context) or GPT-5-mini / Claude Haiku; structured JSON output | Segmentation quality at low cost |
| Vision | MediaPipe Face Landmarker + person detector + ByteTrack | Reframing without AGPL entanglements |
| Render | ffmpeg 7 + NVENC; Remotion for motion graphics | Speed and layout flexibility |
| Captions | libass/ASS for karaoke word highlighting | Fast, reliable burn-in |
| GPU | RunPod Serverless / Vast.ai (~$0.22–$0.34/hr 4090) | Pay-per-second, no idle cost |
| Billing | Stripe metered billing + credit ledger | Industry standard |
| Auth | Clerk or Better Auth | SSO later |
| Observability | Sentry + PostHog + Grafana | Errors, funnels, job latency |

### 5.3 Data model (minimum)

`users`, `workspaces`, `memberships`, `sources`, `transcripts`, `segments`, `clips`, `renders`, `brand_kits`, `templates`, `publications`, `social_accounts`, `credit_ledger`, `jobs`.

Every render should be reproducible from `(source_id, clip_spec_json, template_version, render_version)` — this makes retries, A/B tests, and bug reports tractable.

### 5.4 Quality harness (build this before the UI)

Create a benchmark of 10–20 long videos across niches (podcast, interview, tutorial, gaming, sermon, sports). For each, generate 5 clips and have 2–3 humans rate:

- Hook strength (1–5)
- Self-containedness (1–5)
- Payoff/emotion (1–5)
- Caption WER (%)
- Reframe accuracy (% of frames with active speaker in frame)
- Render time and cost

Track **precision@5** (how many of the 5 clips a human would actually post). This is your real product metric. Commercial tools typically land at 2–3 usable clips per 5 on podcast content; beating that is the entire game.

---

## 6. Build plan (phased, 20 weeks)

| Phase | Weeks | Deliverable | Exit criteria |
|---|---|---|---|
| 0. Benchmark | 1 | Test Opus/Klap/Vizard + open-source repo on 10 videos | Quality baseline and feature gap list |
| 1. CLI pipeline | 2–4 | URL/file → transcript → ranked clips → rendered MP4 with captions | 5 clips in < 10 min for a 60-min video; cost < $0.60 |
| 2. Web MVP | 5–7 | Auth, upload/URL, job queue, clip grid, preview, download | A non-technical user can go from URL to download unaided |
| 3. Editor v1 | 8–11 | Transcript editing, trim/split, caption styles, manual reframe, brand kit | 80% of clips need no external editor |
| 4. Publish + billing | 12–15 | YouTube/TikTok/IG OAuth, scheduler, Stripe credits, usage dashboard | First paying customer / first scheduled post |
| 5. Quality | 16–18 | Active-speaker reframe, dynamic layouts, audio-energy scoring, multilingual | Precision@5 improves by ≥30% vs Phase 1 |
| 6. Scale/enterprise | 19–20+ | API, webhooks, MCP, teams/roles, SSO, SOC 2 prep | Agency/enterprise pilot signed |

**Team:** 1 full-stack + 1 media/ML engineer is enough for Phases 0–4. Add a designer for the editor and a DevOps/SRE profile for Phase 6.

**What to build vs buy:**

| Build | Buy/use |
|---|---|
| Clip ranking prompt + rubric + dedupe | LLM API (Gemini/OpenAI) |
| Reframe/tracking + smoothing | MediaPipe/OpenCV primitives |
| Caption renderer + templates | libass / Remotion |
| Editor UX and project schema | — |
| Publishing adapters + retry logic | Platform APIs |
| Billing/credits | Stripe |
| Queue, storage, observability | Managed services |
| ASR | faster-whisper (self-host) |

---

## 7. Legal and platform risk (read before you ship)

> Not legal advice. Get counsel for your jurisdiction and business model.

### 7.1 YouTube ingestion

- YouTube's Terms of Service prohibit accessing content through unauthorized automated means and downloading content except as the Service permits. Tools like yt-dlp also circumvent technical protection measures, which creates **DMCA §1201 exposure in the US** even where the underlying use might be fair use.
- Datacenter IPs are aggressively blocked, so scraping at scale is both legally and operationally fragile.
- **Safer ingestion paths:**
  1. **User uploads their own file** (default for a product).
  2. **OAuth "connect your channel"** and use the official **YouTube Data API** — `captions.download` requires permission to edit the video, so it only works for the user's own channel.
  3. **YouTube Studio export** for the user's own videos.
  4. Written license/permission from the rights holder (agencies, podcasts, sports).
- If you accept public URLs, require an attestation that the user owns or is licensed to use the content, log it, and provide a takedown process. Consider a licensed ingestion vendor instead of yt-dlp for commercial use.

### 7.2 Copyright and monetization

- Clipping someone else's video does not become legal because you added captions. Fair use/fair dealing is a defense, not a permission, and outcomes are fact-specific.
- YouTube's **reused content** monetization policy is stricter than copyright: channels that repackage existing content without "significant original commentary, substantive modifications, or educational or entertainment value" can be demonetized **even with the original creator's permission**. The policy explicitly says it "applies even if you have permission from the original creator."
- **Product implication:** position the tool for creators clipping **their own** long-form content, or for licensed/agency work with transformative additions (commentary, narrative, edits). Build compliance features: ownership attestation, license upload, "own-channel only" mode, transformation checklist, and audit logs.

### 7.3 Other risks

| Risk | Mitigation |
|---|---|
| YouTube changes break yt-dlp | Upload-first; adapter layer; proxy pool; monitor failure rate; fallback vendors |
| Platform API changes (TikTok/IG) | Adapter pattern; feature flags; graceful degradation to download-only |
| GPU scarcity/cost | Serverless GPU + CPU fallback (Gemini Transcribe) |
| LLM cost spikes | Chunking, caching, cheaper models for classification, batch API |
| Model license traps (YOLO AGPL, pyannote weights) | License audit before launch; prefer Apache/MIT components |
| Privacy/GDPR | Data residency, retention controls, DPA, deletion API |
| Quality expectations | Human-in-the-loop editor + benchmark harness |

---

## 8. Business model and differentiation

### 8.1 Pricing that works

| Segment | Price | Included |
|---|---|---|
| Free | $0 | 30–60 min analysis, watermark, 720p |
| Creator | $15–$25/mo | 3–5 h analysis, 1080p, no watermark, 1 brand kit |
| Pro | $39–$59/mo | 10–15 h, 4K, 3 brand kits, scheduling, API |
| Agency | $99–$249/mo | 30–50 h, 10 seats, white-label, priority render |
| Enterprise | Custom | SSO, on-prem, MSA, custom models |

Use **credits tied to source minutes**, not "clips", because clip count is unpredictable and creates support burden. Show a live cost estimate before processing.

### 8.2 Where a new entrant can win

1. **Niche verticals** — sermons, sports commentary, education, real estate, legal/finance podcasts. Generic tools under-serve layout, vocabulary, and compliance needs.
2. **Reframe quality** — two-person podcasts, gameplay, and screen-share are still weak across the market.
3. **Editor depth** — most tools stop at "trim + captions". A fast transcript editor with real branding wins agencies.
4. **Compliance-first** — "clip your own channel" with OAuth, license tracking, and audit logs is a defensible B2B angle.
5. **On-prem/private** — media companies and sports leagues will pay for it.
6. **API/white-label** — sell the pipeline to other SaaS builders (but price for the $0.20–$0.50/video cost, not the $8 vendor cost).
7. **Language coverage** — 30–100 languages with quality localization and dubbing.

### 8.3 What not to compete on

- Raw "number of clips" — commoditized.
- Template count — easy to copy.
- Being cheapest — 2short.ai and Klap already anchor low.
- Building your own ASR or LLM — no advantage, high cost.

---

## 9. Recommendation

**For most people asking this question: do not build from scratch. Either buy, or build a thin layer on top of an open-source pipeline.**

**If you want to own the tool, build this exact scope first:**

1. Upload or own-channel OAuth (skip public-URL scraping at launch).
2. faster-whisper + LLM ranking with a strong rubric and dedupe.
3. ffmpeg render with active-speaker reframe and 3 caption templates.
4. A simple web app: project list → clip grid → preview → download.
5. One brand kit.
6. Benchmark harness and cost dashboard.

That is ~6–10 weeks for one experienced full-stack + media engineer, costs ~$0.35/video to run, and already beats the open-source repos on usability. Add editor, publishing, billing, and teams only after you have 10 real users giving feedback.

**Do not start with:** a timeline editor, 20 caption templates, social scheduling, or a credit system. Those are Phase 3–4. The risk is building a beautiful editor that surfaces mediocre clips.

---

## 10. Decision checklist

Answer these before writing code:

1. Is this for **your own content**, an **agency's clients**, or **resale**?
2. How many source videos per month, and how long are they?
3. Do you need **public URL ingestion**, or can users upload / connect their channel?
4. Which platforms must publish directly vs download-only?
5. Is a **human editor** in the loop, or must it be fully automatic?
6. What is the quality bar — "good enough to post" or "better than Opus"?
7. Do you have GPU access, or must it run serverless/CPU-only?
8. What is the budget for build (hours) and run (per month)?

If (2) is under ~300 videos/month and (7) is "no GPU", buy or use an API. If (1) is resale, build the pipeline and price at agency levels.

---

## Sources

- Opus Clip pricing and feature matrix — https://www.opus.pro/pricing
- Klap pricing — https://klap.app/pricing
- Klap API pricing and docs — https://docs.klap.app/
- Vizard pricing and API — https://vizard.ai/pricing, https://vizard.ai/api
- Submagic pricing — https://www.submagic.co/pricing
- Choppity pricing — https://www.choppity.com/pricing/
- 2short.ai pricing — https://2short.ai/pricing
- Open-source pipeline — https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator
- ClipsAI library — https://github.com/ClipsAI/clipsai
- Gemini API pricing (Gemini 3.8 Flash, Gemini 3.5 Transcribe) — https://ai.google.dev/gemini-api/docs/pricing
- RunPod GPU pricing (RTX 4090 ~$0.34/hr) — https://www.runpod.io/pricing
- YouTube Terms of Service — https://www.youtube.com/t/terms
- YouTube channel monetization policies (reused content) — https://support.google.com/youtube/answer/1311392
- YouTube Data API captions.download — https://developers.google.com/youtube/v3/docs/captions/download
- Copyright on YouTube — https://support.google.com/youtube/answer/2797466
