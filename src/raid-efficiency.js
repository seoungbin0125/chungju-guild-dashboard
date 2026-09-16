const VERY_HIGH_GAIN = 50;
const HIGH_GAIN = 25;
const NORMAL_GAIN = -10;
const LOW_GAIN = -30;

export function classifyRaidEfficiency(value) {
  if (value == null || value === "") return { key: "unknown", label: "미집계", description: "서버 순위 없음" };
  const score = Number(value);
  if (!Number.isFinite(score)) return { key: "unknown", label: "미집계", description: "서버 순위 없음" };
  if (score >= VERY_HIGH_GAIN) return { key: "excellent", label: "매우 높음", description: "투력 순위보다 50% 이상 앞섬" };
  if (score >= HIGH_GAIN) return { key: "high", label: "높음", description: "투력 순위보다 25% 이상 앞섬" };
  if (score >= NORMAL_GAIN) return { key: "normal", label: "적정", description: "두 서버 순위가 비슷함" };
  if (score >= LOW_GAIN) return { key: "low", label: "낮음", description: "토벌 순위가 다소 낮음" };
  return { key: "very-low", label: "매우 낮음", description: "토벌 순위 점검 필요" };
}

export function calculateServerRankEfficiency(powerRank, raidRank) {
  const power = positiveRank(powerRank);
  const raid = positiveRank(raidRank);
  if (power == null || raid == null) return null;
  return Number((((power - raid) / power) * 100).toFixed(1));
}

export function calculateRaidEfficiency(members) {
  const normalized = (Array.isArray(members) ? members : []).map((member, sourceIndex) => {
    const hasServerScope = member?.rankScope === "server"
      || member?.serverPowerRank != null
      || member?.serverTobeolRank != null;
    const serverPowerRank = positiveRank(member?.serverPowerRank ?? (hasServerScope ? member?.powerRank : null));
    const serverTobeolRank = positiveRank(member?.serverTobeolRank ?? (hasServerScope ? member?.tobeolRank : null));
    const rankAdvantage = serverPowerRank != null && serverTobeolRank != null
      ? serverPowerRank - serverTobeolRank
      : null;
    const efficiencyIndex = calculateServerRankEfficiency(serverPowerRank, serverTobeolRank);

    return {
      ...member,
      sourceIndex,
      serverPowerRank,
      serverTobeolRank,
      rankAdvantage,
      efficiencyIndex,
      efficiencyGrade: classifyRaidEfficiency(efficiencyIndex),
      efficiencyRank: null
    };
  });

  const ranked = normalized
    .filter((entry) => entry.efficiencyIndex != null)
    .sort((a, b) => b.efficiencyIndex - a.efficiencyIndex
      || b.rankAdvantage - a.rankAdvantage
      || a.serverTobeolRank - b.serverTobeolRank);
  ranked.forEach((entry, index) => { entry.efficiencyRank = index + 1; });

  const counts = { excellent: 0, high: 0, normal: 0, low: 0, "very-low": 0, unknown: 0 };
  for (const entry of normalized) counts[entry.efficiencyGrade.key] += 1;

  const ahead = ranked.filter((entry) => entry.rankAdvantage > 0);
  const equal = ranked.filter((entry) => entry.rankAdvantage === 0);
  const behind = ranked.filter((entry) => entry.rankAdvantage < 0);

  return {
    entries: normalized,
    summary: {
      rosterCount: normalized.length,
      participantCount: ranked.length,
      counts,
      aheadCount: ahead.length,
      equalCount: equal.length,
      behindCount: behind.length,
      averageGainRate: ranked.length
        ? Number((ranked.reduce((sum, entry) => sum + entry.efficiencyIndex, 0) / ranked.length).toFixed(1))
        : null,
      best: ranked[0] || null,
      needsAttention: [...ranked].sort((a, b) => a.efficiencyIndex - b.efficiencyIndex
        || a.rankAdvantage - b.rankAdvantage
        || b.serverTobeolRank - a.serverTobeolRank)[0] || null
    },
    model: {
      sampleSize: ranked.length,
      basis: "server-rank-comparison",
      jobAdjustment: false
    }
  };
}

function positiveRank(value) {
  const rank = Number(value);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}
