# YouTube Shorts Organizer — Extension 개발 및 로드 안내

이 폴더는 Chrome / Edge / Brave / Safari Web Extension(Manifest V3)용 확장 프로그램 소스 폴더입니다.
일반 사용자 설치 및 기능 사용법은 루트의 [README.ko.md](../README.ko.md) / [README.md](../README.md) 및 [SAFARI_IOS_SETUP.md](../SAFARI_IOS_SETUP.md)를 참고하세요.

## 개발용 로드 방법

### 방법 1: 수동 로드 (권장 — Chrome 137+ 포함 모든 버전 지원)
1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** ON
3. 좌측 상단 **압축해제된 확장 프로그램 로드** 클릭 → 이 `extension` 폴더 선택
4. 코드 수정 후에는 `chrome://extensions`에서 **새로고침(↻)** 클릭 → 열려 있는 YouTube 탭 **F5**

### 방법 2: `run-dev-chrome.bat` (Windows 테스트 프로필 실행)
* 평소 쓰는 Chrome 프로필과 분리된 `.chrome-profile/`로 Chrome을 띄웁니다.
* *(참고: 최신 일반 Chrome 안정판에서는 보안 정책으로 `--load-extension`이 무시될 수 있으므로, 처음 1회만 `chrome://extensions`에서 이 폴더를 수동 로드해 두면 이후 계속 유지됩니다.)*

## 주요 파일 구성
* `manifest.json` — 확장 메타데이터, 버전(단일 기준), 권한, `www.youtube.com` / `m.youtube.com` 매칭
* `background/service-worker.js` — 번역(`translate.googleapis.com`), 가사(LRCLIB), YouTube 자막(`CC`)·공식 음악 카드 추출, 독립 창(`detached/`) 관리 및 툴바 아이콘 클릭 핸들러
* `content/youtube-adapter.js` — YouTube 데스크톱/모바일 DOM 접근 격리 계층 (영상·제목·채널·음악·광고/스폰서 감지·다음 쇼츠 이동)
* `content/player-controller.js` — 반복 횟수, 배속 유지, A-B 구간 반복, 영상 종료 2초 후 자동 넘김 상태 머신
* `content/storage.js` — `chrome.storage.local` 설정·즐겨찾기·메모 저장소
* `content/floating-panel.js` / `floating-panel.css` — Shadow DOM 격리 3탭 플로팅 UI (드래그 이동·위치 저장·창 분리)
* `content/content-script.js` — 모듈 연결 및 독립 창 실시간 양방향 동기화
* `content/ad-skip.js` & `rules/ad-block-rules.json` — 일반 YouTube 영상 광고 스킵(`광고/스폰서 자동 넘김` 체크박스 연동) 및 광고 도메인 차단 규칙
* `detached/` — 브라우저 밖 독립 팝업 창 UI (`detached.html`, `detached.css`, `detached.js`)
* `icons/` — 16/48/128px 확장 아이콘

## 배포용 ZIP 생성
루트 폴더의 `package-release.bat` 또는 `package-release.ps1`을 실행하면 `.chrome-profile/`, `_metadata/`, `run-dev-chrome.bat`을 자동으로 제외하고 `dist/youtube-shorts-organizer-v<버전>.zip`을 생성합니다.
