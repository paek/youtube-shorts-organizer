# YouTube Shorts Organizer & Learning Player

[English](./README.md) | [한국어 (Korean)](./README.ko.md)

YouTube Shorts를 체계적으로 반복 시청·학습·관리할 수 있는 Local-first Chrome Extension (Manifest V3)입니다.

## 주요 기능

* **쇼츠 반복 횟수 & 자동 넘김**: `1`, `3`, `5`, `10`, `∞` 반복 설정 지원. 설정한 횟수 재생이 끝나면 **2초 대기 후** 다음 쇼츠로 자동 이동합니다.
* **재생속도 & A-B 구간 반복**: `0.5x` ~ `2.0x` 배속 유지 및 어학·음악 학습용 A-B 구간 반복.
* **즐겨찾기 & 즐겨찾기만 연속재생**: YouTube 재생목록과 독립된 로컬 즐겨찾기 관리, **즐겨찾기만 연속재생(랜덤/순서)**.
* **쇼츠별 메모**: 영상별 개인 메모 저장 (`Ctrl+Enter` 빠른 저장).
* **음악 · 자막 · 가사 번역 (`🎵 음악/자막` 탭)**:
  * 쇼츠 배경음악 제목 자동 추출(DOM + YouTube 공식 음악 카드), 제목 인라인 번역, **YouTube 원곡 바로 듣기** / **YouTube Music 검색**.
  * YouTube 영어/자동 자막(`CC`) 추출, 전체 번역, **실시간 영/한 동시 자막 바**.
  * 무료 가사 DB(LRCLIB) 가사 검색 및 전체 가사 번역.
* **광고/스폰서 자동 넘김 체크박스**: 체크박스 하나로 쇼츠 스폰서·인피드 광고 및 일반 YouTube 영상 광고 자동 스킵 ON/OFF.
* **드래그 이동 & 독립 창 분리 (`↗`)**: 브라우저 내 원하는 위치로 드래그 이동(위치 자동 저장)하거나, **별도 팝업 창으로 분리**해 브라우저 밖·듀얼 모니터에서 실시간 제어.

## 설치 방법 (Chrome 개발자 모드)

1. **[Releases](https://github.com/paek/youtube-shorts-organizer/releases)**에서 최신 `.zip` 파일을 받아 압축을 풉니다 (또는 저장소 `git clone`).
2. Chrome 주소창에 `chrome://extensions` 입력 후 우측 상단 **개발자 모드**를 켭니다.
3. 좌측 상단 **압축해제된 확장 프로그램 로드** 클릭 → 압축 푼 폴더(클론한 경우 `extension` 폴더)를 선택합니다.
4. YouTube Shorts 페이지를 열면 우측 상단에 **YT Organizer** 패널이 표시됩니다.
   * 우측 상단 퍼즐(🧩) 메뉴에서 아이콘을 고정하면 클릭 한 번으로 독립 창을 열 수 있습니다.

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
