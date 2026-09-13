const MIN_SLOPE = 0.2;
const MAX_SLOPE = 1.3;
const JOB_SHRINKAGE = 3;

export function classifyRaidEfficiency(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return { key: "unknown", label: "미집계", description: "점수 없음" };
  if (score >= 125) return { key: "excellent", label: "매우 높음", description: "동급 대비 탁월" };
  if (score >= 110) return { key: "high", label: "높음", description: "동급 대비 우수" };
  if (score >= 90) return { key: "normal", label: "적정", description: "기대 범위" };
  if (score >= 75) return { key: "low", label: "낮음", description: "세팅 점검 권장" };
  return { key: "very-low", label: "매우 낮음", description: "우선 점검 필요" };
}

export function calculateRaidEfficiency(members) {
  const normalized = (Array.isArray(members) ? members : []).map((member, sourceIndex) => ({
    ...member,
    sourceIndex,
    efficiencyPower: Number(member?.powerValue || 0),
    efficiencyRaid: Number(member?.sourceTobeolValue ?? member?.tobeolValue ?? 0)
  }));
  const valid = normalized.filter((member) => member.efficiencyPower > 0 && member.efficiencyRaid > 0);

  if (!valid.length) {
    return {
      entries: normalized.map((member) => makeMissingEntry(member)),
      summary: emptySummary(normalized.length),
      jobs: [],
      model: { sampleSize: 0, coefficient: null, exponent: null }
    };
  }

  const logs = valid.map((member) => ({
    member,
    x: Math.log(member.efficiencyPower / 1_000_000_000_000),
    y: Math.log(member.efficiencyRaid / 100_000_000)
  }));
  const meanX = average(logs.map((item) => item.x));
  const meanY = average(logs.map((item) => item.y));
  const varianceX = logs.reduce((sum, item) => sum + ((item.x - meanX) ** 2), 0);
  const covariance = logs.reduce((sum, item) => sum + ((item.x - meanX) * (item.y - meanY)), 0);
  const rawSlope = varianceX > 1e-10 ? covariance / varianceX : 0.6;
  const exponent = clamp(rawSlope, MIN_SLOPE, MAX_SLOPE);
  const intercept = meanY - (exponent * meanX);
  const coefficient = Math.exp(intercept);

  const preliminary = valid.map((member) => {
    const powerJo = member.efficiencyPower / 1_000_000_000_000;
    const actualEok = member.efficiencyRaid / 100_000_000;
    const baseExpectedEok = coefficient * (powerJo ** exponent);
    return { member, actualEok, baseExpectedEok, residual: Math.log(actualEok / baseExpectedEok) };
  });

  const residualsByJob = new Map();
  for (const item of preliminary) {
    const job = String(item.member.job || "기타");
    if (!residualsByJob.has(job)) residualsByJob.set(job, []);
    residualsByJob.get(job).push(item.residual);
  }

  const jobFactors = new Map();
  for (const [job, residuals] of residualsByJob.entries()) {
    const weight = residuals.length / (residuals.length + JOB_SHRINKAGE);
    jobFactors.set(job, Math.exp(average(residuals) * weight));
  }

  const predicted = preliminary.map((item) => {
    const job = String(item.member.job || "기타");
    return {
      ...item,
      expectedEok: item.baseExpectedEok * (jobFactors.get(job) || 1)
    };
  });
  const totalActual = predicted.reduce((sum, item) => sum + item.actualEok, 0);
  const totalExpected = predicted.reduce((sum, item) => sum + item.expectedEok, 0);
  const calibration = totalExpected > 0 ? totalActual / totalExpected : 1;
  const predictedMap = new Map(predicted.map((item) => [item.member.sourceIndex, item]));

  const entries = normalized.map((member) => {
    const item = predictedMap.get(member.sourceIndex);
    if (!item) return makeMissingEntry(member);
    const expectedEok = Math.max(0, item.expectedEok * calibration);
    const expectedValue = Math.round(expectedEok * 100_000_000);
    const efficiencyIndex = expectedEok > 0
      ? Number(((item.actualEok / expectedEok) * 100).toFixed(1))
      : null;
    const grade = classifyRaidEfficiency(efficiencyIndex);
    return {
      ...member,
      expectedTobeolValue: expectedValue,
      efficiencyIndex,
      efficiencyGrade: grade,
      efficiencyRank: null
    };
  });

  const ranked = entries
    .filter((entry) => entry.efficiencyIndex != null)
    .sort((a, b) => b.efficiencyIndex - a.efficiencyIndex || b.efficiencyRaid - a.efficiencyRaid);
  ranked.forEach((entry, index) => { entry.efficiencyRank = index + 1; });

  const counts = { excellent: 0, high: 0, normal: 0, low: 0, "very-low": 0, unknown: 0 };
  for (const entry of entries) counts[entry.efficiencyGrade.key] += 1;

  const jobs = [...new Set(ranked.map((entry) => String(entry.job || "기타")))].map((job) => {
    const jobEntries = ranked.filter((entry) => String(entry.job || "기타") === job);
    const best = jobEntries[0] || null;
    return {
      job,
      count: jobEntries.length,
      averageIndex: Number(average(jobEntries.map((entry) => entry.efficiencyIndex)).toFixed(1)),
      bestNickname: best?.nickname || "-",
      bestIndex: best?.efficiencyIndex ?? null
    };
  }).sort((a, b) => b.averageIndex - a.averageIndex || b.count - a.count);

  return {
    entries,
    summary: {
      rosterCount: normalized.length,
      participantCount: ranked.length,
      counts,
      best: ranked[0] || null,
      needsAttention: [...ranked].sort((a, b) => a.efficiencyIndex - b.efficiencyIndex)[0] || null
    },
    jobs,
    model: {
      sampleSize: ranked.length,
      coefficient: Number(coefficient.toFixed(4)),
      exponent: Number(exponent.toFixed(4))
    }
  };
}

function makeMissingEntry(member) {
  return {
    ...member,
    expectedTobeolValue: null,
    efficiencyIndex: null,
    efficiencyGrade: classifyRaidEfficiency(null),
    efficiencyRank: null
  };
}

function emptySummary(rosterCount) {
  return {
    rosterCount,
    participantCount: 0,
    counts: { excellent: 0, high: 0, normal: 0, low: 0, "very-low": 0, unknown: rosterCount },
    best: null,
    needsAttention: null
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
