import fs from "node:fs/promises";
import { parseGuildContentHtml } from "./mgf-parser.js";

const MODES = [
  ["league", "대항전"],
  ["training", "수련장"],
  ["boss", "보스대전"]
];
const DEFAULT_GUILDS = "충주시";
const guilds = (process.env.GUILD_CONTENT_NAMES || DEFAULT_GUILDS)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const output = process.env.GUILD_CONTENT_OUTPUT || "data/guild-contents.json";
const historyOutput = process.env.GUILD_CONTENT_HISTORY_OUTPUT || "data/guild-contents-history.json";
const capturedAt = kstDateTime();
const capturedDate = capturedAt.slice(0, 10);
const historyInput = await readJson(historyOutput, []);
const oldHistory = (Array.isArray(historyInput) ? historyInput : [])
  .filter((item) => guilds.includes(item?.keyword));

const result = {
  version: 2,
  capturedAt,
  capturedDate,
  source: "MGF.GG guild content cards",
  sourceCapabilities: {
    matchGroup: { available: true },
    score: {
      available: false,
      reason: "현재 공개 매칭 카드에는 대항전/수련장/보스대전 점수 필드가 없습니다."
    }
  },
  guilds: []
};

for (const keyword of guilds) {
  const previous = findPrevious(oldHistory, keyword, capturedDate);
  const bundle = { keyword, modes: {} };
  for (const [mode, label] of MODES) {
    const url = makeUrl(mode, keyword);
    try {
      const html = await fetchText(url);
      const parsed = parseGuildContentHtml(html, { keyword });
      const currentGuild = parsed.guilds.find((guild) => guild.name === keyword) || null;
      const previousGuild = previous?.modes?.[mode]?.guilds?.find((guild) => guild.name === keyword) || null;
      bundle.modes[mode] = {
        label,
        url,
        matchCount: parsed.matchCount,
        scoreAvailable: parsed.scoreAvailable,
        scoreStatus: parsed.scoreAvailable ? "provided" : "source_not_provided",
        currentGuildScoreText: currentGuild?.scoreText || null,
        currentGuildScoreValue: currentGuild?.scoreValue ?? null,
        previousCaptureDate: previous?.capturedDate || null,
        previousGuildScoreText: previousGuild?.scoreText || null,
        previousGuildScoreValue: previousGuild?.scoreValue ?? null,
        guilds: parsed.guilds
      };
      if (parsed.scoreAvailable) result.sourceCapabilities.score.available = true;
      console.log(`[${label}] ${keyword}: 매칭 ${parsed.matchCount}개 · 카드 ${parsed.guilds.length}개 · 점수 ${parsed.scoreAvailable ? "제공" : "미제공"}`);
    } catch (error) {
      console.warn(`[${label}] ${keyword}: 수집 실패 - ${error.message}`);
      bundle.modes[mode] = {
        label,
        url,
        matchCount: 0,
        scoreAvailable: false,
        scoreStatus: "fetch_failed",
        error: error.message,
        guilds: []
      };
    }
  }
  result.guilds.push(bundle);
}

const snapshotEntries = result.guilds.map((bundle) => ({
  capturedAt,
  capturedDate,
  keyword: bundle.keyword,
  modes: bundle.modes
}));
const nextHistory = upsertHistory(oldHistory, snapshotEntries);
await writeJson(output, result);
await writeJson(historyOutput, nextHistory);
console.log(`${output}, ${historyOutput} 저장 완료`);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Chungju-Guild-Content-Collector/2.0)" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function findPrevious(history, keyword, beforeDate) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => item?.keyword === keyword && item?.capturedDate < beforeDate)
    .sort((a, b) => String(b.capturedAt || b.capturedDate).localeCompare(String(a.capturedAt || a.capturedDate)))[0] || null;
}

function upsertHistory(history, snapshots) {
  const keys = new Set(snapshots.map((item) => `${item.capturedDate}::${item.keyword}`));
  return [
    ...(Array.isArray(history) ? history : []).filter((item) => !keys.has(`${item?.capturedDate}::${item?.keyword}`)),
    ...snapshots
  ]
    .sort((a, b) => `${a.capturedDate}::${a.keyword}`.localeCompare(`${b.capturedDate}::${b.keyword}`))
    .slice(-180);
}

function makeUrl(mode, keyword) {
  return `https://mgf.gg/contents/guild.php?mode=${encodeURIComponent(mode)}&stx=${encodeURIComponent(keyword)}`;
}

function kstDateTime() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}

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
