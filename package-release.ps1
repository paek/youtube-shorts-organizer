$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtDir = Join-Path $Root "extension"
$ManifestPath = Join-Path $ExtDir "manifest.json"
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = $Manifest.version

$DistDir = Join-Path $Root "dist"
$StageDir = Join-Path $DistDir "youtube-shorts-organizer-v$Version"
$ZipPath = Join-Path $DistDir "youtube-shorts-organizer-v$Version.zip"

if (Test-Path -LiteralPath $StageDir) { Remove-Item -LiteralPath $StageDir -Recurse -Force }
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

# Copy only runtime extension files (exclude dev profile, Chrome metadata cache, dev launcher)
robocopy $ExtDir $StageDir /E /XD ".chrome-profile" "_metadata" /XF "run-dev-chrome.bat" /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# Include license and quick install instructions inside the ZIP
Copy-Item -LiteralPath (Join-Path $Root "LICENSE") -Destination (Join-Path $StageDir "LICENSE") -Force

$installText = @"
YouTube Shorts Organizer & Learning Player v$Version
====================================================

[설치 방법 / How to Install]
1. 이 ZIP 파일의 압축을 원하는 폴더에 풉니다.
   (Extract this ZIP file to any folder.)
2. Chrome 주소창에 chrome://extensions 입력 후 우측 상단 '개발자 모드'를 켭니다.
   (Open chrome://extensions in Chrome and turn ON 'Developer mode'.)
3. 좌측 상단 '압축해제된 확장 프로그램 로드'를 클릭하고 압축을 푼 폴더를 선택합니다.
   (Click 'Load unpacked' and select the extracted folder.)
4. YouTube Shorts 페이지를 열면 우측 상단에 YT Organizer가 표시됩니다.
   (Open any YouTube Shorts page to use YT Organizer.)

License: GNU GPL v3.0 (see LICENSE)
"@
Set-Content -LiteralPath (Join-Path $StageDir "INSTALL.txt") -Value $installText -Encoding UTF8

Compress-Archive -Path "$StageDir\*" -DestinationPath $ZipPath -Force
Remove-Item -LiteralPath $StageDir -Recurse -Force

Write-Output "Created release package: $ZipPath"
