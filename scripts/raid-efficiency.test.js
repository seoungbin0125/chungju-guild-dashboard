import test from "node:test";
import assert from "node:assert/strict";
import { calculateRaidEfficiency, calculateServerRankEfficiency, classifyRaidEfficiency } from "../src/raid-efficiency.js";
import { formatGuildWarScore, mergeGuildWarManualData, normalizeGuildWarScoreInput } from "../src/guild-war-manual.js";

test("효율 등급 경계값을 정확히 분류한다", () => {
  assert.equal(classifyRaidEfficiency(50).label, "매우 높음");
  assert.equal(classifyRaidEfficiency(25).label, "높음");
  assert.equal(classifyRaidEfficiency(-10).label, "적정");
  assert.equal(classifyRaidEfficiency(-30).label, "낮음");
  assert.equal(classifyRaidEfficiency(-30.1).label, "매우 낮음");
});

test("서버 투력 순위 대비 서버 토벌 순위 향상률을 계산한다", () => {
  assert.equal(calculateServerRankEfficiency(400, 100), 75);
  assert.equal(calculateServerRankEfficiency(100, 100), 0);
  assert.equal(calculateServerRankEfficiency(100, 125), -25);
  assert.equal(calculateServerRankEfficiency(null, 10), null);
});

test("직업과 실제 점수에 관계없이 서버 순위만으로 효율을 계산한다", () => {
  const members = [
    { nickname: "A", job: "캡틴", powerValue: 100, tobeolValue: 500, rankScope: "server", serverPowerRank: 400, serverTobeolRank: 100 },
    { nickname: "B", job: "비숍", powerValue: 999999, tobeolValue: 1, rankScope: "server", serverPowerRank: 100, serverTobeolRank: 125 },
    { nickname: "C", job: "비숍", powerValue: 500, tobeolValue: 500, rankScope: "server", serverPowerRank: 200, serverTobeolRank: 200 },
    { nickname: "D", job: "캡틴", powerValue: 1, tobeolValue: 999999, rankScope: "server", serverPowerRank: 800, serverTobeolRank: null }
  ];
  const result = calculateRaidEfficiency(members);
  assert.equal(result.summary.participantCount, 3);
  assert.equal(result.entries.find((item) => item.nickname === "A").efficiencyIndex, 75);
  assert.equal(result.entries.find((item) => item.nickname === "B").efficiencyIndex, -25);
  assert.equal(result.entries.find((item) => item.nickname === "D").efficiencyGrade.label, "미집계");
  assert.equal(result.model.jobAdjustment, false);
  assert.equal(Object.values(result.summary.counts).reduce((sum, count) => sum + count, 0), 4);
});

test("웹 입력 점수를 주차별로 합쳐 순위와 전주 대비를 계산한다", () => {
  const result = mergeGuildWarManualData({
    baseData: { guild: "충주시", currentWeekKey: "2026-09-10", previousWeekKey: "2026-09-03", members: [] },
    rosterMembers: [{ nickname: "가", guild: "충주시" }, { nickname: "나", guild: "충주시" }],
    currentManual: { date: "2026-09-10", items: [{ nickname: "가", scoreRaw: "200000000000" }, { nickname: "나", scoreRaw: "100000000000" }] },
    previousManual: { date: "2026-09-03", items: [{ nickname: "가", scoreRaw: "100000000000" }, { nickname: "나", scoreRaw: "100000000000" }] }
  });
  assert.equal(result.members.find((item) => item.nickname === "가").growthRate, 100);
  assert.equal(result.members.find((item) => item.nickname === "가").currentRank, 1);
  assert.equal(result.summary.comparedCount, 2);
});

test("점수 입력은 쉼표와 한국식 단위를 모두 허용한다", () => {
  assert.equal(normalizeGuildWarScoreInput("123,456,789"), "123456789");
  assert.equal(normalizeGuildWarScoreInput("1조 2345억 6789만"), "1234567890000");
  assert.equal(formatGuildWarScore("1234567890000"), "1조 2345억 6789만");
});
