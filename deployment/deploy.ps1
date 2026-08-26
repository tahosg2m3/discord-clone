[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$AllowDirty,
  [string]$InstallerPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deployBase = [IO.Path]::GetFullPath((Join-Path $repoRoot '.deploy'))
$releaseId = Get-Date -Format 'yyyyMMdd-HHmmss'
$stageRoot = [IO.Path]::GetFullPath((Join-Path $deployBase $releaseId))
$webStage = Join-Path $stageRoot 'web'
$backendArchive = Join-Path $stageRoot "tahosapp-backend-$releaseId.tar.gz"
$webArchive = Join-Path $stageRoot "tahosapp-web-$releaseId.tar.gz"
$remoteHost = '188.191.107.157'
$remoteUser = 'tahosdeploy'
$sshKey = 'C:\Users\User\.ssh\tahosapp_deploy_ed25519'
$knownHosts = 'C:\Users\User\.ssh\tahosapp_known_hosts'

if (-not $stageRoot.StartsWith($deployBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Gecici dagitim klasoru proje sinirlari disinda.'
}

if (-not (Test-Path -LiteralPath $sshKey -PathType Leaf)) {
  throw "SSH anahtari bulunamadi: $sshKey"
}

$resolvedInstaller = ''
$installerHash = ''
if ($InstallerPath) {
  $resolvedInstaller = [IO.Path]::GetFullPath($InstallerPath)
  if (-not (Test-Path -LiteralPath $resolvedInstaller -PathType Leaf) -or [IO.Path]::GetExtension($resolvedInstaller) -ne '.exe') {
    throw 'Gecerli bir Windows .exe kurulum dosyasi secmelisin.'
  }
  $installerHash = (Get-FileHash -LiteralPath $resolvedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
}

if (-not $AllowDirty) {
  $changes = & git -C $repoRoot status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'Git durumu okunamadi.' }
  if ($changes) {
    throw "Kaydedilmemis degisiklikler var. Once git add/commit yap veya bilincli olarak -AllowDirty kullan."
  }
}

if (-not $SkipBuild) {
  & npm.cmd --prefix $repoRoot run build:frontend
  if ($LASTEXITCODE -ne 0) { throw 'Web uygulamasi derlenemedi.' }
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'frontend\dist\index.html'))) {
  throw 'frontend/dist bulunamadi. Dagitimdan once web derlemesi gerekli.'
}

New-Item -ItemType Directory -Path $webStage -Force | Out-Null
$packageVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
$landingHtml = Get-Content -LiteralPath (Join-Path $repoRoot 'deployment\site\index.html') -Raw
$landingHtml = [regex]::Replace($landingHtml, 'v\d+\.\d+\.\d+ · Windows', "v$packageVersion · Windows")
if ($installerHash) {
  $landingHtml = [regex]::Replace($landingHtml, 'SHA-256: <code>[a-fA-F0-9]{64}</code>', "SHA-256: <code>$installerHash</code>")
}
[IO.File]::WriteAllText((Join-Path $webStage 'index.html'), $landingHtml, [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $repoRoot 'installer\tahosapp.ico') -Destination (Join-Path $webStage 'tahosapp.ico')
Copy-Item -LiteralPath (Join-Path $repoRoot 'frontend\dist') -Destination (Join-Path $webStage 'app') -Recurse

& tar.exe -czf $backendArchive -C (Join-Path $repoRoot 'backend') package.json package-lock.json src
if ($LASTEXITCODE -ne 0) { throw 'Backend arsivi olusturulamadi.' }
& tar.exe -czf $webArchive -C $webStage .
if ($LASTEXITCODE -ne 0) { throw 'Web arsivi olusturulamadi.' }

$sshOptions = @(
  '-i', $sshKey,
  '-o', "UserKnownHostsFile=$knownHosts",
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'BatchMode=yes'
)
$remote = "${remoteUser}@${remoteHost}"
$remoteBackend = "/tmp/$(Split-Path -Leaf $backendArchive)"
$remoteWeb = "/tmp/$(Split-Path -Leaf $webArchive)"
$remoteScript = "/tmp/tahosapp-server-deploy-$releaseId.sh"
$remoteInstaller = '-'

& scp @sshOptions $backendArchive "${remote}:$remoteBackend"
if ($LASTEXITCODE -ne 0) { throw 'Backend sunucuya yuklenemedi.' }
& scp @sshOptions $webArchive "${remote}:$remoteWeb"
if ($LASTEXITCODE -ne 0) { throw 'Web uygulamasi sunucuya yuklenemedi.' }
& scp @sshOptions (Join-Path $repoRoot 'deployment\tahosapp-server-deploy.sh') "${remote}:$remoteScript"
if ($LASTEXITCODE -ne 0) { throw 'Sunucu dagitim yardimcisi yuklenemedi.' }

if ($InstallerPath) {
  $remoteInstaller = "/tmp/tahosapp-$releaseId.exe"
  & scp @sshOptions $resolvedInstaller "${remote}:$remoteInstaller"
  if ($LASTEXITCODE -ne 0) { throw 'Kurulum dosyasi sunucuya yuklenemedi.' }
}

& ssh @sshOptions $remote "sudo bash $remoteScript $releaseId $remoteBackend $remoteWeb $remoteInstaller"
if ($LASTEXITCODE -ne 0) { throw 'Sunucu saglik kontrolu basarisiz oldu; onceki surum korunuyor.' }

Write-Host ''
Write-Host "Yayin tamamlandi: $releaseId" -ForegroundColor Green
Write-Host 'Web: https://tahosapp.com.tr'
Write-Host 'Uygulama: https://tahosapp.com.tr/app/'
