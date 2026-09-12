# 충주시 길드 운영실

현재 버전: **v2.2.0**

기존 Lovely 프로젝트와 별개로 운영하는 충주시(Scania 4) 전용 대시보드입니다. 전투력, 토벌전 참여/점수, **Scania 4 서버 투력·토벌 순위 비교**, 개인 대항전 주간 이력과 상승률, 콘텐츠 매칭, 공략 게시판을 포함합니다.

## v2.2.0 추가 기능

- MGF 서버 랭킹의 `rank-world`(화면의 `S순위`)를 읽어 길드 내부 순위가 아닌 Scania 4 서버 순위 표시
- `서버 투력 순위 - 서버 토벌 순위`로 토벌 순위 상승·하락 폭 표시
- 토벌 점수 0은 억지로 꼴찌 순위를 주지 않고 `미참여` 처리
- 대항전 개인 점수를 목요일 시작 주차별로 `data/guild-war-history.json`에 보관
- 개인별 이번 주 점수, 지난주 점수, 증감, 상승률 표시
- 공개 원본에 제출되지 않은 점수는 `0`이 아닌 `미수집(null)` 처리
- 토벌 순위, 투력 순위, 토벌 순위 상승 폭 기준 정렬

GitHub 업로드부터 자동 수집과 Cloudflare 서버 배포까지는 `GITHUB_AND_SERVER_DEPLOY.md`에 화면별 설정값을 정리했습니다. 빈 GitHub 저장소는 `PUSH_TO_GITHUB.command`, 이미 연결된 저장소의 업데이트는 `PUSH_UPDATE_TO_GITHUB.command`를 더블클릭하면 됩니다.

## 가장 빠른 실행

맥에서 압축을 푼 뒤 `RUN_COLLECT_ALL.command`를 더블클릭하거나 터미널에서 다음을 실행합니다.

```bash
cd ~/Downloads/chungju-guild-dashboard
npm run collect:all-data
npm run serve
```

브라우저에서 `http://localhost:8080`을 엽니다. 작업용 폴더로 별도 복사하려면 `APPLY_TO_WORK_FOLDER.command`를 실행하며 기본 대상은 다음과 같습니다.

```text
/Users/bin/Desktop/work/chungju-guild-dashboard
```

Lovely 폴더에는 아무 파일도 덮어쓰지 않습니다.

## 기존 수치가 맞지 않았던 이유

### 전투력과 토벌전이 같아진 문제

MGF 길드 상세의 길드원 행은 아래처럼 전투력과 토벌 점수를 이미 별도 원본 속성으로 제공합니다.

```html
<div class="member-row" data-bp="7439718039708489" data-gb="548744911285">
```

기존 코드는 HTML을 한 줄의 텍스트로 만든 다음 직업/레벨 뒤에 나온 숫자 중 **마지막 숫자**를 전투력으로 골랐습니다. 현재 화면에서는 마지막 숫자가 토벌 점수이므로 전투력에 토벌 점수가 들어갔습니다. 그 뒤 서버 전체 토벌 랭킹을 고정 20페이지만 읽고 닉네임만으로 다시 결합해 다음 문제가 추가됐습니다.

- 같은 닉네임이 있으면 다른 캐릭터와 결합될 수 있음
- 20페이지 바깥 길드원은 0점 처리될 수 있음
- 한 번 조회에 요청이 21회라 느리고 실패 지점이 많음
- 화면 표시 단위만 읽어 하위 자릿수가 손실됨

v2.2.0은 길드원 행의 `data-bp`와 `data-gb` 정수를 직접 읽습니다. 길드원 수와 길드 전체 토벌 합계까지 검증하고, 검증에 실패하면 잘못된 JSON을 저장하지 않습니다. 서버 순위는 전투력·토벌 랭킹에서 `S순위`를 따로 읽고, 닉네임·길드명·서버가 모두 일치할 때만 결합합니다.

서버 순위 수집은 충주시 최하위 길드원이 포함된 페이지까지 읽으므로 첫 실행에 시간이 걸릴 수 있습니다. 페이지는 제한된 동시 요청으로 수집하며, 원본 사이트 정책과 과도한 요청 방지를 위해 수집 주기를 불필요하게 짧게 설정하지 마세요.

### 7일 전 토벌 점수를 빼면 안 되는 문제

토벌은 주간 초기화 데이터이므로 `오늘 점수 - 정확히 7일 전 점수`를 성장으로 표시하면 서로 다른 진행 시점이나 리셋 전후 값을 섞을 수 있습니다. 또한 정확히 7일 전 자동 수집이 한 번 누락되면 비교 자체가 사라졌습니다.

새 구조는 날짜가 아니라 **주차 키**로 저장합니다.

- 월요일 MGF 값: `previous_week_final`(지난주 확정)
- 화요일~일요일 MGF 값: `current_week_live`(이번 주 진행)
- 지난주 비교: 같은 주차 키의 월요일 확정본을 우선 사용
- 월요일 확정본이 없으면 마지막 수집본임을 명시하고, 아무 이력도 없으면 `수집 이력 없음` 표시
- 전투력만 7일 전 목표일 근처 ±2일의 실제 수집일과 비교

`data/history.json`에 주차·확정 여부·원본 기준일이 함께 저장됩니다. 처음 설치한 주에는 지난주 이력이 없으며 첫 월요일 자동 수집 이후 확정 기록이 표시됩니다.

### 대항전 카드가 0개였던 문제

기존 수집기는 텍스트 줄에서 `길드명 바로 다음 줄은 Master.`라고 가정했습니다. 현재 MGF는 `guild-card` 안에 링크와 여러 블록이 중첩된 구조여서 매칭 개수만 읽고 길드 배열은 비어 있었습니다.

새 수집기는 다음 실제 클래스 단위로 읽습니다.

- `guild-card`, `g-name-link`
- `server-name`, `g-power`
- `m-rank`, `m-name`, `m-power`

현재 매칭 그룹은 `data/guild-contents.json`, 날짜별 이력은 `data/guild-contents-history.json`에 저장됩니다.

### 개인 대항전 주간 비교

MGF 매칭 카드에는 개인 대항전 점수가 없어서 별도 공개 페이지의 `best_guild_war_damage`, `previous_damage`, 제출 시각을 읽습니다. OCR은 사용하지 않습니다.

- 주차 시작: 목요일(KST)
- 현재 주차: 제출 시각이 이번 주차 범위인 점수만 채택
- 지난주: 저장된 지난 주차 스냅샷 우선, 원본의 이전 점수 필드도 보강에 사용
- 상승률: `(이번 주 - 지난주) / 지난주 × 100`
- 지난주가 0점이거나 양쪽 주차 중 하나가 없으면 상승률을 억지로 계산하지 않음
- 사용자 제출 기반이므로 공개되지 않은 사람은 `미수집`으로 표시

자동 수집을 시작하기 전 주차의 값은 소급해서 완전 복구할 수 없습니다. 매일 GitHub Actions가 `data/guild-war-history.json`을 커밋해야 다음 주 비교가 유지됩니다.

## 자동 수집으로 확인할 수 없는 항목

현재 MGF 공개 페이지 기준으로 다음 필드는 HTML에 없습니다.

- 오늘 길드 업그레이드를 했는지 여부
- 수련장·보스대전의 실제 점수

개인 대항전 점수는 별도 공개 소스에서 확인되는 제출값만 기록합니다. 보이지 않는 값을 0점이나 미실행으로 추정하지 않습니다.

## 명령어

```bash
npm test                 # 현재 HTML 구조 회귀 테스트
npm run diagnose         # MGF 필드/카드/점수 노출 상태 진단(파일 변경 없음)
npm run collect          # 충주시 길드원/전투력/토벌 수집
npm run collect:contents # 대항전·수련장·보스대전 매칭 수집
npm run collect:guild-war # 개인 대항전 점수와 주차 이력 수집
npm run collect:all-data # 위 데이터와 핫딜까지 전체 갱신
npm run serve            # 로컬 서버 + /api/tobeol
npm run verify           # 테스트 + Cloudflare 빌드 검증
```

수집 원본:

```text
https://mgf.gg/contents/guild_info.php?g_name=충주시
https://mgf.gg/contents/guild.php?mode=league&stx=충주시
https://www.msidle.gg/guilds/scania/충주시/guild-war
```

## GitHub Actions

`.github/workflows/collect.yml`이 매일 KST 02:10에 전체 데이터를 갱신하고, `.github/workflows/collect-guild-war.yml`이 매일 KST 23:45에 개인 대항전 점수를 한 번 더 보존합니다. 수요일 마감 직전 기록을 놓칠 가능성을 줄이기 위한 별도 작업입니다. 파서 테스트가 먼저 통과해야 데이터 수집·커밋을 진행합니다.

처음 저장소를 만드는 방법, Actions 쓰기 권한, 수동 실행 방법은 `GITHUB_AND_SERVER_DEPLOY.md`를 확인하세요.

## Cloudflare Pages 배포

권장 방식은 GitHub 저장소를 Cloudflare Pages에 연결하고 빌드 명령을 `npm run cf:build`, 출력 폴더를 `.cloudflare-pages-output`으로 설정하는 것입니다. 이 방식이면 Actions의 데이터 커밋 뒤 자동으로 새 화면이 배포됩니다.

첫 배포:

```bash
npm install
npm run cf:setup
```

이후 재배포:

```bash
npm run cf:deploy
```

기본 프로젝트와 주소:

```text
chungju-guild-dashboard
https://chungju-guild-dashboard.pages.dev
```

실시간 토벌 API:

```text
https://chungju-guild-dashboard.pages.dev/api/tobeol?guild=충주시&server=4
```

Cloudflare 빌드에 `assets/`도 포함되도록 수정되어 충주시 배너가 배포본에서 빠지지 않습니다.

## Lovely와 데이터 분리

- 프로젝트 폴더와 Cloudflare Pages 이름이 별도입니다.
- 로컬 저장소 키가 `chungju-guild-dashboard.*`로 분리됩니다.
- Firebase 컬렉션은 `chungjuGuidePosts`, `chungjuWeeklyOverrides`, `chungjuVirtualLobby`, `chungjuJellyGame`을 사용합니다.
- 포함된 `firestore.rules`는 기존 Lovely 컬렉션과 충주시 컬렉션을 모두 허용하므로 기존 운영을 유지할 수 있습니다.

Firebase 규칙을 사용하는 경우 Firebase CLI에서 이 프로젝트의 `firestore.rules`를 배포해야 새 충주시 게시판 저장이 허용됩니다.
