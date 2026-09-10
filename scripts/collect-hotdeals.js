import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "hotdeals.json");

const SOURCE_BASE = process.env.HOTDEAL_SOURCE_BASE || "https://arca.live";
const KEYWORD = process.env.HOTDEAL_KEYWORD || "기프트카드";
const LIMIT = Math.max(1, Number(process.env.HOTDEAL_LIMIT || 5));
const FALLBACK_TO_LATEST = process.env.HOTDEAL_FALLBACK_TO_LATEST !== "0";

async function run() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const sourceUrl = hotdealUrl(KEYWORD);
  console.log(`🚀 핫딜 수집 시작: ${sourceUrl}`);

  const html = await fetchHtml(sourceUrl);
  const candidates = parseHotdealList(html, sourceUrl)
    .filter((item) => isGiftCardDeal(item, KEYWORD));

  const active = candidates.filter((item) => item.status === "active");
  const selected = active.length > 0
    ? fillToLimit(active, candidates, LIMIT)
    : (FALLBACK_TO_LATEST ? candidates.slice(0, LIMIT) : []);

  const output = {
    ok: true,
    version: 1,
    source: "arca.live hotdeal",
    sourceUrl,
    keyword: KEYWORD,
    capturedAt: kstDateTimeString(),
    selectionMode: active.length > 0 ? "active-first" : "latest-fallback",
    totalCandidates: candidates.length,
    activeCandidates: active.length,
    items: selected.map((item) => ({
      title: item.title,
      url: item.url,
      status: item.status,
      reason: item.reason,
      relativeTime: item.relativeTime || "",
      dateText: item.dateText || "",
      priceText: item.priceText || "",
      shop: item.shop || "",
      badges: item.badges || []
    }))
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`🎉 핫딜 수집 완료: ${selected.length}개 저장 → ${OUTPUT_PATH}`);
}

function fillToLimit(primary, all, limit) {
  const seen = new Set();
  const result = [];
  for (const item of [...primary, ...all]) {
    const key = item.url || item.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function parseHotdealList(html, sourceUrl) {
  const rows = extractRows(html);
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const href = firstMatch(row, /href=["']([^"']*\/b\/hotdeal\/\d+[^"']*)["']/i);
    if (!href) continue;

    const url = absoluteUrl(href, sourceUrl);
    if (seen.has(url)) continue;

    const title = extractTitle(row);
    if (!title || isNoiseTitle(title)) continue;

    const statusInfo = inferStatus(title, row);
    seen.add(url);
    items.push({
      title,
      url,
      status: statusInfo.status,
      reason: statusInfo.reason,
      relativeTime: extractRelativeTime(row),
      dateText: extractDateText(row),
      priceText: extractPrice(title),
      shop: extractShop(title),
      badges: extractBadges(title, row)
    });
  }

  return items;
}

function extractRows(html) {
  const source = String(html || "");
  const rowMatches = [...source.matchAll(/<[^>]+class=["'][^"']*(?:vrow|list-table|article-list|board-article)[^"']*["'][^>]*>[\s\S]*?(?=<[^>]+class=["'][^"']*(?:vrow|list-table|article-list|board-article)[^"']*["']|<\/tbody>|<\/main>|$)/gi)]
    .map((match) => match[0])
    .filter((row) => /\/b\/hotdeal\/\d+/i.test(row));

  if (rowMatches.length) return rowMatches;

  return [...source.matchAll(/<a\b[^>]+href=["'][^"']*\/b\/hotdeal\/\d+[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)]
    .map((match) => match[0]);
}

function extractTitle(row) {
  const titleCandidate = firstMatch(row, /class=["'][^"']*(?:title|title-text|article-title)[^"']*["'][^>]*>([\s\S]*?)<\//i)
    || firstMatch(row, /<a\b[^>]+href=["'][^"']*\/b\/hotdeal\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
    || "";

  return cleanText(titleCandidate)
    .replace(/^\d+\s*/, "")
    .replace(/\[[^\]]*공지[^\]]*\]/g, "")
    .trim();
}

function inferStatus(title, row) {
  const source = `${title} ${cleanText(row)}`;
  if (/(종료|마감|품절|매진|끝남|끝|취소|가격\s*오류|오류가|판매종료|구매불가|품절임박\s*아님)/i.test(source)) {
    return { status: "expired", reason: "제목이나 목록 문구에 종료/마감/품절 계열 단어가 있어 마감 가능으로 분류했습니다." };
  }

  if (/(진행|재고|할인|특가|쿠폰|카드|상품권|기프트\s*카드|문상|문화상품권|해피머니|컬쳐랜드|구글\s*플레이|네이버페이)/i.test(source)) {
    return { status: "active", reason: "종료 문구가 없고 기프트카드/상품권 할인 키워드가 있어 유효 가능으로 표시합니다." };
  }

  return { status: "unknown", reason: "목록만으로 유효 여부를 확정하기 어려워 최신 후보로 표시합니다." };
}

function isGiftCardDeal(item, keyword) {
  const text = `${item.title} ${(item.badges || []).join(" ")}`;
  if (text.includes(keyword)) return true;
  return /(기프트\s*카드|상품권|문상|문화상품권|해피머니|컬쳐랜드|구글\s*플레이|구글기프트|네이버페이|스마일캐시|틴캐시|도서문화상품권)/i.test(text);
}

function extractPrice(title) {
  const match = String(title || "").match(/(\d{1,3}(?:,\d{3})+\s*원|\d+(?:\.\d+)?\s*만원|\d+(?:\.\d+)?\s*만\s*원|\d+(?:\.\d+)?\s*%)/);
  return match ? cleanText(match[1]) : "";
}

function extractShop(title) {
  const bracket = String(title || "").match(/^\s*\[([^\]]+)\]/);
  if (bracket) return cleanText(bracket[1]);

  const known = ["컬쳐랜드", "해피머니", "구글플레이", "네이버페이", "11번가", "옥션", "G마켓", "티몬", "위메프", "카카오", "쿠팡"];
  return known.find((name) => title.includes(name)) || "";
}

function extractBadges(title, row) {
  const badges = new Set();
  for (const match of String(title || "").matchAll(/\[([^\]]{1,16})\]/g)) badges.add(cleanText(match[1]));
  for (const match of String(row || "").matchAll(/class=["'][^"']*(?:badge|category|label)[^"']*["'][^>]*>([\s\S]*?)<\//gi)) {
    const badge = cleanText(match[1]);
    if (badge && badge.length <= 16) badges.add(badge);
  }
  return [...badges].slice(0, 4);
}

function extractRelativeTime(row) {
  const text = cleanText(row);
  const match = text.match(/(방금|\d+\s*(?:초|분|시간|일)\s*전|어제|오늘)/);
  return match ? cleanText(match[1]) : "";
}

function extractDateText(row) {
  const text = cleanText(row);
  const match = text.match(/(20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}[.\/-]\d{1,2}\s+\d{1,2}:\d{2}|\d{1,2}:\d{2})/);
  return match ? cleanText(match[1]) : "";
}

function isNoiseTitle(title) {
  return /공지|이벤트공지|필독/.test(title) || title.length < 3;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.5",
      "Cache-Control": "no-cache",
      "User-Agent": "Mozilla/5.0 (compatible; Guild-Hotdeal-Collector/1.0; +https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`핫딜 페이지 fetch 실패 ${response.status}: ${url}`);
  }

  return response.text();
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function firstMatch(source, regex) {
  const match = String(source || "").match(regex);
  return match ? match[1] : "";
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
}

function hotdealUrl(keyword) {
  return `${SOURCE_BASE}/b/hotdeal?target=all&keyword=${encodeURIComponent(keyword)}`;
}

function kstDateTimeString() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

run().catch(async (error) => {
  console.error(`⚠️ 핫딜 수집 실패: ${error.message}`);
  await fs.mkdir(DATA_DIR, { recursive: true });

  const fallback = await readExistingOutput();
  fallback.ok = false;
  fallback.error = error.message;
  fallback.lastFailedAt = kstDateTimeString();
  fallback.notice = isBlockedFetchError(error)
    ? "arca.live가 GitHub Actions/서버 요청을 403으로 차단했습니다. 기존 데이터 또는 빈 목록을 유지하고 전체 대시보드 수집은 계속 진행합니다."
    : "핫딜 수집에 실패했습니다. 기존 데이터 또는 빈 목록을 유지하고 전체 대시보드 수집은 계속 진행합니다.";

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.log(`🧯 핫딜 수집 실패를 안전 처리했습니다. 대시보드 자동 수집은 실패 처리하지 않습니다. → ${OUTPUT_PATH}`);

  if (process.env.HOTDEAL_STRICT === "1") {
    process.exitCode = 1;
  }
});

function isBlockedFetchError(error) {
  return /\b403\b|forbidden|access denied|차단/i.test(String(error?.message || error));
}

async function readExistingOutput() {
  try {
    return JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return {
      ok: false,
      version: 1,
      source: "arca.live hotdeal",
      sourceUrl: hotdealUrl(KEYWORD),
      keyword: KEYWORD,
      capturedAt: "",
      selectionMode: "empty",
      totalCandidates: 0,
      activeCandidates: 0,
      items: []
    };
  }
}
