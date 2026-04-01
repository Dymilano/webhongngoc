$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $PSScriptRoot }
$n = 0
Get-ChildItem -LiteralPath $root -Recurse -Include *.html,*.htm -File | ForEach-Object {
    $t = [IO.File]::ReadAllText($_.FullName)
    if ($t -notmatch 'mona-winery\.monamedia') { return }
    $o = $t
    $t = $t -replace 'https://mona-winery\.monamedia\.net', ''
    if ($t -ne $o) {
        [IO.File]::WriteAllText($_.FullName, $t)
        $n++
    }
}
Write-Host "Patched: $n"
