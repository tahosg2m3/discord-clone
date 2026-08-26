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

if (-not $InstallerPath) {
  $packageVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
  $candidateInstaller = Join-Path $repoRoot "release\tahosapp-Setup-$packageVersion.exe"
  $candidateManifest = Join-Path $repoRoot 'release\latest.yml'
  $candidateBlockmap = "$candidateInstaller.blockmap"
  $hasInstaller = Test-Path -LiteralPath $candidateInstaller -PathType Leaf
  $hasManifest = Test-Path -LiteralPath $candidateManifest -PathType Leaf
  $hasBlockmap = Test-Path -LiteralPath $candidateBlockmap -PathType Leaf
  if ($hasInstaller -and $hasManifest -and $hasBlockmap) {
    $InstallerPath = $candidateInstaller
  }
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
