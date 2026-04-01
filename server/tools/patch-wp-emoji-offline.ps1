$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $PSScriptRoot }
$files = Get-ChildItem -LiteralPath $root -Recurse -Include *.html,*.htm -File
$n = 0
foreach ($f in $files) {
    $t = [IO.File]::ReadAllText($f.FullName)
    if ($t -notmatch 's\.w\.org') { continue }
    $o = $t
    $t = $t -replace '"baseUrl":"https:\\/\\/s\.w\.org\\/images\\/core\\/emoji\\/[^"]+"', '"baseUrl":""'
    $t = $t -replace '"svgUrl":"https:\\/\\/s\.w\.org\\/images\\/core\\/emoji\\/[^"]+"', '"svgUrl":""'
    if ($t -ne $o) { [IO.File]::WriteAllText($f.FullName, $t); $n++ }
}
Write-Host "Emoji CDN stripped: $n files"
