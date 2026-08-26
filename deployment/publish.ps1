[CmdletBinding()]
param(
  [string]$InstallerPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$changes = & git -C $repoRoot status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Git durumu okunamadi.' }
if ($changes) {
  throw 'Once degisiklikleri git add ve git commit ile kaydetmelisin.'
}

& git -C $repoRoot push
if ($LASTEXITCODE -ne 0) { throw 'GitHub push basarisiz oldu; sunucu guncellenmedi.' }

$deployArguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', (Join-Path $PSScriptRoot 'deploy.ps1')
)
if ($InstallerPath) {
  $deployArguments += @('-InstallerPath', $InstallerPath)
}

& powershell @deployArguments
if ($LASTEXITCODE -ne 0) { throw 'Canli sunucu dagitimi basarisiz oldu.' }
