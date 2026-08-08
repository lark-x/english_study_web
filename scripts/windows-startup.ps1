param(
  [ValidateSet("install", "remove")]
  [string]$Action = "install"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot "START_ENGLISH.cmd"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$valueName = "DailyEnglishLocalStudy"

if ($Action -eq "remove") {
  Remove-ItemProperty -Path $runKey -Name $valueName -ErrorAction SilentlyContinue
  Write-Output "Removed Daily English startup entry."
  exit 0
}

$command = '"' + $launcher + '"'
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name $valueName -Value $command -PropertyType String -Force | Out-Null
Write-Output "Installed Daily English startup entry for the current Windows user."
