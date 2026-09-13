const SCORE_UNITS = [
  ["경", 10_000_000_000_000_000n],
  ["조", 1_000_000_000_000n],
  ["억", 100_000_000n],
  ["만", 10_000n]
];

export function normalizeGuildWarScoreInput(value) {
  const source = String(value ?? "").replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return normalizeRawInteger(source);

  let total = 0n;
  let foundUnit = false;
  let remainder = source;
  const unitPattern = /(\d+(?:\.\d+)?)(경|조|억|만)/g;
  for (const match of source.matchAll(unitPattern)) {
    foundUnit = true;
    const unit = SCORE_UNITS.find(([label]) => label === match[2]);
    total += scaleDecimal(match[1], unit[1]);
    remainder = remainder.replace(match[0], "");
  }

  if (!foundUnit || (remainder && !/^\d+$/.test(remainder))) {
    throw new Error("숫자 또는 경·조·억·만 단위로 입력해주세요.");
  }
  if (remainder) total += BigInt(remainder);
  return total.toString();
}

export function formatGuildWarScore(rawValue) {
  const raw = normalizeStoredRaw(rawValue);
  if (raw == null) return "";
  let remaining = BigInt(raw);
  if (remaining === 0n) return "0";
  const parts = [];
  for (const [label, unit] of SCORE_UNITS) {
    const amount = remaining / unit;
    remaining %= unit;
    if (amount > 0n) parts.push(`${amount}${label}`);
  }
  if (remaining > 0n) parts.push(remaining.toString());
  return parts.join(" ");
}

export function mergeGuildWarManualData({
  baseData,
  rosterMembers,
  currentManual,
  previousManual
}) {
  const source = baseData && Array.isArray(baseData.members) ? baseData : { members: [], summary: {} };
  const baseMap = new Map(source.members.map((member) => [String(member.nickname || ""), member]));
  const currentMap = manualItemMap(currentManual);
  const previousMap = manualItemMap(previousManual);
  const roster = Array.isArray(rosterMembers) && rosterMembers.length
    ? rosterMembers
    : source.members;

  const members = roster.map((rosterMember) => {
    const nickname = String(rosterMember.nickname || "");
    const base = baseMap.get(nickname) || {};
    const currentItem = currentMap.get(nickname);
    const previousItem = previousMap.get(nickname);
    const currentScoreRaw = currentItem
      ? normalizeStoredRaw(currentItem.scoreRaw ?? currentItem.scoreValue)
      : normalizeStoredRaw(base.currentScoreRaw ?? base.currentScoreValue);
    const previousScoreRaw = previousItem
      ? normalizeStoredRaw(previousItem.scoreRaw ?? previousItem.scoreValue)
      : normalizeStoredRaw(base.previousScoreRaw ?? base.previousScoreValue);

    return {
      ...base,
      nickname,
      guild: rosterMember.guild || base.guild || source.guild || "충주시",
      job: rosterMember.job || base.job || "",
      currentScoreRaw,
      currentScoreValue: currentScoreRaw == null ? null : Number(currentScoreRaw),
      currentScoreText: currentScoreRaw == null ? null : formatGuildWarScore(currentScoreRaw),
      currentUpdatedAt: currentItem?.updatedAt || base.currentUpdatedAt || null,
      previousScoreRaw,
      previousScoreValue: previousScoreRaw == null ? null : Number(previousScoreRaw),
      previousScoreText: previousScoreRaw == null ? null : formatGuildWarScore(previousScoreRaw),
      previousUpdatedAt: previousItem?.updatedAt || base.previousUpdatedAt || null,
      currentManual: Boolean(currentItem),
      previousManual: Boolean(previousItem)
    };
  });

  const currentRanks = buildRanks(members, "currentScoreRaw");
  const previousRanks = buildRanks(members, "previousScoreRaw");
  for (const member of members) {
    member.currentRank = currentRanks.get(member.nickname) ?? null;
    member.previousRank = previousRanks.get(member.nickname) ?? null;
    if (member.currentScoreRaw != null && member.previousScoreRaw != null) {
      const growth = BigInt(member.currentScoreRaw) - BigInt(member.previousScoreRaw);
      member.growthRaw = growth.toString();
      member.growthValue = Number(growth);
      member.growthText = formatSignedScore(growth);
      member.growthRate = BigInt(member.previousScoreRaw) === 0n
        ? null
        : Number((((Number(member.currentScoreRaw) - Number(member.previousScoreRaw)) / Number(member.previousScoreRaw)) * 100).toFixed(2));
      member.status = growth > 0n ? "increased" : growth < 0n ? "decreased" : "equal";
    } else {
      member.growthRaw = null;
      member.growthValue = null;
      member.growthText = null;
      member.growthRate = null;
      member.status = member.currentScoreRaw == null ? "not_collected" : "new_record";
    }
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.currentScoreRaw == null && b.currentScoreRaw == null) return rosterIndex(roster, a.nickname) - rosterIndex(roster, b.nickname);
    if (a.currentScoreRaw == null) return 1;
    if (b.currentScoreRaw == null) return -1;
    const left = BigInt(a.currentScoreRaw);
    const right = BigInt(b.currentScoreRaw);
    if (left === right) return String(a.nickname).localeCompare(String(b.nickname), "ko");
    return left > right ? -1 : 1;
  });

  const currentKnown = members.filter((member) => member.currentScoreRaw != null);
  const previousKnown = members.filter((member) => member.previousScoreRaw != null);
  const compared = members.filter((member) => member.growthRaw != null);
  const currentTotal = sumRaw(currentKnown.map((member) => member.currentScoreRaw));
  const previousTotal = sumRaw(previousKnown.map((member) => member.previousScoreRaw));

  return {
    ...source,
    currentWeekKey: currentManual?.date || source.currentWeekKey || "",
    previousWeekKey: previousManual?.date || source.previousWeekKey || "",
    members: sortedMembers,
    summary: {
      rosterCount: members.length,
      currentKnownCount: currentKnown.length,
      previousKnownCount: previousKnown.length,
      comparedCount: compared.length,
      increasedCount: compared.filter((member) => BigInt(member.growthRaw) > 0n).length,
      equalCount: compared.filter((member) => BigInt(member.growthRaw) === 0n).length,
      decreasedCount: compared.filter((member) => BigInt(member.growthRaw) < 0n).length,
      currentTotalRaw: currentTotal,
      currentTotalValue: Number(currentTotal),
      currentTotalText: formatGuildWarScore(currentTotal),
      previousTotalRaw: previousTotal,
      previousTotalValue: Number(previousTotal),
      previousTotalText: formatGuildWarScore(previousTotal)
    }
  };
}

function manualItemMap(manual) {
  return new Map((Array.isArray(manual?.items) ? manual.items : [])
    .filter((item) => item?.nickname && (item.scoreRaw !== undefined || item.scoreValue !== undefined))
    .map((item) => [String(item.nickname), item]));
}

function buildRanks(members, field) {
  const ranked = members
    .filter((member) => member[field] != null)
    .sort((a, b) => {
      const left = BigInt(a[field]);
      const right = BigInt(b[field]);
      if (left === right) return String(a.nickname).localeCompare(String(b.nickname), "ko");
      return left > right ? -1 : 1;
    });
  const result = new Map();
  let lastRaw = null;
  let lastRank = 0;
  ranked.forEach((member, index) => {
    if (member[field] !== lastRaw) lastRank = index + 1;
    lastRaw = member[field];
    result.set(member.nickname, lastRank);
  });
  return result;
}

function rosterIndex(roster, nickname) {
  const index = roster.findIndex((member) => String(member.nickname || "") === nickname);
  return index < 0 ? 9999 : index;
}

function sumRaw(values) {
  return values.reduce((sum, value) => sum + BigInt(value || "0"), 0n).toString();
}

function formatSignedScore(value) {
  const score = typeof value === "bigint" ? value : BigInt(value || 0);
  if (score === 0n) return "0";
  return `${score > 0n ? "+" : "-"}${formatGuildWarScore(score > 0n ? score : -score)}`;
}

function normalizeStoredRaw(value) {
  if (value == null || value === "") return null;
  const source = String(value).replace(/,/g, "").trim();
  if (!/^\d+$/.test(source)) return null;
  return normalizeRawInteger(source);
}

function normalizeRawInteger(value) {
  return BigInt(value || "0").toString();
}

function scaleDecimal(value, multiplier) {
  const [wholePart, fractionalPart = ""] = String(value).split(".");
  const whole = BigInt(wholePart || "0") * multiplier;
  if (!fractionalPart) return whole;
  const denominator = 10n ** BigInt(fractionalPart.length);
  return whole + ((BigInt(fractionalPart) * multiplier) / denominator);
}
