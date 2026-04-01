$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $PSScriptRoot }

# Đổi tên file còn *
Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object { $_.Name -like '*' } |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
        $newName = ($_.Name -replace '"<>|]+$', '')
        if ($newName -eq $_.Name) { return }
        $dest = Join-Path $_.DirectoryName $newName
        if (Test-Path -LiteralPath $dest) {
            $ex = Get-Item -LiteralPath $dest
            if ($_.Length -gt $ex.Length) {
                Remove-Item -LiteralPath $dest -Force
                Rename-Item -LiteralPath $_.FullName -NewName $newName
            } else { Remove-Item -LiteralPath $_.FullName -Force }
        } else { Rename-Item -LiteralPath $_.FullName -NewName $newName }
    }

$ext = @('*.html', '*.htm', '*.css', '*.js', '*.json')
$files = Get-ChildItem -LiteralPath $root -Recurse -Include $ext -File
$n = 0
foreach ($f in $files) {
    try {
        $t = [IO.File]::ReadAllText($f.FullName)
        if ($t -notmatch 'coutura\.monamedia|') { continue }
        $o = $t
        $t = $t -replace 'https:\\/\\/coutura\.monamedia\.net', ''
        $t = $t -replace 'http:\\/\\/coutura\.monamedia\.net', ''
        $t = $t -replace 'https://coutura\.monamedia\.net', ''
        $t = $t -replace 'http://coutura\.monamedia\.net', ''
        $t = $t -replace '//coutura\.monamedia\.net', ''
        $t = $t -replace 'https%3A%2F%2Fcoutura\.monamedia\.net%2F', '%2F'
        $t = $t -replace 'https%3A%2F%2Fcoutura\.monamedia\.net', ''
        $t = $t -replace '"''\s<>&\)]+', ''
        $t = $t -creplace '\"''\s<>&\)]*', ''
        $t = $t -creplace '"''\s<>&\)]*', ''
        if ($t -ne $o) {
            [IO.File]::WriteAllText($f.FullName, $t)
            $n++
        }
    } catch {}
}
Write-Host "Patched files: $n"
