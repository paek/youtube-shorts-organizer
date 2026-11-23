# YouTube Shorts Organizer & Learning Player

[English](./README.md) | [한국어 (Korean)](./README.ko.md)

YouTube Shorts를 체계적으로 반복 시청·학습·관리할 수 있는 Local-first Chrome Extension (Manifest V3) & 모바일 Userscript입니다.

---

## 주요 기능

* **쇼츠 반복 횟수 & 2초 후 자동 넘김**: `1`, `3`, `5`, `10`, `∞` 반복 설정 지원. 설정한 횟수 재생이 끝나면 마지막 화면에서 **2초 대기 후** 다음 쇼츠로 자동 이동합니다.
* **재생속도 & A-B 구간 반복**: `0.5x` ~ `2.0x` 배속 유지 및 어학·음악 학습용 A-B 구간 반복.
* **즐겨찾기 & 즐겨찾기만 연속재생**: YouTube 재생목록과 독립된 로컬 즐겨찾기 관리, **즐겨찾기만 연속재생(랜덤/순서)**.
* **쇼츠별 메모**: 영상별 개인 메모 저장 (`Ctrl+Enter` 빠른 저장).
* **음악 · 자막 · 가사 번역 (`🎵 음악/자막` 탭)**:
  * 쇼츠 배경음악 제목 자동 추출(DOM + YouTube `/watch` 공식 음악 카드), 제목 인라인 번역, **YouTube 원곡 바로 듣기 (`▶ YT`)** / **YouTube Music 검색 (`🎵 Music`)**.
  * YouTube 영어/자동 자막(`CC`) 추출, 전체 번역, 선택형 실시간 영/한 동시 자막 바(**기본 OFF** — 필요 시 `실시간 자막 바 표시` 체크).
  * 무료 가사 DB(LRCLIB) 가사 검색 및 전체 가사 번역.
* **광고/스폰서 자동 넘김 체크박스**: 체크박스 하나로 쇼츠 스폰서·인피드 광고 및 일반 YouTube 영상 광고 자동 스킵 ON/OFF.
* **드래그 이동 & 독립 창 분리 (`↗`)**: 브라우저 내 원하는 위치로 드래그 이동(위치 자동 저장, 헤더 더블클릭 시 기본 위치 복원)하거나, **별도 팝업 창으로 분리**해 브라우저 밖·듀얼 모니터에서 실시간 제어.
* **Safari (iOS / macOS) 및 모바일 브라우저 지원**: `m.youtube.com` 지원 및 단독 Userscript([`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js)) 제공.

---

## 설치 방법

### 1. PC Chrome / Edge / Brave (권장)
1. **[Releases](https://github.com/paek/youtube-shorts-organizer/releases)**에서 최신 `youtube-shorts-organizer-v*.zip`을 받아 압축을 풉니다 (또는 저장소를 `git clone`해 `extension/` 폴더 사용).
2. 브라우저 주소창에 `chrome://extensions` (Edge는 `edge://extensions`) 입력 후 우측 상단 **개발자 모드**를 켭니다.
3. 좌측 상단 **압축해제된 확장 프로그램 로드** 클릭 → 압축 푼 폴더(`manifest.json`이 들어 있는 폴더)를 선택합니다.
4. *(선택)* 브라우저 우측 상단 퍼즐(🧩) 아이콘에서 **YouTube Shorts Organizer**를 핀(📌) 고정하면 아이콘 클릭만으로 독립 창을 바로 열 수 있습니다.

### 2. 아이폰/맥 Safari & 안드로이드 브라우저
* **iOS / iPadOS Safari (Mac·Xcode 불필요, 1분 설치)**: App Store에서 무료 **Userscripts** 앱 설치 → [`userscript/youtube-shorts-organizer.user.js`](./userscript/youtube-shorts-organizer.user.js) 추가 → Safari에서 `https://m.youtube.com/shorts` 접속.
* **macOS / iOS 정식 Safari Web Extension 변환** 및 **Android (Firefox / Kiwi / Lemur)** 설치: 자세한 절차는 **[SAFARI_IOS_SETUP.md](./SAFARI_IOS_SETUP.md)** 를 참고하세요.
* *(참고: 공식 iOS Chrome과 공식 Android Chrome은 브라우저 정책상 확장·유저스크립트를 지원하지 않으므로, iOS는 Safari, Android는 Firefox/Kiwi/Lemur를 사용해 주세요.)*

---

## 사용 방법

YouTube Shorts 페이지(`https://www.youtube.com/shorts/...`)를 열면 우측 상단에 **YT Organizer** 패널이 표시됩니다.

### 상단 헤더 조작
* **헤더 드래그 (`⠿ YT Organizer`)**: 브라우저 화면 내 원하는 위치로 이동 (위치 자동 저장).
* **헤더 더블클릭**: 우측 상단 기본 위치로 즉시 복원.
* **`↗` 버튼 (또는 툴바 아이콘)**: 오거나이저를 별도 독립 창으로 분리해 브라우저 밖/다른 모니터에 두고 제어.
* **`▾` / `▸` 버튼**: 패널 접기/펼치기.

### 탭 1 — `제어`
* **Repeat (자동 넘김 횟수)**: `1`, `3`, `5`, `10`, `∞` 선택. 유한 횟수 설정 시 해당 횟수 재생 후 2초 뒤 다음 쇼츠로 자동 이동합니다.
* **Speed**: `0.5x` ~ `2x` 배속 선택 (다음 쇼츠로 넘어가도 배속 유지).
* **A-B Loop**: 시작 지점에서 `Set A`, 끝 지점에서 `Set B`를 누르면 해당 구간만 반복 (`Clear`로 해제).
* **즐겨찾기 (`☆` / `★`)**: 현재 쇼츠를 로컬 즐겨찾기에 추가/해제.
* **Memo**: 쇼츠별 메모 작성 후 **메모 저장** 클릭 (또는 `Ctrl+Enter`).
* **광고/스폰서 자동 넘김**: 체크 시 쇼츠 스폰서/인피드 광고 및 일반 YouTube 영상 광고를 자동으로 스킵합니다.

### 탭 2 — `★ 즐겨찾기`
* **즐겨찾기만 연속재생**: 체크하면 저장해 둔 즐겨찾기 쇼츠만 계속 이어서 재생합니다 (**랜덤** / **순서** 전환 가능).
* 목록 항목 클릭 시 해당 쇼츠로 바로 이동, `✕` 클릭 시 삭제.

### 탭 3 — `🎵 음악/자막`
* **곡 제목 / 사운드**: 쇼츠 배경음악 제목을 자동 추출합니다 (`↻`로 재조회, 직접 수정/입력 가능).
  * `제목 번역`: 곡 제목을 패널 안에서 즉시 번역.
  * `▶ YT`: YouTube 공식 원곡 영상으로 바로 이동 (원곡 ID가 없으면 검색).
  * `🎵 Music`: YouTube Music에서 검색.
  * `🔗 사운드`: 해당 사운드의 Shorts 모음 페이지 열기.
  * `📝`: 곡 제목(번역 포함)을 현재 쇼츠 메모에 원클릭 추가.
* **자막 / 가사 & 번역**:
  * `CC 자막 추출`: 현재 쇼츠의 YouTube 자막(수동/자동 생성 영어 등) 추출.
  * `가사 찾기`: LRCLIB 무료 DB에서 가사 자동 검색.
  * `전체 번역`: 추출한 자막·가사 또는 직접 붙여넣은 텍스트 전체 번역.
  * `실시간 자막 바 표시` *(기본 OFF)*: 체크 시 재생 시각에 맞춘 실시간 원문+번역 자막 바를 패널 상단에 표시.

### 문제 해결 팁
* **백신(Bitdefender 등) 오탐**: 개발 폴더에서 언팩 확장을 로드할 때 백신이 `.js` 파일을 격리하는 경우, 확장 폴더를 백신 예외(안티바이러스 + ATD)에 등록해 주세요.
* **유튜브 영상 하단에 검은색 `실시간 자막` 창이 뜰 때**: 우리 확장이 아닌 Chrome 브라우저 자체 기능입니다. Chrome 주소창에 `chrome://settings/captions` 입력 후 **실시간 자막**을 끄시면 됩니다.

---

## 배포용 ZIP 패키징

Windows에서 `package-release.bat`을 더블클릭(또는 `package-release.ps1` 실행)하면 `extension/manifest.json`의 버전을 자동으로 읽어 `dist/youtube-shorts-organizer-v<버전>.zip`을 생성합니다.

## 버전 정책

**Semantic Versioning (`MAJOR.MINOR.PATCH`)** 규칙을 따릅니다.
* `MAJOR`: 저장 구조·호환성이 깨지는 대규모 변경
* `MINOR`: 새 기능 추가 및 기능 개선 (`PATCH`는 `0`으로 초기화)
* `PATCH`: 버그 수정, 안정성/성능 개선, 소규모 UI 개선
* 문서·테스트만 바뀐 경우 버전은 올리지 않습니다. 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.

## 제작자 및 라이선스

* **제작자**: Baek Hung-Ju (`contact@acegame.com`)
* **라이선스**: **GNU General Public License v3.0 (GPL-3.0)** — 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요. 수정하여 배포할 경우 수정된 소스도 동일한 GPL-3.0 라이선스로 공개해야 합니다.
