# Phase 1 Draft MVP — 로드 및 테스트 방법

이 폴더는 `CLAUDE.md`의 Phase 1 (Player MVP) + 22장 MVP 범위 일부(Favorite/Memo)를
구현한 초안입니다. 빌드 도구 없이 순수 JS/CSS만으로 작성해서 바로 unpacked로 로드할 수
있습니다.

## 중요: 실제 브라우저 테스트를 못 했습니다

이 환경에는 GUI 브라우저가 없어 실제 youtube.com에 대고 동작을 확인하지 못했습니다.
`content/youtube-adapter.js`의 DOM 셀렉터는 알려진 YouTube Shorts 마크업 패턴을 기반으로
여러 폴백을 넣어뒀지만, YouTube가 마크업을 자주 바꾸는 편이라 **실제 로드해서 안 되는
부분이 있을 수 있습니다.** 아래 순서로 직접 로드해서 확인해 주세요.

## 빠른 방법 — `run-dev-chrome.bat` (Windows)

이 폴더의 `run-dev-chrome.bat`를 더블클릭하면:

1. PC에 설치된 `chrome.exe`를 자동으로 찾고
2. 평소 쓰는 Chrome 프로필과 분리된 `.chrome-profile/`(이 폴더 밑, git에는 안 올라감)이라는
   테스트 전용 프로필로
3. 이 확장을 로드한 채로 Chrome을 새로 띄우고 `youtube.com`을 연다

즉 `chrome://extensions` 화면을 열 필요 없이 더블클릭 한 번으로 "확장 로드 + 실행"이 끝난다.

**코드를 고친 뒤 다시 테스트하려면**: 떠 있는 그 Chrome 창을 완전히 닫고 `run-dev-chrome.bat`을
다시 더블클릭하면 된다 (새로 뜨는 Chrome 프로세스가 디스크에서 최신 코드를 다시 읽어온다).

주의할 점:

* 테스트 프로필은 평소 로그인과 분리되어 있어 **YouTube에 로그인이 안 되어 있는 게 정상**이다.
  Phase 1 기능(반복재생/A-B루프/재생속도/Favorite/Memo)은 로그인 여부와 무관하게 동작하므로
  로그인하지 않고 테스트해도 된다.
* `chrome.exe`를 못 찾으면 배치파일이 설치 후보 경로 3곳을 알려준다 — 콘솔에 뜬 실제 경로를
  확인해서 파일 안 `CHROME_EXE` 변수를 직접 채워 넣으면 된다.
* Mac이나 다른 브라우저를 쓴다면 아래 "수동 로드 방법"을 그대로 따르면 된다.

## 수동 로드 방법 (배치파일이 안 맞을 때 / Mac / 다른 브라우저)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 "개발자 모드" 켜기
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 이 폴더(`Youtube Window/extension`)를 선택

## 확인할 것

1. `https://www.youtube.com/shorts/아무영상ID` 로 이동
2. 화면 우측에 "YT Organizer" 패널이 뜨는지 확인
3. Repeat 버튼(1/3/5/10) 클릭 → 영상이 끝까지 재생된 뒤 설정한 횟수만큼 처음부터
   다시 재생되고, 그 횟수를 다 채우면 다음 쇼츠로 자동 이동하는지 확인.
   ∞로 설정하면 다음으로 넘어가지 않고 같은 영상을 계속 반복함 (의도된 동작).
4. Speed 버튼 클릭 → 재생속도가 바뀌는지 확인
5. "Set A" → 몇 초 재생 후 "Set B" → 그 구간만 반복되는지 확인 (기본 5회 반복)
6. ☆ 클릭 → ★로 바뀌는지, 다른 쇼츠로 갔다가 돌아와도 유지되는지 확인
7. Memo 입력 후 "Save memo" → 새로고침 후에도 남아있는지 확인
8. 쇼츠를 스와이프해서 다음 영상으로 넘어갈 때 패널이 새 영상 기준으로 초기화되는지 확인
   (Favorite/Memo/Repeat 표시가 새 videoId 것으로 바뀌어야 함)
9. "Auto-skip sponsored" 체크박스(기본 ON) — 협찬/유료광고 표시가 있는 쇼츠를 만나면
   재생 없이 바로 다음으로 넘어가고 패널에 "⏭ Skipped sponsored Short (...)" 메시지가
   잠깐 뜨는지 확인. 체크 해제하면 스폰서 영상도 그냥 평소처럼 재생되는지 확인
10. 일반 영상(쇼츠 아님, `youtube.com/watch?v=...`) 재생 시 프리롤/미드롤 광고가 뜨면:
    - Skip 가능한 광고는 카운트다운 끝나자마자 자동으로 스킵되는지 확인
    - 스킵 불가능한 광고는 음소거되고 화면이 빨리감기(배속)로 넘어가는지 확인
    - 광고가 끝난 뒤 원래 영상은 음소거 안 풀리거나 배속이 이상하게 남아있지 않고
      정상 상태로 돌아오는지 확인
    - (참고) 네트워크 차단(`rules/ad-block-rules.json`)만으로는 광고 영상 자체를 막을 수
      없다는 게 확인되어서 이 DOM 기반 스킵(`content/ad-skip.js`)을 보강했다 — 자세한
      경위는 CLAUDE.md 30.8~30.9절 참고. 광고가 아예 안 뜨는 걸 기대하면 안 되고,
      "뜨더라도 최대한 빨리 넘어가는지"를 확인하는 것이 맞다.
    - 영상 자체는 정상 재생되는지도 같이 확인 (광고 도메인만 막아야지 영상 스트림까지
      막히면 안 됨)

## 안 될 경우 확인 포인트

패널 자체가 안 뜨면:
- `chrome://extensions`에서 이 확장의 "서비스 워커"/"오류" 링크로 콘솔 에러 확인
- 쇼츠 페이지에서 개발자도구(F12) 콘솔에 `[YTW]` 로그나 에러가 있는지 확인

반복재생/A-B 루프가 안 먹히면 십중팔구 `youtube-adapter.js`의
`ACTIVE_VIDEO_SELECTORS`가 지금 YouTube 마크업과 안 맞는 경우입니다:
1. 쇼츠 페이지에서 개발자도구로 현재 재생 중인 `<video>` 엘리먼트를 직접 찾아본다
2. 그 엘리먼트까지의 실제 선택자를 확인해서 `ACTIVE_VIDEO_SELECTORS` 배열 맨 앞에 추가한다
3. `youtube-adapter.js`는 이 프로젝트에서 YouTube DOM을 아는 유일한 파일이므로
   (CLAUDE.md 23장 원칙 1) 다른 파일은 건드릴 필요가 없다

반복 횟수를 다 채웠는데 다음 쇼츠로 안 넘어가고 그냥 멈춰 있으면, `goToNextShort()`
(`youtube-adapter.js`)의 세 가지 시도(다음 버튼 클릭 → ArrowDown 키 이벤트 → 피드
스크롤)가 전부 지금 YouTube 마크업과 안 맞는 경우입니다. 이때도 위와 같은 방식으로
개발자도구에서 실제 "다음 영상" 버튼의 선택자를 확인해서 `NEXT_BUTTON_SELECTORS` 배열
맨 앞에 추가하면 된다.

스폰서 감지(`isSponsoredShort()`, `youtube-adapter.js`)도 마찬가지로 실제 브라우저에서
검증 안 된 셀렉터 기반이다. 실제로는 협찬 영상인데 안 걸러지면 `AD_SLOT_SELECTORS`나
`DISCLOSURE_TEXT_PATTERN`을 개발자도구로 실제 배지 요소/문구를 찾아 보강해야 하고,
반대로 협찬이 아닌데 잘못 걸러지면(과탐지) `AD_KEYWORD_PATTERN`이 제목의 일반 단어와
우연히 매칭된 경우일 수 있으니 패턴을 좁히면 된다.

(2026-09-01 수정) 예전 버전은 정상 Shorts가 4~5개씩 연달아 자동으로 넘어가는 버그가
있었다 — 광고 슬롯/뱃지 셀렉터가 "현재 재생 중인 영상"에 스코프되어 있지 않아서 피드에
미리 로드된 다른 항목의 광고 요소까지 오탐지했었다. 지금은 `getActiveShortContainer()`로
현재 영상 컨테이너 안에서만 검사하도록 고쳤다. 만약 이 버그가 다시 재현되면(예: 정상
영상이 계속 스킵됨) 콘솔의 `[YTW] sponsored Short detected` 로그에 찍히는 `signals`
내용을 보고 어떤 신호가 오탐인지 확인해서 알려주면 된다.

## 광고 차단이 여전히 뜨거나(과소차단) 영상 자체가 안 나오면(과차단)

`rules/ad-block-rules.json`은 `doubleclick.net`/`googlesyndication.com` 등 잘 알려진
광고 서버 도메인과 `youtube.com/pagead/`, `youtube.com/ptracking` 같은 광고 전용 경로만
차단하도록 만들었다. 실제 영상 스트림은 `googlevideo.com`에서 오므로 이 규칙에 안 걸리게
설계했지만, 실제 브라우저에서 검증은 못 했다.

* **광고가 여전히 뜨면**: `chrome://extensions` → 이 확장의 "세부정보" → "오류" 옆에 있는
  네트워크 요청 관련 정보나, F12 개발자도구 Network 탭에서 광고 요청이 어느 도메인으로
  가는지 확인해서 `rules/ad-block-rules.json`에 규칙을 추가하면 된다. 규칙 추가 후에는
  `chrome://extensions`에서 확장을 새로고침해야 반영된다 (매니페스트/규칙 파일 변경은
  코드 변경보다 더 확실하게 완전히 새로고침해야 함).
* **영상 자체가 안 나오거나 끊기면**: 규칙 중 하나가 실제 비디오 스트림 요청까지 잘못
  걸렀을 가능성이 있다 — 어떤 영상에서 안 나오는지, F12 Network 탭에서 빨갛게(차단됨)
  표시되는 요청의 URL을 확인해서 알려주면 해당 규칙을 좁히겠다.

`content/ad-skip.js`(스킵 버튼 자동 클릭 / 음소거+배속) 관련 문제:

* **광고가 계속 정상 속도로 다 재생되면**: `AD_SHOWING_SELECTORS`(`.ad-showing`/
  `.ad-interrupting` 클래스)가 지금 YouTube 플레이어 마크업과 안 맞는 경우다. 광고
  재생 중 개발자도구로 `#movie_player`/`.html5-video-player`에 실제로 붙는 클래스명을
  확인해서 배열에 추가하면 된다.
* **Skip 버튼이 있는데 안 눌리면**: `SKIP_BUTTON_SELECTORS`가 실제 버튼 클래스와 안
  맞거나, 버튼이 아직 카운트다운 중이라 `offsetParent`가 null인 상태일 수 있다 (0.3초
  뒤 다음 폴링에서 다시 시도하므로 카운트다운이 끝나면 결국 클릭돼야 정상).
* **광고가 끝났는데 음소거/배속이 안 풀리면**: `AD_SHOWING_SELECTORS`가 광고 종료
  시점을 못 잡는 것 — 클래스가 사라지는 타이밍을 개발자도구로 확인해서 셀렉터를
  보강해야 한다.

## 이번 초안에서 의도적으로 뺀 것

- SQLite(WASM+OPFS) 저장소 (2.3절) — 지금은 `chrome.storage.local`만 사용.
  Favorite/Memo 정도의 데이터량에서는 충분하고, DB 계층은 채널 카테고리/시청이력처럼
  관계형 쿼리가 실제로 필요해지는 Phase 2~3부터 붙일 예정.
- Discovery Collector / 자동 카테고리 분류 / 광고 감지 (28~30장) — Phase 4.5 이후.
- Download Helper (15~16장) — 별도 Local Helper 프로세스가 필요하고 배포 정책(15.1절)이
  걸린 기능이라 이번 초안 범위 밖.
