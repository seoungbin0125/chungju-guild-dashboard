const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function parseMsidleGuildWarHtml(html, { expectedGuild = "", expectedServer = "" } = {}) {
  const source = String(html || "");
  const script = source.match(/<script\b(?=[^>]*\bdata-page=["']app["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) throw new Error("msidle.gg 길드 대항전 데이터 JSON을 찾지 못했습니다.");

  let page;
  try {
    page = JSON.parse(decodeHtmlEntities(script));
  } catch {
    throw new Error("msidle.gg 길드 대항전 데이터 JSON 해석에 실패했습니다.");
  }

  const props = page?.props || {};
  const guild = cleanText(props.guild?.name);
  const server = cleanText(props.guild?.server?.name);
  if (expectedGuild && normalizeName(guild) !== normalizeName(expectedGuild)) {
    throw new Error(`요청 길드(${expectedGuild})와 응답 길드(${guild || "없음"})가 다릅니다.`);
  }
  if (expectedServer && normalizeName(server) !== normalizeName(expectedServer)) {
    throw new Error(`요청 서버(${expectedServer})와 응답 서버(${server || "없음"})가 다릅니다.`);
  }

  const members = (Array.isArray(props.members) ? props.members : []).map((member) => ({
    nickname: cleanText(member?.name),
    scoreRaw: integerString(member?.best_guild_war_damage),
    previousScoreRaw: integerString(member?.previous_damage),
    previousScoreAt: normalizeTimestamp(member?.previous_damage_at),
    updatedAt: normalizeTimestamp(member?.data_updated_at)
  })).filter((member) => member.nickname);

  return {
    guild,
    server,
    world: cleanText(props.guild?.world?.name),
    activeTab: cleanText(props.active_tab),
    memberCount: Number(props.guild?.stats?.members || members.length || 0),
    members
  };
}

/**
 * 길드 대항전은 목요일에 새 라운드가 시작되므로 가장 최근 목요일을 주차 키로 사용한다.
 * 화/수에 이전 라운드 값이 남아 있어도 updatedAt이 새 주차 범위 밖이면 이번 주 점수로 간주하지 않는다.
 */
export function getGuildWarWeekKey(dateOrTimestamp) {
  const dateString = kstDateFromInput(dateOrTimestamp);
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const daysSinceThursday = (date.getUTCDay() - 4 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceThursday);
  return date.toISOString().slice(0, 10);
}

export function buildGuildWarData({ parsed, history = [], roster = [], capturedAt = kstDateTime() }) {
  const guild = parsed?.guild || "";
  const server = parsed?.server || "";
  const currentWeekKey = getGuildWarWeekKey(capturedAt);
  const nextWeekKey = addDays(currentWeekKey, 7);
  const previousWeekKey = addDays(currentWeekKey, -7);
  const normalizedHistory = normalizeHistory(history, guild);
  const sourceMembers = Array.isArray(parsed?.members) ? parsed.members : [];

  const currentSource = sourceMembers
    .filter((member) => member.scoreRaw != null)
    .filter((member) => timestampInWeek(member.updatedAt, currentWeekKey, nextWeekKey))
    .map((member) => scoreRecord(member.nickname, member.scoreRaw, member.updatedAt));

  const previousSource = sourceMembers
    .filter((member) => member.previousScoreRaw != null)
    .filter((member) => timestampInWeek(member.previousScoreAt, previousWeekKey, currentWeekKey))
    .map((member) => scoreRecord(member.nickname, member.previousScoreRaw, member.previousScoreAt));

  const nextHistory = upsertWeek(
    upsertWeek(normalizedHistory, guild, server, previousWeekKey, previousSource, capturedAt),
    guild,
    server,
    currentWeekKey,
    currentSource,
    capturedAt
  );

  const currentSnapshot = findWeek(nextHistory, guild, currentWeekKey);
  const previousSnapshot = findWeek(nextHistory, guild, previousWeekKey);
  const currentMap = new Map((currentSnapshot?.members || []).map((member) => [member.nickname, member]));
  const previousMap = new Map((previousSnapshot?.members || []).map((member) => [member.nickname, member]));
  const rosterNames = unique([
    ...(Array.isArray(roster) ? roster : []).map((member) => cleanText(member?.nickname ?? member)),
    ...sourceMembers.map((member) => member.nickname),
    ...currentMap.keys(),
    ...previousMap.keys()
  ]).filter(Boolean);

  const members = rosterNames.map((nickname) => {
    const current = currentMap.get(nickname) || null;
    const previous = previousMap.get(nickname) || null;
    const currentRaw = current?.scoreRaw ?? null;
    const previousRaw = previous?.scoreRaw ?? null;
    const growthRaw = currentRaw != null && previousRaw != null
      ? String(BigInt(currentRaw) - BigInt(previousRaw))
      : null;
    const growthRate = calculateGrowthRate(currentRaw, previousRaw);

    return {
      nickname,
      currentScoreRaw: currentRaw,
      currentScoreValue: safeNumber(currentRaw),
      currentScoreText: currentRaw == null ? null : formatKoreanInteger(currentRaw),
      currentUpdatedAt: current?.updatedAt || null,
      previousScoreRaw: previousRaw,
      previousScoreValue: safeNumber(previousRaw),
      previousScoreText: previousRaw == null ? null : formatKoreanInteger(previousRaw),
      previousUpdatedAt: previous?.updatedAt || null,
      growthRaw,
      growthValue: safeNumber(growthRaw),
      growthText: growthRaw == null ? null : formatSignedKoreanInteger(growthRaw),
      growthRate,
      status: currentRaw == null ? "not_collected" : previousRaw == null ? "new_record" : "compared"
    };
  });

  assignScoreRank(members);
  members.sort((a, b) => rankOrLast(a.currentRank) - rankOrLast(b.currentRank)
    || rankOrLast(a.previousRank) - rankOrLast(b.previousRank)
    || a.nickname.localeCompare(b.nickname, "ko"));

  const currentKnown = members.filter((member) => member.currentScoreRaw != null);
  const previousKnown = members.filter((member) => member.previousScoreRaw != null);
  const compared = members.filter((member) => member.growthRaw != null);
  const currentTotalRaw = sumRaw(currentKnown.map((member) => member.currentScoreRaw));
  const previousTotalRaw = sumRaw(previousKnown.map((member) => member.previousScoreRaw));

  return {
    history: nextHistory,
    data: {
      version: 1,
      capturedAt,
      source: "msidle.gg public guild-war page",
      sourceUrl: "",
      sourceNotice: "사용자 제출 기반 공개 데이터입니다. 미수집은 0점이 아닙니다.",
      guild,
      server,
      currentWeekKey,
      previousWeekKey,
      currentWeekLabel: `${currentWeekKey} 시작 주차`,
      previousWeekLabel: `${previousWeekKey} 시작 주차`,
      summary: {
        rosterCount: rosterNames.length,
        currentKnownCount: currentKnown.length,
        previousKnownCount: previousKnown.length,
        comparedCount: compared.length,
        increasedCount: compared.filter((member) => BigInt(member.growthRaw) > 0n).length,
        equalCount: compared.filter((member) => BigInt(member.growthRaw) === 0n).length,
        decreasedCount: compared.filter((member) => BigInt(member.growthRaw) < 0n).length,
        currentTotalRaw,
        currentTotalValue: safeNumber(currentTotalRaw),
        currentTotalText: formatKoreanInteger(currentTotalRaw),
        previousTotalRaw,
        previousTotalValue: safeNumber(previousTotalRaw),
        previousTotalText: formatKoreanInteger(previousTotalRaw)
      },
      members
    }
  };
}

export function formatKoreanInteger(value) {
  let remaining = BigInt(integerString(value) || "0");
  const units = [
    ["해", 10n ** 20n],
    ["경", 10n ** 16n],
    ["조", 10n ** 12n],
    ["억", 10n ** 8n],
    ["만", 10n ** 4n]
  ];
  const parts = [];
  for (const [label, size] of units) {
    const unitValue = remaining / size;
    remaining %= size;
    if (unitValue > 0n) parts.push(`${unitValue}${label}`);
  }
  if (!parts.length || remaining > 0n) parts.push(String(remaining));
  return parts.join(" ");
}

function formatSignedKoreanInteger(value) {
  const raw = integerString(value, { signed: true });
  if (raw == null) return null;
  const integer = BigInt(raw);
  if (integer === 0n) return "변동 없음";
  return `${integer > 0n ? "+" : "-"}${formatKoreanInteger(integer < 0n ? -integer : integer)}`;
}

function assignScoreRank(members) {
  const current = members
    .filter((member) => member.currentScoreRaw != null)
    .sort((a, b) => compareRawDescending(a.currentScoreRaw, b.currentScoreRaw) || a.nickname.localeCompare(b.nickname, "ko"));
  const previous = members
    .filter((member) => member.previousScoreRaw != null)
    .sort((a, b) => compareRawDescending(a.previousScoreRaw, b.previousScoreRaw) || a.nickname.localeCompare(b.nickname, "ko"));
  assignRanks(current, "currentScoreRaw", "currentRank");
  assignRanks(previous, "previousScoreRaw", "previousRank");
}

function assignRanks(members, valueField, rankField) {
  let previous = null;
  let rank = 0;
  members.forEach((member, index) => {
    if (previous == null || member[valueField] !== previous) rank = index + 1;
    member[rankField] = rank;
    previous = member[valueField];
  });
}

function compareRawDescending(left, right) {
  const a = BigInt(left || 0);
  const b = BigInt(right || 0);
  return a === b ? 0 : a > b ? -1 : 1;
}

function calculateGrowthRate(currentRaw, previousRaw) {
  if (currentRaw == null || previousRaw == null) return null;
  const current = BigInt(currentRaw);
  const previous = BigInt(previousRaw);
  if (previous === 0n) return null;
  const difference = current - previous;
  const absolute = difference < 0n ? -difference : difference;
  // 퍼센트 소수 첫째 자리까지 반올림: |차이| / 이전값 × 100 × 10
  const tenths = (absolute * 1000n + previous / 2n) / previous;
  const numeric = Number(tenths);
  if (!Number.isSafeInteger(numeric)) return null;
  return (difference < 0n ? -numeric : numeric) / 10;
}

function upsertWeek(history, guild, server, weekKey, incoming, capturedAt) {
  if (!incoming.length && !findWeek(history, guild, weekKey)) return history;
  const existing = findWeek(history, guild, weekKey);
  const map = new Map((existing?.members || []).map((member) => [member.nickname, member]));
  for (const member of incoming) {
    const old = map.get(member.nickname);
    if (!old || String(member.updatedAt || "") >= String(old.updatedAt || "")) map.set(member.nickname, member);
  }
  const snapshot = {
    guild,
    server,
    weekKey,
    capturedAt,
    members: [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"))
  };
  return [...history.filter((item) => !(item.guild === guild && item.weekKey === weekKey)), snapshot]
    .sort((a, b) => `${a.weekKey}::${a.guild}`.localeCompare(`${b.weekKey}::${b.guild}`))
    .slice(-104);
}

function normalizeHistory(history, guild) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => item?.guild === guild && /^\d{4}-\d{2}-\d{2}$/.test(item?.weekKey || ""))
    .map((item) => ({ ...item, members: (Array.isArray(item.members) ? item.members : []).filter((member) => member?.nickname && integerString(member?.scoreRaw) != null) }));
}

function findWeek(history, guild, weekKey) {
  return history.find((item) => item?.guild === guild && item?.weekKey === weekKey) || null;
}

function scoreRecord(nickname, scoreRaw, updatedAt) {
  return { nickname, scoreRaw: integerString(scoreRaw), updatedAt: normalizeTimestamp(updatedAt) };
}

function timestampInWeek(timestamp, start, end) {
  const date = kstDateFromInput(timestamp, "");
  return Boolean(date && date >= start && date < end);
}

function kstDateFromInput(value, fallback = kstDate()) {
  const source = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  // 수집기가 만드는 `YYYY-MM-DD HH:mm:ss`는 이미 KST이므로 다시 +9시간 하지 않는다.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(source)) return source.slice(0, 10);
  const parsed = Date.parse(source);
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function normalizeTimestamp(value) {
  const source = String(value || "").trim();
  return Number.isFinite(Date.parse(source)) ? source : null;
}

function integerString(value, { signed = false } = {}) {
  if (value == null || value === "") return null;
  const source = String(value).replace(/,/g, "").trim();
  const pattern = signed ? /^-?\d+$/ : /^\d+$/;
  return pattern.test(source) ? String(BigInt(source)) : null;
}

function safeNumber(value) {
  if (value == null) return null;
  const integer = BigInt(value);
  return integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(integer)
    : null;
}

function sumRaw(values) {
  return String(values.reduce((sum, value) => sum + BigInt(value || 0), 0n));
}

function rankOrLast(value) {
  return value == null ? Number.MAX_SAFE_INTEGER : Number(value);
}

function unique(values) {
  return [...new Set(values)];
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value).toLocaleLowerCase("ko-KR");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function addDays(dateString, offset) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function kstDate() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function kstDateTime() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);
}
