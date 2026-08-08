$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$stdout = Join-Path $runtimeDir "server.out.log"
$stderr = Join-Path $runtimeDir "server.err.log"
$node = (Get-Command node.exe -ErrorAction Stop).Source

# launch.mjs owns dependency checks, browser opening, and the long-running server.
Start-Process -FilePath $node `
  -ArgumentList @("scripts\launch.mjs") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr | Out-Null
