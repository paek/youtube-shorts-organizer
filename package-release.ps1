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

[주요 사용법 / Quick Tips]
- 헤더 드래그: 위치 이동 (자동 저장) / 더블클릭: 기본 위치 복원
- ↗ 버튼 또는 툴바 아이콘 클릭: 브라우저 밖 독립 창으로 분리
- 제어 탭: 반복(종료 2초 후 자동 넘김), 배속, A-B 루프, 메모, 광고/스폰서 자동 넘김
- ★ 즐겨찾기 탭: 즐겨찾기만 연속재생 (랜덤/순서)
- 🎵 음악/자막 탭: 곡 제목 번역·YouTube 원곡 듣기, CC 자막·가사 번역
  (실시간 자막 바는 기본 OFF이며 '실시간 자막 바 표시' 체크 시 활성화됩니다)

iOS Safari / Android guide: https://github.com/paek/youtube-shorts-organizer
License: GNU GPL v3.0 (see LICENSE)
"@
Set-Content -LiteralPath (Join-Path $StageDir "INSTALL.txt") -Value $installText -Encoding UTF8

Compress-Archive -Path "$StageDir\*" -DestinationPath $ZipPath -Force
Remove-Item -LiteralPath $StageDir -Recurse -Force

Write-Output "Created release package: $ZipPath"
