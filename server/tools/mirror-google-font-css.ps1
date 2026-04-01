param(
    [Parameter(Mandatory = $true)][string]$GoogleCssUrl,
    [Parameter(Mandatory = $true)][string]$OutCssPath
)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $OutCssPath
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
$css = (Invoke-WebRequest -Uri $GoogleCssUrl -UseBasicParsing -Headers @{ 'User-Agent' = $ua }).Content
$urls = [regex]::Matches($css, 'url\((https://fonts\.gstatic\.com[^)]+)\)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
foreach ($u in $urls) {
    $uri = [Uri]$u
    $rel = $uri.AbsolutePath.TrimStart('/')
    $relFs = $rel -replace '/', [IO.Path]::DirectorySeparatorChar
    $local = Join-Path $dir (Join-Path 'gstatic' $relFs)
    $parent = Split-Path -Parent $local
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (-not (Test-Path $local)) {
        Invoke-WebRequest -Uri $u -OutFile $local -UseBasicParsing -Headers @{ 'User-Agent' = $ua }
    }
    $css = $css.Replace($u, 'gstatic/' + $rel)
}
[IO.File]::WriteAllText($OutCssPath, $css)
Write-Host "Saved $OutCssPath ($($urls.Count) font files)"
