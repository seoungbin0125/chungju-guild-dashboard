const KOREAN_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

export function parseGuildInfoHtml(html, expectedGuild = "") {
  const source = String(html || "");
  const guildName = textByClass(source, "guild-name") || String(expectedGuild || "").trim();
  const serverName = textByClass(source, "server-chip");
  const master = textByClass(source, "master-nick");
  const sourceDateMatch = source.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\s*기준\s*데이터/);
  const sourceDataDate = sourceDateMatch
    ? [sourceDateMatch[1], sourceDateMatch[2].padStart(2, "0"), sourceDateMatch[3].padStart(2, "0")].join("-")
    : "";
  const stats = parseGuildStats(source);
  const members = parseGuildMemberRows(source);

  return {
    guildName,
    serverName,
    serverId: (serverName.match(/(\d+)\s*$/) || [])[1] || "",
    master,
    guildLevel: integerFromText(stats.get("레벨")),
    memberCount: integerFromText(stats.get("길드원")) || members.length,
    totalPowerText: stats.get("전투력") || "",
    totalTobeolText: stats.get("토벌전") || "",
    sourceDataDate,
    members
  };
}

export function parseGuildMemberRows(html) {
  const rows = splitByOpeningClass(html, "member-row");
  const members = [];
  const seen = new Set();

  for (const row of rows) {
    const openingTag = (row.match(/^<div\b[^>]*>/i) || [""])[0];
    const powerRaw = attribute(openingTag, "data-bp");
    const tobeolRaw = attribute(openingTag, "data-gb");
    const rank = integerFromText(textByClass(row, "member-rank"));
    const nickname = anchorTextByClass(row, "nick-link") || attributeFromClass(row, "nick-link", "title");
    const memberSub = textByClass(row, "member-sub");
    const jobLevel = memberSub.match(/^(.+?)\s*[|｜]\s*Lv\.?\s*(\d+)/i)
      || memberSub.match(/^(.+?)\s+Lv\.?\s*(\d+)/i);
    const job = cleanText(jobLevel?.[1] || "");
    const level = Number(jobLevel?.[2] || 0) || null;
    const powerValue = exactInteger(powerRaw);
    const tobeolValue = exactInteger(tobeolRaw);

    if (!nickname || seen.has(nickname) || powerValue == null) continue;
    seen.add(nickname);
    members.push({
      rank: rank || members.length + 1,
      nickname,
      job,
      level,
      powerRaw,
      powerValue,
      powerText: formatKoreanPower(powerValue),
      tobeolRaw: tobeolRaw || "0",
      tobeolValue: tobeolValue ?? 0,
      tobeolText: formatKoreanPower(tobeolValue ?? 0)
    });
  }

  return members;
}

export function parseGuildContentHtml(html, { keyword = "" } = {}) {
  const source = String(html || "");
  const matchCount = Number((stripTags(source).match(/총\s*(\d+)개\s*길드/) || [])[1] || 0);
  const cards = splitByOpeningClass(source, "guild-card");
  const guilds = cards.map(parseGuildCard).filter((guild) => guild.name);
  const requested = cleanText(keyword);

  if (requested) {
    guilds.sort((a, b) => Number(b.name === requested) - Number(a.name === requested));
  }

  return {
    matchCount: matchCount || guilds.length,
    scoreAvailable: guilds.some((guild) => guild.scoreValue != null),
    guilds
  };
}

export function getRaidPeriod(dateString) {
  const sourceDate = normalizeDate(dateString) || kstDateString();
  const date = new Date(`${sourceDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const currentWeekKey = addDays(sourceDate, -daysSinceMonday);
  const isMondaySnapshot = day === 1;
  const scoreWeekKey = isMondaySnapshot ? addDays(currentWeekKey, -7) : currentWeekKey;

  return {
    sourceDate,
    currentWeekKey,
    scoreWeekKey,
    kind: isMondaySnapshot ? "previous_week_final" : "current_week_live",
    isFinal: isMondaySnapshot,
    metricLabel: isMondaySnapshot ? "지난주 토벌 확정" : "이번 주 토벌 진행",
    description: isMondaySnapshot
      ? `${scoreWeekKey} 주차의 지난주 확정 점수`
      : `${scoreWeekKey} 주차의 현재 누적 점수`
  };
}

export function findRaidSnapshot(history, guild, scoreWeekKey, { finalOnly = true } = {}) {
  const candidates = (Array.isArray(history) ? history : [])
    .filter((snapshot) => snapshot?.guild === guild)
    .filter((snapshot) => snapshot?.raidPeriod?.scoreWeekKey === scoreWeekKey)
    .filter((snapshot) => !finalOnly || snapshot?.raidPeriod?.isFinal)
    .sort((a, b) => String(b.sourceDataDate || b.date || "").localeCompare(String(a.sourceDataDate || a.date || "")));
  return candidates[0] || null;
}

export function findPowerComparisonSnapshot(history, guild, targetDate, maxDistanceDays = 2) {
  const target = normalizeDate(targetDate);
  if (!target) return null;

  const candidates = (Array.isArray(history) ? history : [])
    .filter((snapshot) => snapshot?.guild === guild && normalizeDate(snapshot.sourceDataDate || snapshot.date))
    .map((snapshot) => ({
      snapshot,
      distance: Math.abs(daysBetween(snapshot.sourceDataDate || snapshot.date, target))
    }))
    .filter((item) => item.distance <= maxDistanceDays)
    .sort((a, b) => a.distance - b.distance || String(b.snapshot.date || "").localeCompare(String(a.snapshot.date || "")));

  return candidates[0]?.snapshot || null;
}

/**
 * 길드 안에서 전투력 순위와 토벌전 순위를 같은 기준으로 계산한다.
 * 같은 수치는 공동 순위(1, 2, 2, 4), 토벌 0점은 미참여(null)로 둔다.
 * raidRankAdvantage가 양수면 토벌 순위가 전투력 순위보다 그만큼 높다.
 */
export function addMemberRankComparison(members) {
  const ranked = (Array.isArray(members) ? members : []).map((member, index) => ({
    ...member,
    __rankIndex: index,
    powerRank: null,
    tobeolRank: null,
    raidRankAdvantage: null
  }));
  const guildGroups = new Map();

  for (const member of ranked) {
    const guild = String(member.guild || "");
    if (!guildGroups.has(guild)) guildGroups.set(guild, []);
    guildGroups.get(guild).push(member);
  }

  for (const group of guildGroups.values()) {
    assignCompetitionRank(group, "powerRank", (member) => exactRankValue(member.powerRaw, member.powerValue), () => true);
    assignCompetitionRank(
      group,
      "tobeolRank",
      (member) => exactRankValue(member.sourceTobeolRaw ?? member.tobeolRaw, member.sourceTobeolValue ?? member.tobeolValue),
      (value) => value > 0n
    );

    for (const member of group) {
      member.raidRankAdvantage = member.powerRank != null && member.tobeolRank != null
        ? member.powerRank - member.tobeolRank
        : null;
    }
  }

  return ranked
    .sort((a, b) => a.__rankIndex - b.__rankIndex)
    .map(({ __rankIndex, ...member }) => member);
}

export function formatKoreanPower(value) {
  let n = Math.max(0, Math.floor(Number(value || 0)));
  const units = [
    ["경", 10_000_000_000_000_000],
    ["조", 1_000_000_000_000],
    ["억", 100_000_000],
    ["만", 10_000]
  ];
  const parts = [];

  for (const [label, size] of units) {
    const unitValue = Math.floor(n / size);
    n %= size;
    if (unitValue > 0) parts.push(`${unitValue}${label}`);
  }

  return parts.join(" ") || "0";
}

function assignCompetitionRank(members, field, getValue, includeValue) {
  const sorted = members
    .map((member) => ({ member, value: getValue(member) }))
    .filter((item) => item.value != null && includeValue(item.value))
    .sort((a, b) => {
      if (a.value !== b.value) return a.value > b.value ? -1 : 1;
      return String(a.member.nickname || "").localeCompare(String(b.member.nickname || ""), "ko");
    });

  let previousValue = null;
  let rank = 0;
  sorted.forEach((item, index) => {
    if (previousValue == null || item.value !== previousValue) rank = index + 1;
    item.member[field] = rank;
    previousValue = item.value;
  });
}

function exactRankValue(rawValue, numericValue) {
  const raw = String(rawValue ?? "").trim();
  if (/^\d+$/.test(raw)) return BigInt(raw);
  const numeric = Number(numericValue);
  return Number.isFinite(numeric) ? BigInt(Math.max(0, Math.trunc(numeric))) : null;
}

export function parseKoreanPowerValue(text) {
  const source = cleanText(text).replace(/,/g, "");
  if (!source) return null;
  if (/^\d+(?:\.\d+)?$/.test(source)) return Number(source);
  const units = { 경: 10_000_000_000_000_000, 조: 1_000_000_000_000, 억: 100_000_000, 만: 10_000 };
  let total = 0;
  let matched = false;
  for (const [unit, size] of Object.entries(units)) {
    const match = source.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`));
    if (!match) continue;
    total += Number(match[1]) * size;
    matched = true;
  }
  return matched ? total : null;
}

export function kstDateString(offsetDays = 0) {
  return new Date(Date.now() + KOREAN_TIME_OFFSET_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(dateString, offsetDays) {
  const date = new Date(`${normalizeDate(dateString)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(offsetDays || 0));
  return date.toISOString().slice(0, 10);
}

function parseGuildStats(html) {
  const stats = new Map();
  for (const block of splitByOpeningClass(html, "stat-pill")) {
    const label = textByClass(block, "stat-pill-label");
    const tooltip = textByClass(block, "power-tooltip");
    const value = tooltip || textByClass(block, "stat-pill-value");
    if (label) stats.set(label, value);
  }
  return stats;
}

function parseGuildCard(card) {
  const name = anchorTextByClass(card, "g-name-link");
  const masterBlock = (card.match(/Master\.[\s\S]*?<strong\b[^>]*>([\s\S]*?)<\/strong>/i) || [])[1] || "";
  const master = anchorTextByClass(masterBlock, "char-link") || stripTags(masterBlock);
  const server = textByClass(card, "server-name");
  const powerText = textByClass(card, "g-power").replace(/^\s*[⚡🔥]\s*/, "");
  const members = [];
  const memberRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let memberMatch;
  while ((memberMatch = memberRegex.exec(card)) !== null) {
    const block = memberMatch[1];
    const rank = integerFromText(textByClass(block, "m-rank"));
    const nickname = anchorTextByClass(block, "char-link") || textByClass(block, "m-name");
    const memberPowerText = textByClass(block, "m-power");
    if (!rank || !nickname) continue;
    members.push({ rank, nickname, powerText: memberPowerText });
    if (members.length >= 5) break;
  }

  const plain = stripTags(card);
  const scoreMatch = plain.match(/(?:대항전\s*)?(?:점수|Score|Point)\s*[:：]?\s*([\d,.]+(?:\s*[경조억만])?)/i);
  const scoreText = scoreMatch?.[1] || "";
  const scoreValue = scoreText ? parseKoreanPowerValue(scoreText) : null;

  return {
    name,
    master,
    server,
    powerText,
    scoreText: scoreValue == null ? null : scoreText,
    scoreValue,
    scoreAvailable: scoreValue != null,
    members
  };
}

function splitByOpeningClass(html, className) {
  const source = String(html || "");
  const matches = findOpeningTagsByClass(source, className, "div");
  return matches.map((match, index) => source.slice(match.index, matches[index + 1]?.index ?? source.length));
}

function textByClass(html, className) {
  const source = String(html || "");
  const found = findOpeningTagsByClass(source, className)[0];
  if (!found) return "";
  const closing = new RegExp(`<\\/${found.tagName}\\s*>`, "i");
  const rest = source.slice(found.end);
  const end = rest.search(closing);
  return stripTags(end >= 0 ? rest.slice(0, end) : "");
}

function anchorTextByClass(html, className) {
  const source = String(html || "");
  const found = findOpeningTagsByClass(source, className, "a")[0];
  if (!found) return "";
  const rest = source.slice(found.end);
  const end = rest.search(/<\/a\s*>/i);
  return stripTags(end >= 0 ? rest.slice(0, end) : "");
}

function attributeFromClass(html, className, attributeName) {
  const found = findOpeningTagsByClass(String(html || ""), className)[0];
  return attribute(found?.openingTag || "", attributeName);
}

function findOpeningTagsByClass(html, className, requiredTagName = "") {
  const source = String(html || "");
  const tagRegex = /<([a-z0-9]+)\b[^>]*\bclass\s*=\s*(["'])(.*?)\2[^>]*>/gi;
  const matches = [];
  let match;
  while ((match = tagRegex.exec(source)) !== null) {
    const tagName = String(match[1] || "").toLowerCase();
    const classes = String(match[3] || "").split(/\s+/).filter(Boolean);
    if (requiredTagName && tagName !== requiredTagName.toLowerCase()) continue;
    if (!classes.includes(className)) continue;
    matches.push({ index: match.index, end: tagRegex.lastIndex, tagName, openingTag: match[0] });
  }
  return matches;
}

function attribute(tag, name) {
  const regex = new RegExp(`\\b${escapeRegex(name)}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return decodeHtmlEntities((String(tag || "").match(regex) || [])[2] || "");
}

function stripTags(value) {
  return cleanText(decodeHtmlEntities(String(value || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
}

function exactInteger(value) {
  const source = String(value || "").replace(/,/g, "").trim();
  if (!/^\d+$/.test(source)) return null;
  const number = Number(source);
  return Number.isFinite(number) ? number : null;
}

function integerFromText(value) {
  return Number((String(value || "").match(/[\d,]+/) || [""])[0].replace(/,/g, "")) || null;
}

function normalizeDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? match[0] : "";
}

function daysBetween(left, right) {
  const a = new Date(`${normalizeDate(left)}T00:00:00.000Z`).getTime();
  const b = new Date(`${normalizeDate(right)}T00:00:00.000Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
