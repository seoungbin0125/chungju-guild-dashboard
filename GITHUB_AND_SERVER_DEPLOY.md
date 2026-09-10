# 충주시 대시보드 GitHub·서버 배포 가이드

이 프로젝트의 권장 운영 흐름은 다음과 같습니다.

```text
MGF → GitHub Actions 정기 수집 → data/*.json 커밋 → Cloudflare Pages 자동 재배포
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

## 2. GitHub Actions 자동 스크래핑 켜기

프로젝트에 이미 다음 워크플로가 들어 있습니다.

- `.github/workflows/collect.yml`: 매일 한국시간 02:10 길드·콘텐츠·핫딜 갱신
- `.github/workflows/collect-hotdeals.yml`: 매시간 17분 핫딜 갱신

GitHub 저장소에서 다음을 확인합니다.

1. `Actions` 탭을 열고 워크플로 사용을 허용합니다.
2. `Collect Dashboard Data`를 선택합니다.
3. `Run workflow → Run workflow`를 눌러 첫 수집을 직접 실행합니다.
4. 실행 완료 후 `data/latest.json`에 새 커밋이 생겼는지 확인합니다.

자동 커밋이 `403`으로 실패하는 경우:

1. 저장소 `Settings → Actions → General`로 이동합니다.
2. `Workflow permissions`에서 `Read and write permissions`를 선택합니다.
3. 저장한 뒤 워크플로를 다시 실행합니다.

스크래핑은 OCR을 사용하지 않습니다. MGF 길드 상세의 `data-bp`(전투력)와 `data-gb`(토벌)를 직접 읽고, 합계 검증에 실패하면 잘못된 데이터를 커밋하지 않습니다.

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

## 4. 순위 비교 기능 기준

- 전투력 순위: 길드원 `data-bp` 원본 정수 내림차순
- 토벌 순위: `data-gb`가 1 이상인 참여자만 내림차순
- 동점: 공동 순위 방식 `1, 2, 2, 4`
- 토벌 0점: 순위를 부여하지 않고 `미참여`
- 순위 차이: `전투력 순위 - 토벌 순위`
  - `+3`: 토벌 순위가 투력 순위보다 3칸 높음
  - `0`: 두 순위가 같음
  - `-3`: 토벌 순위가 투력 순위보다 3칸 낮음

대시보드의 `투력·토벌 순위 비교`에서 토벌 순위, 투력 순위, 토벌 순위 상승 폭으로 정렬할 수 있습니다. `토벌전` 화면의 실시간 조회 결과에도 같은 비교가 표시됩니다.

## 5. 문제 확인 명령어

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
