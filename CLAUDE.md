# YouTube Shorts Organizer & Learning Player

## Chrome Extension 개발 기획서

**Project Type:** Chrome Extension
**Target Browser:** Google Chrome / Chromium 기반 브라우저
**Extension Standard:** Manifest V3
**Primary Target:** YouTube / YouTube Shorts
**Development Model:** Local-first

**최초 작성:** 사용자 초안 (기획서 전문)
**최근 갱신:** 2026-09-01 — 로그인 정책 확정, 다운로드 기능 배포 정책 추가, 기존 유사 프로그램 조사(섹션 27) 반영
**추가 갱신:** 2026-09-01 — 미구독 Shorts 자동 카테고리 분류 + 카테고리 내 자동 연속재생(섹션 28) 반영
**추가 갱신:** 2026-09-01 — 저장소 엔진을 SQLite(WASM+OPFS) 파일 DB로 확정(섹션 2.3), 시청 관심사 분석 + 신규 채널 추천(섹션 29) 반영
**추가 갱신:** 2026-09-01 — Discovery Collector가 시청 여부와 무관하게 노출된 콘텐츠를 기본 수집하도록 명시(28.2절 보강), 광고성 Shorts 감지·분리(섹션 30) 반영
**추가 갱신:** 2026-09-01 — 일반 영상 시청 중 삽입 광고(중간광고) 네트워크 레벨 차단(섹션 30.8) 반영 — 원래 기획(1·25장)은 Shorts 전용이었으나 사용자 요청으로 일반 영상 광고 차단까지 범위 확장

---

# 0. 이 문서의 성격

이 파일은 `Youtube Window/` 하위에서 작업할 때 Claude Code가 따라야 할 프로젝트 기획서 겸 가이드 문서다. 저장소 루트의 `CLAUDE.md`(ACE Timing Series)와는 완전히 별개 프로젝트이며, 제품명 체계·타이밍 로직·DB 스키마 등 루트 문서의 도메인 규칙은 이 프로젝트에 적용되지 않는다. 단, 루트 문서의 **Git 관리 공통 정책**(관련 파일만 명시적 stage, 빌드 산출물/캐시/로컬 설정 미추적, 커밋 전 diff 확인 등)은 이 프로젝트에도 동일하게 적용한다.

---

# 1. 프로젝트 개요

본 프로젝트는 YouTube 및 YouTube Shorts를 보다 체계적으로 관리하고, 반복 시청 및 어학 학습 등에 활용할 수 있도록 지원하는 Chrome Extension 개발을 목표로 한다.

기존 YouTube Shorts는 알고리즘 기반으로 콘텐츠가 연속 제공되기 때문에 사용자가 원하는 주제별로 콘텐츠를 분류하거나 학습 목적으로 반복 관리하기 어렵다.

본 Extension에서는 다음 기능을 중심으로 이러한 한계를 보완한다.

* YouTube 구독 채널 관리
* 구독 채널 카테고리 분류
* 카테고리 기반 Shorts 탐색
* Shorts 반복 횟수 지정
* A-B 구간 반복
* 재생속도 조절
* 즐겨찾기
* 사용자 태그
* 학습 상태 관리
* 영상별 메모
* 본인 영상 관리
* 다운로드 Helper 연동 (개발/개인 사용 빌드 한정 — 자세한 정책은 15장, 28장 참고)
* 시청 패턴 기반 관심사 분석 + 신규 채널/영상 추천 (구독 여부 무관, 29장)
* 광고성 Shorts 자동 감지 및 분리 (30장)
* 일반 영상 재생 중 삽입 광고(중간광고) 네트워크 레벨 차단 (30.8절, 2026-09-01 범위 확장 — 원래 Shorts 전용 기획에서 확장)

단순한 YouTube 편의 Extension보다는 다음 개념을 목표로 한다.

> **YouTube Shorts Organizer + Learning Player**

---

# 2. 핵심 설계 방향

## 2.1 Local-first

초기 버전에서는 별도의 서버 구축을 최소화한다.

사용자의 다음 데이터는 브라우저 내부에 저장한다.

* 카테고리
* 즐겨찾기
* 태그
* 반복 횟수
* A-B 반복 구간
* 메모
* 학습 상태
* 시청 상태
* 사용자 설정

저장 방식:

* **핵심 데이터(채널·카테고리·영상·즐겨찾기·태그·학습상태·시청 이력·관심사 프로파일 등)** — SQLite 파일 DB (2.3절, 실제 채택 확정)
* **소규모 UI/런타임 설정(현재 테마, 마지막으로 연 탭 등)** — `chrome.storage.local` (동기화 필요 없고 빈번히 읽고 쓰는 값이라 SQLite 트랜잭션 오버헤드를 피함)

향후 필요할 경우 계정 기반 동기화를 추가한다.

## 2.2 로그인/인증 정책 (확정)

Chrome Extension이라는 형태 자체가 이미 사용자가 Chrome에 로그인해 둔 YouTube 세션을 그대로 이용할 수 있다는 뜻이므로, **별도의 Google OAuth/로그인 UI를 이 프로젝트가 직접 구현하지 않는다.**

* Content Script가 `youtube.com` 페이지의 DOM/내부 상태(현재 로그인 계정, 구독 목록, 재생 중인 videoId 등)를 읽어와 활용한다 — 사용자는 평소처럼 Chrome/YouTube에 로그인만 되어 있으면 된다.
* Google OAuth 및 YouTube Data API는 "DOM 접근만으로는 안정적으로 얻기 어려운 데이터"(예: 대량 구독 목록의 정확한 메타데이터, Shorts 카테고리 필드 등)가 실제로 필요하다고 판명될 때만 Phase 4/7에서 선택적으로 도입한다 (기존 3.1절, 27장 결정 유지).
* 즉 "로그인 연동"은 별도 인증 플로우가 아니라 "브라우저의 기존 로그인 상태에 얹혀가는 것"으로 해석한다. 이 결정이 바뀌면(OAuth 도입 시) 이 절과 21장 Phase 4/7을 함께 갱신할 것.

## 2.3 저장소 엔진: SQLite (WASM + OPFS) 채택 (확정 — 2026-09-01)

채널/카테고리/영상/즐겨찾기/태그/학습상태에 더해 28장의 `ChannelCategoryGuess`, 29장의 시청 이력·관심사 프로파일까지 데이터 종류와 관계(채널↔카테고리↔영상↔이벤트)가 늘어나면서, 단순 KV 저장소(`chrome.storage.local`)나 스키마 없는 객체 저장소(순수 IndexedDB)로는 조인·집계 쿼리(예: "지난 30일간 카테고리별 시청 시간 합계")를 감당하기 어렵다고 판단해, **파일 기반 관계형 DB를 직접 둔다.**

### 검토한 선택지

| 옵션 | 특성 | 이 프로젝트에 대한 평가 |
|------|------|--------------------------|
| IndexedDB (원안) | 브라우저 내장, 스키마 없음, JOIN 없음 | 관심사 분석/추천처럼 여러 테이블을 엮는 집계 쿼리를 직접 짜야 해서 코드가 급격히 복잡해짐 |
| **SQLite (WASM) + OPFS** | 진짜 단일 파일 `.sqlite`, 표준 SQL, JOIN/집계 지원, WASM 번들 작음(~1MB대) | **채택.** 개인 1인 사용 규모(연간 수천~수만 행)에서 충분히 빠르고, 파일이 실제로 존재해 백업/내보내기/DB 브라우저 툴로 직접 열람 가능 — "File DB로 관리"라는 요구에 정확히 부합 |
| DuckDB-Wasm | 컬럼형 OLAP 엔진, 대용량 집계·윈도우 함수에 SQLite보다 강력, OPFS 영속화도 지원 | 검토했으나 **기각 (현재는).** WASM 번들이 훨씬 크고(수십 MB) Extension 로드/용량 부담이 큰데, 개인 시청 이력 규모에서는 SQLite로도 병목이 없어 이점을 체감하기 어려움. 29장의 추천/집계 쿼리가 실제로 느려지는 시점(예: history 테이블 수십만 행 이상, 복잡한 윈도우 함수 다발)이 오면 재검토 대상으로 남겨둔다. |

### 실행 컨텍스트 (Manifest V3 제약 — 중요)

OPFS의 동기 파일 접근(`createSyncAccessHandle`)은 **Worker 컨텍스트에서만** 가능하고, Content Script나 Popup에서 직접 열 수 없다. 또한 MV3의 background Service Worker는 언제든 종료될 수 있어 OPFS 핸들을 안전하게 오래 들고 있기에 적합하지 않다. 따라서:

```text
Content Script / Popup / Floating Panel
            │  (메시지 전달, chrome.runtime)
            ▼
      Background Service Worker  ← 요청 라우팅만 담당, DB 핸들을 직접 들고 있지 않음
            │
            ▼
      Offscreen Document (chrome.offscreen)
            │
            ▼
      Dedicated Worker
            │
            ▼
   sqlite-wasm (OPFS VFS) ──► youtube_window.sqlite (실제 파일, OPFS)
```

* DB 읽기/쓰기는 전부 Offscreen Document 안의 Dedicated Worker에 격리하고, 나머지 코드는 메시지 패싱으로만 접근한다 — 23장 원칙(YouTubeAdapter/Download Interface와 동일하게 "DB 접근 계층 격리" 원칙을 하나 더 추가한 것으로 취급).
* 라이브러리는 SQLite 공식 `sqlite-wasm` 패키지(OPFS VFS 내장)를 우선 검토한다.

이 결정에 따라 17장 Extension Architecture, 18장 폴더 구조, 19장 데이터 모델, 24장 최종 Architecture를 함께 갱신했다 (아래 각 장 참고).

---

# 3. 주요 기능

## 3.1 YouTube 사용자 환경 연동

사용자가 Chrome에서 기존에 로그인한 YouTube 환경을 최대한 활용한다.

지원 목표:

* 현재 로그인 사용자 확인
* 구독 채널 접근
* 구독 콘텐츠 탐색
* 사용자의 YouTube 영상 접근
* Shorts 탐색

초기 MVP에서는 별도 Google OAuth 의존성을 최소화하고, 반드시 필요한 기능이 확인될 경우 YouTube Data API 및 Google OAuth 연동을 추가한다. (2.2절 참고 — 현재는 OAuth 없이 브라우저 세션에만 의존하는 것으로 확정)

---

# 4. Channel Category

구독 채널을 사용자가 직접 카테고리별로 관리할 수 있도록 한다.

예:

```text
My Channels
│
├── 🚲 Cycling
│   ├── GCN
│   ├── UCI
│   └── MTB Channel
│
├── 🇺🇸 English
│   ├── BBC Learning English
│   ├── English Teacher A
│   └── Daily English
│
├── 💻 IT
│   ├── Programming
│   ├── Linux
│   └── AI
│
├── 🤖 AI
│
├── 🎵 Music
│
└── 📰 News
```

하나의 채널을 여러 카테고리에 등록하는 기능도 고려한다.

---

# 5. Shorts Category Feed

YouTube 기본 Shorts Feed와 별도로 사용자 카테고리에 기반한 Shorts 탐색 UI를 제공한다.

예:

```text
SHORTS

[ ALL ]
[ English ]
[ Cycling ]
[ IT ]
[ AI ]
[ Music ]
[ 📢 Sponsored/Ad ]   ← 30장, 기본 카테고리 피드에서는 자동 제외되고 원할 때만 열람
```

`English` 선택 시 English 카테고리에 등록된 채널의 Shorts를 중심으로 탐색할 수 있도록 한다.

가능하다면 다음 필터도 지원한다.

* 최신순
* 오래된 순
* 미시청
* 즐겨찾기
* 학습 중
* 학습 완료
* 특정 채널

**주의 (2026-09-01 갱신):** 이 카테고리 피드는 "구독 채널 → 카테고리" 수동 매핑에만 의존하지 않는다. 사용자가 구독하지 않은 채널의 Shorts라도 28장의 자동 분류기가 카테고리를 판별하면 동일하게 이 피드에 편입된다. 즉 5장의 카테고리 목록은 "구독 채널 기반"과 "자동 분류된 미구독 콘텐츠"를 합친 뷰이며, UI 상에서는 출처를 배지 등으로 구분할 수 있게 한다(예: 구독 채널 여부 아이콘).

---

# 6. Shorts Repeat Controller

본 프로젝트의 핵심 기능 중 하나이다.

YouTube Shorts의 무한 반복 대신 사용자가 반복 횟수를 지정할 수 있도록 한다.

예:

```text
Repeat

○ 1
○ 3
● 5
○ 10
○ ∞
```

동작:

```text
Short 재생 종료
       ↓
Repeat Count 확인
       ↓
현재 반복 < 설정값
       ↓
처음부터 재생
       ↓
반복 횟수 증가
       ↓
설정 횟수 도달
       ↓
다음 Short
```

사용자가 직접 다음 영상으로 이동하면 반복 카운터를 초기화한다.

**28장과의 관계:** 설정된 반복 횟수를 모두 소진한 뒤 "다음 Short"로 넘어가는 동작은, 사용자가 카테고리 피드(5장/28장)를 통해 진입한 경우 YouTube 기본 추천이 아니라 28.4절의 Category Queue에서 다음 항목을 가져온다. 반복 횟수가 1(기본값)이면 사실상 재생 종료 즉시 카테고리 자동 연속재생으로 넘어가는 것과 같다.

---

# 7. A-B Repeat

특정 구간만 반복할 수 있도록 한다.

특히 어학 및 음악 학습 용도로 사용한다.

예:

```text
A : 00:03.20
B : 00:11.80

[ Set A ]
[ Set B ]

Repeat : 5

[ START ]
```

재생:

```text
3.20 sec
   ↓
11.80 sec
   ↓
3.20 sec
   ↓
11.80 sec
```

A-B 반복 횟수도 지정 가능하도록 한다.

---

# 8. Playback Speed

학습 목적을 위해 재생속도를 쉽게 변경할 수 있도록 한다.

예:

```text
0.5x
0.75x
0.8x
1.0x
1.25x
1.5x
2.0x
```

사용자가 직접 사용자 지정 값을 설정하는 기능도 향후 고려한다.

---

# 9. Favorite

Shorts 및 일반 영상을 Extension 자체 즐겨찾기에 저장한다.

YouTube의 기존 Playlist와 독립적으로 관리한다.

예:

```text
⭐ Favorite
```

저장 정보:

```text
videoId
title
channelId
channelName
thumbnail
url
createdAt
tags
memo
learningStatus
```

---

# 10. Tag System

Channel Category와 Video Tag를 분리한다.

중요:

> Channel Category ≠ Video Tag

예:

Channel Category:

```text
English
```

Video Tags:

```text
#conversation
#pronunciation
#grammar
#listening
#business
```

하나의 영상에 여러 Tag를 사용할 수 있도록 한다.

---

# 11. Learning Mode

어학 학습 등을 위한 별도 모드를 제공한다.

예:

```text
━━━━━━━━━━━━━━━━━━

🇺🇸 English Learning

Daily Conversation

━━━━━━━━━━━━━━━━━━

Repeat
[ 1 ] [ 3 ] [ 5 ] [ 10 ] [ ∞ ]

Speed
[ 0.75 ] [ 0.8 ] [ 1.0 ] [ 1.25 ]

A-B LOOP

A  00:03.20
B  00:11.80

[ SET A ] [ SET B ]

━━━━━━━━━━━━━━━━━━

⭐ Favorite
🏷 Tags
📝 Memo

Learning Status

○ New
● Learning
○ Learned

━━━━━━━━━━━━━━━━━━
```

---

# 12. 학습 상태 관리

영상마다 학습 상태를 저장한다.

상태:

```text
NEW
LEARNING
LEARNED
```

또는 향후:

```text
NEW
LEARNING
REVIEW
MASTERED
```

형태로 확장할 수 있다.

---

# 13. Memo

영상별 개인 메모 기능을 제공한다.

예:

```text
Video:
How to order coffee in English

Memo:

"I'd like to ~"
→ 주문할 때 사용하는 표현

"Could I get ~"
→ 조금 더 자연스러운 표현
```

메모는 Video ID를 기준으로 저장한다.

---

# 14. 학습 History

향후 다음 데이터를 기록할 수 있다.

```text
Video ID
Watch Count
Repeat Count
AB Repeat Count
Last Watched
Total Study Time
Learning Status
```

이를 기반으로 간단한 학습 통계도 제공할 수 있다.

예:

```text
Today

Shorts Watched     27
Learning Videos    12
Repeat             46
Study Time         38 min
```

---

# 15. Download 기능

다운로드 기능은 Chrome Extension 내부에서 모든 작업을 직접 처리하기보다 Local Helper 방식 사용을 검토한다.

권장 구조:

```text
YouTube
   │
Chrome Extension
   │
   │ localhost
   ▼
Local Helper
   │
   ├── yt-dlp
   └── FFmpeg
        │
        ▼
     Download
```

Extension:

```text
Download
   ↓
Local Helper API
   ↓
yt-dlp
   ↓
FFmpeg
   ↓
File
```

다운로드 기능은 사용자가 소유한 영상, 다운로드가 허용된 영상 또는 적법한 권한이 있는 콘텐츠를 대상으로 설계한다.

## 15.1 배포 정책 (확정 — 중요)

* **개발/개인 사용 빌드**: 다운로드 기능(Local Helper 연동, yt-dlp/FFmpeg 실행)을 포함해 전체 기능이 동작해야 한다. 개인 어학 학습용으로 실제 필요한 기능이므로 개발 단계에서는 막지 않는다.
* **공개 배포 빌드** (Chrome 웹스토어 등 불특정 다수 배포): YouTube 이용약관은 자체 다운로드 기능 배포를 금지하므로, 공개 빌드에서는 다운로드 관련 UI/코드 경로를 **빌드 타임에 완전히 제거하거나 비활성화**한다.
* 두 빌드를 하나의 코드베이스에서 관리하기 위해 다운로드 기능은 반드시 15장의 `Download Interface` 계층 뒤에 격리하고(23장 "3. Download 기능 분리" 원칙), 빌드 스크립트/매니페스트 변형(예: `manifest.dev.json` vs `manifest.public.json`, 또는 빌드 플래그로 해당 모듈 자체를 번들에서 제외)으로 공개 빌드에는 해당 모듈이 아예 포함되지 않도록 한다. 단순 UI 숨김(런타임 플래그)만으로는 코드가 번들에 남아있어 웹스토어 심사·리버스엔지니어링 관점에서 위험이 남으므로, 번들 제외 수준으로 분리하는 것을 목표로 한다.
* Local Helper(별도 실행 파일)는 애초에 Chrome 웹스토어 배포물이 아니라 사용자가 직접 실행하는 로컬 프로그램이므로, "공개 배포 = Extension 배포"를 의미하고 Local Helper 자체의 공개 여부는 별도 판단이 필요하다 (공개 시 동일하게 ToS 리스크 고지 필요).

---

# 16. Local Helper API 예시

예:

```text
POST http://127.0.0.1:17723/download
```

Payload:

```json
{
  "url": "youtube-url",
  "type": "video"
}
```

A-B 구간 다운로드:

```json
{
  "url": "youtube-url",
  "start": 3.2,
  "end": 11.8
}
```

향후 다음 기능을 지원할 수 있다.

```text
Download Full Video
Download A-B Section
Download Audio
Download Subtitle
Download Thumbnail
```

---

# 17. Extension Architecture

권장 구조:

```text
YouTube
   │
   ▼
Content Script
   │
   ├── Video Detector
   ├── Shorts Detector
   ├── Player Controller
   └── UI Injector
           │
           ▼
      Extension Core
           │
    ┌──────┼────────┐
    │      │        │
 Category Favorite Learning
 Manager  Manager   Manager
    │      │        │
    └──────┼────────┘
           │
           ▼
      Storage Layer (메시지 패싱)
           │
           ▼
  Offscreen Document + Worker (2.3절)
           │
    ┌──────┴──────┐
    │             │
sqlite-wasm    chrome.storage.local
(OPFS 파일)     (경량 UI 설정만)
```

다운로드 기능 사용 시:

```text
Extension Core
      │
      ▼
Download Manager
      │
      ▼
Local Helper
      │
   ┌──┴───┐
   │      │
yt-dlp  FFmpeg
```

---

# 18. Chrome Extension 구조 예시

```text
youtube-learning-extension/

├── manifest.json
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── youtube.ts
│   │   ├── shorts.ts
│   │   └── player.ts
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.ts
│   │
│   ├── ui/
│   │   ├── floating-panel.ts
│   │   ├── repeat-controller.ts
│   │   └── learning-panel.ts
│   │
│   ├── storage/
│   │   ├── favorites.ts
│   │   ├── categories.ts
│   │   ├── tags.ts
│   │   └── learning.ts
│   │
│   ├── db/                          ← 2.3절 SQLite(WASM+OPFS) 계층
│   │   ├── offscreen.html
│   │   ├── offscreen.ts             ← Offscreen Document 진입점
│   │   ├── db-worker.ts             ← Dedicated Worker, sqlite-wasm 실행
│   │   ├── schema.sql               ← 테이블 정의 (19장, 29장)
│   │   ├── migrations/              ← 버전별 마이그레이션 스크립트
│   │   └── client.ts                ← 나머지 모듈이 사용하는 메시지 패싱 클라이언트
│   │
│   └── common/
│       ├── types.ts
│       └── utils.ts
│
└── helper/
    ├── server
    ├── yt-dlp
    └── ffmpeg
```

---

# 19. 데이터 모델

아래 인터페이스는 논리적 데이터 모델이며, 2.3절 결정에 따라 실제로는 SQLite 테이블로 구현된다 (`chrome.storage.local`에는 UI 설정 등 경량 값만 남는다). `channelId`/`videoId`를 각 테이블의 기본키로, `Video.channelId` 등을 외래키로 둔 통상적인 관계형 스키마를 사용한다.

## Channel

```typescript
interface Channel {
    channelId: string;
    name: string;
    categories: string[];
}
```

## Video

```typescript
interface Video {
    videoId: string;
    title: string;
    channelId: string;

    favorite: boolean;

    tags: string[];

    learningStatus:
        | "NEW"
        | "LEARNING"
        | "LEARNED";

    memo?: string;

    repeat?: {
        count: number;
        start?: number;
        end?: number;
    };

    // 28장 — 자동 분류/디스커버리 관련 필드
    isSubscribedChannel: boolean;     // 발견 당시 구독 채널 여부
    category?: string;                // 최종 확정 카테고리 (수동 override 우선)
    categorySource?:
        | "manual"                    // 사용자가 채널/영상에 직접 지정
        | "channelCache"               // ChannelCategoryGuess 캐시 재사용
        | "auto";                      // 신규 분류기 실행 결과
    categoryConfidence?: number;      // 0~1, auto 분류일 때만 유효
    discoveredAt?: string;            // 최초 관찰(passive scan) 시각 (ISO)

    // 30장 — 광고성 콘텐츠 감지 관련 필드
    isAd?: boolean;                   // 판정 결과 (임계값 이상이면 true)
    adConfidence?: number;            // 0~1
    adSignals?: string[];             // 판정 근거, 예: ["platform_ad_slot"], ["disclosure_badge","keyword:유료광고"]
}
```

## Category

```typescript
interface Category {
    id: string;
    name: string;
    icon?: string;
    keywords?: string[]; // 28.3절 규칙 기반 분류기가 사용하는 매칭 키워드
}
```

## ChannelCategoryGuess (28장 신설)

```typescript
interface ChannelCategoryGuess {
    channelId: string;
    guessedCategory: string;
    confidence: number;       // 0~1
    sampleCount: number;      // 이 채널에서 분류 근거로 쓰인 영상 수
    lastUpdated: string;      // ISO timestamp
    userOverride?: string;    // 사용자가 수동으로 정정한 카테고리 (있으면 최우선)
}
```

## WatchEvent / InterestScore / RecommendationCandidate (29장 신설)

```typescript
interface WatchEvent {
    id: string;               // uuid
    videoId: string;
    channelId: string;
    isSubscribedChannel: boolean;
    category?: string;
    watchedAt: string;        // ISO
    watchDurationMs: number;
    videoDurationMs: number;
    repeatCount: number;      // 6장 반복재생이 실제로 몇 회 반복됐는지
    completed: boolean;       // 끝까지 시청했는지
    isAd: boolean;            // 30장 — true면 29.3절 Interest Score 집계에서 제외
}

interface InterestScore {
    scopeType: "category" | "tag" | "channel";
    scopeId: string;           // categoryId / tag 문자열 / channelId
    score: number;             // 29.3절 가중치 계산 결과
    lastComputedAt: string;
}

interface RecommendationCandidate {
    videoId: string;
    channelId: string;
    matchedScopeType: "category" | "tag";
    matchedScopeId: string;
    score: number;             // InterestScore와 콘텐츠 유사도를 결합한 추천 점수
    status: "new" | "shown" | "dismissed" | "watched";
    discoveredAt: string;
}
```

---

# 20. 참고할 공개 프로젝트

## LoopLock

GitHub:

https://github.com/SugnCheng/looplock-extension

참고 영역:

* Manifest V3
* TypeScript
* YouTube Content Script
* Player 제어
* Floating Panel
* A-B Loop
* Keyboard Shortcut
* YouTube SPA 페이지 변경 처리

특히 A-B Repeat 기능 구현 시 우선적으로 구조를 분석한다.

---

## yt-dlp

GitHub:

https://github.com/yt-dlp/yt-dlp

용도:

* 영상 다운로드
* 오디오 다운로드
* 미디어 정보 추출
* 자막 처리

Extension에 직접 포함하기보다 Local Helper에서 실행하는 구조를 우선 검토한다.

---

## ClipTap

GitHub:

https://github.com/VELLUMCORE/cliptap

참고 영역:

* Browser Extension
* Local Helper
* localhost 통신
* yt-dlp
* FFmpeg
* 구간 다운로드
* Download Queue
* Helper 상태 관리

특히 다음 아키텍처를 주요 참고 대상으로 삼는다.

```text
Browser Extension
       ↓
Local Helper
       ↓
yt-dlp / FFmpeg
```

---

## PocketTube

GitHub:

https://github.com/NabokD/pockettube

참고 영역:

* Subscription Group UX
* Channel Category UX
* YouTube UI Integration
* Subscription 관리 방식

주의:

PocketTube GitHub 저장소는 완전한 소스 코드 공개 저장소가 아니다.

따라서:

> 기능 및 UX 참고용

으로 사용하고 PocketTube 코드를 기반으로 구현하는 프로젝트로 취급하지 않는다.

---

# 21. 구현 우선순위

## Phase 1 — Player MVP

가장 먼저 YouTube Shorts Player 제어 기능을 검증한다.

구현:

* Shorts 감지
* 현재 Video ID 감지
* 반복재생
* 반복 횟수 설정
* 재생속도
* A-B Loop
* Floating Control Panel

목표:

> YouTube Shorts Learning Player 동작 검증

---

## Phase 2 — Personal Organizer

구현:

* Favorite
* Tags
* Memo
* Learning Status
* Watch History

저장:

```text
SQLite (WASM + OPFS) — 2.3절
```

Phase 1에서는 아직 DB 계층(Offscreen+Worker, 2.3절)이 없을 수 있으므로, Phase 2 착수 시점에 `db/` 모듈(18장)을 먼저 세팅한다.

---

## Phase 3 — Channel Organizer

구현:

* Channel Category
* Category 생성
* Category 수정
* Channel 등록
* Channel 다중 Category
* Category별 Channel 보기

---

## Phase 4 — Shorts Category Feed

구현:

```text
English Shorts
Cycling Shorts
IT Shorts
AI Shorts
```

카테고리별 Shorts Feed를 구성한다.

이 단계에서 필요하다면 YouTube Data API 및 Google OAuth 도입을 검토한다.

**Phase 4.5 — 미구독 Shorts 자동 분류 + 자동 연속재생 (28장):** Phase 4가 안정화된 뒤 확장한다. 구성 요소는 28장 참고.

```text
Discovery Collector (passive scan)
        ↓
Category Classifier (rule-based)
        ↓
ChannelCategoryGuess Cache
        ↓
Category Queue
        ↓
Autoplay Override (재생 종료 → 큐의 다음 항목)
```

이 Phase는 Phase 4의 "구독 채널 카테고리" 기반이 먼저 사용 가능해야 의미가 있으므로 반드시 Phase 4 다음에 온다.

---

## Phase 5 — Learning System

구현:

* 학습 상태
* 학습 History
* 반복 기록
* 학습 시간
* Review 목록
* Learning Dashboard

---

## Phase 6 — Download Helper

구현:

```text
Extension
   ↓
localhost API
   ↓
Local Helper
   ↓
yt-dlp
   ↓
FFmpeg
```

지원:

* Full Video
* A-B Section
* Audio
* Subtitle

이 Phase는 15.1절 배포 정책에 따라 **개발/개인 사용 빌드에서만** 완성한다. 공개 배포 빌드 산출물에는 이 Phase의 코드가 번들되지 않도록 빌드 구성을 분리한다.

---

## Phase 7 — Sync

필요한 경우 추가한다.

```text
Google Login
       ↓
User Settings
       ↓
Category
Favorite
Tags
Memo
Learning History
       ↓
Multiple Chrome Devices
```

---

## Phase 8 — Interest Profiling & Recommendation (29장)

번호상 8번이지만 실제 착수 시점은 로드맵 순서(Sync=Phase 7)와 무관하게 **Phase 4.5(Discovery Collector) 완료 직후**로 앞당길 수 있다 — Discovery Collector가 이미 구독/미구독 Shorts 메타데이터를 축적하고 있어야 관심사 분석이 의미를 가지기 때문이다. 기존 Phase 1~7 번호를 보존하기 위해 뒤에 추가했다.

구현:

```text
Watch Event 로깅 (재생/반복/완료 여부)
        ↓
Interest Score 집계 (카테고리·태그·채널별)
        ↓
Recommendation Candidate 스코어링
        ↓
추천 피드 UI
```

자세한 내용은 29장 참고.

---

## Phase 9 — Ad Shorts Detection (30장)

번호는 뒤지만 **Phase 8(Interest Profiling)이 광고 시청을 관심사로 오판하지 않으려면 Phase 9의 `isAd` 판정 로직이 먼저 있거나 최소한 함께 있어야 한다** — Phase 8과 동시에 진행하거나 그 직전에 마친다. Discovery Collector(Phase 4.5)가 수집하는 메타데이터에 광고 판별 신호를 얹는 구조라 Phase 4.5 이후 아무 때나 착수 가능하다.

구현:

```text
Platform Ad Slot 감지 (DOM)
        +
유료광고 disclosure 배지 감지
        +
제목/해시태그 키워드 매칭 (#ad, 유료광고, 협찬 등)
        ↓
   isAd / adConfidence 판정
        ↓
Category Queue 자동 스킵 + Sponsored 카테고리 편입
```

자세한 내용은 30장 참고.

---

# 22. MVP 범위

첫 버전에서 모든 기능을 구현하지 않는다.

권장 MVP:

```text
YouTube Shorts
      │
      ▼
Extension Panel
      │
 ┌────┼──────────┐
 │    │          │
Repeat Speed   Favorite
 │
A-B Loop
 │
Memo
```

MVP 기능:

1. Shorts 인식
2. 반복 횟수 설정
3. A-B 반복
4. 재생속도
5. Favorite
6. Memo
7. Local Storage

이 정도만 완성해도 실제 사용 가능한 Extension이 된다.

---

# 23. 개발 원칙

### 1. YouTube DOM 의존 최소화

YouTube는 UI 및 DOM 구조를 자주 변경한다.

DOM selector를 코드 전체에 분산시키지 않는다.

```text
YouTubeAdapter
```

같은 계층으로 격리한다.

---

### 2. Player와 Organizer 분리

```text
Player Engine
```

과

```text
Organizer
```

를 독립 모듈로 구현한다.

---

### 3. Download 기능 분리

Extension Core가 yt-dlp에 직접 의존하지 않도록 한다.

```text
Extension
     ↓
Download Interface
     ↓
Local Helper
```

구조를 사용한다. (15.1절 배포 정책의 전제 조건이므로 예외 없이 지킨다 — Download Interface 뒤로 격리되어 있어야 공개 빌드에서 해당 모듈만 번들 제외가 가능하다.)

---

### 4. YouTube API 의존 최소화

가능한 기능은 현재 브라우저의 YouTube 환경에서 처리한다.

API가 반드시 필요한 기능만 YouTube Data API를 사용한다.

---

### 5. 학습 기능을 독립 Domain으로 설계

Learning 기능을 Shorts 전용 코드로 만들지 않는다.

향후:

```text
YouTube Shorts
YouTube Video
Local Video
Audio
Podcast
```

등에서도 사용할 수 있도록 다음 구조를 고려한다.

```text
Media
  │
Learning Engine
  │
 ├ Repeat
 ├ A-B Loop
 ├ Speed
 ├ Memo
 ├ Tags
 └ Learning Status
```

---

### 6. 자동 콘텐츠 수집은 "관찰"로 한정한다 (28장)

미구독 Shorts를 분류하기 위해 별도의 크롤러/폴러가 YouTube를 능동적으로 긁어오지 않는다.

```text
Active Crawling   ✗  (ToS 리스크, 서버 부하 유발 가능)
Passive Observing ✓  (사용자가 실제로 유튜브를 탐색하며 화면에 노출된 것만 수집)
```

Discovery Collector는 사용자가 홈 피드/Shorts 피드/검색결과를 스크롤하는 동안 Content Script가 관찰 가능한 DOM/메타데이터만 수집한다. 사용자가 유튜브를 열어두지 않은 시간에는 아무 것도 수집하지 않는다.

---

# 24. 최종 목표 Architecture

```text
                 Chrome Extension
                        │
              ┌─────────┴─────────┐
              │                   │
       YouTube Adapter       Extension UI
              │                   │
        ┌─────┴─────┐       ┌─────┴──────┐
        │           │       │            │
      Video       Shorts  Organizer    Learning
      Player      Player   Manager      Manager
        │           │       │            │
        └──────┬────┘       └─────┬──────┘
               │                  │
               └────────┬─────────┘
                        │
                  Media Engine
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       Repeat         A-B Loop       Speed
          │             │             │
          └─────────────┼─────────────┘
                        │
                   Storage Layer (메시지 패싱)
                        │
                        ▼
          Offscreen Document + Worker
                        │
             ┌──────────┴──────────┐
             │                     │
      sqlite-wasm (OPFS)   chrome.storage.local
             │                (경량 UI 설정)
             │ Optional
             ▼
       Sync Provider


               Download Interface
                        │
                        ▼
                  Local Helper
                        │
                 ┌──────┴──────┐
                 │             │
              yt-dlp         FFmpeg
```

---

# 25. 프로젝트 방향 요약

본 프로젝트는 기존 YouTube를 대체하는 프로그램이 아니다.

YouTube 위에서 동작하는:

> **Personal YouTube Organizer**

이면서 동시에

> **Short-form Learning Player**

역할을 수행하는 Chrome Extension을 목표로 한다.

특히 핵심 차별점은 다음과 같다.

```text
YouTube Subscription
        +
Channel Category
        +
Shorts Category Feed
        +
N-times Repeat
        +
A-B Repeat
        +
Playback Speed
        +
Favorite / Tag / Memo
        +
Learning History
        +
Interest Profiling / Recommendation
```

단순한 Shorts 반복 프로그램보다 **콘텐츠 관리 + 학습 도구**라는 방향으로 설계한다.

---

# 26. 개발 시작 권장 순서

실제 개발은 다음 순서로 시작한다.

```text
1. Manifest V3 Extension 생성
             ↓
2. YouTube Content Script Injection
             ↓
3. Shorts 페이지 감지
             ↓
4. HTMLVideoElement 탐색
             ↓
5. 현재 Video ID 추출
             ↓
6. Repeat × N 구현
             ↓
7. A-B Repeat 구현
             ↓
8. Floating Learning Panel
             ↓
9. Favorite / Memo 저장
             ↓
10. Channel Category
             ↓
11. Category Shorts Feed
             ↓
12. Local Helper / Download
```

초기 개발 단계에서는 Google Login, YouTube API, Download 기능부터 구현하지 않는다.

먼저:

> **Shorts를 정확하게 감지하고 원하는 횟수만큼 안정적으로 반복시킬 수 있는가?**

를 첫 번째 기술 검증 목표로 한다.

이 기능이 안정적으로 동작하면 그 위에 Organizer와 Learning 기능을 단계적으로 확장한다.

---

# 27. 기존 유사 프로그램 조사 (2026-09-01)

착수 전 시장 조사 결과. 이 프로젝트가 제안하는 기능 조합(구독 카테고리 분류 + Shorts 카테고리 피드 + N회 반복 + A-B 반복 + 다운로드 + 학습 관리)을 **하나로 묶어 제공하는 기존 프로그램은 발견되지 않았다.** 기능별로 아래처럼 파편화되어 있으며, 각 카테고리의 대표 도구는 설계·차별화 시 참고 대상으로 삼는다.

## 27.1 구독 피드 정리 / Shorts 제거·분리
* **FreeTube** (오픈소스 데스크톱 앱, Win/Mac/Linux) — 구독 채널을 Videos/Shorts/Live/Posts 탭으로 모아 보여줌, 추천 알고리즘 없음, 로컬 파일 기반. https://docs.freetubeapp.io/about/freetube
* **Feedvault** — 구독 피드를 시간순/그룹별로 재구성, Shorts 제외 옵션. https://getfeedvault.com/alternative-to-youtube-subscription-feed/
* **Unhook** (크롬 확장) — youtube.com에서 추천/Shorts/댓글 숨김.

## 27.2 채널·Shorts 카테고리 분류
* **YouTube Categories** (크롬 확장) — 구독 채널을 카테고리별 그룹화. https://chromewebstore.google.com/detail/youtube-categories/foifdpnfkmpcknplaldpfhifhhkleoka
* **YouTube Content Filter** — Productive/Learning/Custom 모드로 카테고리 차단·필터. https://chromewebstore.google.com/detail/youtube-content-filter/kdnbkjboiljlinakaokmcbhfibjoeaid
* **Filter by Videos or Shorts** — 구독 피드를 영상/Shorts로 분리. https://chromewebstore.google.com/detail/filter-by-videos-or-short/pefcpfobggmkgkdfdlfoclmndjbkhoae
* **PocketTube** — 구독 그룹 UX 참고용 (20장 참고, 소스 비공개).

## 27.3 반복재생 (횟수 지정, A-B 루프)
* **Repeat for YouTube™ A-B — HNE Looper** — A-B 구간 반복 + 반복 횟수(∞ 또는 N) 지정, **Shorts에서도 동작 확인됨**. 이 프로젝트의 6·7장 기능과 가장 근접한 기존 사례. https://chromewebstore.google.com/detail/repeat-for-youtube-a-b-%E2%80%94/ebcapjdglkfgiinemiealmelhhgkndgi
* **Section Repeat for YouTube™** — A/B 루프, Shorts 지원.
* **YouTube Repeat** — 반복 횟수 지정(예: 10회) 가능. https://chromewebstore.google.com/detail/youtube-repeat/jhkfddihpaahlogkaaljcfjlfpiomacl
* **YouTube Looper / Looper for YouTube** — 탭별 반복 설정, 자동 반복 토글.

## 27.4 다운로드
* **Tubly Downloader** — 4K 다운로드, MP3 변환, Shorts 저장 지원(무료 480p, 유료 1080p/MP3). https://tubly.download/
* **YouTube Video and Short Saver** — Shorts 저장 전용 무료 확장.
* 공통적으로 YouTube ToS 위반 소지를 안고 운영되는 영역 — 15.1절 배포 정책의 근거.

## 27.5 어학 학습 특화 (가장 근접한 선례)
* **Language Reactor** — YouTube/Netflix 이중 자막 + 단어 클릭 사전 + `S` 키로 현재 자막 문장 즉시 반복 + 자동 일시정지. "반복재생으로 어학 공부"라는 이 프로젝트의 핵심 동기와 가장 유사한 성숙한 도구이지만, **Shorts 전용이 아니고 카테고리 분류·Favorite/Tag/학습상태 관리 기능은 없음** — 이 프로젝트의 차별점이 유지되는 지점. https://www.languagereactor.com/help/basic

## 27.6 결론
* 개별 기능(반복, 필터, 다운로드, 학습용 자막 반복)은 각각 성숙한 도구가 이미 존재하므로, 신규 구현 시 UX/키바인딩 관례(예: HNE Looper의 Set A/Set B, Language Reactor의 `S`=반복재생)를 참고해 사용자 학습 곡선을 낮추는 것이 유리하다.
* 이 프로젝트의 실질적 차별점은 **"Shorts 카테고리 피드 + 채널 카테고리 + 학습 상태/태그/메모를 하나의 로컬 데이터 모델로 통합"**하는 부분이며, 이 조합을 제공하는 기존 제품은 조사 범위 내에서 없었다. MVP(22장)는 이 통합보다 반복재생 코어 검증을 우선하지만, Phase 3~5(채널 카테고리·Shorts 피드·학습 시스템)가 실제 차별화 지점임을 설계 시 계속 상기할 것.

---

# 28. 미구독 Shorts 자동 카테고리 분류 + 카테고리 내 자동 연속재생

## 28.1 배경 및 목표

지금까지의 카테고리 분류(4장, 5장)는 "사용자가 구독한 채널을 수동으로 카테고리에 등록"하는 것을 전제로 했다. 하지만 실제로 Shorts를 소비하는 경로의 상당수는 **구독하지 않은 채널의 추천 Shorts**이며, 이 콘텐츠는 지금 구조에서는 카테고리 밖에 남는다.

목표는 다음 두 가지다.

1. 구독 여부와 무관하게 사용자가 유튜브를 이용하는 동안 노출된 Shorts를 카테고리별로 **자동** 정리한다 (수동 채널 등록 불필요, 백그라운드에서 갱신).
2. 사용자는 카테고리 화면에서 썸네일을 훑어보고 하나를 클릭하는 것으로 시청을 "시작"만 하면 된다 — 이후 다음 영상으로 넘어가는 것은 **추가 조작 없이** 같은 카테고리 안에서 자동으로 이어진다 (YouTube 기본 Shorts의 무한 스크롤과 같은 몰입감을, 알고리즘이 아니라 사용자가 고른 카테고리 안에서 제공).

```text
[ 오늘 처음 보는 채널의 Shorts ]
         │
         ▼
   자동 카테고리 분류 (28.3)
         │
         ▼
   카테고리 썸네일 그리드 (28.6)
         │  (사용자가 1개 클릭)
         ▼
      재생 시작
         │  (반복 설정 있으면 반복 먼저 소진 — 6장)
         ▼
      재생 종료
         │  (추가 액션 없음)
         ▼
 같은 카테고리의 다음 Shorts 자동 재생 (28.4)
```

## 28.2 Discovery Collector (관찰 기반 수집)

사용자가 유튜브 홈/Shorts 피드/검색 결과를 스크롤하거나 Shorts를 시청하는 동안, Content Script가 화면에 노출된 Shorts 카드(및 현재 재생 중인 Shorts)의 메타데이터만 수동적으로 관찰해 수집한다.

수집 대상 (화면에 이미 렌더링된 정보만 사용, 별도 API 호출/크롤링 없음):

```text
videoId
title
channelId
channelName
thumbnail
hashtags (설명/오버레이에 노출된 것)
noticedAt
```

* 사용자가 유튜브를 열어두지 않은 동안에는 아무 것도 수집하지 않는다 (23장 신설 원칙 6 참고).
* 이미 분류가 끝난 채널(28.3절 캐시 hit)의 새 영상은 분류기를 다시 돌리지 않고 캐시된 카테고리를 바로 적용한다 — 매 영상마다 분류를 재실행하지 않아 성능 부담을 줄인다.

**기본 수집 범위 (2026-09-01 명확화):** 수집은 "사용자가 클릭해서 재생한 것"에 한정되지 않는다. **클릭 여부와 무관하게, 화면에 노출(exposure)된 Shorts 카드는 기본적으로 전부 수집 대상이다** — 피드를 스크롤만 하고 지나친 영상도 카테고리 분류(28.3절)와 광고 판별(30장)의 입력 데이터로 쓴다. 이는 29장 `WatchEvent`(실제 재생·반복 등 "시청" 행위만 기록)와는 별개 개념이므로 혼동하지 않는다 — 노출 수집은 "채널/영상 카탈로그를 넓히기 위한 것", WatchEvent는 "관심도를 측정하기 위한 것"이다.

## 28.3 Category Classifier (규칙 기반, 교체 가능한 인터페이스)

Local-first 원칙(2.1절) 및 OAuth 최소화 원칙(2.2절)에 따라, 1차 구현은 서버·ML API 호출 없이 브라우저 안에서 끝나는 **키워드/규칙 기반 분류기**로 시작한다.

```text
Video (title + hashtags + channelName)
            │
            ▼
   Category.keywords 매칭 (19장 Category.keywords)
            │
            ▼
   매칭 스코어 최고 카테고리 채택 (동률/무매칭 시 "미분류")
            │
            ▼
   ChannelCategoryGuess 갱신 (해당 채널의 sampleCount, confidence 누적)
```

설계 원칙:

* 분류 로직은 `CategoryClassifier` 인터페이스 뒤로 격리한다 (Download Interface와 동일한 패턴, 23장). 1차 구현은 `KeywordCategoryClassifier`이며, 향후 필요 시 임베딩/로컬 소형 모델 기반 구현으로 교체 가능하게 한다 — Extension Core는 구체 구현을 알지 못해야 한다.
* 채널 단위로 여러 영상이 쌓이면 `ChannelCategoryGuess.confidence`가 올라가고, 이후 같은 채널의 새 영상은 재분류 없이 캐시를 즉시 적용한다.
* 오분류 시 사용자가 카테고리 피드(28.6절)에서 해당 영상/채널을 다른 카테고리로 직접 옮길 수 있어야 하며, 이 수동 정정은 `Video.category`(직접 지정, `categorySource: "manual"`) 또는 `ChannelCategoryGuess.userOverride`(채널 전체 정정)로 저장되어 이후 자동 분류보다 항상 우선한다.
* 미분류 영상은 숨기지 않고 별도의 "미분류(Unsorted)" 카테고리에 모아두어, 사용자가 원할 때 카테고리를 만들어 배정할 수 있게 한다.

## 28.4 Category Queue & 자동 연속재생

카테고리 화면에서 사용자가 클릭해 재생을 시작하면, 그 순간 해당 카테고리의 미시청 Shorts 목록으로 큐를 구성한다.

```text
CategoryQueue {
    category: string
    items: videoId[]      // Discovery Collector가 수집한 해당 카테고리 영상들
    cursor: number          // 현재 재생 위치
}
```

재생 종료 이벤트(6장 Repeat Controller가 설정된 반복을 모두 소진한 시점) 발생 시:

```text
재생 종료
   │
   ▼
CategoryQueue.cursor + 1
   │
   ▼
다음 videoId 존재?
   │
  ┌┴───────────┐
 있음          없음
  │             │
  ▼             ▼
해당 Shorts   YouTube 기본
로 SPA 이동   다음 동작으로 폴백
(자동 재생)   (또는 대기 화면 표시)
```

* 기술적으로는 YouTube Shorts 플레이어의 "다음 영상(스와이프/자동재생)" 동작을 가로채, 유튜브 알고리즘이 고르는 다음 영상 대신 **Category Queue의 다음 videoId로 강제 이동**시키는 방식이다 (`/shorts/{videoId}` 로 SPA 네비게이션 — 20장 LoopLock 참고자료의 "YouTube SPA 페이지 변경 처리" 대응 방식과 동일 계열의 기법 사용).
* 이미 시청한(현재 세션에서 재생 완료된) 항목은 큐에서 제외해 같은 영상이 반복 노출되지 않게 한다. 단, 6장의 "N회 반복"은 이 자동 연속재생과 별개 개념이므로 혼동하지 않는다 — 반복은 "같은 영상 안에서", 연속재생은 "영상 간 이동"이다.
* 큐가 소진되면(신규 미시청 영상이 더 없으면) Discovery Collector가 그 사이 새로 관찰한 영상으로 큐를 보충하거나, 없으면 사용자에게 "이 카테고리에 더 볼 영상 없음"을 안내하고 유튜브 기본 피드로 폴백한다 — 무리하게 새 영상을 확보하려고 능동 크롤링을 하지 않는다(28.2절 원칙 유지).

## 28.5 UI — Discovery 카테고리 피드 (썸네일 그리드)

5장의 카테고리 탭 UI를 그대로 확장해서 쓰되, 그리드 아이템에 출처 배지를 추가한다.

```text
SHORTS — English

┌────────┐ ┌────────┐ ┌────────┐
│ [thumb]│ │ [thumb]│ │ [thumb]│
│  ⭐구독 │ │        │ │        │
└────────┘ └────────┘ └────────┘
┌────────┐ ┌────────┐ ┌────────┐
│ [thumb]│ │ [thumb]│ │ [thumb]│
└────────┘ └────────┘ └────────┘
```

* `⭐구독` 배지 = 구독 채널 출처, 배지 없음 = 자동 분류된 미구독 발견 콘텐츠.
* 아무 썸네일이나 클릭 → 그 시점 그리드 순서(또는 최신순 등 5장의 필터 기준)대로 Category Queue를 구성해 재생 시작.
* 그리드는 Discovery Collector가 새 영상을 관찰할 때마다 백그라운드에서 갱신되며, 사용자가 그리드를 다시 열 때마다 최신 상태를 반영한다 (실시간 push가 아니라 화면 진입 시점 재조회로 충분).

## 28.6 데이터 모델 반영

19장의 `Video`, `Category`, `ChannelCategoryGuess` 인터페이스에 이미 이 장에서 필요한 필드를 반영해 두었다 (`isSubscribedChannel`, `category`, `categorySource`, `categoryConfidence`, `discoveredAt`, `Category.keywords`, `ChannelCategoryGuess`). 새 필드 추가 시 이 장과 19장을 함께 갱신할 것.

## 28.7 리스크 및 제약

* **오분류**: 키워드 기반 분류는 완벽하지 않다. 오분류 자체보다 "정정이 쉬운가"가 더 중요하므로 28.3절의 수동 override 경로를 MVP 단계부터 반드시 함께 만든다.
* **YouTube DOM 변경 취약성**: Discovery Collector와 자동 연속재생 오버라이드 모두 YouTube 내부 DOM/SPA 라우팅에 의존한다 — 23장 원칙 1(YouTubeAdapter 계층 격리)을 이 기능에도 예외 없이 적용한다.
* **개인정보/수집 범위**: 수집은 어디까지나 "현재 로그인한 사용자 자신의 브라우저 화면에 노출된 정보"이며 로컬 저장소를 벗어나지 않는다 (2.1절 Local-first 유지). 서버 전송·타 사용자 데이터 집계는 이 프로젝트 범위에 포함하지 않는다.
* **이 기능은 Phase 4.5(21장)로, Phase 1~4가 안정화된 뒤 착수한다** — Discovery/자동 분류/자동 연속재생은 구독 채널 카테고리 피드가 먼저 정상 동작해야 검증 가능하다.

---

# 29. 시청 관심사 분석 + 신규 채널 추천

## 29.1 배경 및 목표

사용자가 특정 주제의 쇼츠/영상을 반복해서 찾아본다면(구독 여부와 무관하게), 그 자체가 "이 사용자는 이 주제에 관심이 많다"는 신호다. 지금까지의 카테고리 분류(4·5·28장)는 콘텐츠를 "정리"하는 데 초점이 있었다면, 이 장은 그 정리된 데이터를 근거로 **사용자의 관심사를 수치화하고, 아직 발견하지 못한 신규 채널의 비슷한 콘텐츠를 먼저 찾아 보여주는 것**이 목표다.

```text
반복 시청 / 즐겨찾기 / 완주율 높음
              │
              ▼
      Watch Event 로깅 (29.2)
              │
              ▼
   Interest Score 집계 (29.3) ── "이 사용자는 English/Cycling에 관심 高"
              │
              ▼
Discovery Collector(28장)가 관찰한 새 채널/영상과 매칭 (29.4)
              │
              ▼
        추천 후보 스코어링
              │
              ▼
         추천 피드 노출 (29.5)
```

## 29.2 Watch Event 로깅

Player Engine(6·7·8장)이 이미 알고 있는 재생 정보를 그대로 이벤트로 남긴다 — 별도 추적 코드를 새로 만들지 않고 기존 Repeat Controller/A-B Loop 훅에 로깅만 추가한다.

기록 시점:

```text
재생 시작   → WatchEvent 생성 (videoId, channelId, isSubscribedChannel, category)
재생 중     → watchDurationMs 누적
반복 발생   → repeatCount 증가 (6장 Repeat Controller와 동일 카운터 재사용)
재생 종료   → completed 여부 확정, WatchEvent 저장(SQLite INSERT)
```

즐겨찾기(9장)·학습상태 LEARNING/LEARNED(12장) 지정도 관심 신호로 함께 취급하되, 별도 이벤트 타입으로 남기기보다 29.3절 점수 계산 시 `Video.favorite`/`learningStatus`를 가중치로 반영하는 편이 테이블 구조가 단순해진다.

## 29.3 Interest Score 계산

SQLite의 SQL 집계 기능을 그대로 활용한다 (2.3절에서 SQLite를 택한 실질적 이유 중 하나).

계산에 반영하는 신호(모두 조정 가능한 가중치):

```text
시청 횟수         (많을수록 +)
반복재생 횟수      (많을수록 +, 어학 학습 의도 강한 신호)
완주 여부         (완주 +, 중간 이탈 −)
즐겨찾기 여부      (+)
학습상태 LEARNING/LEARNED (+)
최신성            (최근 시청일수록 가중치 ↑, 오래된 시청은 decay)
```

집계는 `category`, `tag`, `channelId` 세 가지 스코프(19장 `InterestScore.scopeType`)로 각각 계산해 별도 저장한다 — 카테고리 단위 관심도와 특정 채널에 대한 애착은 다른 정보이기 때문이다.

**광고 제외 (30장 연계):** 집계 쿼리는 항상 `WHERE isAd = false` 조건을 건다. 광고를 몇 번 봤다고 해서 그 카테고리에 관심이 있다고 오판하면 안 되기 때문이다.

계산 주기는 매 WatchEvent마다 실시간 갱신하지 않고, Offscreen Worker(2.3절)에서 유휴 시점(예: 유튜브 탭이 백그라운드로 전환될 때, 또는 하루 1회)에 증분 재계산한다 — 실시간성보다 배터리/CPU 비용을 우선한다.

## 29.4 추천 후보 매칭 (Recommendation Engine)

28장 Discovery Collector가 이미 관찰해 둔, **아직 사용자가 보지 않은** 영상들 중에서 Interest Score가 높은 스코프(카테고리/태그/채널)와 일치하는 것을 추천 후보로 끌어올린다.

```text
Discovery Collector가 관찰한 영상
     (아직 WatchEvent 없음)
              │
              ▼
   category/tag가 상위 Interest Score와 일치?
              │
       ┌──────┴──────┐
      예              아니오
       │               │
       ▼               ▼
RecommendationCandidate   버림 (저장 안 함 — 불필요한 행 누적 방지)
  로 저장, score 부여
```

* score는 "콘텐츠가 얼마나 관심사와 맞는가(카테고리/태그 일치도)" × "그 스코프에 대한 InterestScore"로 계산하는 단순 곱셈 모델로 시작한다 (28.3절 규칙 기반 분류기와 마찬가지로, 처음부터 ML을 도입하지 않는다).
* 이미 구독 중인 채널의 새 영상은 애초에 5장 카테고리 피드로 노출되므로, 추천 후보는 **미구독 채널** 중심으로 걸러낸다 (`isSubscribedChannel: false`).
* 사용자가 추천을 무시(dismiss)하면 `status: "dismissed"`로 남기고 같은 영상/채널을 반복 추천하지 않는다 — 이 dismiss 이력 자체도 향후 점수 계산에 (약한) 음의 신호로 반영할 수 있다.

## 29.5 UI — 추천 피드

기존 카테고리 탭(5장/28.5절) 옆에 별도 탭으로 둔다. 카테고리 피드는 "사용자가 고른 카테고리"를, 추천 피드는 "시스템이 관심사 기반으로 고른 항목"을 보여준다는 점에서 목적이 다르므로 섞지 않는다.

```text
[ ALL ] [ English ] [ Cycling ] [ ⭐ For You ]

⭐ For You  (관심사 기반 추천)

┌────────┐ ┌────────┐ ┌────────┐
│ [thumb]│ │ [thumb]│ │ [thumb]│
│ 신규채널│ │ 신규채널│ │ 신규채널│
└────────┘ └────────┘ └────────┘

왜 추천됐는지 표시:
"English 관심도 높음 · 유사 채널"
```

* 추천 이유(matchedScopeType/matchedScopeId)를 짧게 노출해 사용자가 "왜 이게 떴는지" 알 수 있게 한다 — 블랙박스 추천이 아니라 28장에서 이미 확립한 "정정 가능한 분류"라는 철학과 일관되게, 추천도 근거를 보여주고 사용자가 dismiss로 직접 피드백할 수 있게 한다.

## 29.6 데이터 모델

19장에 `WatchEvent`, `InterestScore`, `RecommendationCandidate`를 이미 반영해 두었다.

## 29.7 프라이버시 / 로컬 유지 원칙

* 관심사 프로파일과 추천 후보는 모두 로컬 SQLite 파일(2.3절) 안에만 존재한다. 외부 서버로 전송하거나 다른 사용자와 비교하는 기능은 이 프로젝트 범위에 포함하지 않는다 (2.1 Local-first, 23장 원칙 6과 동일한 기준 적용).
* Discovery Collector(28.2절)의 "관찰만 하고 능동 수집하지 않는다"는 원칙이 이 장에도 그대로 적용된다 — 추천 후보를 늘리기 위해 별도로 유튜브를 더 긁어오지 않는다. 사용자가 유튜브를 실제로 둘러본 만큼만 추천 풀이 쌓인다.

## 29.8 Phase 배치

21장 **Phase 8**로 등록했다. 번호와 무관하게 실제 착수는 Phase 4.5(Discovery Collector) 직후가 자연스럽다 — 자세한 내용은 21장 Phase 8 항목 참고.

---

# 30. 광고성 Shorts 감지 및 처리

## 30.1 배경 및 목표

28.2절에서 확정한 대로 Discovery Collector는 시청 여부와 무관하게 노출된 모든 Shorts를 기본 수집한다. 문제는 이 노출 대상에 **YouTube 자체 광고 슬롯**과 **협찬/유료광고 콘텐츠**가 섞여 있다는 점이다. 이 둘을 걸러내지 않으면:

* 광고를 몇 번 봤다고 관심사(29장)로 오판되고, 그 관심사를 근거로 또 비슷한 광고성 콘텐츠가 추천되는 악순환이 생긴다.
* 카테고리 자동 연속재생(28.4절)이 사용자가 원하지 않는 광고로 이어질 수 있다.

목표는 광고를 완전히 숨기는 것이 아니라 **"의도치 않게 섞여 들어오는 것"을 막는 것**이다 — 사용자가 원하면 광고성 콘텐츠도 별도 카테고리에서 확인할 수 있게 남겨둔다.

```text
Discovery Collector가 관찰한 Shorts
              │
              ▼
      Ad Shorts Detector (30.3)
              │
       ┌──────┴──────┐
     광고 아님        광고로 판정
       │               │
       ▼               ▼
 일반 카테고리       📢 Sponsored/Ad
 분류(28.3)로 진행    카테고리로 격리
       │               │
       ▼               ▼
 카테고리 큐/추천에    카테고리 큐/추천에서
 정상 포함             기본 제외 (원할 때만 열람)
```

## 30.2 감지 대상 두 갈래

### (a) Platform Ad Slot — YouTube 자체 유료 광고

Shorts 피드 사이에 YouTube가 직접 삽입하는 광고 슬롯. "Sponsored"/광고 배지, 건너뛰기 버튼, 광고 전용 컨테이너 등 DOM상의 뚜렷한 표식으로 식별 가능하다. 신뢰도가 가장 높은 신호다.

### (b) Sponsored/Branded Content — 협찬·유료광고 표시가 붙은 일반 영상

채널이 자발적으로 올리지만 법적으로 유료광고 여부를 표시해야 하는 콘텐츠. 감지 신호:

* YouTube 자체 "유료 프로모션 포함(Includes paid promotion)" 디스클로저 오버레이/배지
* 제목·설명·해시태그 키워드: `#ad`, `#sponsored`, `유료광고`, `유료광고 포함`, `협찬`, `광고 포함`, `제공받아 작성` 등 — 특히 한국 표시·광고법상 "유료광고 포함" 문구가 국내 채널에는 의무 표기라 신뢰도 높은 키워드 신호로 활용 가능

### (c) 노골적 홍보성 콘텐츠 (디스클로저 없음) — 낮은 우선순위

디스클로저 표시 없이도 사실상 광고에 가까운 콘텐츠(예: 특정 상품 홍보 위주 채널)는 오탐 위험이 커서 1차 구현 범위에서 제외하고, `adConfidence`를 낮게 주는 참고 신호 정도로만 남겨둔다 (완전 자동 차단 대상 아님).

## 30.3 Ad Shorts Detector

28.3절 `CategoryClassifier`와 동일한 패턴으로, 구체 판별 로직을 인터페이스 뒤에 격리한다 (`AdShortsDetector`). Extension Core는 "판정 결과(`isAd`, `adConfidence`, `adSignals`)"만 소비하고 판별 방식은 몰라도 되게 한다.

```text
signals = []
if (Platform Ad Slot DOM 감지)      signals.push("platform_ad_slot"); confidence = 1.0
if (디스클로저 배지 감지)             signals.push("disclosure_badge")
if (키워드 매칭)                     signals.push("keyword:<matched>")

adConfidence = signals 조합으로 산출 (platform_ad_slot 단독으로도 즉시 1.0)
isAd = adConfidence >= threshold (기본 0.6, 설정 가능)
```

* 28.3절 카테고리 분류와 마찬가지로 이 판정도 **오판 정정이 쉬워야 한다** — 사용자가 Sponsored 카테고리에서 특정 영상/채널을 "광고 아님"으로 되돌리면 그 채널의 이후 판정에도 반영한다(`ChannelCategoryGuess`처럼 채널 단위 화이트리스트 캐시를 별도로 둔다).
* 반대로 놓친 광고(디스클로저 없이 올라온 것)는 이 감지기가 못 잡을 수 있다는 한계를 인정한다 — "최대한 걸러내는 것"이지 "완전 차단"을 보장하지 않는다.

## 30.4 처리 정책

| 상황 | 처리 |
|------|------|
| 카테고리 자동 연속재생(28.4) 중 다음 큐 항목이 광고 | 사용자 개입 없이 자동 스킵, 그다음 항목으로 진행 |
| 카테고리 피드(5장/28.5)·추천 피드(29.5) | 기본적으로 제외 (설정에서 노출 여부 토글 가능) |
| 📢 Sponsored/Ad 고정 카테고리 | 광고로 판정된 항목을 삭제하지 않고 모아둠 — 사용자가 원할 때 직접 열람 |
| Interest Score 집계(29.3) | `isAd = true` 인 WatchEvent는 집계에서 제외 |
| Recommendation Candidate(29.4) | 광고 판정 콘텐츠는 애초에 후보로 만들지 않음 |

## 30.5 데이터 모델

19장 `Video`에 `isAd`/`adConfidence`/`adSignals`, 29장 `WatchEvent`에 `isAd`를 이미 반영해 두었다.

## 30.6 리스크

* **과탐지(false positive)**: 정상 콘텐츠가 광고로 잘못 분류되면 사용자가 보고 싶은 카테고리에서 빠질 수 있다 → 30.3절의 사용자 정정 경로를 MVP 단계부터 함께 만든다.
* **미탐지(false negative)**: 디스클로저 없는 은근한 광고는 걸러지지 않을 수 있다 → 완벽 차단이 아니라 "명백한 광고를 걸러내는 것"으로 기대치를 설정한다.
* **DOM 의존성**: Platform Ad Slot 감지는 YouTube UI 변경에 취약하므로 23장 원칙 1(YouTubeAdapter 계층 격리)을 그대로 적용한다.

## 30.7 Phase 배치

21장 **Phase 9**로 등록했다. Phase 8(Interest Profiling)의 광고 제외 로직이 의미를 가지려면 Phase 9와 동시에 또는 그 직전에 완료돼야 한다.

## 30.8 일반 영상 삽입 광고(중간광고) 네트워크 차단 (2026-09-01 추가, 범위 확장)

30.1~30.7절은 **Shorts 콘텐츠 자체가 협찬/광고성인지** 판별하는 내용이었다. 이 절은 완전히 다른 문제를 다룬다 — **YouTube가 일반 영상(`/watch`) 재생 중간에 자체적으로 삽입하는 광고(프리롤/미드롤)**를 아예 뜨지 않게 하는 것. 1장·25장의 원래 기획은 "Shorts Organizer + Learning Player"로 Shorts에 한정되어 있었으나, 사용자 요청으로 일반 영상 시청 경험까지 범위가 넓어졌다.

### 방식 결정: 네트워크 레벨 차단 (확정)

두 가지 방식을 검토했다.

| 방식 | 설명 | 채택 여부 |
|------|------|-----------|
| DOM 기반 스킵 | 광고 감지 시 Skip 버튼 자동 클릭, 안 되면 최대한 빨리 넘김 | 기각 — 광고가 짧게라도 화면에 뜸 |
| **네트워크 레벨 차단** | `declarativeNetRequest`로 광고 서버 요청 자체를 차단해 광고가 아예 로드되지 않게 함 | **채택** |

사용자가 "광고가 안 뜨게" 하는 완전 차단을 원해서, uBlock Origin류의 실제 애드블로커에 가까운 두 번째 방식으로 구현한다.

### 구현

`extension/rules/ad-block-rules.json` — Manifest V3 `declarativeNetRequest` 정적 룰셋. `doubleclick.net`, `googlesyndication.com`, `googleadservices.com`, `adservice.google.com`, `static.doubleclick.net` 같은 잘 알려진 광고 서버 도메인과, `youtube.com/pagead/`, `youtube.com/ptracking`, `youtube.com/api/stats/ads`, `youtube.com/get_midroll_` 같은 YouTube 자체의 광고 전용 경로를 차단한다.

```text
manifest.json
   │
   ├── permissions: ["storage", "declarativeNetRequest"]
   └── declarative_net_request.rule_resources
              │
              ▼
       rules/ad-block-rules.json (정적 룰셋, 항상 활성)
```

**절대 차단하면 안 되는 것 (설계 원칙)**: 실제 영상/오디오 스트림은 `googlevideo.com`에서 서빙되고, 플레이어 초기화 API(`youtube.com/youtubei/v1/*` 등)는 광고와 무관하게 항상 필요하다. 이 두 카테고리는 룰셋에서 의도적으로 제외했다 — 광고 서버·광고 전용 경로만 정확히 겨냥해야 영상 재생 자체가 깨지지 않는다.

이 방식은 별도 런타임 토글 없이 **항상 켜져 있다** (정적 룰셋이라 매니페스트 로드 시점에 자동 활성화되고, 끄려면 확장 자체를 비활성화해야 함). 30.4절의 Shorts 스폰서 스킵과 달리 사용자가 껐다 켰다 할 이유가 적다고 판단해 토글 UI를 만들지 않았다 — 필요해지면 `chrome.declarativeNetRequest.updateEnabledRulesets()`로 추가 가능.

### 배포 정책 (15.1절과 동일한 패턴 적용)

광고 차단은 YouTube 이용약관 위반 소지가 있는 영역이라는 점에서 15.1절의 다운로드 기능과 성격이 같다. 다만 uBlock Origin 등 동일 기능을 제공하는 확장이 대규모로 존재하고 널리 용인되는 영역이라 다운로드 기능만큼 법적 리스크가 크지는 않다고 판단하지만, 원칙은 동일하게 적용한다 — **개발/개인 사용 빌드에는 포함하되, 공개 배포 빌드(Chrome 웹스토어 등)로 전환할 때는 반드시 재검토한다.**

### 검증 상태 및 한계 발견 (2026-09-01 실사용 테스트)

실사용 테스트 결과 **네트워크 레벨 차단만으로는 실제 광고 영상 재생을 막지 못한다**는 근본적 한계가 확인됐다. 원인: 구글은 광고 영상 콘텐츠 자체를 일반 영상과 **동일한 CDN 도메인**(`googlevideo.com`)으로 서빙한다 — 애드블로커 회피를 위해 의도적으로 그렇게 설계되어 있다. `doubleclick.net`/`youtube.com/pagead/` 같은 규칙은 "광고를 보여줄지 결정하는" 부가 요청·트래킹만 막을 뿐이고, 일단 스케줄된 광고의 실제 영상 바이트는 `googlevideo.com`을 통해 온다 — 이 도메인은 실제 영상 재생에도 쓰이므로(30.8절 "절대 차단하면 안 되는 것") 막을 수 없다. 즉 순수 도메인 차단으로는 YouTube 광고 영상 자체를 막을 수 없고, 이는 이 프로젝트의 구현 실수가 아니라 uBlock Origin 등 실제 애드블로커들도 겪는 업계 공통의 근본적 제약이다.

## 30.9 DOM 기반 광고 스킵 보강 (2026-09-01 추가)

30.8절의 한계를 보완하기 위해, 실제로 광고가 재생되기 시작하면 DOM에서 감지해서 최대한 빨리 넘기는 보조 장치를 추가했다. 애초에 30.8절 방식 결정 당시 "광고가 짧게라도 화면에 뜬다"는 단점 때문에 기각했던 방식이지만, 네트워크 차단만으로는 원천적으로 불가능하다는 게 실사용 테스트로 확인되어 다시 채택했다 — **둘은 배타적이지 않고 상호 보완적**이다 (네트워크 차단이 트래킹/부가요청을 줄이고, DOM 스킵이 실제로 재생된 광고를 최대한 빨리 끝낸다).

### 구현 — `extension/content/ad-skip.js` (신규 파일, Shorts 로직과 완전히 분리)

```text
0.3초마다 폴링
        │
        ▼
   광고 재생 중인가?
  (.ad-showing / .ad-interrupting 클래스)
        │
   ┌────┴────┐
  아니오      예
   │           │
   ▼           ▼
(변경했던      Skip 버튼 있음?
 음소거/배속       │
 복원)        ┌────┴────┐
             있음        없음
              │           │
              ▼           ▼
          자동 클릭   음소거 + 최대 배속(16x)으로
                      최대한 빨리 지나가게 함
```

* Shorts 전용 `player-controller.js`(반복/A-B 로직)와는 완전히 독립된 파일 — youtube.com 모든 페이지에서 항상 동작한다 (Shorts 페이지에서도 실행되지만 대상 셀렉터가 없으면 그냥 아무 것도 안 함).
* 광고가 끝나면(클래스 사라짐) 우리가 바꿔둔 음소거/배속 상태를 원래대로 복원한다.
* 스킵 버튼은 DOM에 존재해도 카운트다운이 끝나기 전엔 클릭 불가 상태일 수 있어 `offsetParent !== null`(화면에 실제로 보이는지)로 한 번 더 확인한다.
* 실제 브라우저 검증 안 됨 — `.ytp-skip-ad-button` 등은 YouTube 플레이어의 잘 알려진 공개 클래스명이지만 확인 필요.

### 남은 한계 (솔직하게 기록)

이 방식도 완벽하지 않다:
* 스킵 불가능한 광고는 여전히 몇 초간 (음소거+배속 상태로) 화면에 뜬다 — "아예 안 뜨게"는 기술적으로 달성 불가능하다는 게 이번에 확인된 결론.
* 더 강력한 방식(플레이어 초기화 응답의 광고 스케줄 정보를 스크립트 주입으로 가로채 제거하는 방식)도 검토했으나, MAIN world 스크립트 주입 + YouTube 내부 응답 스키마 파싱이 필요해 훨씬 복잡하고 YouTube 쪽 변경에 취약해서 이번에는 보류 — 사용자가 이후 요청하면 재검토.

---

# 31. 구현 현황 (2026-09-01)

## 31.1 Phase 1 초안 MVP 구현됨 — `extension/`

Manifest V3, 빌드 도구 없는 순수 JS/CSS로 `Youtube Window/extension/`에 구현했다. 로드·테스트 방법은 `extension/README.md` 참고.

구현됨 (21장 Phase 1 + 22장 MVP 범위 일부):

* Shorts 페이지/현재 videoId 감지, SPA 네비게이션(`yt-navigate-finish`) 대응 (`content/youtube-adapter.js`)
* 반복재생 N회(1/3/5/10/∞), A-B 구간 반복, 재생속도 (`content/player-controller.js`)
* 유한 반복 횟수(∞ 아님)를 다 채우면 다음 쇼츠로 자동 이동 (`Adapter.goToNextShort()`, 2026-09-01 추가) — ∞ 설정은 지금처럼 같은 영상을 계속 반복
* (2026-09-01 실사용 테스트로 발견) YouTube가 쇼츠 전환 시 `<video>` 엘리먼트를 재사용하면서 `video.loop`을 다시 `true`로 되돌리는 경합이 있어, 두 번째 영상부터 `ended` 이벤트 자체가 안 발생하고 무한 반복되는 버그가 있었음.
  1차 조치: `timeupdate`/`playing`/`loadedmetadata`마다 `video.loop`을 강제로 `false`로 되돌리는 `enforceNoNativeLoop()` — 경합에서 이기려는 방어. 하지만 정확히 영상이 끝나는 순간에 경합을 지면(밀리초 단위) 여전히 놓칠 수 있음.
  2차 조치(더 견고함, 사용자가 별도 세션에서 직접 패치): `enforceNoNativeLoop()`는 유지하되, `handleTimeUpdate`에 **wraparound 직접 감지** 로직을 추가 — "끝나기 0.75초(`LOOP_DETECT_END_WINDOW`) 이내에 있다가 `currentTime`이 1초(`LOOP_DETECT_JUMP_MIN`) 이상 갑자기 뒤로 튀면" `ended` 발생 여부와 무관하게 "한 번 재생 완료"로 간주. `ended` 핸들러와 이 감지 로직이 동일한 `handlePlaythroughComplete()`(구 `handleEnded`)를 공유. 경합의 승패 자체가 아니라 증상(되감김)을 직접 감지하므로 타이밍에 안 좌우됨 — 트레이드오프로 영상 끝부분에서 사용자가 직접 크게 되감으면 "재생 완료"로 오인할 수 있으나 MVP 단계에서는 감수 가능한 수준.
* **스폰서 Short 자동 스킵 (30장의 축소 구현, 2026-09-01 추가)**: `youtube-adapter.js`의 `isSponsoredShort()`가 (1) 광고 슬롯 DOM (2) 유료 프로모션 디스클로저 배지 (3) 제목의 `#ad`/`유료광고`/`협찬` 등 키워드 세 가지 신호를 조합해 판정. 감지되면 재생을 아예 시작하지 않고(반복 컨트롤러에 붙이지 않고) `Adapter.goToNextShort()`로 바로 다음 Short로 넘어감. 패널에 "Auto-skip sponsored" 체크박스(기본 ON, `settings.autoSkipSponsored`)로 켜고 끌 수 있음. 30장에서 계획한 "Sponsored 카테고리에 모아두기" UI는 아직 없음(Discovery Collector/카테고리 시스템이 Phase 4.5라 아직 미구현) — 지금은 스킵만 하고 별도로 모아두지는 않는다는 점이 30.4절 표와의 차이.
  * **버그 수정 (2026-09-01 실사용 테스트로 발견)**: 정상 Shorts가 4~5개 이상 연달아 자동으로 넘어가는 오탐지가 있었음. 원인은 `AD_SLOT_SELECTORS`의 `ytd-shorts ytd-ad-slot-renderer`가 **현재 재생 중인 영상에 스코프되어 있지 않아서** 피드에 미리 로드돼 있는 다른 항목(또는 Shorts 오버레이 밑에 깔린 홈 피드)의 광고 슬롯이 매칭됐고, 뱃지 판별도 `ytd-badge-supported-renderer` 태그 존재만 봤지 실제 문구(4K/LIVE 등 다른 뱃지에도 쓰이는 범용 태그)는 확인하지 않았던 것. `getActiveShortContainer()`로 현재 재생 중인 영상 컨테이너를 먼저 찾고 그 안에서만 검사하도록 스코프를 좁히고, 뱃지는 실제 "sponsored/paid promotion/유료광고/협찬" 문구가 포함된 경우만 신호로 인정하도록 수정.
* **일반 영상 중간광고 네트워크 차단 (30.8절, 2026-09-01 추가)**: `rules/ad-block-rules.json`(Manifest V3 `declarativeNetRequest` 정적 룰셋)으로 `doubleclick.net` 등 광고 서버 도메인과 `youtube.com/pagead/` 등 YouTube 자체 광고 경로를 차단. 실제 영상 스트림(`googlevideo.com`)과 플레이어 API는 건드리지 않도록 설계. 토글 없이 항상 켜져 있음. 원래 기획(1·25장)이 Shorts 전용이었던 것에서 사용자 요청으로 범위가 확장된 사례.
* Floating Control Panel (`content/floating-panel.js`, `floating-panel.css`)
* Favorite, Memo — `chrome.storage.local` 기반 (`content/storage.js`)

**이번 초안에서 의도적으로 보류한 것**: SQLite(WASM+OPFS, 2.3절), Discovery Collector/자동 분류/광고 감지(28~30장), Download Helper(15~16장). 각 Phase 착수 시점에 붙인다.

**중요한 제약**: 이 개발 환경에는 GUI 브라우저가 없어 실제 youtube.com에서 라이브 테스트를 하지 못했다. `youtube-adapter.js`의 DOM 셀렉터는 알려진 YouTube Shorts 마크업 패턴 기반의 폴백만 넣어뒀으므로, 실사용 전 반드시 사용자가 직접 로드해 동작을 확인하고 셀렉터를 조정해야 한다.

**테스트 편의**: `extension/run-dev-chrome.bat` — Windows에서 `chrome.exe`를 자동 탐지해 평소 프로필과 분리된 테스트 프로필(`.chrome-profile/`, git 미추적)로 이 확장을 로드한 채 Chrome을 띄운다. `chrome://extensions`를 매번 열 필요 없이 더블클릭 한 번으로 로드+실행, 코드 수정 후에는 창을 닫고 재실행하면 된다. 루트 CLAUDE.md의 "Windows 빌드/배치 파일 공통 정책"(`cd /d "%~dp0"` 패턴 사용)을 따랐다.

## 31.2 참고 공개 프로젝트 라이선스 조사 결과 (20장 갱신)

실제 구현 착수 전 GitHub API로 라이선스를 확인했다:

| 저장소 | 라이선스 | 결론 |
|--------|----------|------|
| LoopLock (`SugnCheng/looplock-extension`) | 없음 (all rights reserved 기본값) | **코드 재사용 금지.** `yt-navigate-finish` 이벤트로 SPA 네비게이션을 감지하는 것 같은 공개적으로 알려진 기법만 참고하고, 코드는 직접 새로 작성한다. |
| ClipTap (`VELLUMCORE/cliptap`) | MIT | 재사용 가능(출처 표시 조건). 다만 다운로드(Phase 6) 관련이라 Phase 1에서는 사용하지 않음. |
| PocketTube (`NabokD/pockettube`) | 없음 | 20장에 이미 "기능/UX 참고용, 코드 기반 아님"으로 명시되어 있던 것과 일치 — 유지. |

**원칙**: 라이선스가 없는(all rights reserved) 공개 저장소는 코드를 그대로 가져오지 않는다. 아이디어·구조 참고까지만 하고 구현은 새로 작성한다 — Chrome 웹스토어 공개 배포(15.1절)를 염두에 둔 프로젝트이므로 라이선스 위반 리스크를 처음부터 배제한다.
