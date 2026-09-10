import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, ".cloudflare-pages-output");
const PROJECT_NAME = process.env.CF_PAGES_PROJECT || process.env.CLOUDFLARE_PROJECT_NAME || "chungju-guild-dashboard";
const BRANCH = process.env.CF_PAGES_BRANCH || "main";

const command = process.argv[2] || "help";

async function main() {
  switch (command) {
    case "build":
      await buildStaticAssets();
      break;
    case "login":
      run("npx", ["wrangler", "login"]);
      break;
    case "create":
      createProject();
      break;
    case "deploy":
      await buildStaticAssets();
      deployProject();
      break;
    case "setup":
      console.log("\n1) Cloudflare 로그인 창이 열리면 계정 인증을 완료해주세요.\n");
      run("npx", ["wrangler", "login"]);
      console.log("\n2) Cloudflare Pages 프로젝트를 생성합니다. 이미 있으면 오류가 나도 다음 deploy를 실행하면 됩니다.\n");
      createProject({ allowFailure: true });
      console.log("\n3) 정적 파일 + Pages Function을 배포합니다.\n");
      await buildStaticAssets();
      deployProject();
      printOpenUrl();
      break;
    case "open":
      printOpenUrl();
      if (process.platform === "darwin") {
        spawnSync("open", [`https://${PROJECT_NAME}.pages.dev`], { stdio: "inherit" });
      }
      break;
    case "tail":
      run("npx", ["wrangler", "pages", "deployment", "tail", "--project-name", PROJECT_NAME, "--environment", "production"]);
      break;
    default:
      printHelp();
  }
}

async function buildStaticAssets() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  await copyFile("index.html");
  await copyDir("src");
  await copyDir("assets");
  await copyDir("data");

  await fs.writeFile(path.join(DIST_DIR, "_headers"), [
    "/*",
    "  X-Frame-Options: DENY",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Cache-Control: public, max-age=300",
    "",
    "/index.html",
    "  Cache-Control: no-store",
    "",
    "/data/*",
    "  Cache-Control: no-store",
    "",
    "/api/*",
    "  Cache-Control: no-store",
    ""
  ].join("\n"));

  await fs.writeFile(path.join(DIST_DIR, "_redirects"), [
    "/api/* /api/:splat 200",
    "/* /index.html 200",
    ""
  ].join("\n"));

  console.log(`✅ Cloudflare Pages 정적 파일 준비 완료: ${path.relative(ROOT_DIR, DIST_DIR)}`);
}

async function copyFile(relativePath) {
  await fs.copyFile(path.join(ROOT_DIR, relativePath), path.join(DIST_DIR, relativePath));
}

async function copyDir(relativePath) {
  await fs.cp(path.join(ROOT_DIR, relativePath), path.join(DIST_DIR, relativePath), {
    recursive: true,
    filter(source) {
      const name = path.basename(source);
      return !name.startsWith(".") && name !== "node_modules";
    }
  });
}

function createProject(options = {}) {
  const result = run("npx", ["wrangler", "pages", "project", "create", PROJECT_NAME, "--production-branch", BRANCH], {
    allowFailure: options.allowFailure
  });
  if (result.status !== 0 && options.allowFailure) {
    console.log("⚠️ 프로젝트 생성이 실패했지만 계속 진행합니다. 이미 생성된 프로젝트일 수 있습니다.");
  }
}

function deployProject() {
  run("npx", [
    "wrangler",
    "pages",
    "deploy",
    path.relative(ROOT_DIR, DIST_DIR),
    "--project-name",
    PROJECT_NAME,
    "--branch",
    BRANCH,
    "--commit-dirty=true"
  ]);
  printOpenUrl();
}

function run(bin, args, options = {}) {
  console.log(`\n$ ${bin} ${args.join(" ")}\n`);
  const result = spawnSync(bin, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status || 1);
  }
  return result;
}

function printOpenUrl() {
  console.log(`\n🌐 Cloudflare Pages 주소: https://${PROJECT_NAME}.pages.dev`);
  console.log(`🔎 실시간 토벌 API 테스트: https://${PROJECT_NAME}.pages.dev/api/tobeol?guild=${encodeURIComponent("충주시")}&server=4\n`);
}

function printHelp() {
  console.log(`
충주시 Cloudflare Pages helper

사용법:
  npm run cf:login    Cloudflare 계정 인증
  npm run cf:create   Pages 프로젝트 생성
  npm run cf:deploy   정적 파일 + /functions API 배포
  npm run cf:setup    로그인 → 생성 → 배포 한번에 진행
  npm run cf:open     배포 주소 열기

환경변수:
  CF_PAGES_PROJECT=chungju-guild-dashboard
  CF_PAGES_BRANCH=main
`);
}

main().catch((error) => {
  console.error("❌ Cloudflare Pages 작업 실패:", error?.message || error);
  process.exit(1);
});
