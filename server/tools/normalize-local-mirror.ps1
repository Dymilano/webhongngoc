# Chuẩn hóa bản sao tĩnh: đổi tên file  gỡ query  trong nội dung, trỏ domain về local.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $PSScriptRoot }

Write-Host "Root: $root"

# 1) Đổi tên file ... -> tên gốc (ưu tiên bản không @ nếu trùng: giữ file lớn hơn)
$renamed = 0
Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '@ver=' } |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
        $dir = $_.DirectoryName
        $newName = ($_.Name -replace '"<>|]+$', '')
        if ($newName -eq $_.Name) { return }
        $dest = Join-Path $dir $newName
        if (Test-Path -LiteralPath $dest) {
            $ex = Get-Item -LiteralPath $dest
            if ($_.Length -gt $ex.Length) {
                Remove-Item -LiteralPath $dest -Force
                Rename-Item -LiteralPath $_.FullName -NewName $newName
                $renamed++
            } else {
                Remove-Item -LiteralPath $_.FullName -Force
            }
        } else {
            Rename-Item -LiteralPath $_.FullName -NewName $newName
            $renamed++
        }
    }
Write-Host "Renamed/skipped @ver files: $renamed"

# 2) Thay thế trong nội dung
$ext = @('*.html', '*.htm', '*.css', '*.js', '*.json', '*.xml')
$files = Get-ChildItem -LiteralPath $root -Recurse -Include $ext -File -ErrorAction SilentlyContinue
$count = 0
foreach ($f in $files) {
    try {
        $t = [IO.File]::ReadAllText($f.FullName)
        $o = $t
        # Domain gốc -> đường dẫn gốc site
        $t = $t -replace 'https://coutura\.monamedia\.net', ''
        $t = $t -replace 'http://coutura\.monamedia\.net', ''
        $t = $t -replace '//coutura\.monamedia\.net', ''
        # Bỏ cache-bust query (WordPress)
        $t = $t -replace '\&"''\s<>)]*', ''
        $t = $t -replace '&"''\s<>)]*', ''
        $t = $t -replace '\&"''\s<>)]*', ''
        $t = $t -replace '&"''\s<>)]*', ''
        # Google Fonts -> thư mục local (sau khi đã mirror)
        if ($t -ne $o) {
            [IO.File]::WriteAllText($f.FullName, $t)
            $count++
        }
    } catch {}
}
Write-Host "Updated text files: $count"
