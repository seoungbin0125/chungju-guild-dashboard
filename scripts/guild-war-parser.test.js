import test from "node:test";
import assert from "node:assert/strict";
import { buildGuildWarData, getGuildWarWeekKey, parseMsidleGuildWarHtml } from "./guild-war-parser.js";

test("msidle 공개 JSON에서 개인 대항전 점수와 제출 시각을 읽는다", () => {
  const payload = {
    component: "Guilds/Show",
    props: {
      active_tab: "guild-war",
      guild: { name: "충주시", server: { name: "Scania 4" }, world: { name: "Scania" }, stats: { members: 2 } },
      members: [
        { name: "꿀꿀왕자", best_guild_war_damage: "108779082397", previous_damage: "90000000000", previous_damage_at: "2026-09-04T03:00:00+00:00", data_updated_at: "2026-09-10T03:31:51+00:00" },
        { name: "미수집", best_guild_war_damage: null, previous_damage: null, previous_damage_at: null, data_updated_at: null }
      ]
    }
  };
  const html = `<script data-page="app" type="application/json">${JSON.stringify(payload)}</script>`;
  const parsed = parseMsidleGuildWarHtml(html, { expectedGuild: "충주시", expectedServer: "Scania 4" });
  assert.equal(parsed.members[0].scoreRaw, "108779082397");
  assert.equal(parsed.members[1].scoreRaw, null);
});

test("대항전 주차 키는 가장 최근 목요일이고 월요일도 같은 라운드로 묶는다", () => {
  assert.equal(getGuildWarWeekKey("2026-09-10 12:00:00"), "2026-09-10");
  assert.equal(getGuildWarWeekKey("2026-09-14 21:00:00"), "2026-09-10");
  assert.equal(getGuildWarWeekKey("2026-09-16 23:59:59"), "2026-09-10");
  assert.equal(getGuildWarWeekKey("2026-09-17 00:01:00"), "2026-09-17");
});

test("지난주 저장값과 이번 주 점수를 비교하고 미수집은 0점으로 만들지 않는다", () => {
  const parsed = {
    guild: "충주시",
    server: "Scania 4",
    members: [
      { nickname: "상승", scoreRaw: "150", updatedAt: "2026-09-10T03:00:00+00:00", previousScoreRaw: null, previousScoreAt: null },
      { nickname: "미수집", scoreRaw: null, updatedAt: null, previousScoreRaw: null, previousScoreAt: null }
    ]
  };
  const history = [{ guild: "충주시", server: "Scania 4", weekKey: "2026-09-03", capturedAt: "2026-09-09 10:00:00", members: [{ nickname: "상승", scoreRaw: "100", updatedAt: "2026-09-08T00:00:00+00:00" }] }];
  const { data } = buildGuildWarData({ parsed, history, roster: [{ nickname: "상승" }, { nickname: "미수집" }], capturedAt: "2026-09-11 12:00:00" });
  const rising = data.members.find((member) => member.nickname === "상승");
  const missing = data.members.find((member) => member.nickname === "미수집");
  assert.equal(rising.growthRaw, "50");
  assert.equal(rising.growthRate, 50);
  assert.equal(missing.currentScoreRaw, null);
  assert.equal(missing.status, "not_collected");
});
