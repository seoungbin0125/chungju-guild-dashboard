import test from "node:test";
import assert from "node:assert/strict";
import { calculateRaidEfficiency, classifyRaidEfficiency } from "../src/raid-efficiency.js";
import { formatGuildWarScore, mergeGuildWarManualData, normalizeGuildWarScoreInput } from "../src/guild-war-manual.js";

test("효율 등급 경계값을 정확히 분류한다", () => {
  assert.equal(classifyRaidEfficiency(125).label, "매우 높음");
  assert.equal(classifyRaidEfficiency(110).label, "높음");
  assert.equal(classifyRaidEfficiency(90).label, "적정");
  assert.equal(classifyRaidEfficiency(75).label, "낮음");
  assert.equal(classifyRaidEfficiency(74.9).label, "매우 낮음");
});

test("전투력과 토벌 점수로 모든 참여자의 기대점수와 효율을 계산한다", () => {
  const members = [
    { nickname: "A", job: "캡틴", powerValue: 100e12, tobeolValue: 500e8 },
    { nickname: "B", job: "캡틴", powerValue: 200e12, tobeolValue: 900e8 },
    { nickname: "C", job: "비숍", powerValue: 400e12, tobeolValue: 1200e8 },
    { nickname: "D", job: "비숍", powerValue: 800e12, tobeolValue: 2100e8 }
  ];
  const result = calculateRaidEfficiency(members);
  assert.equal(result.summary.participantCount, 4);
  assert.equal(result.entries.every((item) => Number.isFinite(item.expectedTobeolValue)), true);
  assert.equal(result.entries.every((item) => Number.isFinite(item.efficiencyIndex)), true);
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
