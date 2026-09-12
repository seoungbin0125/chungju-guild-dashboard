# 충주시 대시보드 GitHub·서버 배포 가이드

이 프로젝트의 권장 운영 흐름은 다음과 같습니다.

```text
MGF·개인점수 공개 페이지 → GitHub Actions 정기 수집 → data/*.json 커밋 → Cloudflare Pages 자동 재배포
                                      └→ Pages Function /api/tobeol 실시간 조회
```

`functions/api/tobeol.js`가 필요하므로 단순 파일 드래그 업로드가 아니라 **GitHub 연동 배포** 또는 프로젝트에 포함된 Wrangler 배포를 사용해야 합니다.

## 1. GitHub에 처음 올리기

### 가장 쉬운 방법: 포함된 실행 파일

1. GitHub에서 `chungju-guild-dashboard`라는 새 저장소를 만듭니다.
2. 저장소 생성 화면에서 README, `.gitignore`, License는 추가하지 않고 빈 저장소로 만듭니다.
3. 생성된 저장소의 HTTPS 주소를 복사합니다.
4. 프로젝트 폴더의 `PUSH_TO_GITHUB.command`를 더블클릭합니다.
5. 안내에 따라 저장소 주소, 커밋 이름, 이메일을 입력합니다.

macOS가 실행을 막으면 파일을 우클릭하고 **열기**를 선택합니다. GitHub 인증을 요구하면 GitHub 계정으로 인증합니다. 계정 비밀번호를 Git 비밀번호 칸에 직접 넣는 방식은 사용할 수 없으므로, 이미 로그인된 GitHub Desktop을 사용하거나 GitHub 개인 액세스 토큰을 사용합니다.

### GitHub Desktop으로 올리기

1. GitHub Desktop에 로그인합니다.
2. `File → Add Local Repository`에서 이 프로젝트 폴더를 선택합니다.
3. 저장소가 아니라고 나오면 `create a repository`를 선택합니다.
4. 이름은 `chungju-guild-dashboard`, 브랜치는 `main`으로 둡니다.
5. `Publish repository`를 누릅니다. 공개할 필요가 없으면 `Keep this code private`를 체크합니다.

### 이미 연결된 GitHub 저장소 업데이트

이 버전의 파일을 기존 `chungju-guild-dashboard` 폴더에 적용한 뒤 `PUSH_UPDATE_TO_GITHUB.command`를 더블클릭합니다. 변경 파일 커밋과 `main` 푸시가 끝나면 연결된 Cloudflare Pages가 자동 배포를 시작합니다.

## 2. GitHub Actions 자동 스크래핑 켜기

프로젝트에 이미 다음 워크플로가 들어 있습니다.

- `.github/workflows/collect.yml`: 매일 한국시간 02:10 길드·서버 순위·개인 대항전·콘텐츠·핫딜 갱신
- `.github/workflows/collect-guild-war.yml`: 매일 한국시간 23:45 개인 대항전 점수와 주차 이력 추가 보존
- `.github/workflows/collect-hotdeals.yml`: 매시간 17분 핫딜 갱신

GitHub 저장소에서 다음을 확인합니다.

1. `Actions` 탭을 열고 워크플로 사용을 허용합니다.
2. `Collect Dashboard Data`를 선택합니다.
3. `Run workflow → Run workflow`를 눌러 첫 수집을 직접 실행합니다.
4. 실행 완료 후 `data/latest.json`과 `data/guild-war-history.json`에 새 커밋이 생겼는지 확인합니다.

자동 커밋이 `403`으로 실패하는 경우:

1. 저장소 `Settings → Actions → General`로 이동합니다.
2. `Workflow permissions`에서 `Read and write permissions`를 선택합니다.
3. 저장한 뒤 워크플로를 다시 실행합니다.

스크래핑은 OCR을 사용하지 않습니다. MGF 길드 상세의 `data-bp`(전투력), `data-gb`(토벌), 서버 랭킹의 `rank-world`를 직접 읽습니다. 개인 대항전은 공개 JSON의 개인별 점수·제출 시각을 주차별로 저장합니다.

## 3. Cloudflare Pages에 서버 배포

### 권장: GitHub 저장소 연결

1. Cloudflare Dashboard에서 `Workers & Pages`로 이동합니다.
2. `Create application → Pages → Import an existing Git repository`를 선택합니다.
3. 앞에서 만든 `chungju-guild-dashboard` 저장소를 연결합니다.
4. 빌드 설정을 정확히 다음과 같이 입력합니다.

| 항목 | 값 |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run cf:build` |
| Build output directory | `.cloudflare-pages-output` |
| Root directory | `/` 또는 비워두기 |

5. `Save and Deploy`를 누릅니다.
6. 배포가 끝나면 `https://chungju-guild-dashboard.pages.dev`를 엽니다.
7. `https://chungju-guild-dashboard.pages.dev/api/tobeol?guild=충주시&server=4`에서 JSON이 표시되는지 확인합니다.

이후 GitHub Actions가 새 데이터를 커밋할 때마다 Cloudflare가 변경을 감지해 자동으로 다시 배포합니다.

### 대안: 맥에서 Wrangler로 직접 배포

GitHub 연동 없이 한 번 직접 배포하려면 프로젝트 폴더에서 다음을 실행합니다.

```bash
npm install
npm run cf:setup
```

이후 수정본 재배포는 다음 한 줄입니다.

```bash
npm run cf:deploy
```

GitHub 연동 방식과 Wrangler 직접 업로드 방식은 Cloudflare 프로젝트 생성 시 운영 방식이 갈릴 수 있으므로, 새 프로젝트라면 위의 GitHub 연동 방식을 권장합니다.

## 4. 서버 순위 비교 기능 기준

- 전투력 순위: MGF 전투력 랭킹의 Scania 4 `S순위`
- 토벌 순위: MGF 토벌 랭킹의 Scania 4 `S순위`
- 결합 조건: 닉네임, 길드명, 서버 번호가 모두 일치
- 토벌 0점: 순위를 부여하지 않고 `미참여`
- 순위 차이: `서버 전투력 순위 - 서버 토벌 순위`
  - `+3`: 토벌 순위가 투력 순위보다 3칸 높음
  - `0`: 두 순위가 같음
  - `-3`: 토벌 순위가 투력 순위보다 3칸 낮음

대시보드의 `투력·토벌 순위 비교`에서 서버 토벌 순위, 서버 투력 순위, 순위 상승 폭으로 정렬할 수 있습니다. 실시간 토벌 조회에는 가장 최근 정기 수집에서 저장한 서버 순위를 결합합니다.

## 5. 개인 대항전 주간 기록 기준

- `npm run collect:guild-war`가 개인별 공개 점수와 제출 시각을 읽습니다.
- 목요일(KST)을 새 주차 시작으로 사용합니다.
- `data/guild-war-history.json`은 주차별 원본 정수를 보존합니다.
- 이번 주와 지난주가 모두 있는 사람만 증감·상승률을 계산합니다.
- 공개 소스가 사용자 제출 기반이므로 누락은 `0점`이 아니라 `미수집(null)`입니다.
- 자동 수집을 켠 시점 이전의 누락 주차는 완전하게 소급 복구할 수 없습니다.

## 6. 문제 확인 명령어

```bash
npm test
npm run diagnose
npm run collect:all-data
npm run verify
```

- Actions는 성공했지만 화면이 이전 데이터라면 Cloudflare의 마지막 배포 시각을 확인합니다.
- `/api/tobeol`만 실패하면 Cloudflare 배포에 루트 `functions/` 폴더가 포함됐는지 확인합니다.
- 데이터 수집이 실패하면 `npm run diagnose` 결과에서 MGF HTML 구조 변경 여부를 확인합니다.

## 공식 참고 문서

- GitHub 기존 로컬 프로젝트 업로드: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- GitHub Actions 저장소 권한: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- Cloudflare Pages Git 연동: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
