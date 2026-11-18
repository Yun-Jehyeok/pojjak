# CLAUDE.md

폴짝폴짝 길건너기: 아이들용 3D 길건너기 게임. 빌드 단계 없는 정적 사이트 + Firebase(로그인·클라우드 저장).
사용자와는 한국어로 대화하고, 게임 안 문구도 아이들이 읽기 쉬운 존댓말 한국어로 쓴다.

## 구조
| 파일 | 내용 |
|---|---|
| `public/index.html` | 게임 전체 (CSS + 마크업 + JS 한 파일, 약 3,900줄) |
| `public/firebase-config.js` | Firebase 웹 설정 (`pokjjak-game`). 공개돼도 되는 값 |
| `firestore.rules` | `players/{uid}` 본인만 읽기/쓰기, save 필드 모양·범위 검사. `ranks/{uid}`(랭킹판)는 로그인하면 누구나 읽기, 본인만 쓰기. `matches/{mid}`와 `matches/{mid}/players/{uid}`(랭킹전 방) |
| `tools/reset-pin.js` | 관리자용 비밀번호 재설정 (`tools/service-account.json` 필요, 절대 커밋 금지) |
| `firebase.json`, `.firebaserc` | Firebase CLI 설정. `.firebaserc` 기본 프로젝트는 `pokjjak-game` |

외부 라이브러리는 CDN: three.js r128 (cdnjs), Firebase compat SDK 10.12.2 (gstatic). 번들러·npm 없음.

## index.html 지도 (`/* ===== 섹션 ===== */` 주석으로 구분)
- **settings** (~922): 상수(`HOP`, `STAGE_ROWS=200`, 뽑기 비용 100/500/1000, `PET_COOLDOWN=30` 등), `THEMES`, 친구 능력 헬퍼(`is(id)`, `hopDur`, `worldMul`, `floats` …), `FRIENDS`(24), `PETS`(5), `CAUSES`.
- **save data** (~1049): `freshSave` / `normalizeSave` / `persist`. localStorage 키는 `pokjjak-crossing-v1:<uid>`.
- **cloud** (~1085): 닉네임 → `u<utf8 hex>@pokjjak.game` 가짜 이메일, 비밀번호 `pokjjak-<PIN>`. 1.5초 디바운스로 Firestore에 저장, 실패 시 8초 재시도.
- **sound** (~1179): WebAudio로 효과음 합성.
- **voxel geometry** (~1253): `mergeBoxes(parts)` — part는 `[w,h,d,x,yBottom,z,color,rot?]`. `CHAR_PARTS`, `PET_PARTS`, 차량·지형 parts, `buildGeometries`.
- **world: lanes** (~2077): 레인 타입 grass/road/river/ice/lily/rail/siren. `STAGE` 표로 단계별 난이도, `planGroup`이 레인 묶음 생성, `updateLane`.
- **player** (~2471): `tryMove` → `planMove` → `land`, `checkHazards` → `hit` → `die`. 펫 능력(`usePet`), 봉황 부활 등.
- **랭킹**: `ranks/{uid}` = `{nickname, best, selected, updatedAt}`. `cloud.flush`가 best·닉네임·친구가 바뀔 때만 `players`와 같은 batch로 쓴다(규칙이 `getAfter`로 players와 값이 같은지 검사). 규칙이 거부하면 players만 저장. `openRanks`가 상위 50명을 최고 기록/티어(rp) 탭으로 보여 준다.
- **랭킹전·티어** (`tiers and ranked match` 섹션): 최대 5명, Firestore만 사용(서버 없음). `findRoom`이 `openUntil > now`인 방에 트랜잭션으로 들어가거나 새로 만든다. 25초 대기 후 아무 클라이언트나 `status: playing`과 `roster`를 정하고, 각자 3초 카운트다운 뒤 2분 동안 같은 `seed`의 맵에서 달린다. 점수는 3초마다, 하트비트는 4~8초마다 자기 player 문서에 쓴다. 하트비트가 끊긴 사람은 나간 것으로 본다(서버 시각 기준 = 방에서 가장 최근 `seen`). 순위는 점수, 같으면 먼저 도달한 사람(`scoreAt`). 포인트 50/40/30/20/10을 `save.rp`에 더하고 `save.lastMatch`로 중복을 막는다. 티어는 `TIERS`(브론즈~챌린저 9단계 × 5~1), `TIER_STEP=100`점마다 한 칸, 내려가지 않는다.
- **시드 맵**: 맵 생성(`weightedPick`~`createLane`)은 `wr()`/`wrand`/`wpick`/`wshuffle`만 쓴다. `matchSeed`가 있으면 `resetWorld`가 그 시드로 고정하고, 펫 상자는 나오지 않는다. 맵 생성에 `Math.random`을 새로 쓰면 랭킹전 맵이 사람마다 달라진다.
- **game flow / sign-in / UI / boot** (~3246 이후): 화면 전환(`setScreen`), 로그인, 친구·펫 모달, 뽑기, 선물 상자, 입력 처리, `start()`.

## 수정 시 주의
- save에 필드를 추가하면 **세 곳을 같이** 고친다: `freshSave`/`normalizeSave`, `cloud`의 `clean()`, `firestore.rules`의 `validSave` `hasOnly` 목록. 규칙에 없으면 클라우드 저장이 전부 실패한다.
- `EMAIL_DOMAIN`/닉네임→이메일 변환은 `index.html`과 `tools/reset-pin.js`가 같아야 한다.
- 친구를 추가하면 `FRIENDS`, `CHAR_PARTS`, 필요 시 능력 헬퍼를 같이 수정. 친구 수가 40, 펫 수가 10을 넘으면 규칙의 `owned`/`pets` 크기 제한도 늘린다.
- 코인 계산은 클라이언트에서 한다(조작을 완전히 막을 수 없음, README에 명시).
- `window.claude.hot` 관련 코드는 예전 Claude 아티팩트 환경용 잔재로 무해하다.

## 배포
- **Vercel ← GitHub** (`https://github.com/Yun-Jehyeok/pojjak.git`, 브랜치 `main`).
  `main`에 push하면 운영에 자동 배포, 다른 브랜치는 미리보기 배포.
  Vercel 설정: Framework **Other**, Build Command 없음, Output Directory **`public`**.
- `firebase.json`의 hosting/캐시 설정은 Vercel에서 쓰이지 않는다.
- Firestore 규칙은 Vercel과 별개: 콘솔에 직접 붙여 넣거나 `firebase deploy --only firestore:rules`.

## 확인 방법
테스트 코드는 없다. 변경 후 브라우저에서 `public/index.html`을 로컬 서버(예: `npx serve public`)로 열어 직접 플레이해 확인한다.
