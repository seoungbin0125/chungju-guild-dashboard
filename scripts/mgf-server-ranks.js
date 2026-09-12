import { parseServerRankingHtml } from "./mgf-parser.js";

const DEFAULT_SOURCE_BASE = `https://${["m", "g", "f"].join("")}.gg`;
const USER_AGENT = "Mozilla/5.0 (compatible; Chungju-Guild-Dashboard/2.2)";

export async function fetchServerMemberRanks({
  serverId,
  guild,
  members,
  sourceBase = process.env.SOURCE_BASE || DEFAULT_SOURCE_BASE,
  concurrency = Number(process.env.RANKING_CONCURRENCY || 8),
  logger = console
} = {}) {
  const roster = Array.isArray(members) ? members : [];
  const expectedServerId = String(serverId || "").trim();
  if (!expectedServerId) throw new Error(`${guild || "길드"} 서버 번호가 없어 서버 순위를 수집할 수 없습니다.`);

  const [power, raid] = await Promise.all([
    crawlRanking({
      kind: "power",
      endpoint: "/ranking/index.php",
      valueOf: (member) => member.powerRaw ?? member.powerValue,
      include: () => true,
      sourceBase,
      serverId: expectedServerId,
      guild,
      members: roster,
      concurrency,
      logger
    }),
    crawlRanking({
      kind: "raid",
      endpoint: "/ranking/guild_boss.php",
      valueOf: (member) => member.tobeolRaw ?? member.tobeolValue,
      include: (value) => value > 0n,
      sourceBase,
      serverId: expectedServerId,
      guild,
      members: roster,
      concurrency,
      logger
    })
  ]);

  return {
    serverId: expectedServerId,
    guild,
    powerByNickname: Object.fromEntries(power.matches.map((row) => [row.nickname, row.serverRank])),
    raidByNickname: Object.fromEntries(raid.matches.map((row) => [row.nickname, row.serverRank])),
    diagnostics: {
      scope: `Scania ${expectedServerId}`,
      power: power.diagnostics,
      raid: raid.diagnostics
    }
  };
}

async function crawlRanking({ kind, endpoint, valueOf, include, sourceBase, serverId, guild, members, concurrency, logger }) {
  const targets = members
    .map((member) => ({ member, value: exactInteger(valueOf(member)) }))
    .filter((item) => item.member?.nickname && item.value != null && include(item.value))
    .sort((a, b) => a.value === b.value ? 0 : a.value < b.value ? -1 : 1);

  if (!targets.length) {
    return { matches: [], diagnostics: { available: true, pagesFetched: 0, foundCount: 0, expectedCount: 0, missingNicknames: [] } };
  }

  const discovery = await discoverLastNeededPage({ endpoint, sourceBase, serverId, guild, targets });
  const lastPage = Math.max(1, discovery.page + 1);
  const pages = Array.from({ length: lastPage }, (_, index) => index + 1);
  const htmlByPage = new Map(discovery.html ? [[discovery.page, discovery.html]] : []);
  const pendingPages = pages.filter((page) => !htmlByPage.has(page));
  logger.log?.(`↳ Scania ${serverId} ${kind === "raid" ? "토벌" : "투력"} 서버 순위 ${lastPage}페이지 수집`);

  await mapLimit(pendingPages, Math.max(1, Math.min(12, concurrency || 8)), async (page) => {
    const url = rankingUrl(sourceBase, endpoint, serverId, { page });
    htmlByPage.set(page, (await fetchHtml(url)).html);
  });

  const allRows = pages.flatMap((page) => parseServerRankingHtml(htmlByPage.get(page) || "", { kind }));
  const targetNames = new Set(targets.map((item) => item.member.nickname));
  const matches = allRows.filter((row) => {
    if (!targetNames.has(row.nickname)) return false;
    if (row.serverId && row.serverId !== String(serverId)) return false;
    if (guild && row.guild && normalizeName(row.guild) !== normalizeName(guild)) return false;
    return Number.isInteger(row.serverRank) && row.serverRank > 0;
  });
  const deduped = [...new Map(matches.map((row) => [row.nickname, row])).values()];
  const foundNames = new Set(deduped.map((row) => row.nickname));
  const missingNicknames = targets.map((item) => item.member.nickname).filter((nickname) => !foundNames.has(nickname));

  return {
    matches: deduped,
    diagnostics: {
      available: deduped.length > 0,
      endpoint,
      pagesFetched: pages.length,
      discoveredFrom: discovery.nickname,
      foundCount: deduped.length,
      expectedCount: targets.length,
      missingCount: missingNicknames.length,
      missingNicknames
    }
  };
}

async function discoverLastNeededPage({ endpoint, sourceBase, serverId, guild, targets }) {
  const attempts = targets.slice(0, Math.min(5, targets.length));
  let lastError = null;
  for (const { member } of attempts) {
    try {
      const url = rankingUrl(sourceBase, endpoint, serverId, { stx: member.nickname });
      const response = await fetchHtml(url, { timeoutMs: 90_000, retries: 1 });
      const rows = parseServerRankingHtml(response.html, { kind: endpoint.includes("guild_boss") ? "raid" : "power" });
      const exact = rows.find((row) => row.nickname === member.nickname
        && (!row.serverId || row.serverId === String(serverId))
        && (!row.guild || !guild || normalizeName(row.guild) === normalizeName(guild)));
      const page = Number(new URL(response.url).searchParams.get("page") || 1);
      if (exact && Number.isInteger(page) && page > 0) {
        return { page, html: response.html, nickname: member.nickname };
      }
      lastError = new Error(`${member.nickname} 검색 결과에서 정확한 행을 찾지 못했습니다.`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`서버 순위 마지막 페이지 확인 실패: ${lastError?.message || "검색 결과 없음"}`);
}

async function fetchHtml(url, { timeoutMs = 60_000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { html: await response.text(), url: response.url };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(700 * (attempt + 1));
    }
  }
  throw new Error(`${url} 조회 실패: ${lastError?.message || lastError}`);
}

function rankingUrl(sourceBase, endpoint, serverId, params = {}) {
  const url = new URL(endpoint, sourceBase);
  url.searchParams.set("server", String(serverId));
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.stx) url.searchParams.set("stx", String(params.stx));
  return url.href;
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

function exactInteger(value) {
  const source = String(value ?? "").replace(/,/g, "").trim();
  return /^\d+$/.test(source) ? BigInt(source) : null;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
