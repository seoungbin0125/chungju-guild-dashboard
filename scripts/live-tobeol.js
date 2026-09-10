import {
  addMemberRankComparison,
  formatKoreanPower,
  getRaidPeriod,
  kstDateString,
  parseGuildInfoHtml,
  parseKoreanPowerValue
} from "./mgf-parser.js";

const ENV = globalThis.process?.env || {};
const SOURCE_BASE = ENV.SOURCE_BASE || `https://${["m", "g", "f"].join("")}.gg`;
const DEFAULT_MEMBER_LIMIT = Number(ENV.MEMBER_LIMIT || 120);

export async function fetchLiveTobeolByGuild({ guildName, serverId = "", memberLimit = DEFAULT_MEMBER_LIMIT } = {}) {
  const guild = String(guildName || "").trim();
  if (!guild) throw new Error("길드명을 입력해주세요.");

  const sourceUrl = guildInfoUrl(guild);
  const html = await fetchHtml(sourceUrl);
  const parsed = parseGuildInfoHtml(html, guild);
  if (!parsed.members.length) throw new Error(`${guild} 길드원 목록을 찾지 못했습니다. MGF 길드명을 확인해주세요.`);
  if (parsed.guildName && normalizeName(parsed.guildName) !== normalizeName(guild)) {
    throw new Error(`요청 길드(${guild})와 응답 길드(${parsed.guildName})가 다릅니다.`);
  }

  const sourceDataDate = parsed.sourceDataDate || kstDateString();
  const raidPeriod = getRaidPeriod(sourceDataDate);
  const members = addMemberRankComparison(parsed.members.slice(0, Number(memberLimit || DEFAULT_MEMBER_LIMIT)).map((member) => ({
    rank: member.rank,
    guild,
    nickname: member.nickname,
    job: member.job,
    level: member.level,
    powerRaw: member.powerRaw,
    powerValue: member.powerValue,
    powerText: member.powerText,
    sourceTobeolRaw: member.tobeolRaw,
    tobeolValue: Number(member.tobeolValue || 0),
    tobeolText: member.tobeolText,
    hit: Number(member.tobeolValue || 0) > 0
  })));
  const hitMembers = members.filter((member) => member.hit);
  const missedMembers = members.filter((member) => !member.hit);
  const totalTobeolValue = members.reduce((sum, member) => sum + Number(member.tobeolValue || 0), 0);
  const pageRaidTotal = parseKoreanPowerValue(parsed.totalTobeolText);

  if (pageRaidTotal != null && Math.abs(pageRaidTotal - totalTobeolValue) >= 10_000) {
    throw new Error("길드원 토벌 합계가 MGF 길드 합계와 달라 결과를 중단했습니다. 페이지 구조 변경 여부를 확인하세요.");
  }

  return {
    ok: true,
    guild,
    source: "MGF guild_info member-row data-gb",
    sourceUrl,
    serverId: parsed.serverId || String(serverId || ""),
    serverName: parsed.serverName || "",
    requestedServerId: String(serverId || ""),
    sourceDataDate,
    capturedAt: kstDateTimeString(),
    raidPeriod,
    summary: {
      memberCount: members.length,
      hitCount: hitMembers.length,
      missedCount: missedMembers.length,
      hitRate: members.length ? Number(((hitMembers.length / members.length) * 100).toFixed(1)) : 0,
      totalTobeolValue,
      totalTobeolText: formatKoreanPower(totalTobeolValue),
      raidRankAheadCount: members.filter((member) => Number(member.raidRankAdvantage) > 0).length,
      raidRankEqualCount: members.filter((member) => Number(member.raidRankAdvantage) === 0 && member.tobeolRank != null).length,
      raidRankBehindCount: members.filter((member) => Number(member.raidRankAdvantage) < 0).length
    },
    validation: {
      parser: "member-row:data-gb",
      pageRaidTotal,
      parsedRaidTotal: totalTobeolValue,
      raidTotalMatches: true,
      rankingPaginationRequests: 0
    },
    members,
    hitMembers: [...hitMembers].sort((a, b) => Number(b.tobeolValue || 0) - Number(a.tobeolValue || 0)),
    missedMembers
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Chungju-Guild-Dashboard/2.1)" }
  });
  if (!response.ok) throw new Error(`MGF 조회 실패 ${response.status}`);
  return response.text();
}

function guildInfoUrl(guild) {
  return `${SOURCE_BASE}/contents/guild_info.php?g_name=${encodeURIComponent(guild)}`;
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("ko-KR");
}

function kstDateTimeString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}
