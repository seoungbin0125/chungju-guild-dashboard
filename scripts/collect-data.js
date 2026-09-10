import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addMemberRankComparison,
  addDays,
  findPowerComparisonSnapshot,
  findRaidSnapshot,
  formatKoreanPower,
  getRaidPeriod,
  kstDateString,
  parseGuildInfoHtml,
  parseKoreanPowerValue
} from "./mgf-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_BASE = process.env.SOURCE_BASE || `https://${["m", "g", "f"].join("")}.gg`;
const DEFAULT_GUILD_NAMES = parseGuildNames(process.env.GUILD_NAMES || process.env.GUILD_NAME || "충주시");
const DEFAULT_MEMBER_LIMIT = Number(process.env.MEMBER_LIMIT || 120);
const DATA_DIR = path.join(ROOT_DIR, "data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");
const MANUAL_PATH = path.join(DATA_DIR, "manual.json");

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const guildNames = parseGuildNames(args.guilds || args.guild || DEFAULT_GUILD_NAMES);
  const memberLimit = Number(args.memberLimit || DEFAULT_MEMBER_LIMIT);
  const capturedDate = kstDateString();

  if (!guildNames.length) throw new Error("수집할 길드명이 없습니다.");
  await fs.mkdir(DATA_DIR, { recursive: true });
  console.log(`🚀 MGF 길드 상세 직접 수집: ${guildNames.join(", ")} · ${capturedDate}`);
  const guildResults = [];

  for (const guild of guildNames) {
    const sourceUrl = guildInfoUrl(guild);
    console.log(`↳ ${guild}: ${sourceUrl}`);
    const html = await fetchHtml(sourceUrl);
    const parsed = parseGuildInfoHtml(html, guild);
    const members = parsed.members.slice(0, memberLimit);
    if (!members.length) throw new Error(`${guild} 길드원 행을 찾지 못했습니다. MGF 구조 변경 여부를 확인하세요.`);
    if (parsed.guildName && normalizeName(parsed.guildName) !== normalizeName(guild)) {
      throw new Error(`요청 길드(${guild})와 응답 길드(${parsed.guildName})가 다릅니다.`);
    }

    const sourceDataDate = parsed.sourceDataDate || capturedDate;
    const raidPeriod = getRaidPeriod(sourceDataDate);
    const exactRaidTotal = members.reduce((sum, member) => sum + Number(member.tobeolValue || 0), 0);
    const pageRaidTotal = parseKoreanPowerValue(parsed.totalTobeolText);
    const validation = {
      parser: "member-row:data-bp,data-gb",
      memberCountMatches: !parsed.memberCount || parsed.memberCount === members.length,
      pageMemberCount: parsed.memberCount || null,
      parsedMemberCount: members.length,
      raidTotalMatches: pageRaidTotal == null || Math.abs(pageRaidTotal - exactRaidTotal) < 10_000,
      pageRaidTotal,
      parsedRaidTotal: exactRaidTotal,
      distinctPowerRaidMembers: members.filter((member) => Number(member.powerValue) !== Number(member.tobeolValue)).length
    };
    if (!validation.memberCountMatches || !validation.raidTotalMatches || validation.distinctPowerRaidMembers === 0) {
      throw new Error(`${guild} 데이터 검증 실패: ${JSON.stringify(validation)}`);
    }

    guildResults.push({ guild, sourceUrl, parsed, members, sourceDataDate, raidPeriod, validation });
    console.log(`✅ ${members.length}명 · ${raidPeriod.metricLabel} · 합계 ${formatKoreanPower(exactRaidTotal)}`);
    await sleep(250);
  }

  const allHistory = await readJsonFile(HISTORY_PATH, []);
  const history = (Array.isArray(allHistory) ? allHistory : []).filter((snapshot) => guildNames.includes(snapshot?.guild));
  const manual = await readJsonFile(MANUAL_PATH, null);
  let mergedMembers = [];
  const comparisonDates = {};
  const raidHistoryByGuild = {};
  const departedMembers = [];

  for (const result of guildResults) {
    const { guild, members, sourceUrl, sourceDataDate, raidPeriod } = result;
    const powerTargetDate = addDays(sourceDataDate, -7);
    const powerSnapshot = findPowerComparisonSnapshot(history, guild, powerTargetDate, 2);
    const powerMap = memberMap(powerSnapshot);
    comparisonDates[guild] = powerSnapshot?.sourceDataDate || powerSnapshot?.date || null;

    const previousWeekKey = addDays(raidPeriod.currentWeekKey, -7);
    const finalRaidSnapshot = findRaidSnapshot(history, guild, previousWeekKey, { finalOnly: true });
    const raidSnapshot = finalRaidSnapshot || findRaidSnapshot(history, guild, previousWeekKey, { finalOnly: false });
    const raidMap = memberMap(raidSnapshot);
    raidHistoryByGuild[guild] = raidPeriod.isFinal
      ? {
          currentWeekKey: raidPeriod.currentWeekKey,
          previousWeekKey,
          snapshotDate: sourceDataDate,
          isFinal: true,
          status: "final"
        }
      : {
          currentWeekKey: raidPeriod.currentWeekKey,
          previousWeekKey,
          snapshotDate: raidSnapshot?.sourceDataDate || raidSnapshot?.date || null,
          isFinal: Boolean(finalRaidSnapshot),
          status: finalRaidSnapshot ? "final" : raidSnapshot ? "latest_capture" : "not_collected"
        };

    const currentNicknames = new Set(members.map((member) => member.nickname));
    for (const previous of powerSnapshot?.members || []) {
      if (!previous?.nickname || currentNicknames.has(previous.nickname)) continue;
      departedMembers.push({
        guild,
        nickname: previous.nickname,
        rank: previous.rank ?? null,
        job: previous.job || "",
        level: previous.level ?? null,
        powerValue: previous.powerValue ?? null,
        powerText: previous.powerValue == null ? null : formatKoreanPower(previous.powerValue)
      });
    }

    for (const member of members) {
      const previousPower = powerMap.get(member.nickname) || null;
      const historyRaid = raidMap.get(member.nickname) || null;
      const isMondayFinal = raidPeriod.kind === "previous_week_final";
      const sourceTobeolValue = Number(member.tobeolValue || 0);
      const currentWeekTobeolValue = isMondayFinal ? null : sourceTobeolValue;
      const lastWeekTobeolValue = isMondayFinal
        ? sourceTobeolValue
        : nullableNumber(historyRaid?.sourceTobeolValue ?? historyRaid?.tobeolValue);
      const powerGrowthValue = previousPower
        ? Number(member.powerValue || 0) - Number(previousPower.powerValue || 0)
        : null;

      mergedMembers.push({
        guild,
        sourceUrl,
        memberStatus: previousPower ? "existing" : "new",
        rank: member.rank,
        nickname: member.nickname,
        job: member.job,
        level: member.level,
        powerRaw: member.powerRaw,
        powerValue: member.powerValue,
        powerText: member.powerText,
        previousPowerValue: previousPower?.powerValue ?? null,
        previousPowerText: previousPower ? formatKoreanPower(previousPower.powerValue) : null,
        powerGrowthValue,
        powerGrowthText: powerGrowthValue == null ? null : formatSignedKoreanPower(powerGrowthValue),
        powerGrowthRate: calcGrowthRate(member.powerValue, previousPower?.powerValue),
        sourceTobeolRaw: member.tobeolRaw,
        sourceTobeolValue,
        sourceTobeolText: member.tobeolText,
        currentWeekTobeolValue,
        currentWeekTobeolText: currentWeekTobeolValue == null ? null : formatKoreanPower(currentWeekTobeolValue),
        lastWeekTobeolValue,
        lastWeekTobeolText: lastWeekTobeolValue == null ? null : formatKoreanPower(lastWeekTobeolValue),
        lastWeekTobeolIsFinal: isMondayFinal || Boolean(finalRaidSnapshot),
        tobeolValue: sourceTobeolValue,
        tobeolText: member.tobeolText,
        previousTobeolValue: lastWeekTobeolValue,
        previousTobeolText: lastWeekTobeolValue == null ? null : formatKoreanPower(lastWeekTobeolValue),
        tobeolGrowthValue: null,
        tobeolGrowthText: null,
        tobeolGrowthRate: null
      });
    }
  }

  const manualAppliedCount = applyManualOverrides(mergedMembers, manual, capturedDate);
  mergedMembers = addMemberRankComparison(mergedMembers);
  const summary = buildSummary(mergedMembers);
  const memberChanges = buildMemberChanges(guildNames, mergedMembers, departedMembers);
  const primaryPeriod = guildResults[0]?.raidPeriod || getRaidPeriod(capturedDate);

  const latest = {
    ok: true,
    version: 7,
    appVersion: "v2.1.0",
    guilds: guildNames,
    guild: guildNames.join(" · "),
    capturedDate,
    sourceDataDate: guildResults[0]?.sourceDataDate || capturedDate,
    comparisonMode: "power_nearest_7d_and_raid_week",
    comparisonTargetDate: addDays(guildResults[0]?.sourceDataDate || capturedDate, -7),
    comparisonDates,
    comparisonDateText: Object.entries(comparisonDates)
      .map(([guild, date]) => `${guild}: ${date || "비교 이력 없음"}`)
      .join(" · "),
    raidPeriod: primaryPeriod,
    raidHistoryByGuild,
    dataSource: "MGF guild_info member-row attributes",
    sourceUrls: Object.fromEntries(guildResults.map((item) => [item.guild, item.sourceUrl])),
    guildProfiles: Object.fromEntries(guildResults.map((item) => [item.guild, {
      name: item.parsed.guildName || item.guild,
      master: item.parsed.master || "",
      serverName: item.parsed.serverName || "",
      serverId: item.parsed.serverId || "",
      guildLevel: item.parsed.guildLevel ?? null,
      memberCount: item.parsed.memberCount || item.members.length,
      totalPowerText: item.parsed.totalPowerText || "",
      totalTobeolText: item.parsed.totalTobeolText || "",
      sourceDataDate: item.sourceDataDate
    }])),
    sourceCapabilities: {
      memberPower: { available: true, field: "data-bp", precision: "raw_integer_preserved" },
      raidScore: { available: true, field: "data-gb", periodAware: true },
      guildRankComparison: {
        available: true,
        fields: ["powerRank", "tobeolRank", "raidRankAdvantage"],
        scope: "within_guild",
        zeroRaidPolicy: "unranked"
      },
      guildUpgradeToday: {
        available: false,
        reason: "MGF 공개 길드 상세 페이지에 업그레이드/건물 활동 필드가 없습니다."
      },
      guildCompetitionScore: {
        available: false,
        reason: "MGF 공개 매칭 페이지는 현재 매칭 그룹만 제공하며 점수 필드는 노출하지 않습니다."
      }
    },
    collectionDiagnostics: Object.fromEntries(guildResults.map((item) => [item.guild, item.validation])),
    summary,
    manualAppliedCount,
    memberChanges,
    departedMembers,
    guildSummaries: Object.fromEntries(
      guildNames.map((guild) => [guild, buildSummary(mergedMembers.filter((member) => member.guild === guild))])
    ),
    members: mergedMembers
  };

  const snapshots = guildResults.map((result) => ({
    date: capturedDate,
    sourceDataDate: result.sourceDataDate,
    capturedAt: kstDateTimeString(),
    guild: result.guild,
    sourceUrl: result.sourceUrl,
    raidPeriod: result.raidPeriod,
    validation: result.validation,
    members: mergedMembers
      .filter((member) => member.guild === result.guild)
      .map((member) => ({
        nickname: member.nickname,
        rank: member.rank,
        job: member.job,
        level: member.level,
        powerValue: member.powerValue,
        powerRaw: member.powerRaw,
        powerRank: member.powerRank,
        sourceTobeolValue: member.sourceTobeolValue,
        sourceTobeolRaw: member.sourceTobeolRaw,
        tobeolRank: member.tobeolRank,
        raidRankAdvantage: member.raidRankAdvantage,
        tobeolValue: member.sourceTobeolValue
      }))
  }));

  await writeJsonFile(LATEST_PATH, latest);
  await writeJsonFile(HISTORY_PATH, upsertHistory(history, snapshots));
  console.log(`🎉 저장 완료: ${LATEST_PATH}`);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Chungju-Guild-Dashboard/2.1)" }
  });
  if (!response.ok) throw new Error(`MGF 조회 실패 ${response.status}: ${url}`);
  return response.text();
}

function buildSummary(members) {
  const total = (field) => members.reduce((sum, member) => sum + Number(member[field] || 0), 0);
  return {
    guildCount: new Set(members.map((member) => member.guild).filter(Boolean)).size,
    memberCount: members.length,
    totalPowerValue: total("powerValue"),
    totalTobeolValue: total("sourceTobeolValue"),
    totalCurrentWeekTobeolValue: total("currentWeekTobeolValue"),
    totalLastWeekTobeolValue: total("lastWeekTobeolValue"),
    lastWeekKnownCount: members.filter((member) => member.lastWeekTobeolValue != null).length
  };
}

function buildMemberChanges(guildNames, members, departedMembers) {
  return Object.fromEntries(guildNames.map((guild) => {
    const newMembers = members
      .filter((member) => member.guild === guild && member.memberStatus === "new")
      .map((member) => ({
        guild,
        nickname: member.nickname,
        rank: member.rank,
        job: member.job,
        level: member.level,
        powerValue: member.powerValue,
        powerText: member.powerText,
        tobeolValue: member.sourceTobeolValue,
        tobeolText: member.sourceTobeolText
      }));
    const departed = departedMembers.filter((member) => member.guild === guild);
    return [guild, { newCount: newMembers.length, departedCount: departed.length, newMembers, departedMembers: departed }];
  }));
}

function applyManualOverrides(members, manual, capturedDate) {
  if (!manual?.items?.length || (manual.date && manual.date !== capturedDate)) return 0;
  const map = new Map(manual.items.map((item) => [memberKey(item.guild, item.nickname), item]));
  let count = 0;
  for (const member of members) {
    const item = map.get(memberKey(member.guild, member.nickname));
    if (!item) continue;
    let changed = false;
    if (hasManualValue(item, "power")) {
      member.powerValue = manualValue(item, "power", member.powerValue);
      member.powerText = formatKoreanPower(member.powerValue);
      member.powerRaw = String(Math.max(0, Math.trunc(member.powerValue || 0)));
      changed = true;
    }
    if (hasManualValue(item, "previousPower")) {
      member.previousPowerValue = manualValue(item, "previousPower", member.previousPowerValue);
      member.previousPowerText = member.previousPowerValue == null ? null : formatKoreanPower(member.previousPowerValue);
      changed = true;
    }
    if (hasManualValue(item, "tobeol")) {
      member.sourceTobeolValue = manualValue(item, "tobeol", member.sourceTobeolValue) ?? 0;
      member.sourceTobeolRaw = String(Math.max(0, Math.trunc(member.sourceTobeolValue || 0)));
      member.tobeolValue = member.sourceTobeolValue;
      member.tobeolRaw = member.sourceTobeolRaw;
      member.tobeolText = formatKoreanPower(member.tobeolValue);
      if (member.currentWeekTobeolValue != null) member.currentWeekTobeolValue = member.tobeolValue;
      if (member.currentWeekTobeolValue != null) member.currentWeekTobeolText = member.tobeolText;
      changed = true;
    }
    if (hasManualValue(item, "previousTobeol")) {
      member.lastWeekTobeolValue = manualValue(item, "previousTobeol", member.lastWeekTobeolValue);
      member.lastWeekTobeolText = member.lastWeekTobeolValue == null ? null : formatKoreanPower(member.lastWeekTobeolValue);
      member.previousTobeolValue = member.lastWeekTobeolValue;
      member.previousTobeolText = member.lastWeekTobeolText;
      changed = true;
    }
    if (changed) {
      member.powerGrowthValue = member.previousPowerValue == null ? null : member.powerValue - member.previousPowerValue;
      member.powerGrowthText = member.powerGrowthValue == null ? null : formatSignedKoreanPower(member.powerGrowthValue);
      member.powerGrowthRate = calcGrowthRate(member.powerValue, member.previousPowerValue);
    }
    if (changed || item.memo) {
      member.isManual = true;
      member.manualMemo = item.memo || "";
      count += 1;
    }
  }
  return count;
}

function hasManualValue(item, prefix) {
  return item?.[`${prefix}Value`] !== undefined || item?.[`${prefix}Text`] !== undefined;
}

function manualValue(item, prefix, fallback) {
  const value = item?.[`${prefix}Value`];
  if (value !== undefined && value !== "") return value == null ? null : Number(value);
  const text = item?.[`${prefix}Text`];
  if (text !== undefined) return String(text).trim() ? parseKoreanPowerValue(text) : null;
  return nullableNumber(fallback);
}

function memberMap(snapshot) {
  return new Map((snapshot?.members || []).filter((member) => member?.nickname).map((member) => [member.nickname, member]));
}

function upsertHistory(history, snapshots) {
  const keys = new Set(snapshots.map(historyKey));
  const next = [...history.filter((item) => !keys.has(historyKey(item))), ...snapshots]
    .sort((a, b) => historyKey(a).localeCompare(historyKey(b)));
  return next.slice(-180);
}

function historyKey(snapshot) {
  return `${snapshot?.sourceDataDate || snapshot?.date || ""}::${snapshot?.guild || ""}`;
}

function guildInfoUrl(guild) {
  return `${SOURCE_BASE}/contents/guild_info.php?g_name=${encodeURIComponent(guild)}`;
}

function parseGuildNames(value) {
  if (Array.isArray(value)) return value.flatMap(parseGuildNames);
  return String(value || "").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

function parseArgs(args) {
  return Object.fromEntries(args.filter((item) => item.startsWith("--") && item.includes("="))
    .map((item) => {
      const [key, ...rest] = item.slice(2).split("=");
      return [key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), rest.join("=")];
    }));
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("ko-KR");
}

function memberKey(guild, nickname) {
  return `${String(guild || "").trim()}::${String(nickname || "").trim()}`;
}

function nullableNumber(value) {
  return value == null || value === "" ? null : Number(value);
}

function calcGrowthRate(current, previous) {
  const before = Number(previous || 0);
  if (!before) return null;
  return Number((((Number(current || 0) - before) / before) * 100).toFixed(2));
}

function formatSignedKoreanPower(value) {
  const number = Number(value || 0);
  if (!number) return "0";
  return `${number > 0 ? "+" : "-"}${formatKoreanPower(Math.abs(number))}`;
}

function kstDateTimeString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

run().catch((error) => {
  console.error("❌ 수집 실패:", error?.message || error);
  process.exit(1);
});
