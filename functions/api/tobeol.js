import { fetchLiveTobeolByGuild } from "../../scripts/live-tobeol.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const guild = (url.searchParams.get("guild") || "충주시").trim();
  const server = (url.searchParams.get("server") || "").trim();

  try {
    const result = await fetchLiveTobeolByGuild({
      guildName: guild,
      serverId: server
    });

    return json(result, 200);
  } catch (error) {
    return json({
      ok: false,
      message: error?.message || "실시간 토벌전 조회에 실패했습니다."
    }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(value, status) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
