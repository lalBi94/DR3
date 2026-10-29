param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Archive,
  [Parameter(Mandatory = $true)][string]$Notes,
  [switch]$Prerelease
)

$ErrorActionPreference = 'Stop'
$repository = 'lalBi94/DR3'
if ($Version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$') { throw 'Version attendue : X.Y.Z ou X.Y.Z-beta.1.' }
if ($Version.Contains('-') -and -not $Prerelease) { throw 'Une version suffixée nécessite -Prerelease.' }
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
$notesPath = (Resolve-Path -LiteralPath $Notes).Path
$notesText = [IO.File]::ReadAllText($notesPath, [Text.Encoding]::UTF8)
if ([string]::IsNullOrWhiteSpace($notesText)) { throw 'Les notes de version sont obligatoires.' }
if ([IO.Path]::GetExtension($archivePath) -ne '.zip') { throw 'Une archive ZIP Windows est attendue.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $hasExecutable = $false
  foreach ($entry in $zip.Entries) {
    $path = $entry.FullName.Replace('\', '/')
    if ($path -match '(^|/)(\.\.|\.git|src|tests|node_modules|dress3_data)(/|$)|(^|/)\.env([^/]*$)|\.(jsx|tsx|map)$|(^|/)(package\.json|pnpm-lock\.yaml|clothing\.json|fit-memory\.json)$') {
      throw "Contenu interdit dans la distribution : $path"
    }
    if ($path.EndsWith('.exe', [StringComparison]::OrdinalIgnoreCase)) { $hasExecutable = $true }
  }
  if (-not $hasExecutable) { throw 'Aucun exécutable dans cette archive.' }
} finally { $zip.Dispose() }

$token = $env:GITHUB_TOKEN
if (-not $token) {
  $credential = "protocol=https`nhost=github.com`n`n" | git credential fill
  foreach ($line in $credential) { if ($line.StartsWith('password=')) { $token = $line.Substring(9) } }
}
if (-not $token) { throw 'Authentification GitHub requise (GITHUB_TOKEN ou gestionnaire Git).' }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'Dress3-release-publisher' }
$api = "https://api.github.com/repos/$repository"
$tag = "v$Version"
$assetName = "Dress3-$Version-windows.zip"
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $archivePath).Length
$manifest = @{
  schemaVersion = 1; version = $Version; platform = 'windows'; prerelease = [bool]$Prerelease
  url = "https://github.com/$repository/releases/download/$tag/$assetName"
  sha256 = $hash; size = $size
  releaseNotesUrl = "https://github.com/$repository/releases/tag/$tag"
} | ConvertTo-Json

# Aucun remplacement d'une release existante : l'API refuse un tag déjà publié.
$body = @{ tag_name = $tag; name = "Dress 3 $Version"; body = $notesText; draft = $true; prerelease = [bool]$Prerelease } | ConvertTo-Json
$release = Invoke-RestMethod -Method Post -Uri "$api/releases" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
$upload = $release.upload_url -replace '\{.*$', ''
Invoke-RestMethod -Method Post -Uri "${upload}?name=$assetName" -Headers $headers -ContentType 'application/zip' -InFile $archivePath | Out-Null
Invoke-RestMethod -Method Post -Uri "${upload}?name=update.json" -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($manifest)) | Out-Null
Invoke-RestMethod -Method Patch -Uri "$api/releases/$($release.id)" -Headers $headers -ContentType 'application/json' -Body '{"draft":false}' | Out-Null
Write-Output "Version publiée : https://github.com/$repository/releases/tag/$tag"
