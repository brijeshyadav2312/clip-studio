# Command line use:
#   .\clip.ps1 "https://youtube.com/watch?v=..." --clips 5 --style hormozi
#   .\clip.ps1 "C:\Videos\podcast.mp4" --clips 3 --min 25 --max 50
param([Parameter(Position = 0, Mandatory = $true)][string]$Source)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:PYTHONPATH = $PSScriptRoot
& .\.venv\Scripts\python.exe -m clipping.cli $Source @args
