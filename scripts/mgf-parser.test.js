import test from "node:test";
import assert from "node:assert/strict";
import {
  addMemberRankComparison,
  findPowerComparisonSnapshot,
  findRaidSnapshot,
  getRaidPeriod,
  parseGuildContentHtml,
  parseGuildInfoHtml,
  parseServerRankingHtml
} from "./mgf-parser.js";

test("길드 내 전투력 순위와 토벌 순위를 비교하고 0점은 미참여로 둔다", () => {
  const members = addMemberRankComparison([
    { guild: "충주시", nickname: "투력왕", powerRaw: "900719925474099312", tobeolRaw: "100" },
    { guild: "충주시", nickname: "토벌왕", powerRaw: "900719925474099311", tobeolRaw: "300" },
    { guild: "충주시", nickname: "공동2위", powerRaw: "10", tobeolRaw: "100" },
    { guild: "충주시", nickname: "미참여", powerRaw: "9", tobeolRaw: "0" }
  ]);

  assert.deepEqual(
    members.map(({ nickname, powerRank, tobeolRank, raidRankAdvantage }) => ({ nickname, powerRank, tobeolRank, raidRankAdvantage })),
    [
      { nickname: "투력왕", powerRank: 1, tobeolRank: 2, raidRankAdvantage: -1 },
      { nickname: "토벌왕", powerRank: 2, tobeolRank: 1, raidRankAdvantage: 1 },
      { nickname: "공동2위", powerRank: 3, tobeolRank: 2, raidRankAdvantage: 1 },
      { nickname: "미참여", powerRank: 4, tobeolRank: null, raidRankAdvantage: null }
    ]
  );
});

test("길드원 행에서 전투력(data-bp)과 토벌(data-gb)을 각각 정확히 읽는다", () => {
  const html = `
    <span class="guild-name">충주시</span><span class="server-chip">Scania 4</span>
    <div class="stat-pill"><span class="stat-pill-label">레벨</span><span class="stat-pill-value">Lv.9</span></div>
    <div class="stat-pill"><span class="stat-pill-label">길드원</span><span class="stat-pill-value">1명</span></div>
    <div class="stat-pill metric-gb"><span class="stat-pill-label">토벌전</span><span class="power-tooltip">548,744,911,285</span></div>
    <div class="guild-update-row">📅 2026.09.09 기준 데이터</div>
    <a class="master-nick">꿀꿀왕자</a>
    <div class="member-row g-a" data-bp="7439718039708489" data-gb="548744911285">
      <span class="member-rank">1</span>
      <a class="nick-link" title="그만해주세요">그만해주세요</a>
      <div class="member-sub"><img alt="나이트로드"> 나이트로드 <span>|</span> Lv.114</div>
    </div>`;
  const parsed = parseGuildInfoHtml(html, "충주시");
  assert.equal(parsed.guildName, "충주시");
  assert.equal(parsed.serverId, "4");
  assert.equal(parsed.sourceDataDate, "2026-09-09");
  assert.equal(parsed.members.length, 1);
  assert.equal(parsed.members[0].powerValue, 7_439_718_039_708_489);
  assert.equal(parsed.members[0].tobeolValue, 548_744_911_285);
  assert.notEqual(parsed.members[0].powerValue, parsed.members[0].tobeolValue);
});

test("현재 MGF 길드 콘텐츠 카드 구조를 파싱하고 검색 길드를 첫 카드로 정렬한다", () => {
  const card = (name, master, server, power) => `
    <div class="guild-card">
      <a class="g-name-link">${name}</a>
      <p>Master. <strong><a class="char-link">${master}</a></strong></p>
      <span class="server-name">${server}</span><p class="g-power">${power}</p>
      <li><span class="m-rank">1</span><span class="m-name"><a class="char-link">대표${name}</a></span><span class="m-power">1조 2억</span></li>
    </div>`;
  const html = `<div>현재 그룹 <span>총 2개 길드가 매칭되었습니다.</span></div>${card("다른길드", "다른마스터", "Scania 1", "2경")}${card("충주시", "꿀꿀왕자", "Scania 4", "3경")}`;
  const parsed = parseGuildContentHtml(html, { keyword: "충주시" });
  assert.equal(parsed.matchCount, 2);
  assert.equal(parsed.guilds.length, 2);
  assert.equal(parsed.guilds[0].name, "충주시");
  assert.equal(parsed.guilds[0].master, "꿀꿀왕자");
  assert.equal(parsed.guilds[0].members[0].nickname, "대표충주시");
  assert.equal(parsed.scoreAvailable, false);
});

test("월요일 점수는 지난주 확정, 화~일 점수는 이번주 진행으로 분류한다", () => {
  const monday = getRaidPeriod("2026-09-07");
  const wednesday = getRaidPeriod("2026-09-09");
  assert.equal(monday.kind, "previous_week_final");
  assert.equal(monday.scoreWeekKey, "2026-08-31");
  assert.equal(monday.isFinal, true);
  assert.equal(wednesday.kind, "current_week_live");
  assert.equal(wednesday.scoreWeekKey, "2026-09-07");
  assert.equal(wednesday.isFinal, false);
});

test("토벌 이력은 날짜 뺄셈이 아니라 주차 키와 확정 여부로 선택한다", () => {
  const history = [
    { guild: "충주시", sourceDataDate: "2026-09-06", raidPeriod: { scoreWeekKey: "2026-08-31", isFinal: false } },
    { guild: "충주시", sourceDataDate: "2026-09-07", raidPeriod: { scoreWeekKey: "2026-08-31", isFinal: true } },
    { guild: "충주시", sourceDataDate: "2026-09-08", raidPeriod: { scoreWeekKey: "2026-09-07", isFinal: false } }
  ];
  assert.equal(findRaidSnapshot(history, "충주시", "2026-08-31")?.sourceDataDate, "2026-09-07");
});

test("전투력 7일 비교는 누락일이 있어도 목표일 근처 2일 이내를 사용한다", () => {
  const history = [
    { guild: "충주시", sourceDataDate: "2026-09-01", members: [] },
    { guild: "충주시", sourceDataDate: "2026-08-27", members: [] }
  ];
  assert.equal(findPowerComparisonSnapshot(history, "충주시", "2026-09-02")?.sourceDataDate, "2026-09-01");
});

test("랭킹 행에서 전체 표시 순위와 Scania 서버 내 순위를 구분한다", () => {
  const html = `
    <table><tr><td><span class="rank-total">3366</span><span class="rank-world" title="4 서버 내 토벌전 순위">S71</span></td>
      <td><span class="nickname">그만해주세요</span><a class="badge-guild">충주시</a></td>
      <td><span class="server-badge">Scania 4</span></td><td><span class="score-tooltip">5885억 8989만</span></td></tr></table>`;
  const [row] = parseServerRankingHtml(html, { kind: "raid" });
  assert.equal(row.displayedRank, 3366);
  assert.equal(row.serverRank, 71);
  assert.equal(row.serverId, "4");
  assert.equal(row.nickname, "그만해주세요");
  assert.equal(row.guild, "충주시");
});
