# YouTube Shorts Organizer & Learning Player

YouTube Shorts를 체계적으로 반복 시청·학습·관리할 수 있는 Chrome Extension (Manifest V3)입니다.

## 주요 기능

* **쇼츠 반복 횟수 & 자동 넘김**: 1 / 3 / 5 / 10 / ∞ 반복 설정, 재생 종료 2초 후 다음 쇼츠로 자동 이동
* **재생속도 & A-B 구간 반복**: 0.5x ~ 2.0x 배속 유지, 어학/음악 학습용 구간 반복
* **즐겨찾기 & 즐겨찾기만 연속재생**: YouTube 재생목록과 독립된 즐겨찾기 관리, 랜덤/순서 연속 재생
* **쇼츠별 메모**: 영상별 개인 메모 저장 (Ctrl+Enter 빠른 저장)
* **음악/자막 & 번역 (🎵 음악/자막 탭)**:
  * 쇼츠 배경음악 제목 자동 추출, 인라인 번역, YouTube 원곡 바로 듣기 / YouTube Music 검색
  * YouTube 영어/자동 자막(CC) 추출 + 전체 번역 + 실시간 영/한 동시 자막 바
  * 무료 가사 DB(LRCLIB) 가사 검색 및 전체 가사 번역
* **광고/스폰서 자동 넘김**: 체크박스로 쇼츠 스폰서/인피드 광고 및 일반 YouTube 영상 광고 자동 스킵 ON/OFF
* **독립 창 분리 (↗)**: 오거나이저를 별도 팝업 창으로 분리해 브라우저 밖/듀얼 모니터에서 실시간 제어

## 설치 방법 (Chrome 개발자 모드)

1. 이 저장소를 다운로드(Code → Download ZIP)하거나 git clone 합니다.
2. Chrome 주소창에 chrome://extensions 입력 후 우측 상단 **개발자 모드**를 켭니다.
3. 좌측 상단 **압축해제된 확장 프로그램 로드** 클릭 → 이 저장소의 extension 폴더를 선택합니다.
4. YouTube Shorts 페이지를 열면 우측 상단에 **YT Organizer** 패널이 표시됩니다.
   * 우측 상단 퍼즐(🧩) 메뉴에서 아이콘을 고정해 두면 클릭 한 번으로 독립 창을 열 수 있습니다.

## 라이선스

이 프로젝트는 **GNU General Public License v3.0 (GPL-3.0)** 라이선스를 따릅니다. 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
