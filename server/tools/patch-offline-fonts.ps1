$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $PSScriptRoot }

$latin = "/wp-content/uploads/local-fonts/work-sans-latin.css"
$viet = "/wp-content/uploads/local-fonts/work-sans-jost-vietnamese.css"
$roboto = "/wp-content/uploads/local-fonts/work-sans-roboto.css"

$htmlFiles = Get-ChildItem -LiteralPath $root -Recurse -Include *.html,*.htm -File
$n = 0
foreach ($f in $htmlFiles) {
    try {
        $t = [IO.File]::ReadAllText($f.FullName)
        if ($t -notmatch 'fonts\.googleapis|fonts\.gstatic|gmpg\.org') { continue }
        $o = $t
        $t = $t -replace "<link rel='dns-prefetch' href='https://fonts\.googleapis\.com/' />\r?\n?", ''
        $t = $t -replace "<link rel='dns-prefetch' href='//fonts\.googleapis\.com' />\r?\n?", ''
        $t = $t -replace "<link rel=`"preconnect`" href=`"https://fonts\.gstatic\.com/`" crossorigin>", ''
        $t = $t -replace "<link rel='stylesheet' id='nasa-fonts-css' href='https://fonts\.googleapis\.com[^']+'", "<link rel='stylesheet' id='nasa-fonts-css' href='$latin'"
        $t = $t -replace "<link rel='stylesheet' id='google-fonts-1-css' href='https://fonts\.googleapis\.com[^']+'", "<link rel='stylesheet' id='google-fonts-1-css' href='$viet'"
        $t = $t -replace '<link href="https://fonts\.googleapis\.com/css\?family=Work\+Sans[^"]*"', "<link href=`"$roboto`""
        $t = $t -replace 'https://fonts\.googleapis\.com/css\?family=[^"''\s>]+', $roboto
        $t = $t -replace 'http://gmpg\.org/xfn/11', '#'
        if ($t -ne $o) {
            [IO.File]::WriteAllText($f.FullName, $t)
            $n++
        }
    } catch {}
}
Write-Host "HTML patched: $n"

# CSS @import google fonts
$cssFiles = Get-ChildItem -LiteralPath $root -Recurse -Include *.css -File
$c = 0
foreach ($f in $cssFiles) {
    try {
        $t = [IO.File]::ReadAllText($f.FullName)
        if ($t -notmatch '@import.*fonts\.googleapis') { continue }
        $o = $t
        $t = $t -replace '@import\s+url\([^\)]*fonts\.googleapis\.com[^\)]*\)[^;]*;?', ''
        if ($t -ne $o) {
            [IO.File]::WriteAllText($f.FullName, $t)
            $c++
        }
    } catch {}
}
Write-Host "CSS @import stripped: $c"
