import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGuildWarData, parseMsidleGuildWarHtml } from "./guild-war-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");
const OUTPUT_PATH = path.join(DATA_DIR, "guild-war.json");
const HISTORY_PATH = path.join(DATA_DIR, "guild-war-history.json");
const GUILD = String(process.env.GUILD_WAR_GUILD || "충주시").trim();
const WORLD_SLUG = String(process.env.GUILD_WAR_WORLD || "scania").trim().toLowerCase();
const SERVER_ID = String(process.env.GUILD_WAR_SERVER_ID || "4").trim();
const SERVER = `Scania ${SERVER_ID}`;
const SOURCE_URL = `https://www.msidle.gg/guilds/${encodeURIComponent(WORLD_SLUG)}/${encodeURIComponent(GUILD)}/guild-war`;

await fs.mkdir(DATA_DIR, { recursive: true });
const [latest, history] = await Promise.all([
  readJson(LATEST_PATH, { members: [] }),
  readJson(HISTORY_PATH, [])
]);
const response = await fetch(SOURCE_URL, {
  headers: { "user-agent": "Mozilla/5.0 (compatible; Chungju-Guild-Dashboard/2.2)" }
});
if (!response.ok) throw new Error(`개인 대항전 점수 조회 실패 HTTP ${response.status}`);
const parsed = parseMsidleGuildWarHtml(await response.text(), {
  expectedGuild: GUILD,
  expectedServer: SERVER
});
const capturedAt = kstDateTime();
const roster = (latest?.members || []).filter((member) => member?.guild === GUILD);
const result = buildGuildWarData({ parsed, history, roster, capturedAt });
result.data.sourceUrl = SOURCE_URL;
result.data.sourceDiagnostics = {
  sourceMemberCount: parsed.members.length,
  sourceScoreCount: parsed.members.filter((member) => member.scoreRaw != null).length,
  currentWeekScoreCount: result.data.summary.currentKnownCount,
  missingPolicy: "null_not_zero",
  weekBoundary: "Thursday KST",
  sourceType: "user_submitted_public_data"
};

await Promise.all([
  writeJson(OUTPUT_PATH, result.data),
  writeJson(HISTORY_PATH, result.history)
]);

console.log(`✅ 개인 대항전 점수 저장: ${result.data.summary.currentKnownCount}/${result.data.summary.rosterCount}명`);
console.log(`↳ 이번 주 ${result.data.currentWeekKey} · 지난주 ${result.data.previousWeekKey}`);
console.log(`↳ 미수집 값은 0점으로 처리하지 않습니다.`);

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function kstDateTime() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}
