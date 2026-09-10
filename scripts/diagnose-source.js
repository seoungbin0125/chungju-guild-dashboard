import {
  getRaidPeriod,
  parseGuildContentHtml,
  parseGuildInfoHtml
} from "./mgf-parser.js";

const guild = String(process.env.GUILD_NAME || "충주시").trim();
const infoUrl = `https://mgf.gg/contents/guild_info.php?g_name=${encodeURIComponent(guild)}`;
const infoHtml = await fetchText(infoUrl);
const info = parseGuildInfoHtml(infoHtml, guild);
const contentEntries = await Promise.all(["league", "training", "boss"].map(async (mode) => {
  const url = `https://mgf.gg/contents/guild.php?mode=${mode}&stx=${encodeURIComponent(guild)}`;
  const html = await fetchText(url);
  const parsed = parseGuildContentHtml(html, { keyword: guild });
  return [mode, {
    url,
    matchCount: parsed.matchCount,
    parsedCards: parsed.guilds.length,
    requestedGuildFound: parsed.guilds.some((item) => item.name === guild),
    scoreAvailable: parsed.scoreAvailable
  }];
}));
const contents = Object.fromEntries(contentEntries);

const diagnostics = {
  checkedAtKst: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19),
  guild,
  guildInfo: {
    url: infoUrl,
    sourceDataDate: info.sourceDataDate,
    server: info.serverName,
    master: info.master,
    memberCount: info.members.length,
    hasDataBpForEveryMember: info.members.every((member) => /^\d+$/.test(member.powerRaw)),
    hasDataGbForEveryMember: info.members.every((member) => /^\d+$/.test(member.tobeolRaw)),
    distinctPowerRaidMembers: info.members.filter((member) => member.powerValue !== member.tobeolValue).length,
    raidPeriod: getRaidPeriod(info.sourceDataDate),
    guildUpgradeFieldFound: /업그레이드|길드\s*건물|guild[_-]?upgrade/i.test(infoHtml)
  },
  contents,
  interpretation: {
    powerAndRaid: "data-bp/data-gb 직접 수집 가능",
    guildUpgradeToday: "공개 길드 상세에서 필드 미발견",
    contentScores: Object.values(contents).some((item) => item.scoreAvailable) ? "점수 필드 발견" : "공개 매칭 카드에서 점수 필드 미발견"
  }
};

console.log(JSON.stringify(diagnostics, null, 2));

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Chungju-Guild-Diagnostics/2.0)" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
