import { FIREBASE_COLLECTION, FIREBASE_CONFIG, FIREBASE_GAME_COLLECTION, FIREBASE_LOBBY_COLLECTION, FIREBASE_MANUAL_COLLECTION } from "./firebase-config.js";
import { createGuideBoardClient, createJellyGameClient, createManualOverrideClient, createVirtualLobbyClient, isFirebaseConfigured } from "./firebase-board.js";

const APP_VERSION = "v2.2.0";
const LIVE_TOBEOL_API_ORIGIN = "https://chungju-guild-dashboard.pages.dev";
const EDIT_PASSWORD = "5645";
const LOCAL_MANUAL_KEY = "chungju-guild-dashboard.manual.v1";
const LOCAL_POSTS_KEY = "chungju-guild-dashboard.guide-posts.v1";
const LOCAL_VIRTUAL_KEY = "chungju-guild-dashboard.virtual-user.v1";
const LOCAL_CHAT_KEY = "chungju-guild-dashboard.virtual-chat.v1";
const LOCAL_GAME_KEY = "chungju-guild-dashboard.jelly-user.v1";
const LOCAL_GAME_EVENTS_KEY = "chungju-guild-dashboard.jelly-events.v1";
const VIRTUAL_JAIL_MS = 5000;
const VIRTUAL_ATTACK_COOLDOWN_MS = 1200;
const VIRTUAL_ATTACK_RANGE = 16;
const VIRTUAL_WORLD_MIN_X = 3;
const VIRTUAL_WORLD_MAX_X = 97;
const VIRTUAL_WORLD_MIN_Y = 42;
const VIRTUAL_WORLD_MAX_Y = 86;
const VIRTUAL_JAIL_POSITION = { x: 91, y: 75 };
const VIRTUAL_SKILLS = {
  slash: { label: "공격", cooldown: 1200, range: 16, damageRate: 0.16, message: "기본 공격!" },
  dash: { label: "돌진", cooldown: 4200, range: 28, damageRate: 0.24, dash: true, message: "돌진 베기!" },
  heal: { label: "회복", cooldown: 9000, healRate: 0.24, message: "회복 스킬 사용!" },
  shield: { label: "실드", cooldown: 11000, shieldMs: 5500, message: "방어막 생성!" }
};

const state = {
  rawData: null,
  data: null,
  manualFromFile: null,
  localManual: null,
  serverManual: null,
  manualClient: null,
  manualLoaded: false,
  postsFromFile: null,
  localPosts: null,
  posts: [],
  firebasePosts: [],
  firebaseBoard: null,
  boardMode: isFirebaseConfigured(FIREBASE_CONFIG) ? "firebase" : "local",
  boardLoaded: false,
  page: "dashboard",
  tab: "power",
  guildFilter: "all",
  keyword: "",
  sort: "powerGrowth",
  featuredStartIndex: 0,
  visualGuildFilter: "all",
  visualKeyword: "",
  visualSort: "powerGrowth",
  virtualSelectedKey: "",
  virtualJoined: false,
  virtualClient: null,
  virtualParticipants: [],
  virtualMessages: [],
  virtualPosition: { x: 50, y: 54 },
  virtualStatus: "",
  virtualLoopTimer: null,
  virtualLastSyncAt: 0,
  virtualAttackCooldownUntil: 0,
  virtualSkillCooldowns: {},
  virtualActionMessage: "",
  virtualLastAttackedAt: "",
  virtualUserId: getOrCreateVirtualUserId(),
  gameSelectedKey: "",
  gameTeam: "solo",
  gameJoined: false,
  gameClient: null,
  gamePlayers: [],
  gameEvents: [],
  gameFood: [],
  gameBots: [],
  gamePosition: { x: 50, y: 52 },
  gameTarget: null,
  gameMass: 22,
  gameScore: 0,
  gameStatus: "",
  gameLastSyncAt: 0,
  gameLoopTimer: null,
  gameSafeUntil: 0,
  gameLastEatenAt: "",
  gameUserId: getOrCreateGameUserId(),
  guildContents: null,
  guildWar: null,
  hotdeals: null,
  contentsGuild: "충주시",
  liveTobeolGuild: "충주시",
  liveTobeolServer: "4",
  liveTobeolLoading: false,
  liveTobeolData: null,
  liveTobeolError: "",
  rankCompareSort: "tobeol",
  liveRankSort: "tobeol",
  contentsMode: "league",
  editorUnlocked: true
};

const refs = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  bannerSourceDate: document.getElementById("banner-source-date"),
  summaryGrid: document.getElementById("summary-grid"),
  sourceHealth: document.getElementById("source-health"),
  raidPeriodChip: document.getElementById("raid-period-chip"),
  weeklyRaidList: document.getElementById("weekly-raid-list"),
  rankCompareSummary: document.getElementById("rank-compare-summary"),
  rankCompareList: document.getElementById("rank-compare-list"),
  rankCompareSort: document.getElementById("rank-compare-sort"),
  mainTabs: document.querySelectorAll(".main-tab"),
  pages: document.querySelectorAll(".content-page"),
  tabs: document.querySelectorAll(".tab"),
  guildFilter: document.getElementById("guild-filter"),
  keyword: document.getElementById("keyword"),
  sort: document.getElementById("sort"),
  featuredMemberList: document.getElementById("featured-member-list"),
  featuredPrev: document.getElementById("featured-prev"),
  featuredNext: document.getElementById("featured-next"),
  panelTitle: document.getElementById("panel-title"),
  panelDesc: document.getElementById("panel-desc"),
  tableHead: document.getElementById("table-head"),
  tableBody: document.getElementById("table-body"),
  mobileCardList: document.getElementById("mobile-card-list"),
  visualStats: document.getElementById("visual-stats"),
  visualGuildFilter: document.getElementById("visual-guild-filter"),
  visualKeyword: document.getElementById("visual-keyword"),
  visualSort: document.getElementById("visual-sort"),
  visualOverview: document.getElementById("visual-overview"),
  characterGrid: document.getElementById("character-grid"),
  virtualStatus: document.getElementById("virtual-status"),
  virtualCharacterSelect: document.getElementById("virtual-character-select"),
  virtualJoin: document.getElementById("virtual-join"),
  virtualLeave: document.getElementById("virtual-leave"),
  virtualRandom: document.getElementById("virtual-random"),
  virtualStage: document.getElementById("virtual-stage"),
  virtualAvatars: document.getElementById("virtual-avatars"),
  virtualHint: document.getElementById("virtual-hint"),
  virtualOnlineCount: document.getElementById("virtual-online-count"),
  virtualSelectedName: document.getElementById("virtual-selected-name"),
  virtualPower: document.getElementById("virtual-power"),
  virtualHp: document.getElementById("virtual-hp"),
  virtualState: document.getElementById("virtual-state"),
  virtualTobeol: document.getElementById("virtual-tobeol"),
  virtualAttack: document.getElementById("virtual-attack"),
  virtualSkillButtons: document.querySelectorAll("[data-virtual-skill]"),
  virtualChatList: document.getElementById("virtual-chat-list"),
  virtualChatInput: document.getElementById("virtual-chat-input"),
  virtualChatSend: document.getElementById("virtual-chat-send"),
  virtualNudgeButtons: document.querySelectorAll("[data-virtual-move]"),
  gameStatus: document.getElementById("game-status"),
  gameCharacterSelect: document.getElementById("game-character-select"),
  gameTeamSelect: document.getElementById("game-team-select"),
  gameStart: document.getElementById("game-start"),
  gameLeave: document.getElementById("game-leave"),
  gameReset: document.getElementById("game-reset"),
  gameArena: document.getElementById("game-arena"),
  gameFoodLayer: document.getElementById("game-food-layer"),
  gamePlayerLayer: document.getElementById("game-player-layer"),
  gameTarget: document.getElementById("game-target"),
  gameHint: document.getElementById("game-hint"),
  gameAliveCount: document.getElementById("game-alive-count"),
  gameScoreboard: document.getElementById("game-scoreboard"),
  gameEventLog: document.getElementById("game-event-log"),
  gameSelectedName: document.getElementById("game-selected-name"),
  gameMass: document.getElementById("game-mass"),
  gameScore: document.getElementById("game-score"),
  gameNudgeButtons: document.querySelectorAll("[data-game-move]"),
  contentsTabs: document.querySelectorAll(".contents-tab"),
  contentsGuildSelect: document.getElementById("contents-guild-select"),
  contentsSourceLink: document.getElementById("contents-source-link"),
  contentsSummary: document.getElementById("contents-summary"),
  guildWarPanel: document.getElementById("guild-war-member-panel"),
  guildWarSummary: document.getElementById("guild-war-summary"),
  guildWarList: document.getElementById("guild-war-list"),
  guildWarNotice: document.getElementById("guild-war-notice"),
  guildWarSourceLink: document.getElementById("guild-war-source-link"),
  contentsMatchHeading: document.getElementById("contents-match-heading"),
  contentsGrid: document.getElementById("contents-grid"),
  liveTobeolGuild: document.getElementById("live-tobeol-guild"),
  liveTobeolServer: document.getElementById("live-tobeol-server"),
  liveTobeolSearch: document.getElementById("live-tobeol-search"),
  liveTobeolSummary: document.getElementById("live-tobeol-summary"),
  liveTobeolMissList: document.getElementById("live-tobeol-miss-list"),
  liveTobeolHitList: document.getElementById("live-tobeol-hit-list"),
  liveRankSort: document.getElementById("live-rank-sort"),
  liveTobeolSourceLink: document.getElementById("live-tobeol-source-link"),
  hotdealSummary: document.getElementById("hotdeal-summary"),
  hotdealGrid: document.getElementById("hotdeal-grid"),
  hotdealSourceLink: document.getElementById("hotdeal-source-link"),
  footerText: document.getElementById("footer-text"),
  editDialog: document.getElementById("edit-dialog"),
  openEditor: document.getElementById("open-editor"),
  filterDialog: document.getElementById("filter-dialog"),
  openFilter: document.getElementById("open-filter"),
  closeFilter: document.getElementById("close-filter"),
  openEditorGuide: document.getElementById("open-editor-guide"),
  openActionsRefresh: document.getElementById("open-actions-refresh"),
  closeEditor: document.getElementById("close-editor"),
  passwordView: document.getElementById("password-view"),
  editorView: document.getElementById("editor-view"),
  editorPassword: document.getElementById("editor-password"),
  unlockEditor: document.getElementById("unlock-editor"),
  passwordMessage: document.getElementById("password-message"),
  editorBody: document.getElementById("editor-body"),
  applyManual: document.getElementById("apply-manual"),
  downloadManual: document.getElementById("download-manual"),
  clearManual: document.getElementById("clear-manual"),
  editorMessage: document.getElementById("editor-message"),
  openPostEditor: document.getElementById("open-post-editor"),
  postDialog: document.getElementById("post-dialog"),
  closePostEditor: document.getElementById("close-post-editor"),
  postPassword: document.getElementById("post-password"),
  postAuthor: document.getElementById("post-author"),
  postCategory: document.getElementById("post-category"),
  postTitle: document.getElementById("post-title"),
  postContent: document.getElementById("post-content"),
  savePost: document.getElementById("save-post"),
  resetPostForm: document.getElementById("reset-post-form"),
  postMessage: document.getElementById("post-message"),
  postList: document.getElementById("post-list"),
  downloadPosts: document.getElementById("download-posts"),
  importPosts: document.getElementById("import-posts"),
  clearLocalPosts: document.getElementById("clear-local-posts"),
  boardStatus: document.getElementById("board-status"),
  firebaseSetupNotice: document.getElementById("firebase-setup-notice")
};

init();

async function init() {
  bindEvents();

  try {
    const [latest, manual, posts, guildContents, guildWar, hotdeals] = await Promise.all([
      fetchJson("data/latest.json", true),
      fetchJson("data/manual.json", false),
      fetchJson("data/guide-posts.json", false),
      fetchJson("data/guild-contents.json", false),
      fetchJson("data/guild-war.json", false),
      fetchJson("data/hotdeals.json", false)
    ]);

    state.rawData = latest;
    state.manualFromFile = manual;
    state.localManual = readLocalManual();
    state.postsFromFile = normalizePosts(posts);
    state.localPosts = readLocalPosts();
    state.guildContents = normalizeGuildContents(guildContents);
    state.guildWar = normalizeGuildWar(guildWar);
    state.hotdeals = normalizeHotdeals(hotdeals);
    initFirebaseBoard();
    initManualClient();
    rebuildPosts();
    rebuildData();
    initGuildFilter();
    initVisualFilters();
    initVirtualPicker();
    initContentsFilters();
    initVirtualLobbyClient();
    renderPage();
  } catch (error) {
    if (refs.tableBody) {
      refs.tableBody.innerHTML = `<tr><td colspan="99" class="empty">${escapeHtml(error.message)}</td></tr>`;
    }
    refs.footerText.textContent = `${APP_VERSION} · data/latest.json 파일을 확인해주세요.`;
  }
}

async function fetchJson(path, required) {
  const response = await fetch(`${path}?ts=${Date.now()}`);
  if (!response.ok) {
    if (!required && response.status === 404) return null;
    throw new Error(`${path} 로딩 실패: ${response.status}`);
  }
  return response.json();
}

function bindEvents() {
  refs.mainTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.page = tab.dataset.page;
      refs.mainTabs.forEach((item) => item.classList.toggle("active", item.dataset.page === state.page));
      renderPage();
    });
  });

  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      refs.tabs.forEach((item) => item.classList.toggle("active", item === tab));
      syncSortByTab();
      render();
    });
  });


  refs.openFilter?.addEventListener("click", () => {
    if (refs.filterDialog?.showModal) refs.filterDialog.showModal();
  });

  refs.closeFilter?.addEventListener("click", () => {
    refs.filterDialog?.close();
  });

  refs.guildFilter?.addEventListener("change", (event) => {
    state.guildFilter = event.target.value;
    state.featuredStartIndex = 0;
    render();
  });

  refs.keyword?.addEventListener("input", (event) => {
    state.keyword = event.target.value.trim();
    state.featuredStartIndex = 0;
    render();
  });

  refs.sort?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.featuredStartIndex = 0;
    render();
  });

  refs.featuredPrev?.addEventListener("click", () => {
    moveFeaturedWindow(-5);
  });

  refs.featuredNext?.addEventListener("click", () => {
    moveFeaturedWindow(5);
  });

  refs.visualGuildFilter?.addEventListener("change", (event) => {
    state.visualGuildFilter = event.target.value;
    renderCharactersPage();
  });

  refs.visualKeyword?.addEventListener("input", (event) => {
    state.visualKeyword = event.target.value.trim();
    renderCharactersPage();
  });

  refs.visualSort?.addEventListener("change", (event) => {
    state.visualSort = event.target.value;
    renderCharactersPage();
  });

  refs.liveTobeolSearch?.addEventListener("click", searchLiveTobeol);
  refs.rankCompareSort?.addEventListener("change", (event) => {
    state.rankCompareSort = event.target.value || "tobeol";
    renderRankComparison();
  });
  refs.liveRankSort?.addEventListener("change", (event) => {
    state.liveRankSort = event.target.value || "tobeol";
    renderLiveTobeolResults();
  });
  refs.liveTobeolGuild?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLiveTobeol();
    }
  });
  refs.liveTobeolServer?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLiveTobeol();
    }
  });

  refs.contentsTabs?.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.contentsMode = tab.dataset.contentMode || "league";
      refs.contentsTabs.forEach((item) => item.classList.toggle("active", item === tab));
      renderGuildContentsPage();
    });
  });

  refs.contentsGuildSelect?.addEventListener("change", (event) => {
    state.contentsGuild = event.target.value || "충주시";
    renderGuildContentsPage();
  });

  refs.virtualCharacterSelect?.addEventListener("change", (event) => {
    state.virtualSelectedKey = event.target.value;
    if (state.virtualJoined) joinVirtualLobby(true);
    renderVirtualPage();
  });

  refs.virtualJoin?.addEventListener("click", () => joinVirtualLobby(false));
  refs.virtualSkillButtons?.forEach((button) => {
    button.addEventListener("click", () => useVirtualSkill(button.dataset.virtualSkill || "slash"));
  });
  refs.virtualLeave?.addEventListener("click", leaveVirtualLobby);
  refs.virtualRandom?.addEventListener("click", moveVirtualRandom);
  refs.virtualStage?.addEventListener("click", handleVirtualStageClick);
  refs.virtualChatSend?.addEventListener("click", sendVirtualChat);
  refs.virtualChatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendVirtualChat();
    }
  });
  refs.virtualNudgeButtons?.forEach((button) => {
    button.addEventListener("click", () => nudgeVirtualAvatar(button.dataset.virtualMove));
  });
  refs.gameCharacterSelect?.addEventListener("change", (event) => {
    state.gameSelectedKey = event.target.value;
    if (state.gameJoined) startJellyGame(true);
    renderGamePage();
  });
  refs.gameTeamSelect?.addEventListener("change", (event) => {
    state.gameTeam = event.target.value;
    if (state.gameJoined) syncGamePlayer(true);
    renderGamePage();
  });
  refs.gameStart?.addEventListener("click", () => startJellyGame(false));
  refs.gameLeave?.addEventListener("click", leaveJellyGame);
  refs.gameReset?.addEventListener("click", resetJellySelf);
  refs.gameArena?.addEventListener("pointerdown", handleGameArenaPointer);
  refs.gameNudgeButtons?.forEach((button) => {
    button.addEventListener("click", () => nudgeJellyPlayer(button.dataset.gameMove));
  });
  document.addEventListener("keydown", handleVirtualKeydown);
  document.addEventListener("keydown", handleGameKeydown);
  const cleanupPresence = () => {
    cleanupVirtualPresence();
    if (state.gameJoined && state.gameClient?.enabled) state.gameClient.leave(state.gameUserId).catch?.(() => {});
  };
  window.addEventListener("pagehide", cleanupPresence);
  window.addEventListener("beforeunload", cleanupPresence);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cleanupPresence();
  });

  refs.openEditor?.addEventListener("click", openEditor);
  refs.openEditorGuide?.addEventListener("click", openEditor);
  refs.closeEditor?.addEventListener("click", closeEditor);
  refs.unlockEditor?.addEventListener("click", unlockEditor);
  refs.editorPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockEditor();
    }
  });
  refs.applyManual?.addEventListener("click", applyManualFromEditor);
  refs.clearManual?.addEventListener("click", clearLocalManual);
  refs.openActionsRefresh?.addEventListener("click", openActionsRefresh);
  refs.openPostEditor?.addEventListener("click", openPostEditor);
  refs.closePostEditor?.addEventListener("click", closePostEditor);
  refs.savePost?.addEventListener("click", savePostFromForm);
  refs.resetPostForm?.addEventListener("click", resetPostForm);
  refs.downloadPosts?.addEventListener("click", downloadPosts);
  refs.importPosts?.addEventListener("change", importPostsFromFile);
  refs.clearLocalPosts?.addEventListener("click", clearLocalPosts);
  refs.postList?.addEventListener("click", handlePostListClick);
}

function renderPage() {
  refs.pages.forEach((page) => {
    page.classList.toggle("active", page.id === `page-${state.page}`);
  });

  if (state.page === "dashboard") {
    render();
    return;
  }

  if (state.page === "characters") {
    renderCharactersPage();
    return;
  }

  if (state.page === "virtual") {
    renderVirtualPage();
    return;
  }

  if (state.page === "live-tobeol") {
    renderLiveTobeolPage();
    return;
  }

  if (state.page === "contents") {
    renderGuildContentsPage();
    return;
  }

  if (state.page === "hotdeals") {
    renderHotdealsPage();
    return;
  }

  if (state.page === "guide") {
    refs.title.textContent = "공략 게시판";
    refs.subtitle.textContent = "길드 공략을 작성하고 공유하는 공간";
    renderPosts();
    refs.footerText.textContent = "";
    return;
  }

  if (state.page === "links") {
    refs.title.textContent = "길드 링크";
    refs.subtitle.textContent = "길드 주요 링크 바로가기";
    refs.footerText.textContent = "";
    return;
  }

  if (state.page === "rest") {
    refs.title.textContent = "휴식";
    refs.subtitle.textContent = "게임 1 · 게임 2";
    refs.footerText.textContent = "";
  }
}

function rebuildData() {
  const cloned = deepClone(state.rawData || {});
  const effectiveManual = mergeManualObjects([
    state.manualFromFile,
    state.localManual,
    state.serverManual
  ], cloned.capturedDate);

  applyManualOverrides(cloned, effectiveManual);
  cloned.members = normalizeMemberServerRanks(cloned.members || []);
  cloned.summary = buildSummary(cloned.members || []);
  cloned.guildSummaries = Object.fromEntries(
    getGuildsFromData(cloned).map((guild) => [
      guild,
      buildSummary((cloned.members || []).filter((member) => member.guild === guild))
    ])
  );
  cloned.manualAppliedCount = effectiveManual.items.length;

  state.data = cloned;
}

function initGuildFilter() {
  const guilds = getGuilds();
  refs.guildFilter.innerHTML = [
    `<option value="all">전체</option>`,
    ...guilds.map((guild) => `<option value="${escapeAttr(guild)}">${escapeHtml(guild)}</option>`)
  ].join("");
  refs.guildFilter.value = state.guildFilter;
}

function initVisualFilters() {
  if (!refs.visualGuildFilter) return;
  const guilds = getGuilds();
  refs.visualGuildFilter.innerHTML = [
    `<option value="all">전체</option>`,
    ...guilds.map((guild) => `<option value="${escapeAttr(guild)}">${escapeHtml(guild)}</option>`)
  ].join("");
  refs.visualGuildFilter.value = state.visualGuildFilter;
  if (refs.visualSort) refs.visualSort.value = state.visualSort;
}

function initVirtualPicker() {
  if (!refs.virtualCharacterSelect) return;

  const members = [...(state.data?.members || [])].sort((a, b) => {
    const guildCompare = String(a.guild || "").localeCompare(String(b.guild || ""), "ko");
    if (guildCompare) return guildCompare;
    return Number(a.rank || 9999) - Number(b.rank || 9999);
  });

  if (!state.virtualSelectedKey && members[0]) {
    state.virtualSelectedKey = virtualMemberKey(members[0]);
  }

  refs.virtualCharacterSelect.innerHTML = members.map((member) => `
    <option value="${escapeAttr(virtualMemberKey(member))}">${escapeHtml(member.guild || "-")} · ${escapeHtml(member.nickname || "-")} · ${escapeHtml(member.job || "-")}</option>
  `).join("");
  refs.virtualCharacterSelect.value = state.virtualSelectedKey;
}


function initContentsFilters() {
  if (!refs.contentsGuildSelect) return;
  const bundles = getGuildContentBundles();
  const keywords = bundles.length
    ? bundles.map((item) => item.keyword)
    : [state.contentsGuild || "충주시"];

  if (!keywords.includes(state.contentsGuild)) state.contentsGuild = keywords[0] || "충주시";

  refs.contentsGuildSelect.innerHTML = keywords.map((keyword) =>
    `<option value="${escapeAttr(keyword)}">${escapeHtml(keyword)}</option>`
  ).join("");
  refs.contentsGuildSelect.value = state.contentsGuild;
}

function renderGuildContentsPage() {
  refs.title.textContent = "길드 컨텐츠";
  refs.subtitle.textContent = "개인 대항전 주차 비교 · 수련장 · 보스대전 매칭 확인";

  refs.contentsTabs?.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.contentMode === state.contentsMode);
  });
  if (refs.contentsGuildSelect) refs.contentsGuildSelect.value = state.contentsGuild;

  const bundle = getSelectedGuildContentBundle();
  const modeData = bundle?.modes?.[state.contentsMode] || null;
  const url = modeData?.url || makeGuildContentsUrl(state.contentsMode, state.contentsGuild);
  if (refs.contentsSourceLink) refs.contentsSourceLink.href = url;

  renderGuildContentsSummary(bundle, modeData);
  renderGuildWarPanel();
  renderGuildContentsGrid(modeData);

  const count = Number(modeData?.matchCount ?? modeData?.guilds?.length ?? 0);
  refs.footerText.textContent = "";
}

function renderGuildContentsSummary(bundle, modeData) {
  if (!refs.contentsSummary) return;
  const modes = ["league", "training", "boss"];
  refs.contentsSummary.innerHTML = modes.map((mode) => {
    const item = bundle?.modes?.[mode];
    const isActive = mode === state.contentsMode;
    const count = Number(item?.matchCount ?? item?.guilds?.length ?? 0);
    const topGuild = item?.guilds?.[0];
    const warSummary = state.guildWar?.summary || {};
    const availability = mode === "league"
      ? `개인점수 ${Number(warSummary.currentKnownCount || 0)}/${Number(warSummary.rosterCount || 0)}명`
      : item?.scoreAvailable ? "점수 제공" : "매칭 카드 수집";
    return `
      <button class="contents-summary-card ${isActive ? "active" : ""}" data-content-summary="${escapeAttr(mode)}" type="button">
        <span>${contentModeEmoji(mode)} ${escapeHtml(contentModeLabel(mode))}</span>
        <strong>${count ? `${count}개 길드` : "데이터 없음"}</strong>
        <small>${topGuild ? `${escapeHtml(topGuild.name)} · ${escapeHtml(availability)}` : "원본에서 확인 가능"}</small>
      </button>
    `;
  }).join("");

  refs.contentsSummary.querySelectorAll("[data-content-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      state.contentsMode = button.dataset.contentSummary || "league";
      renderGuildContentsPage();
    });
  });
}

function renderGuildContentsGrid(modeData) {
  if (!refs.contentsGrid) return;
  const guilds = modeData?.guilds || [];
  if (!guilds.length) {
    refs.contentsGrid.innerHTML = `
      <article class="contents-empty">
        <strong>표시할 매칭 데이터가 없습니다.</strong>
        <p>브라우저에서 MGF 원본 페이지를 열거나, 로컬에서 <code>npm run collect:contents</code>를 실행해 최신 데이터를 갱신하세요.</p>
      </article>
    `;
    return;
  }

  refs.contentsGrid.innerHTML = guilds.map((guild, index) => renderGuildContentsCard(guild, index, modeData)).join("");
}

function renderGuildContentsCard(guild, index, modeData) {
  const members = Array.isArray(guild.members) ? guild.members : [];
  const isRequestedGuild = guild.name === state.contentsGuild;
  const rankBadge = isRequestedGuild ? "현재 검색 길드" : `매칭 #${index + 1}`;
  const memberLines = members.length
    ? members.map((member) => renderGuildContentsMember(member)).join("")
    : `<li><span>-</span><strong>최정예 멤버 정보 없음</strong><em>-</em></li>`;
  const previousScore = isRequestedGuild && modeData?.previousGuildScoreValue != null
    ? `${modeData.previousCaptureDate || "이전"} · ${modeData.previousGuildScoreText || formatKoreanPower(modeData.previousGuildScoreValue)}`
    : "이전 점수 이력 없음";
  const scoreBlock = state.contentsMode === "league"
    ? ""
    : guild.scoreAvailable
      ? `<div class="contents-score available"><span>콘텐츠 점수</span><strong>${escapeHtml(guild.scoreText || formatKoreanPower(guild.scoreValue))}</strong><small>${escapeHtml(previousScore)}</small></div>`
      : `<div class="contents-score unavailable"><span>콘텐츠 점수</span><strong>원본 점수 없음</strong><small>매칭 그룹만 자동 기록합니다.</small></div>`;

  return `
    <article class="contents-card ${isRequestedGuild ? "is-main" : ""}">
      <div class="contents-card-top">
        <span class="contents-rank">${escapeHtml(rankBadge)}</span>
        <strong>${escapeHtml(guild.name || "-")}</strong>
      </div>
      <div class="contents-meta">
        <span>Master. <b>${escapeHtml(guild.master || "-")}</b></span>
        <span>${escapeHtml(guild.server || "-")}</span>
      </div>
      <div class="contents-power">
        <span>총 전투력</span>
        <strong>${escapeHtml(guild.powerText || "-")}</strong>
      </div>
      ${scoreBlock}
      <div class="contents-members-title">최정예 멤버 TOP 5</div>
      <ol class="contents-members">${memberLines}</ol>
    </article>
  `;
}

function renderGuildContentsMember(member) {
  return `
    <li>
      <span>${escapeHtml(member.rank || "-")}</span>
      <strong>${escapeHtml(member.nickname || "-")}</strong>
      <em>${escapeHtml(member.powerText || "-")}</em>
    </li>
  `;
}

function getGuildContentBundles() {
  return Array.isArray(state.guildContents?.guilds) ? state.guildContents.guilds : [];
}

function getSelectedGuildContentBundle() {
  return getGuildContentBundles().find((item) => item.keyword === state.contentsGuild) || getGuildContentBundles()[0] || null;
}

function normalizeGuildContents(value) {
  if (!value || !Array.isArray(value.guilds)) {
    return { capturedAt: "", source: "원본", guilds: [] };
  }
  return value;
}

function normalizeGuildWar(value) {
  if (!value || !Array.isArray(value.members)) {
    return {
      capturedAt: "",
      sourceUrl: "https://www.msidle.gg/guilds/scania/%EC%B6%A9%EC%A3%BC%EC%8B%9C/guild-war",
      sourceNotice: "아직 개인 대항전 수집 파일이 없습니다.",
      summary: { rosterCount: 0, currentKnownCount: 0, previousKnownCount: 0, comparedCount: 0, increasedCount: 0 },
      members: []
    };
  }
  return value;
}

function renderGuildWarPanel() {
  if (!refs.guildWarPanel || !refs.guildWarSummary || !refs.guildWarList) return;
  const isLeague = state.contentsMode === "league";
  refs.guildWarPanel.hidden = !isLeague;
  if (refs.contentsMatchHeading) refs.contentsMatchHeading.hidden = !isLeague;
  if (!isLeague) return;

  const data = state.guildWar || normalizeGuildWar(null);
  const summary = data.summary || {};
  const members = Array.isArray(data.members) ? data.members : [];
  if (refs.guildWarSourceLink) refs.guildWarSourceLink.href = data.sourceUrl || normalizeGuildWar(null).sourceUrl;

  refs.guildWarSummary.innerHTML = [
    [`이번 주 · ${data.currentWeekKey || "-"}`, `${Number(summary.currentKnownCount || 0)}/${Number(summary.rosterCount || 0)}명`, "current"],
    [`공개 ${Number(summary.currentKnownCount || 0)}명 합계`, summary.currentKnownCount ? `${summary.currentTotalText || "0"}` : "미수집", "total"],
    [`지난주 · ${data.previousWeekKey || "-"}`, `${Number(summary.previousKnownCount || 0)}명`, "previous"],
    ["주간 비교", `${Number(summary.comparedCount || 0)}명 · 상승 ${Number(summary.increasedCount || 0)}명`, "growth"]
  ].map(([label, value, tone]) => `
    <article class="guild-war-summary-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");

  if (!members.length) {
    refs.guildWarList.innerHTML = `<div class="guild-war-empty">개인 점수 데이터가 아직 없습니다. <code>npm run collect:guild-war</code>를 실행해주세요.</div>`;
  } else {
    refs.guildWarList.innerHTML = `
      <div class="guild-war-list-head"><span>길드원</span><span>이번 주 개인점수</span><span>지난주</span><span>증감</span><span>상승률</span></div>
      ${members.map(renderGuildWarMember).join("")}
    `;
  }

  const captured = data.capturedAt ? `${data.capturedAt} KST 수집` : "수집 전";
  if (refs.guildWarNotice) {
    refs.guildWarNotice.textContent = `${captured} · ${data.sourceNotice || "공개된 개인 점수만 기록하며 미수집은 0점이 아닙니다."}`;
  }
}

function renderGuildWarMember(member) {
  const currentKnown = member.currentScoreRaw != null;
  const previousKnown = member.previousScoreRaw != null;
  const compared = member.growthRaw != null;
  const rate = compared && member.growthRate != null
    ? `${Number(member.growthRate) > 0 ? "+" : ""}${member.growthRate}%`
    : compared && String(member.previousScoreRaw) === "0"
      ? "기준 0점"
      : "—";
  const growthClass = !compared ? "unknown" : BigInt(member.growthRaw) > 0n ? "up" : BigInt(member.growthRaw) < 0n ? "down" : "same";
  const rank = member.currentRank == null ? "—" : `#${member.currentRank}`;

  return `
    <article class="guild-war-member-row ${currentKnown ? "is-collected" : "is-missing"}">
      <div class="guild-war-member-name"><span>${escapeHtml(rank)}</span><strong>${escapeHtml(member.nickname || "-")}</strong></div>
      <div class="guild-war-score current ${currentKnown ? "" : "missing"}"><strong>${escapeHtml(currentKnown ? member.currentScoreText || member.currentScoreRaw : "미수집")}</strong><small>${escapeHtml(currentKnown ? formatGuildWarTimestamp(member.currentUpdatedAt) : "제출 기록 없음")}</small></div>
      <div class="guild-war-score previous ${previousKnown ? "" : "missing"}"><strong>${escapeHtml(previousKnown ? member.previousScoreText || member.previousScoreRaw : "미수집")}</strong><small>${member.previousRank == null ? "—" : `지난주 #${escapeHtml(member.previousRank)}`}</small></div>
      <strong class="guild-war-growth ${growthClass}">${escapeHtml(compared ? member.growthText || member.growthRaw : "비교 불가")}</strong>
      <strong class="guild-war-rate ${growthClass}">${escapeHtml(rate)}</strong>
    </article>
  `;
}

function formatGuildWarTimestamp(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "제출 시각 미상";
  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date)} KST`;
}

function contentModeLabel(mode) {
  return ({ league: "대항전", training: "수련장", boss: "보스대전" })[mode] || "대항전";
}

function contentModeEmoji(mode) {
  return ({ league: "⚔️", training: "🥋", boss: "👑" })[mode] || "⚔️";
}

function makeGuildContentsUrl(mode, keyword) {
  return `https://mgf.gg/contents/guild.php?mode=${encodeURIComponent(mode || "league")}&stx=${encodeURIComponent(keyword || "충주시")}`;
}

function renderLiveTobeolPage() {
  refs.title.textContent = "";
  refs.subtitle.textContent = "";

  if (refs.liveTobeolGuild && !refs.liveTobeolGuild.value) refs.liveTobeolGuild.value = state.liveTobeolGuild || "충주시";
  if (refs.liveTobeolServer && !refs.liveTobeolServer.value) refs.liveTobeolServer.value = state.liveTobeolServer || "4";
  updateLiveTobeolSourceLink();
  renderLiveTobeolResults();

  refs.footerText.textContent = "";
}

async function searchLiveTobeol() {
  const guild = (refs.liveTobeolGuild?.value || state.liveTobeolGuild || "충주시").trim();
  const server = (refs.liveTobeolServer?.value || state.liveTobeolServer || "4").trim();
  if (!guild) {
    state.liveTobeolError = "길드명을 입력해주세요.";
    renderLiveTobeolResults();
    return;
  }

  state.liveTobeolGuild = guild;
  state.liveTobeolServer = server;
  state.liveTobeolLoading = true;
  state.liveTobeolError = "";
  updateLiveTobeolSourceLink();
  renderLiveTobeolResults();

  try {
    const url = makeLiveTobeolApiUrl(guild, server);
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `실시간 조회 실패: ${response.status}`);
    }
    state.liveTobeolData = payload;
  } catch (error) {
    state.liveTobeolData = null;
    state.liveTobeolError = error?.message || "실시간 토벌전 조회에 실패했습니다.";
  } finally {
    state.liveTobeolLoading = false;
    renderLiveTobeolResults();
  }
}

function makeLiveTobeolApiUrl(guild, server) {
  const params = new URLSearchParams({
    guild: guild || "충주시",
    server: server || "4",
    ts: String(Date.now())
  });

  const host = window.location.hostname || "";
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  const isCloudflarePages = host.endsWith(".pages.dev");
  const apiOrigin = isLocal || isCloudflarePages ? "" : LIVE_TOBEOL_API_ORIGIN;

  return `${apiOrigin}/api/tobeol?${params.toString()}`;
}

function updateLiveTobeolSourceLink() {
  if (!refs.liveTobeolSourceLink) return;
  const guild = (refs.liveTobeolGuild?.value || state.liveTobeolGuild || "충주시").trim() || "충주시";
  refs.liveTobeolSourceLink.href = `https://mgf.gg/contents/guild_info.php?g_name=${encodeURIComponent(guild)}`;
}

function renderLiveTobeolResults() {
  if (!refs.liveTobeolSummary || !refs.liveTobeolMissList || !refs.liveTobeolHitList) return;

  refs.liveTobeolHitList.innerHTML = "";

  if (state.liveTobeolLoading) {
    refs.liveTobeolSummary.innerHTML = `
      <article class="live-summary-card loading">
        <span>MGF 원본 조회 중</span>
        <strong>확인 중...</strong>
        <small>길드원 행의 전투력·토벌 원본값을 가져오고 있습니다.</small>
      </article>
    `;
    refs.liveTobeolMissList.innerHTML = `<div class="live-empty">잠시만 기다려주세요.</div>`;
    return;
  }

  if (state.liveTobeolError) {
    refs.liveTobeolSummary.innerHTML = `
      <article class="live-summary-card error">
        <span>조회 실패</span>
        <strong>확인 필요</strong>
        <small>${escapeHtml(state.liveTobeolError)}</small>
      </article>
    `;
    refs.liveTobeolMissList.innerHTML = `<div class="live-empty">Cloudflare Pages 배포 또는 npm run serve로 실행했는지 확인해주세요.</div>`;
    return;
  }

  const data = state.liveTobeolData;
  if (!data) {
    refs.liveTobeolSummary.innerHTML = `
      <article class="live-summary-card ready">
        <span>준비 완료</span>
        <strong>길드명을 입력하고 조회</strong>
        <small>기본값은 충주시 / Scania 4입니다.</small>
      </article>
    `;
    refs.liveTobeolMissList.innerHTML = `<div class="live-empty">조회 후 길드원 전체가 참여/미참여 상태로 표시됩니다.</div>`;
    return;
  }

  const summary = data.summary || {};
  const period = data.raidPeriod || {};
  const isPreviousWeekFinal = period.kind === "previous_week_final";
  const participationLabel = isPreviousWeekFinal ? "지난주 참여" : "이번 주 참여";
  const missedLabel = isPreviousWeekFinal ? "지난주 미참여" : "이번 주 미참여";
  const sourceMembers = Array.isArray(data.members) && data.members.length
    ? data.members
    : [...(data.hitMembers || []), ...(data.missedMembers || [])];
  const storedRanks = new Map((state.data?.members || [])
    .filter((member) => member.guild === state.liveTobeolGuild)
    .map((member) => [member.nickname, member]));
  const allMembers = sortRankComparisonMembers(
    normalizeMemberServerRanks(sourceMembers.map((member) => {
      const stored = storedRanks.get(member.nickname) || {};
      return {
        ...member,
        rankScope: stored.rankScope,
        serverName: stored.serverName,
        serverPowerRank: stored.serverPowerRank,
        serverTobeolRank: stored.serverTobeolRank,
        serverRaidRankAdvantage: stored.serverRaidRankAdvantage,
        powerRank: stored.powerRank,
        tobeolRank: stored.tobeolRank,
        raidRankAdvantage: stored.raidRankAdvantage,
        __tobeolStatus: Number(member.tobeolValue || 0) > 0 || member.hit ? "hit" : "missed"
      };
    })),
    state.liveRankSort
  );
  const raidAheadCount = allMembers.filter((member) => Number(member.raidRankAdvantage) > 0).length;
  const raidEqualCount = allMembers.filter((member) => Number(member.raidRankAdvantage) === 0 && member.tobeolRank != null).length;
  const raidBehindCount = allMembers.filter((member) => Number(member.raidRankAdvantage) < 0).length;
  if (refs.liveRankSort) refs.liveRankSort.value = state.liveRankSort;
  refs.liveTobeolSummary.innerHTML = `
    <article class="live-summary-card hit">
      <span>${participationLabel}</span>
      <strong>${Number(summary.hitCount || 0)}명</strong>
      <small>참여율 ${escapeHtml(String(summary.hitRate ?? 0))}%</small>
    </article>
    <article class="live-summary-card missed">
      <span>${missedLabel}</span>
      <strong>${Number(summary.missedCount || 0)}명</strong>
      <small>${isPreviousWeekFinal ? "지난주 확정 점수 없음" : "현재 누적 점수 없음"}</small>
    </article>
    <article class="live-summary-card total">
      <span>${escapeHtml(period.metricLabel || "총 토벌전")}</span>
      <strong>${escapeHtml(summary.totalTobeolText || "0")}</strong>
      <small>MGF ${escapeHtml(data.sourceDataDate || "-")} 기준 · ${escapeHtml(period.scoreWeekKey || "-")} 주차</small>
    </article>
    <article class="live-summary-card compare">
      <span>서버 투력 대비 토벌 상승</span>
      <strong>${raidAheadCount}명</strong>
      <small>동일 ${raidEqualCount}명 · 하락 ${raidBehindCount}명</small>
    </article>
  `;

  refs.liveTobeolMissList.innerHTML = allMembers.length
    ? allMembers.map((member) => renderLiveTobeolMember(member, member.__tobeolStatus)).join("")
    : `<div class="live-empty">표시할 길드원이 없습니다.</div>`;
}

function renderLiveTobeolMember(member, type) {
  const isHit = type === "hit";
  const isPreviousWeekFinal = state.liveTobeolData?.raidPeriod?.kind === "previous_week_final";
  const imageUrl = getCharacterImageUrl(member.nickname);
  const statusText = isHit ? (isPreviousWeekFinal ? "지난주 참여" : "참여") : (isPreviousWeekFinal ? "지난주 미참여" : "미참여");
  const powerRank = member.powerRank ?? null;
  const tobeolRank = member.tobeolRank ?? null;
  const scoreText = isHit ? (member.tobeolText || "0") : "—";
  const delta = rankDifferenceMeta(member);
  const detailText = isHit ? `${statusText} · 서버 투력 ${powerRank ? `#${powerRank}` : "미수집"}` : "점수 없음";

  return `
    <article class="live-member-row ${isHit ? "is-hit" : "is-missed"}">
      <div class="featured-rank ${powerRank && Number(powerRank) <= 3 ? `top-${escapeAttr(String(powerRank))}` : ""}" title="Scania 4 서버 투력 순위">S${escapeHtml(powerRank || "-")}</div>
      <div class="featured-avatar-wrap">
        <img class="featured-avatar" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(member.nickname || "캐릭터")}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'; this.parentElement.classList.add('is-missing');" />
        <span class="featured-avatar-fallback">🌸</span>
      </div>
      <div class="featured-info">
        <strong class="featured-name">${escapeHtml(member.nickname || "-")}</strong>
        <small class="featured-meta">Lv.${escapeHtml(member.level || "-")}${member.job ? ` · ${escapeHtml(member.job)}` : ""}</small>
      </div>
      <span class="featured-pill rank-delta ${delta.className}" title="${escapeAttr(delta.description)}">${escapeHtml(delta.shortLabel)}</span>
      <div class="featured-score-box tobeol-score">
        <span>${tobeolRank == null ? "서버 토벌 미수집" : `서버 토벌 #${escapeHtml(tobeolRank)}`}</span>
        <strong>${escapeHtml(scoreText)}</strong>
        <small>${detailText}</small>
      </div>
    </article>
  `;
}


function renderHotdealsPage() {
  refs.title.textContent = "핫딜 알림";
  refs.subtitle.textContent = "기프트카드 할인 글 최신 확인";

  const bundle = state.hotdeals || normalizeHotdeals(null);
  if (refs.hotdealSourceLink) refs.hotdealSourceLink.href = bundle.sourceUrl || makeHotdealUrl();

  renderHotdealSummary(bundle);
  renderHotdealGrid(bundle);

  const count = (bundle.items || []).length;
  const validCount = (bundle.items || []).filter((item) => item.status === "active").length;
  refs.footerText.textContent = count
    ? `기프트카드 핫딜 ${count}개 표시 · 유효 가능 ${validCount}개 · ${bundle.capturedAt || "수집일 미상"}`
    : "기프트카드 핫딜 데이터가 아직 없습니다. npm run collect:hotdeals 실행 후 다시 확인하세요.";
}

function renderHotdealSummary(bundle) {
  if (!refs.hotdealSummary) return;
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const activeCount = items.filter((item) => item.status === "active").length;
  const fallbackCount = items.filter((item) => item.status === "unknown").length;
  const latest = items[0];
  refs.hotdealSummary.innerHTML = `
    <article class="hotdeal-summary-card hotdeal-live">
      <span>유효 가능</span>
      <strong>${activeCount}개</strong>
      <small>마감/종료 문구가 없는 글</small>
    </article>
    <article class="hotdeal-summary-card">
      <span>최신 표시</span>
      <strong>${items.length}개</strong>
      <small>${fallbackCount ? "유효 여부 불명 글 포함" : "수집된 후보 글"}</small>
    </article>
    <article class="hotdeal-summary-card">
      <span>최근 글</span>
      <strong>${latest ? escapeHtml(latest.relativeTime || latest.dateText || "확인됨") : "없음"}</strong>
      <small>${latest ? escapeHtml(latest.title || "-") : "수집 스크립트 실행 필요"}</small>
    </article>
  `;
}

function renderHotdealGrid(bundle) {
  if (!refs.hotdealGrid) return;
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  if (!items.length) {
    refs.hotdealGrid.innerHTML = `
      <article class="hotdeal-empty">
        <strong>표시할 기프트카드 핫딜이 아직 없습니다.</strong>
        <p>로컬이나 GitHub Actions에서 <code>npm run collect:hotdeals</code>를 실행하면 최신 5개가 <code>data/hotdeals.json</code>에 저장됩니다.</p>
      </article>
    `;
    return;
  }

  refs.hotdealGrid.innerHTML = items.map((item, index) => renderHotdealCard(item, index)).join("");
}

function renderHotdealCard(item, index) {
  const status = hotdealStatusMeta(item.status);
  const price = item.priceText ? `<span>💳 ${escapeHtml(item.priceText)}</span>` : "";
  const shop = item.shop ? `<span>🏪 ${escapeHtml(item.shop)}</span>` : "";
  const date = item.relativeTime || item.dateText || item.createdAt || "시간 미상";
  const badges = (item.badges || []).map((badge) => `<em>${escapeHtml(badge)}</em>`).join("");
  const url = item.url || makeHotdealUrl();
  return `
    <article class="hotdeal-card ${item.status === "expired" ? "is-expired" : ""}">
      <div class="hotdeal-card-top">
        <span class="hotdeal-rank">#${index + 1}</span>
        <span class="hotdeal-status ${escapeAttr(status.className)}">${escapeHtml(status.label)}</span>
      </div>
      <a class="hotdeal-title" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || "제목 없음")}</a>
      <div class="hotdeal-meta">
        <span>🕒 ${escapeHtml(date)}</span>
        ${price}
        ${shop}
      </div>
      ${badges ? `<div class="hotdeal-badges">${badges}</div>` : ""}
      <p>${escapeHtml(item.reason || status.description)}</p>
    </article>
  `;
}

function hotdealStatusMeta(status) {
  if (status === "active") {
    return { label: "유효 가능", className: "active", description: "제목에 종료/품절 문구가 없어 아직 유효할 가능성이 있습니다." };
  }
  if (status === "expired") {
    return { label: "마감 가능", className: "expired", description: "제목에 종료/품절/마감 계열 문구가 감지되었습니다." };
  }
  return { label: "최신 후보", className: "unknown", description: "유효 여부를 자동 확정할 수 없어 최신 글 후보로 표시합니다." };
}

function normalizeHotdeals(value) {
  if (!value || !Array.isArray(value.items)) {
    return {
      capturedAt: "",
      source: "arca.live 핫딜",
      sourceUrl: makeHotdealUrl(),
      keyword: "기프트카드",
      items: []
    };
  }
  return {
    capturedAt: value.capturedAt || "",
    source: value.source || "arca.live 핫딜",
    sourceUrl: value.sourceUrl || makeHotdealUrl(value.keyword || "기프트카드"),
    keyword: value.keyword || "기프트카드",
    items: value.items.slice(0, 5)
  };
}

function makeHotdealUrl(keyword = "기프트카드") {
  return `https://arca.live/b/hotdeal?target=all&keyword=${encodeURIComponent(keyword)}`;
}

function initGamePicker() {
  if (!refs.gameCharacterSelect) return;

  const members = [...(state.data?.members || [])].sort((a, b) => {
    const guildCompare = String(a.guild || "").localeCompare(String(b.guild || ""), "ko");
    if (guildCompare) return guildCompare;
    return Number(a.rank || 9999) - Number(b.rank || 9999);
  });

  if (!state.gameSelectedKey && members[0]) {
    state.gameSelectedKey = virtualMemberKey(members[0]);
  }

  refs.gameCharacterSelect.innerHTML = members.map((member) => `
    <option value="${escapeAttr(virtualMemberKey(member))}">${escapeHtml(member.guild || "-")} · ${escapeHtml(member.nickname || "-")} · ${escapeHtml(member.job || "-")}</option>
  `).join("");
  refs.gameCharacterSelect.value = state.gameSelectedKey;
  if (refs.gameTeamSelect) refs.gameTeamSelect.value = state.gameTeam;
}

function getGuilds() {
  return getGuildsFromData(state.data);
}

function getGuildsFromData(data) {
  const declared = Array.isArray(data?.guilds) ? data.guilds : [];
  const fromMembers = [...new Set((data?.members || []).map((member) => member.guild).filter(Boolean))];
  return [...new Set([...declared, ...fromMembers])];
}

function syncSortByTab() {
  if (state.tab === "power") state.sort = "powerGrowth";
  if (state.tab === "tobeol") state.sort = "tobeol";
  refs.sort.value = state.sort;
}

function render() {
  const data = state.data;
  const guilds = getGuilds();
  const selectedGuildText = state.guildFilter === "all" ? guilds.join(" · ") : state.guildFilter;

  refs.title.textContent = "";
  refs.subtitle.textContent = "";

  renderBannerDate();
  renderSummary();
  renderSourceHealth();
  renderFeaturedMembers();
  renderWeeklyRaidList();
  renderRankComparison();
  renderTable();

  if (state.page !== "dashboard") return;

  const editText = data.manualAppliedCount > 0 ? ` · 수정 ${data.manualAppliedCount}건 반영` : "";
  const sourceText = data.dataSource === "MGF guild_info" ? "" : "";
  refs.footerText.textContent = "";
}

function getComparisonDateText(data, guildFilter) {
  if (!data) return "-";
  const comparisonDates = data.comparisonDates || {};

  if (guildFilter && guildFilter !== "all") {
    return comparisonDates[guildFilter] || `${data.comparisonTargetDate || "7일 전"} 데이터 없음`;
  }

  if (data.comparisonDateText) return data.comparisonDateText;

  const dates = [...new Set(Object.values(comparisonDates).filter(Boolean))];
  if (dates.length === 0) return `${data.comparisonTargetDate || "7일 전"} 데이터 없음`;
  if (dates.length === 1) return dates[0];
  return dates.join(" · ");
}

function openActionsRefresh() {
  const url = getActionsWorkflowUrl();
  window.open(url, "_blank", "noopener,noreferrer");
}

function getActionsWorkflowUrl() {
  const host = window.location.hostname || "";
  const firstPath = window.location.pathname.split("/").filter(Boolean)[0];

  if (host.endsWith(".github.io") && firstPath) {
    const owner = host.replace(".github.io", "");
    return `https://github.com/${owner}/${firstPath}/actions/workflows/collect.yml`;
  }

  return "https://github.com/OWNER/chungju-guild-dashboard/actions/workflows/collect.yml";
}

function renderSummary() {
  const members = getGuildFilteredMembers();
  const summary = buildSummary(members);
  const avgPower = summary.memberCount ? Math.floor(summary.totalPowerValue / summary.memberCount) : 0;
  const raidPeriod = state.data?.raidPeriod || {};
  const raidLabel = raidPeriod.kind === "previous_week_final" ? "지난주 토벌 확정" : "이번 주 토벌";
  const cards = [
    { label: "길드원", value: `${summary.memberCount || 0}명`, icon: "👥", tone: "primary" },
    { label: "총 전투력", value: formatKoreanPower(summary.totalPowerValue || 0), icon: "⚡", tone: "featured" },
    { label: raidLabel, value: formatKoreanPower(summary.totalTobeolValue || 0), icon: "🏹", tone: "accent" },
    { label: "평균 전투력", value: formatKoreanPower(avgPower || 0), icon: "✨", tone: "soft" }
  ];

  refs.summaryGrid.innerHTML = cards.map((card) => `
    <article class="summary-card summary-card-${card.tone}">
      <div class="summary-card-top">
        <span class="summary-icon" aria-hidden="true">${card.icon}</span>
        <div class="label">${escapeHtml(card.label)}</div>
      </div>
      <div class="value">${escapeHtml(card.value)}</div>
    </article>
  `).join("");
}

function renderBannerDate() {
  if (!refs.bannerSourceDate) return;
  const sourceDate = state.data?.sourceDataDate || state.data?.capturedDate || "-";
  refs.bannerSourceDate.textContent = `${sourceDate} MGF 기준`;
}

function renderSourceHealth() {
  if (!refs.sourceHealth) return;
  const data = state.data || {};
  const period = data.raidPeriod || {};
  const raidHistory = data.raidHistoryByGuild?.[state.guildFilter === "all" ? (data.guilds?.[0] || "충주시") : state.guildFilter] || {};
  const lastWeekText = raidHistory.status === "final"
    ? `${raidHistory.snapshotDate} 확정본 연결`
    : raidHistory.status === "latest_capture"
      ? `${raidHistory.snapshotDate} 마지막 수집본`
      : "첫 월요일 수집 후 표시";
  const warSummary = state.guildWar?.summary || {};
  const warCoverage = `${Number(warSummary.currentKnownCount || 0)}/${Number(warSummary.rosterCount || 0)}명 공개`;
  const items = [
    { icon: "✓", tone: "ok", label: "전투력", value: "원본 정수 직접 수집", detail: "data-bp · 길드 합계 검증" },
    { icon: "✓", tone: "ok", label: "토벌전", value: period.metricLabel || "주차 판별", detail: `${period.scoreWeekKey || "-"} 주차 · data-gb` },
    { icon: "↺", tone: raidHistory.status === "not_collected" ? "wait" : "ok", label: "지난주 토벌", value: lastWeekText, detail: "월요일 확정본 우선" },
    { icon: "↺", tone: warSummary.currentKnownCount ? "ok" : "wait", label: "개인 대항전", value: warCoverage, detail: "주차별 저장 · 미수집은 null" },
    { icon: "—", tone: "limited", label: "일일 길드 업그레이드", value: "공개 원본 미제공", detail: "자동 완료 여부 판정 불가" }
  ];
  refs.sourceHealth.innerHTML = items.map((item) => `
    <article class="source-health-card ${item.tone}">
      <span class="source-health-icon">${item.icon}</span>
      <div><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></div>
    </article>
  `).join("");
}

function renderWeeklyRaidList() {
  if (!refs.weeklyRaidList) return;
  const data = state.data || {};
  const period = data.raidPeriod || {};
  const isPreviousWeekFinal = period.kind === "previous_week_final";
  const members = getGuildFilteredMembers()
    .sort((a, b) => Number(b.sourceTobeolValue ?? b.tobeolValue ?? 0) - Number(a.sourceTobeolValue ?? a.tobeolValue ?? 0));
  if (refs.raidPeriodChip) {
    refs.raidPeriodChip.textContent = `${period.metricLabel || "토벌 주차"} · ${period.scoreWeekKey || "-"}`;
  }
  if (!members.length) {
    refs.weeklyRaidList.innerHTML = `<div class="weekly-empty">표시할 토벌 기록이 없습니다.</div>`;
    return;
  }
  refs.weeklyRaidList.innerHTML = `
    <div class="weekly-raid-head"><span>길드원</span><span>${isPreviousWeekFinal ? "지난주 확정" : "이번 주 진행"}</span><span>${isPreviousWeekFinal ? "기록 상태" : "지난주 기록"}</span></div>
    ${members.map((member, index) => {
      const sourceScore = member.sourceTobeolValue ?? member.tobeolValue ?? 0;
      const lastWeek = member.lastWeekTobeolValue;
      const lastWeekLabel = isPreviousWeekFinal && lastWeek != null
        ? "이 주차 확정본으로 저장됨"
        : lastWeek == null
        ? "수집 이력 없음"
        : `${formatKoreanPower(lastWeek)}${member.lastWeekTobeolIsFinal ? " · 확정" : " · 마지막 수집"}`;
      return `
        <article class="weekly-raid-row">
          <span class="weekly-rank">${index + 1}</span>
          <div><strong>${escapeHtml(member.nickname || "-")}</strong><small>${escapeHtml(member.job || "-")} · Lv.${escapeHtml(member.level || "-")}</small></div>
          <b>${escapeHtml(formatKoreanPower(sourceScore))}</b>
          <em class="${lastWeek == null ? "is-empty" : ""}">${escapeHtml(lastWeekLabel)}</em>
        </article>`;
    }).join("")}
  `;
}

function renderRankComparison() {
  if (!refs.rankCompareSummary || !refs.rankCompareList) return;
  if (refs.rankCompareSort) refs.rankCompareSort.value = state.rankCompareSort;
  const members = sortRankComparisonMembers(getGuildFilteredMembers(), state.rankCompareSort);
  const participated = members.filter((member) => member.tobeolRank != null);
  const ahead = participated.filter((member) => Number(member.raidRankAdvantage) > 0).length;
  const equal = participated.filter((member) => Number(member.raidRankAdvantage) === 0).length;
  const behind = participated.filter((member) => Number(member.raidRankAdvantage) < 0).length;

  refs.rankCompareSummary.innerHTML = [
    ["토벌 참여", `${participated.length}/${members.length}명`, "participated"],
    ["투력 대비 상승", `${ahead}명`, "ahead"],
    ["같은 순위", `${equal}명`, "equal"],
    ["투력 대비 하락", `${behind}명`, "behind"]
  ].map(([label, value, tone]) => `
    <article class="rank-summary-card ${tone}"><span>${label}</span><strong>${value}</strong></article>
  `).join("");

  if (!members.length) {
    refs.rankCompareList.innerHTML = `<div class="weekly-empty">표시할 길드원이 없습니다.</div>`;
    return;
  }

  refs.rankCompareList.innerHTML = `
    <div class="rank-compare-head"><span>길드원</span><span>서버 투력</span><span>서버 토벌</span><span>순위 차이</span></div>
    ${members.map(renderRankComparisonRow).join("")}
  `;
}

function renderRankComparisonRow(member) {
  const delta = rankDifferenceMeta(member);
  const powerRank = member.powerRank == null ? "-" : `#${member.powerRank}`;
  const tobeolRank = member.tobeolRank == null ? "미참여" : `#${member.tobeolRank}`;
  const tobeolValue = member.sourceTobeolValue ?? member.tobeolValue ?? 0;

  return `
    <article class="rank-compare-row ${member.tobeolRank == null ? "is-unranked" : ""}">
      <div class="rank-member-info">
        <strong>${escapeHtml(member.nickname || "-")}</strong>
        <small>${escapeHtml(member.job || "-")} · Lv.${escapeHtml(member.level || "-")}</small>
      </div>
      <div class="rank-metric power"><span>${escapeHtml(powerRank)}</span><small>${escapeHtml(compactPowerText(member.powerText, member.powerValue))}</small></div>
      <div class="rank-metric raid"><span>${escapeHtml(tobeolRank)}</span><small>${escapeHtml(member.tobeolRank == null ? "0점 또는 순위 미수집" : compactPowerText(member.tobeolText, tobeolValue))}</small></div>
      <span class="rank-delta ${delta.className}" title="${escapeAttr(delta.description)}">${escapeHtml(delta.label)}</span>
    </article>
  `;
}

function sortRankComparisonMembers(members, mode = "tobeol") {
  const list = [...(Array.isArray(members) ? members : [])];
  const rankOrLast = (value) => value == null ? Number.MAX_SAFE_INTEGER : Number(value);
  return list.sort((a, b) => {
    if (mode === "power") {
      return rankOrLast(a.powerRank) - rankOrLast(b.powerRank)
        || rankOrLast(a.tobeolRank) - rankOrLast(b.tobeolRank);
    }
    if (mode === "advantage") {
      const aDelta = a.raidRankAdvantage == null ? -Infinity : Number(a.raidRankAdvantage);
      const bDelta = b.raidRankAdvantage == null ? -Infinity : Number(b.raidRankAdvantage);
      return bDelta - aDelta || rankOrLast(a.tobeolRank) - rankOrLast(b.tobeolRank);
    }
    return rankOrLast(a.tobeolRank) - rankOrLast(b.tobeolRank)
      || rankOrLast(a.powerRank) - rankOrLast(b.powerRank);
  });
}

function rankDifferenceMeta(member) {
  if (member?.tobeolRank == null || member?.raidRankAdvantage == null) {
    return { label: "비교 불가", shortLabel: "미수집", className: "unranked", description: "서버 투력 또는 서버 토벌 순위가 없어 비교에서 제외" };
  }
  const delta = Number(member.raidRankAdvantage || 0);
  if (delta > 0) return { label: `토벌 +${delta} ↑`, shortLabel: `+${delta} ↑`, className: "ahead", description: `Scania 4 토벌 순위가 서버 투력 순위보다 ${delta}칸 높음` };
  if (delta < 0) return { label: `토벌 ${delta} ↓`, shortLabel: `${delta} ↓`, className: "behind", description: `Scania 4 토벌 순위가 서버 투력 순위보다 ${Math.abs(delta)}칸 낮음` };
  return { label: "순위 같음", shortLabel: "동일", className: "equal", description: "Scania 4 서버 투력 순위와 서버 토벌 순위가 같음" };
}

function renderCharactersPage() {
  const data = state.data;
  if (!data) return;

  const selectedGuildText = state.visualGuildFilter === "all" ? "전체 길드" : state.visualGuildFilter;
  const members = getVisualFilteredMembers();

  refs.title.textContent = `${selectedGuildText} 캐릭터 모아보기`;
  refs.subtitle.textContent = `캐릭터 이미지 · 전투력 · 토벌전 · 변화량을 한 화면에서 확인`;

  renderVisualStats(members);
  renderVisualOverview();
  renderCharacterGrid(members);

  const editText = data.manualAppliedCount > 0 ? ` · 수정 ${data.manualAppliedCount}건 반영` : "";
  refs.footerText.textContent = "";
}

function getVisualFilteredMembers() {
  const keyword = state.visualKeyword.toLowerCase();
  return [...(state.data?.members || [])]
    .filter((member) => state.visualGuildFilter === "all" || member.guild === state.visualGuildFilter)
    .filter((member) => {
      if (!keyword) return true;
      return `${member.guild} ${member.nickname} ${member.job}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => getSortValue(b, state.visualSort) - getSortValue(a, state.visualSort));
}

function renderVisualStats(members) {
  if (!refs.visualStats) return;
  const topPower = getTopMember(members, "power");
  const topTobeol = getTopMember(members, "tobeol");
  const avgPowerGrowth = averageNumeric(members.map((member) => member.powerGrowthValue));
  const lastWeekKnown = members.filter((member) => member.lastWeekTobeolValue != null).length;
  const cards = [
    ["표시 인원", `${members.length}명`],
    ["전투력 1위", topPower ? `${topPower.nickname} · ${formatKoreanPower(topPower.powerValue)}` : "-"],
    ["평균 전투력 변화", avgPowerGrowth == null ? "비교 없음" : formatSignedKoreanPower(avgPowerGrowth)],
    ["지난주 기록", lastWeekKnown ? `${lastWeekKnown}명 보관` : "첫 월요일 후 표시"],
    ["토벌전 1위", topTobeol ? `${topTobeol.nickname} · ${formatKoreanPower(topTobeol.tobeolValue)}` : "-"]
  ];

  refs.visualStats.innerHTML = cards.map(([label, value]) => `
    <article class="visual-stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function renderVisualOverview() {
  if (!refs.visualOverview) return;
  const guilds = state.visualGuildFilter === "all" ? getGuilds() : [state.visualGuildFilter];
  const allMembers = state.data?.members || [];
  const guildSummaries = guilds
    .map((guild) => {
      const members = allMembers.filter((member) => member.guild === guild);
      return { guild, members, summary: buildSummary(members) };
    })
    .filter((item) => item.members.length);

  refs.visualOverview.innerHTML = guildSummaries.map(({ guild, members, summary }) => {
    const topPower = getTopMember(members, "power");
    const topTobeol = getTopMember(members, "tobeol");
    return `
      <article class="overview-card">
        <div class="overview-title">
          <span class="guild-pill">${escapeHtml(guild)}</span>
          <strong>${summary.memberCount}명</strong>
        </div>
        <div class="overview-lines">
          ${renderOverviewLine("총 전투력", formatKoreanPower(summary.totalPowerValue))}
          ${renderOverviewLine("총 토벌전", formatKoreanPower(summary.totalTobeolValue))}
          ${renderOverviewLine("전투력 대표", topPower ? topPower.nickname : "-")}
          ${renderOverviewLine("토벌전 대표", topTobeol ? topTobeol.nickname : "-")}
        </div>
      </article>
    `;
  }).join("");
}

function renderOverviewLine(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCharacterGrid(members) {
  if (!refs.characterGrid) return;
  if (!members.length) {
    refs.characterGrid.innerHTML = `<div class="empty character-empty">표시할 캐릭터가 없습니다.</div>`;
    return;
  }

  const max = getVisualMaxValues(members);
  refs.characterGrid.innerHTML = members.map((member, index) => renderCharacterCard(member, index, max)).join("");
}

function renderCharacterCard(member, index, max) {
  const imageUrl = getCharacterImageUrl(member.nickname);
  const rank = member.rank ? `#${member.rank}` : `#${index + 1}`;
  const manualBadge = member.isManual ? `<span class="manual-badge">수정</span>` : "";
  const statusBadge = renderMemberStatusBadge(member);
  const powerGrowth = member.powerGrowthValue == null ? null : Number(member.powerGrowthValue);
  const lastWeekTobeol = member.lastWeekTobeolValue == null ? null : Number(member.lastWeekTobeolValue);

  return `
    <article class="character-card ${member.isManual ? "manual-card" : ""}">
      <div class="character-art">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(member.nickname || "캐릭터")} 캐릭터 이미지" loading="lazy" decoding="async" onerror="this.closest('.character-art').classList.add('is-missing'); this.remove();" />
        <span class="image-fallback">이미지 없음</span>
      </div>
      <div class="character-info">
        <div class="character-topline">
          <span class="badge">${escapeHtml(rank)}</span>
          ${renderGuild(member)}
        </div>
        <h3>${escapeHtml(member.nickname || "-")} ${manualBadge} ${statusBadge}</h3>
        <p>${escapeHtml(member.job || "-")} · Lv.${escapeHtml(member.level || "-")}</p>
      </div>
      <div class="character-bars">
        ${renderCharacterBar("전투력", member.powerText || formatKoreanPower(member.powerValue), percentOf(member.powerValue, max.power), "") }
        ${renderCharacterBar("전투력 변화", powerGrowth == null ? "비교 없음" : formatSignedKoreanPower(powerGrowth), percentOf(Math.abs(powerGrowth || 0), max.powerGrowth), growthClass(powerGrowth))}
        ${renderCharacterBar("토벌전", formatKoreanPower(member.tobeolValue), percentOf(member.tobeolValue, max.tobeol), "") }
        ${renderCharacterBar("지난주 토벌", lastWeekTobeol == null ? "수집 이력 없음" : formatKoreanPower(lastWeekTobeol), percentOf(lastWeekTobeol || 0, max.lastWeekTobeol), "")}
      </div>
    </article>
  `;
}

function renderCharacterBar(label, value, percent, className) {
  const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
  return `
    <div class="character-bar ${escapeAttr(className || "")}" style="--bar:${safePercent}%">
      <div class="character-bar-label">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <div class="bar-track"><span></span></div>
    </div>
  `;
}

function getCharacterImageUrl(nickname) {
  return `https://mgf.gg/ranking/ranking_image.php?n=${encodeURIComponent(String(nickname || ""))}`;
}

function getVisualMaxValues(members) {
  return {
    power: getMaxNumber(members.map((member) => member.powerValue)),
    powerGrowth: getMaxNumber(members.map((member) => Math.abs(Number(member.powerGrowthValue || 0)))),
    tobeol: getMaxNumber(members.map((member) => member.tobeolValue)),
    lastWeekTobeol: getMaxNumber(members.map((member) => Number(member.lastWeekTobeolValue || 0)))
  };
}

function getMaxNumber(values) {
  return Math.max(1, ...values.map((value) => Number(value || 0)));
}

function percentOf(value, max) {
  return (Number(value || 0) / Number(max || 1)) * 100;
}

function growthClass(value) {
  if (value == null) return "is-empty";
  if (Number(value) > 0) return "is-up";
  if (Number(value) < 0) return "is-down";
  return "is-zero";
}

function getTopMember(members, type) {
  const key = type === "tobeol" ? "tobeolValue" : "powerValue";
  return [...members].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] || null;
}

function averageNumeric(values) {
  const valid = values
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map((value) => Number(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}


function initVirtualLobbyClient() {
  state.virtualMessages = readLocalVirtualMessages();
  state.virtualClient = createVirtualLobbyClient({
    config: FIREBASE_CONFIG,
    collectionName: FIREBASE_LOBBY_COLLECTION,
    onParticipants: (participants) => {
      state.virtualParticipants = participants;
      syncVirtualStateFromServer(participants);
      if (state.page === "virtual") renderVirtualPage();
    },
    onMessages: (messages) => {
      state.virtualMessages = messages;
      if (state.page === "virtual") renderVirtualChat();
    },
    onStatus: (status, message) => {
      state.virtualStatus = message || status || "";
      if (state.page === "virtual") renderVirtualStatus();
    },
    onError: (error) => {
      console.error(error);
      state.virtualStatus = `광장 연결 실패: ${error.message}`;
      if (state.page === "virtual") renderVirtualStatus();
    }
  });

  if (!state.virtualClient?.enabled) {
    state.virtualStatus = "데모 모드: 이 브라우저에서만 움직입니다";
  }
}

function renderVirtualPage() {
  if (!state.data) return;
  if (!state.virtualSelectedKey) initVirtualPicker();

  const member = getSelectedVirtualMember();
  refs.title.textContent = "길드 2D 광장";
  refs.subtitle.textContent = "가로로 긴 맵에서 이동 · 채팅 · 전투력 기반 스킬 장난하기";

  renderVirtualStatus();
  renderVirtualSelected(member);
  renderVirtualWorld();
  renderVirtualChat();

  const count = getVirtualParticipantsForRender().filter((item) => !item.isGhost).length;
  refs.footerText.textContent = state.virtualClient?.enabled
    ? `실시간 광장 연결 · 현재 ${count}명 표시 중`
    : "데모 모드 · Firebase 규칙을 배포하면 다른 사람과 실시간으로 만날 수 있습니다.";
}

function renderVirtualStatus() {
  if (!refs.virtualStatus) return;
  const mode = state.virtualClient?.enabled ? "online" : "local";
  refs.virtualStatus.className = `virtual-status ${mode}`;
  refs.virtualStatus.textContent = state.virtualStatus || (mode === "online" ? "실시간 광장 연결됨" : "데모 모드");
}

function renderVirtualSelected(member) {
  if (!member) return;
  const me = getMyVirtualParticipant();
  const maxHp = getVirtualMaxHp(member);
  const hp = getVirtualHp(me, member);
  const jailRemaining = getVirtualJailRemaining(me);
  const cooldownRemaining = Math.max(0, state.virtualAttackCooldownUntil - Date.now());

  if (refs.virtualSelectedName) refs.virtualSelectedName.textContent = `${member.nickname || "-"} · ${member.job || "-"}`;
  if (refs.virtualPower) refs.virtualPower.textContent = member.powerText || formatKoreanPower(member.powerValue);
  if (refs.virtualHp) refs.virtualHp.textContent = state.virtualJoined ? `${formatKoreanPower(hp)} / ${formatKoreanPower(maxHp)}` : formatKoreanPower(maxHp);
  const shieldRemaining = getVirtualShieldRemaining(me);
  if (refs.virtualState) refs.virtualState.textContent = jailRemaining > 0
    ? `감옥 ${Math.ceil(jailRemaining / 1000)}초`
    : shieldRemaining > 0
      ? `실드 ${Math.ceil(shieldRemaining / 1000)}초`
      : state.virtualJoined ? "정상" : "입장 전";
  if (refs.virtualTobeol) refs.virtualTobeol.textContent = formatKoreanPower(member.tobeolValue);
  if (refs.virtualJoin) refs.virtualJoin.textContent = state.virtualJoined ? "캐릭터 변경 적용" : "광장 입장";
  updateVirtualSkillButtons(jailRemaining);
  if (refs.virtualLeave) refs.virtualLeave.disabled = !state.virtualJoined;
  if (refs.virtualChatInput) refs.virtualChatInput.disabled = !state.virtualJoined;
  if (refs.virtualChatSend) refs.virtualChatSend.disabled = !state.virtualJoined;
}

function updateVirtualSkillButtons(jailRemaining = 0) {
  const now = Date.now();
  refs.virtualSkillButtons?.forEach((button) => {
    const skillName = button.dataset.virtualSkill || "slash";
    const skill = VIRTUAL_SKILLS[skillName] || VIRTUAL_SKILLS.slash;
    const cooldownRemaining = Math.max(0, Number(state.virtualSkillCooldowns?.[skillName] || 0) - now);
    const disabled = !state.virtualJoined || jailRemaining > 0 || cooldownRemaining > 0;
    button.disabled = disabled;
    const label = cooldownRemaining > 0 ? `${Math.ceil(cooldownRemaining / 1000)}초` : skill.label;
    const labelNode = button.querySelector("b");
    if (labelNode) labelNode.textContent = label;
    button.classList.toggle("is-cooling", cooldownRemaining > 0);
  });
}

function renderVirtualWorld() {
  if (!refs.virtualAvatars) return;
  const participants = getVirtualParticipantsForRender();
  const onlineCount = participants.filter((item) => !item.isGhost).length;
  if (refs.virtualOnlineCount) refs.virtualOnlineCount.textContent = `${onlineCount}명`;
  const me = getMyVirtualParticipant();
  const jailRemaining = getVirtualJailRemaining(me);
  if (refs.virtualHint) refs.virtualHint.textContent = state.virtualActionMessage || (jailRemaining > 0
    ? `감옥에 갇혔습니다. ${Math.ceil(jailRemaining / 1000)}초 뒤 자동으로 풀려납니다.`
    : state.virtualJoined
      ? "좌우로 긴 맵입니다. 화면을 옆으로 밀어 돌아다니고, 하단 스킬 버튼으로 장난 공격을 써보세요."
      : "광장 입장 버튼을 누르면 캐릭터들이 보이고 이동/채팅/스킬을 사용할 수 있습니다.");

  refs.virtualAvatars.innerHTML = state.virtualJoined
    ? participants.map((participant) => renderVirtualAvatar(participant)).join("")
    : `<div class="virtual-entry-cover"><strong>입장 대기 중</strong><span>캐릭터를 고르고 광장 입장을 누르면 긴 2D 맵이 열립니다.</span></div>`;
}

function renderVirtualAvatar(participant) {
  const member = participant.member || findMemberByName(participant.guild, participant.nickname) || {};
  const isMe = participant.userId === state.virtualUserId;
  const x = clamp(Number(participant.x ?? 50), VIRTUAL_WORLD_MIN_X, VIRTUAL_WORLD_MAX_X);
  const y = clamp(Number(participant.y ?? 64), VIRTUAL_WORLD_MIN_Y, VIRTUAL_WORLD_MAX_Y);
  const imageUrl = getCharacterImageUrl(member.nickname || participant.nickname);
  const bubble = participant.lastMessage ? `<div class="avatar-bubble">${escapeHtml(participant.lastMessage)}</div>` : "";
  const maxHp = getVirtualMaxHp(member, participant);
  const hp = getVirtualHp(participant, member);
  const hpPercent = maxHp ? clamp((hp / maxHp) * 100, 0, 100) : 100;
  const jailRemaining = getVirtualJailRemaining(participant);
  const shieldRemaining = getVirtualShieldRemaining(participant);
  const jailBadge = jailRemaining > 0 ? `<span class="avatar-jail">감옥 ${Math.ceil(jailRemaining / 1000)}초</span>` : "";
  const shieldBadge = shieldRemaining > 0 ? `<span class="avatar-shield">실드</span>` : "";
  const hpText = `${formatKoreanPower(hp)} / ${formatKoreanPower(maxHp)}`;

  return `
    <button class="virtual-avatar ${isMe ? "is-me" : ""} ${participant.isGhost ? "is-ghost" : ""} ${jailRemaining > 0 ? "is-jailed" : ""} ${shieldRemaining > 0 ? "is-shielded" : ""} ${hpPercent <= 35 ? "is-low-hp" : ""}" type="button" style="--x:${x}%; --y:${y}%; --hp:${hpPercent}%" title="${escapeAttr((participant.nickname || "캐릭터") + " · 체력 " + hpText)}">
      ${bubble}
      ${jailBadge}
      ${shieldBadge}
      <span class="avatar-shadow"></span>
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(participant.nickname || "캐릭터")}" loading="lazy" decoding="async" onerror="this.closest('.virtual-avatar').classList.add('is-missing'); this.remove();" />
      <span class="avatar-fallback">?</span>
      <strong>${escapeHtml(participant.nickname || "-")}</strong>
      <span class="avatar-hp"><i></i></span>
      <small>${escapeHtml(participant.guild || "-")}</small>
    </button>
  `;
}

function renderVirtualChat() {
  if (!refs.virtualChatList) return;
  const messages = [...(state.virtualMessages || [])].slice(-40);

  if (!messages.length) {
    refs.virtualChatList.innerHTML = `<div class="virtual-empty">아직 채팅이 없습니다. 입장 후 첫 인사를 남겨보세요.</div>`;
    return;
  }

  refs.virtualChatList.innerHTML = messages.map((message) => `
    <article class="chat-message ${message.userId === state.virtualUserId ? "is-me" : ""}">
      <div>
        <strong>${escapeHtml(message.nickname || "익명")}</strong>
        <span>${formatChatTime(message.createdAt)}</span>
      </div>
      <p>${escapeHtml(message.text || "")}</p>
    </article>
  `).join("");
  refs.virtualChatList.scrollTop = refs.virtualChatList.scrollHeight;
}

async function joinVirtualLobby(keepPosition = false) {
  const member = getSelectedVirtualMember();
  if (!member) return;
  if (!keepPosition) state.virtualPosition = randomVirtualPosition();
  state.virtualJoined = true;

  const participant = makeVirtualParticipant(member, state.virtualPosition, { resetHp: true, clearJail: true });

  if (state.virtualClient?.enabled) {
    await state.virtualClient.upsertParticipant(participant);
  } else {
    upsertLocalParticipant(participant);
  }

  startVirtualLoop();
  renderVirtualPage();
  centerVirtualStageOnMe();
}

async function leaveVirtualLobby() {
  state.virtualJoined = false;
  stopVirtualLoop();
  state.virtualActionMessage = "";
  state.virtualParticipants = state.virtualParticipants.filter((item) => item.userId !== state.virtualUserId);
  try {
    if (state.virtualClient?.enabled) {
      await state.virtualClient.leave(state.virtualUserId);
    }
  } catch (error) {
    console.warn("광장 퇴장 처리 실패", error);
  }
  renderVirtualPage();
}

function cleanupVirtualPresence() {
  if (!state.virtualJoined) return;
  state.virtualJoined = false;
  stopVirtualLoop();
  state.virtualParticipants = state.virtualParticipants.filter((item) => item.userId !== state.virtualUserId);
  if (state.virtualClient?.enabled) {
    state.virtualClient.leave(state.virtualUserId).catch?.(() => {});
  }
}

function moveVirtualRandom() {
  if (!state.virtualJoined) {
    joinVirtualLobby(false);
    return;
  }
  if (isMyVirtualJailed()) {
    setVirtualActionMessage("감옥 안에서는 이동할 수 없습니다.");
    return;
  }
  updateVirtualPosition(randomVirtualPosition());
}

function handleVirtualStageClick(event) {
  if (!state.virtualJoined || !refs.virtualStage) return;
  if (isMyVirtualJailed()) {
    setVirtualActionMessage("감옥 안에서는 이동할 수 없습니다. 잠깐만 기다려주세요.");
    return;
  }
  if (event.target.closest(".virtual-controls, .virtual-chat-panel, .virtual-avatar")) return;
  const rect = refs.virtualStage.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  updateVirtualPosition({ x, y });
}

function handleVirtualKeydown(event) {
  if (state.page !== "virtual" || !state.virtualJoined) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    useVirtualSkill("slash");
    return;
  }
  if (event.key.toLowerCase() === "q") {
    event.preventDefault();
    useVirtualSkill("dash");
    return;
  }
  if (event.key.toLowerCase() === "e") {
    event.preventDefault();
    useVirtualSkill("heal");
    return;
  }
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };
  if (!map[event.key]) return;
  event.preventDefault();
  nudgeVirtualAvatar(map[event.key]);
}

function nudgeVirtualAvatar(direction) {
  if (!state.virtualJoined) return;
  if (isMyVirtualJailed()) {
    setVirtualActionMessage("감옥 안에서는 움직일 수 없습니다.");
    return;
  }
  const step = direction === "left" || direction === "right" ? 5.2 : 4.4;
  const next = { ...state.virtualPosition };
  if (direction === "up") next.y -= step;
  if (direction === "down") next.y += step;
  if (direction === "left") next.x -= step;
  if (direction === "right") next.x += step;
  updateVirtualPosition(next);
}

async function updateVirtualPosition(position) {
  const member = getSelectedVirtualMember();
  if (!member) return;
  if (isMyVirtualJailed()) {
    state.virtualPosition = { ...VIRTUAL_JAIL_POSITION };
    renderVirtualWorld();
    return;
  }
  state.virtualPosition = {
    x: clamp(Number(position.x), VIRTUAL_WORLD_MIN_X, VIRTUAL_WORLD_MAX_X),
    y: clamp(Number(position.y), VIRTUAL_WORLD_MIN_Y, VIRTUAL_WORLD_MAX_Y)
  };

  await syncVirtualParticipant(true);
  renderVirtualWorld();
  centerVirtualStageOnMe();
}

async function sendVirtualChat() {
  if (!state.virtualJoined || !refs.virtualChatInput) return;
  const text = refs.virtualChatInput.value.trim().slice(0, 120);
  if (!text) return;
  const member = getSelectedVirtualMember();
  const message = {
    id: `local-${Date.now()}`,
    userId: state.virtualUserId,
    nickname: member?.nickname || "익명",
    guild: member?.guild || "-",
    text,
    createdAt: new Date().toISOString()
  };

  refs.virtualChatInput.value = "";

  if (state.virtualClient?.enabled) {
    await state.virtualClient.sendMessage(message);
    await state.virtualClient.upsertParticipant({
      ...makeVirtualParticipant(member, state.virtualPosition),
      lastMessage: text
    });
  } else {
    state.virtualMessages = [...state.virtualMessages, message].slice(-80);
    localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify({ messages: state.virtualMessages }));
    upsertLocalParticipant({ ...makeVirtualParticipant(member, state.virtualPosition), lastMessage: text });
    renderVirtualChat();
    renderVirtualWorld();
  }
}


function startVirtualLoop() {
  if (state.virtualLoopTimer) return;
  state.virtualLoopTimer = window.setInterval(tickVirtualLobby, 1000);
}

function stopVirtualLoop() {
  if (!state.virtualLoopTimer) return;
  window.clearInterval(state.virtualLoopTimer);
  state.virtualLoopTimer = null;
}

async function tickVirtualLobby() {
  if (!state.virtualJoined) return;
  const me = getMyVirtualParticipant();

  if (shouldReleaseVirtualJail(me)) {
    await releaseVirtualFromJail();
    return;
  }

  if (getVirtualJailRemaining(me) > 0) {
    state.virtualPosition = { ...VIRTUAL_JAIL_POSITION };
    await syncVirtualParticipant(false);
  } else if (Date.now() - state.virtualLastSyncAt > 3500) {
    await syncVirtualParticipant(false);
  }

  if (state.page === "virtual") {
    renderVirtualSelected(getSelectedVirtualMember());
    renderVirtualWorld();
  }
}

async function syncVirtualParticipant(force = false, options = {}) {
  if (!state.virtualJoined) return;
  const now = Date.now();
  if (!force && now - state.virtualLastSyncAt < 2600) return;
  state.virtualLastSyncAt = now;
  const member = getSelectedVirtualMember();
  const participant = makeVirtualParticipant(member, state.virtualPosition, options);
  if (state.virtualClient?.enabled) {
    await state.virtualClient.upsertParticipant(participant);
  } else {
    upsertLocalParticipant(participant);
  }
}

function syncVirtualStateFromServer(participants) {
  const me = participants.find((participant) => participant.userId === state.virtualUserId);
  if (!me || !state.virtualJoined) return;
  state.virtualPosition = {
    x: clamp(Number(me.x ?? state.virtualPosition.x), VIRTUAL_WORLD_MIN_X, VIRTUAL_WORLD_MAX_X),
    y: clamp(Number(me.y ?? state.virtualPosition.y), VIRTUAL_WORLD_MIN_Y, VIRTUAL_WORLD_MAX_Y)
  };
  if (me.attackedAt && me.attackedAt !== state.virtualLastAttackedAt) {
    state.virtualLastAttackedAt = me.attackedAt;
    if (getVirtualJailRemaining(me) > 0) {
      setVirtualActionMessage(`${me.lastAttacker || "누군가"}에게 공격당해 5초 감옥에 갇혔습니다.`);
    } else if (me.lastAttacker) {
      setVirtualActionMessage(`${me.lastAttacker}에게 공격당했습니다. 체력이 줄었어요.`);
    }
  }
}

async function releaseVirtualFromJail() {
  const member = getSelectedVirtualMember();
  if (!member) return;
  state.virtualPosition = randomVirtualPosition();
  state.virtualActionMessage = "감옥에서 풀려났습니다. 체력이 다시 회복됐어요.";
  const participant = makeVirtualParticipant(member, state.virtualPosition, { resetHp: true, clearJail: true });
  if (state.virtualClient?.enabled) {
    await state.virtualClient.upsertParticipant(participant);
  } else {
    upsertLocalParticipant(participant);
  }
  if (state.page === "virtual") renderVirtualPage();
}

async function attackNearestVirtualParticipant() {
  return useVirtualSkill("slash");
}

async function useVirtualSkill(skillName = "slash") {
  const skill = VIRTUAL_SKILLS[skillName] || VIRTUAL_SKILLS.slash;
  if (!state.virtualJoined) {
    await joinVirtualLobby(false);
    return;
  }

  if (isMyVirtualJailed()) {
    setVirtualActionMessage("감옥 안에서는 스킬을 사용할 수 없습니다.");
    return;
  }

  const cooldownRemaining = Number(state.virtualSkillCooldowns?.[skillName] || 0) - Date.now();
  if (cooldownRemaining > 0) {
    setVirtualActionMessage(`${skill.label} 대기 중입니다. ${Math.ceil(cooldownRemaining / 1000)}초 남았어요.`);
    return;
  }

  if (skillName === "heal") {
    await useVirtualHeal(skill);
    return;
  }

  if (skillName === "shield") {
    await useVirtualShield(skill);
    return;
  }

  const target = findNearestVirtualAttackTarget(skill.range || VIRTUAL_ATTACK_RANGE);
  if (!target) {
    setVirtualActionMessage(`${skill.label}: 사거리 안에 상대가 없습니다. 조금 더 가까이 가보세요.`);
    setVirtualCooldown(skillName, 450);
    updateVirtualSkillButtons(getVirtualJailRemaining(getMyVirtualParticipant()));
    return;
  }

  if (skill.dash) {
    dashTowardVirtualTarget(target);
  }

  await applyVirtualAttackToTarget(target, skillName, skill);
}

async function useVirtualHeal(skill) {
  const member = getSelectedVirtualMember();
  const me = getMyVirtualParticipant() || makeVirtualParticipant(member, state.virtualPosition);
  const maxHp = getVirtualMaxHp(member, me);
  const hp = getVirtualHp(me, member);
  const nextHp = Math.min(maxHp, hp + Math.round(maxHp * (skill.healRate || 0.2)));
  setVirtualCooldown("heal", skill.cooldown);
  setVirtualActionMessage(`회복! 체력이 ${formatKoreanPower(nextHp)}까지 회복됐어요.`);
  await syncVirtualParticipant(true, { hp: nextHp, clearJail: true, preserveStatus: true });
  if (state.page === "virtual") renderVirtualPage();
}

async function useVirtualShield(skill) {
  const until = new Date(Date.now() + (skill.shieldMs || 5000)).toISOString();
  setVirtualCooldown("shield", skill.cooldown);
  setVirtualActionMessage("방어막! 잠깐 동안 받는 피해가 줄어듭니다.");
  await syncVirtualParticipant(true, { shieldUntil: until, preserveStatus: true });
  if (state.page === "virtual") renderVirtualPage();
}

async function applyVirtualAttackToTarget(target, skillName, skill) {
  const meMember = getSelectedVirtualMember();
  const targetMember = target.member || findMemberByName(target.guild, target.nickname) || {};
  const rawDamage = calculateVirtualAttackDamage(meMember, targetMember, skill.damageRate || 0.16);
  const shielded = getVirtualShieldRemaining(target) > 0;
  const damage = shielded ? Math.max(1, Math.round(rawDamage * 0.45)) : rawDamage;
  const targetMaxHp = getVirtualMaxHp(targetMember, target);
  const targetHp = getVirtualHp(target, targetMember);
  const nextHp = Math.max(0, targetHp - damage);
  const now = new Date();
  const myName = meMember?.nickname || "익명";
  const targetName = target.nickname || "상대";
  const patch = {
    hp: Math.round(nextHp),
    maxHp: Math.round(targetMaxHp),
    attackedAt: now.toISOString(),
    lastAttacker: myName,
    shieldUntil: String(target.shieldUntil || "")
  };

  let text = `${skill.message || skill.label} ${targetName}에게 -${formatKoreanPower(damage)}`;
  if (shielded) text += " · 방어막 감소";
  if (nextHp <= 0) {
    patch.hp = 0;
    patch.x = VIRTUAL_JAIL_POSITION.x;
    patch.y = VIRTUAL_JAIL_POSITION.y;
    patch.jailedUntil = new Date(Date.now() + VIRTUAL_JAIL_MS).toISOString();
    text = `${targetName} 제압! 5초 감옥으로 이동했습니다.`;
  }

  if (state.virtualClient?.enabled && !target.isGhost) {
    await state.virtualClient.patchParticipant(target.userId, patch);
  } else {
    upsertLocalParticipant({ ...target, ...patch });
  }

  setVirtualCooldown(skillName, skill.cooldown || VIRTUAL_ATTACK_COOLDOWN_MS);
  state.virtualAttackCooldownUntil = state.virtualSkillCooldowns[skillName];
  state.virtualActionMessage = text;
  await syncVirtualParticipant(true);
  if (state.page === "virtual") renderVirtualPage();
}

function setVirtualCooldown(skillName, ms) {
  state.virtualSkillCooldowns = {
    ...(state.virtualSkillCooldowns || {}),
    [skillName]: Date.now() + Number(ms || 0)
  };
}

function dashTowardVirtualTarget(target) {
  const current = { ...state.virtualPosition };
  const dx = Number(target.x || 50) - Number(current.x || 50);
  const dy = Number(target.y || 64) - Number(current.y || 64);
  const length = Math.max(1, Math.hypot(dx, dy));
  state.virtualPosition = {
    x: clamp(current.x + (dx / length) * Math.min(9, length * 0.72), VIRTUAL_WORLD_MIN_X, VIRTUAL_WORLD_MAX_X),
    y: clamp(current.y + (dy / length) * Math.min(4, length * 0.45), VIRTUAL_WORLD_MIN_Y, VIRTUAL_WORLD_MAX_Y)
  };
}

function findNearestVirtualAttackTarget(range = VIRTUAL_ATTACK_RANGE) {
  const me = makeVirtualParticipant(getSelectedVirtualMember(), state.virtualPosition);
  return getVirtualParticipantsForRender()
    .filter((participant) => participant.userId !== state.virtualUserId)
    .filter((participant) => isRecentParticipant(participant))
    .filter((participant) => getVirtualJailRemaining(participant) <= 0)
    .map((participant) => ({
      ...participant,
      distance: Math.hypot(Number(participant.x || 50) - Number(me.x || 50), Number(participant.y || 55) - Number(me.y || 55))
    }))
    .filter((participant) => participant.distance <= range)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function calculateVirtualAttackDamage(attackerMember, targetMember, damageRate = 0.18) {
  const attackerPower = getVirtualMaxHp(attackerMember);
  const targetPower = getVirtualMaxHp(targetMember);
  const powerRatio = targetPower > 0 ? attackerPower / targetPower : 1;
  const ratioBonus = clamp(powerRatio, 0.45, 1.8);
  return Math.max(1, Math.round(attackerPower * damageRate * ratioBonus));
}

async function addVirtualSystemMessage() {
  // 전투 알림은 채팅창에 올리지 않습니다.
}


function getMyVirtualParticipant() {
  return (state.virtualParticipants || []).find((participant) => participant.userId === state.virtualUserId) || null;
}

function getVirtualMaxHp(member, participant = null) {
  const power = Number(member?.powerValue ?? participant?.maxHp ?? participant?.hp ?? 0);
  return Math.max(1, Math.round(Number.isFinite(power) ? power : 1));
}

function getVirtualHp(participant, member = null) {
  const maxHp = getVirtualMaxHp(member, participant);
  if (!participant) return maxHp;
  const hp = Number(participant.hp ?? maxHp);
  return Math.round(clamp(Number.isFinite(hp) ? hp : maxHp, 0, maxHp));
}

function getVirtualJailRemaining(participant) {
  const until = new Date(participant?.jailedUntil || "").getTime();
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

function getVirtualShieldRemaining(participant) {
  const until = new Date(participant?.shieldUntil || "").getTime();
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

function shouldReleaseVirtualJail(participant) {
  if (!participant?.jailedUntil) return false;
  const until = new Date(participant.jailedUntil).getTime();
  if (!Number.isFinite(until) || until > Date.now()) return false;
  return getVirtualHp(participant) <= 0;
}

function isMyVirtualJailed() {
  return getVirtualJailRemaining(getMyVirtualParticipant()) > 0;
}

function setVirtualActionMessage(message) {
  state.virtualActionMessage = message;
  if (state.page === "virtual") {
    renderVirtualSelected(getSelectedVirtualMember());
    renderVirtualWorld();
  }
  window.clearTimeout(setVirtualActionMessage.timer);
  setVirtualActionMessage.timer = window.setTimeout(() => {
    if (state.virtualActionMessage === message) {
      state.virtualActionMessage = "";
      if (state.page === "virtual") renderVirtualWorld();
    }
  }, 2600);
}

function getVirtualParticipantsForRender() {
  if (!state.virtualJoined) return [];
  const map = new Map();
  const membersByKey = new Map((state.data?.members || []).map((member) => [virtualMemberKey(member), member]));

  for (const participant of state.virtualParticipants || []) {
    const member = membersByKey.get(participant.memberKey) || findMemberByName(participant.guild, participant.nickname);
    map.set(participant.userId, {
      ...participant,
      member,
      x: Number(participant.x ?? 50),
      y: Number(participant.y ?? 55)
    });
  }

  if (state.virtualJoined && !map.has(state.virtualUserId)) {
    const member = getSelectedVirtualMember();
    map.set(state.virtualUserId, makeVirtualParticipant(member, state.virtualPosition));
  }

  const realParticipants = [...map.values()].filter((item) => isRecentParticipant(item));
  if (state.virtualClient?.enabled && realParticipants.length >= 2) return realParticipants;

  return getDemoVirtualParticipants(realParticipants);
}

function getDemoVirtualParticipants(realParticipants) {
  const already = new Set(realParticipants.map((item) => item.memberKey));
  const demoMembers = [...(state.data?.members || [])]
    .filter((member) => !already.has(virtualMemberKey(member)))
    .sort((a, b) => Number(b.powerValue || 0) - Number(a.powerValue || 0))
    .slice(0, 7);

  return [
    ...realParticipants,
    ...demoMembers.map((member, index) => ({
      userId: `ghost-${index}`,
      memberKey: virtualMemberKey(member),
      nickname: member.nickname,
      guild: member.guild,
      job: member.job,
      x: [12, 24, 38, 52, 66, 78, 90][index] || 50,
      y: [66, 72, 60, 78, 64, 74, 68][index] || 66,
      lastSeen: new Date().toISOString(),
      member,
      isGhost: true
    }))
  ];
}

function makeVirtualParticipant(member, position, options = {}) {
  const existing = options.existing || getMyVirtualParticipant();
  const maxHp = getVirtualMaxHp(member, existing);
  const currentHp = Number.isFinite(Number(options.hp))
    ? Number(options.hp)
    : options.resetHp
      ? maxHp
      : getVirtualHp(existing, member);
  const jailedUntil = options.clearJail ? "" : String(existing?.jailedUntil || "");
  const shieldUntil = options.shieldUntil != null ? String(options.shieldUntil || "") : String(existing?.shieldUntil || "");
  const finalPosition = getVirtualJailRemaining({ jailedUntil }) > 0 ? VIRTUAL_JAIL_POSITION : position;

  return {
    userId: state.virtualUserId,
    memberKey: virtualMemberKey(member),
    nickname: member?.nickname || "익명",
    guild: member?.guild || "-",
    job: member?.job || "-",
    x: clamp(Number(finalPosition?.x ?? 50), VIRTUAL_WORLD_MIN_X, VIRTUAL_WORLD_MAX_X),
    y: clamp(Number(finalPosition?.y ?? 64), VIRTUAL_WORLD_MIN_Y, VIRTUAL_WORLD_MAX_Y),
    hp: Math.round(clamp(currentHp, 0, maxHp)),
    maxHp: Math.round(maxHp),
    jailedUntil,
    shieldUntil,
    attackedAt: String(existing?.attackedAt || ""),
    lastAttacker: String(existing?.lastAttacker || ""),
    lastMessage: String(existing?.lastMessage || ""),
    lastSeen: new Date().toISOString()
  };
}

function upsertLocalParticipant(participant) {
  const byId = new Map((state.virtualParticipants || []).map((item) => [item.userId, item]));
  const previous = byId.get(participant.userId) || {};
  byId.set(participant.userId, { ...previous, ...participant });
  state.virtualParticipants = [...byId.values()];
}

function getSelectedVirtualMember() {
  const members = state.data?.members || [];
  return members.find((member) => virtualMemberKey(member) === state.virtualSelectedKey) || members[0] || null;
}

function virtualMemberKey(member) {
  return `${String(member?.guild || "").trim()}::${String(member?.nickname || "").trim()}`;
}

function findMemberByName(guild, nickname) {
  return (state.data?.members || []).find((member) => member.guild === guild && member.nickname === nickname) || null;
}

function randomVirtualPosition() {
  return {
    x: 8 + Math.random() * 84,
    y: 58 + Math.random() * 22
  };
}

function centerVirtualStageOnMe() {
  if (!refs.virtualStage || !state.virtualJoined) return;
  const container = refs.virtualStage.parentElement;
  if (!container || container.scrollWidth <= container.clientWidth) return;
  const x = clamp(Number(state.virtualPosition.x || 50), 0, 100) / 100;
  const target = refs.virtualStage.scrollWidth * x - container.clientWidth / 2;
  container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

function readLocalVirtualMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

function getOrCreateVirtualUserId() {
  try {
    const existing = localStorage.getItem(LOCAL_VIRTUAL_KEY);
    if (existing) return existing;
    const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(LOCAL_VIRTUAL_KEY, id);
    return id;
  } catch {
    return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function isRecentParticipant(participant) {
  if (participant.isGhost) return true;
  const lastSeen = new Date(participant.lastSeen || participant.updatedAt || Date.now()).getTime();
  if (!Number.isFinite(lastSeen)) return true;
  return Date.now() - lastSeen < 1000 * 35;
}

function formatChatTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "방금";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}


function initGameFood() {
  if (state.gameFood.length) return;
  state.gameFood = createGameFood(72);
}

function initGameBots() {
  const members = [...(state.data?.members || [])]
    .sort((a, b) => Number(b.powerValue || 0) - Number(a.powerValue || 0))
    .slice(0, 8);

  state.gameBots = members.map((member, index) => ({
    userId: `bot-${index}`,
    memberKey: virtualMemberKey(member),
    nickname: member.nickname,
    guild: member.guild,
    job: member.job,
    team: ["solo", "blue", "violet", "green", "orange"][index % 5],
    x: [18, 36, 58, 76, 28, 66, 48, 82][index] || randomGamePosition().x,
    y: [24, 66, 34, 72, 46, 22, 80, 42][index] || randomGamePosition().y,
    mass: 18 + index * 5,
    score: index * 80,
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
    lastSeen: new Date().toISOString(),
    member,
    isBot: true
  }));
}

function initJellyGameClient() {
  state.gameEvents = readLocalGameEvents();
  state.gameClient = createJellyGameClient({
    config: FIREBASE_CONFIG,
    collectionName: FIREBASE_GAME_COLLECTION,
    onPlayers: (players) => {
      state.gamePlayers = players;
      syncLocalJellyFromServer(players);
      if (state.page === "game") renderGamePage();
    },
    onEvents: (events) => {
      state.gameEvents = events;
      if (state.page === "game") renderGameEventLog();
    },
    onStatus: (status, message) => {
      state.gameStatus = message || status || "";
      if (state.page === "game") renderGameStatus();
    },
    onError: (error) => {
      console.error(error);
      state.gameStatus = `게임 연결 실패: ${error.message}`;
      if (state.page === "game") renderGameStatus();
    }
  });

  if (!state.gameClient?.enabled) {
    state.gameStatus = "데모 모드: 이 브라우저에서 봇과 연습합니다";
  }
}

function renderGamePage() {
  if (!state.data) return;
  if (!state.gameSelectedKey) initGamePicker();
  if (!state.gameFood.length) initGameFood();
  if (!state.gameBots.length) initGameBots();

  const member = getSelectedGameMember();
  refs.title.textContent = "메키 젤리난투";
  refs.subtitle.textContent = "길드 캐릭터로 먹이 먹고, 작은 상대 흡수하고, 팀으로 살아남기";

  renderGameStatus();
  renderGameSelected(member);
  renderGameArena();
  renderGameScoreboard();
  renderGameEventLog();

  const playerCount = getGamePlayersForRender().filter((item) => !item.isBot).length;
  refs.footerText.textContent = state.gameClient?.enabled
    ? `실시간 젤리난투 연결 · 현재 ${playerCount}명 참여 중 · 같은 팀은 흡수 불가`
    : "데모 모드 · Firebase 규칙을 배포하면 길드원끼리 실시간 난투가 가능합니다.";
}

function renderGameStatus() {
  if (!refs.gameStatus) return;
  const mode = state.gameClient?.enabled ? "online" : "local";
  refs.gameStatus.className = `game-status ${mode}`;
  refs.gameStatus.textContent = state.gameStatus || (mode === "online" ? "실시간 게임 서버 연결됨" : "데모 모드");
}

function renderGameSelected(member) {
  if (member && refs.gameSelectedName) refs.gameSelectedName.textContent = `${member.nickname || "-"} · ${member.job || "-"}`;
  if (refs.gameMass) refs.gameMass.textContent = `${Math.round(state.gameMass)}점`;
  if (refs.gameScore) refs.gameScore.textContent = numberFormat(Math.round(state.gameScore));
  if (refs.gameStart) refs.gameStart.textContent = state.gameJoined ? "캐릭터/팀 적용" : "게임 시작";
  if (refs.gameLeave) refs.gameLeave.disabled = !state.gameJoined;
  if (refs.gameReset) refs.gameReset.disabled = !state.gameJoined;
}

function renderGameArena() {
  if (!refs.gameFoodLayer || !refs.gamePlayerLayer) return;

  refs.gameFoodLayer.innerHTML = state.gameFood.map((food) => `
    <span class="game-food food-${escapeAttr(food.type)}" style="--x:${food.x}%; --y:${food.y}%; --s:${food.size}px"></span>
  `).join("");

  const players = getGamePlayersForRender();
  const activeCount = players.filter((item) => !item.isBot).length;
  if (refs.gameAliveCount) refs.gameAliveCount.textContent = `${activeCount}명`;
  if (refs.gameHint) refs.gameHint.textContent = state.gameJoined
    ? "게임장을 누르면 그 위치로 이동합니다. 방향키/버튼도 가능해요. 큰 상대에게 가까이 가면 위험합니다."
    : "게임 시작 후 먹이를 먹어 질량을 키우고, 작은 상대를 흡수하세요.";

  refs.gamePlayerLayer.innerHTML = players.map((player) => renderJellyPlayer(player)).join("");
  renderGameTarget();
}

function renderGameTarget() {
  if (!refs.gameTarget) return;
  if (!state.gameJoined || !state.gameTarget) {
    refs.gameTarget.classList.remove("active");
    return;
  }
  refs.gameTarget.classList.add("active");
  refs.gameTarget.style.left = `${clamp(state.gameTarget.x, 0, 100)}%`;
  refs.gameTarget.style.top = `${clamp(state.gameTarget.y, 0, 100)}%`;
}

function renderJellyPlayer(player) {
  const member = player.member || findMemberByName(player.guild, player.nickname) || {};
  const isMe = player.userId === state.gameUserId;
  const relation = getJellyRelationClass(player);
  const x = clamp(Number(player.x ?? 50), 3, 97);
  const y = clamp(Number(player.y ?? 52), 5, 95);
  const mass = Math.max(12, Number(player.mass || 18));
  const size = massToBlobSize(mass);
  const imageUrl = getCharacterImageUrl(member.nickname || player.nickname);
  const teamName = getGameTeamLabel(player.team);
  const shield = isMe && Date.now() < state.gameSafeUntil ? `<span class="jelly-shield">보호</span>` : "";

  return `
    <article class="jelly-player ${isMe ? "is-me" : ""} ${player.isBot ? "is-bot" : ""} ${relation} team-${escapeAttr(player.team || "solo")}" style="--x:${x}%; --y:${y}%; --size:${size}px; --z:${Math.round(size)}" title="${escapeAttr(player.nickname || "캐릭터")}">
      ${shield}
      <div class="jelly-blob">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(player.nickname || "캐릭터")}" loading="lazy" decoding="async" onerror="this.closest('.jelly-player').classList.add('is-missing'); this.remove();" />
        <span class="jelly-fallback">${escapeHtml((player.nickname || "?").slice(0, 1))}</span>
      </div>
      <strong>${escapeHtml(player.nickname || "-")}</strong>
      <small>${escapeHtml(teamName)} · ${Math.round(mass)}</small>
    </article>
  `;
}

function renderGameScoreboard() {
  if (!refs.gameScoreboard) return;
  const players = getGamePlayersForRender()
    .filter((player) => isRecentGamePlayer(player))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.mass || 0) - Number(a.mass || 0))
    .slice(0, 10);

  if (!players.length) {
    refs.gameScoreboard.innerHTML = `<div class="virtual-empty">아직 참여자가 없습니다.</div>`;
    return;
  }

  refs.gameScoreboard.innerHTML = players.map((player, index) => `
    <article class="score-row ${player.userId === state.gameUserId ? "is-me" : ""}">
      <span class="badge">${index + 1}</span>
      <div>
        <strong>${escapeHtml(player.nickname || "-")}</strong>
        <small>${escapeHtml(getGameTeamLabel(player.team))}${player.isBot ? " · 봇" : ""}</small>
      </div>
      <b>${numberFormat(Math.round(player.score || 0))}</b>
    </article>
  `).join("");
}

function renderGameEventLog() {
  if (!refs.gameEventLog) return;
  const events = [...(state.gameEvents || [])].slice(-18).reverse();

  if (!events.length) {
    refs.gameEventLog.innerHTML = `<div class="virtual-empty">아직 난투 기록이 없습니다.</div>`;
    return;
  }

  refs.gameEventLog.innerHTML = events.map((event) => `
    <article class="game-event ${event.type === "eat" ? "is-eat" : ""}">
      <span>${formatChatTime(event.createdAt)}</span>
      <p>${escapeHtml(event.text || "")}</p>
    </article>
  `).join("");
}

async function startJellyGame(keepPosition = false) {
  const member = getSelectedGameMember();
  if (!member) return;

  if (!keepPosition) {
    state.gamePosition = randomGamePosition();
    state.gameTarget = null;
    state.gameMass = 22;
    state.gameScore = 0;
    state.gameSafeUntil = Date.now() + 2500;
  }

  state.gameJoined = true;
  startGameLoop();
  await syncGamePlayer(true);
  void addGameEvent(`${member.nickname || "익명"} 입장! 먹이부터 챙기는 중`, "join");
  renderGamePage();
}

async function leaveJellyGame() {
  state.gameJoined = false;
  state.gameTarget = null;
  stopGameLoop();
  if (state.gameClient?.enabled) {
    await state.gameClient.leave(state.gameUserId);
  } else {
    state.gamePlayers = state.gamePlayers.filter((item) => item.userId !== state.gameUserId);
  }
  renderGamePage();
}

async function resetJellySelf() {
  if (!state.gameJoined) {
    await startJellyGame(false);
    return;
  }
  state.gamePosition = randomGamePosition();
  state.gameTarget = null;
  state.gameMass = 22;
  state.gameScore = Math.max(0, Math.floor(Number(state.gameScore || 0) * 0.35));
  state.gameSafeUntil = Date.now() + 2500;
  await syncGamePlayer(true);
  void addGameEvent(`${getSelectedGameMember()?.nickname || "익명"} 작게 리스폰`, "respawn");
  renderGamePage();
}

function handleGameArenaPointer(event) {
  if (!state.gameJoined || !refs.gameArena) return;
  refs.gameArena.focus({ preventScroll: true });
  const rect = refs.gameArena.getBoundingClientRect();
  state.gameTarget = {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 2, 98),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96)
  };
  renderGameTarget();
}

function handleGameKeydown(event) {
  if (state.page !== "game" || !state.gameJoined) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right"
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  nudgeJellyPlayer(direction);
}

function nudgeJellyPlayer(direction) {
  if (!state.gameJoined) return;
  const step = getJellyMoveStep();
  const next = { ...state.gamePosition };
  if (direction === "up") next.y -= step;
  if (direction === "down") next.y += step;
  if (direction === "left") next.x -= step;
  if (direction === "right") next.x += step;
  state.gameTarget = null;
  updateJellyPosition(next, true);
}

function startGameLoop() {
  if (state.gameLoopTimer) return;
  state.gameLoopTimer = window.setInterval(tickJellyGame, 90);
}

function stopGameLoop() {
  if (!state.gameLoopTimer) return;
  window.clearInterval(state.gameLoopTimer);
  state.gameLoopTimer = null;
}

function tickJellyGame() {
  if (!state.gameJoined) return;
  moveGameBots();
  moveJellyTowardTarget();
  eatNearbyFood();
  checkJellyCollisions();
  void syncGamePlayer(false);
  if (state.page === "game") {
    renderGameArena();
    renderGameScoreboard();
    renderGameSelected(getSelectedGameMember());
  }
}

function moveJellyTowardTarget() {
  if (!state.gameTarget) return;
  const dx = state.gameTarget.x - state.gamePosition.x;
  const dy = state.gameTarget.y - state.gamePosition.y;
  const distance = Math.hypot(dx, dy);
  const step = getJellyMoveStep();
  if (distance <= step) {
    state.gamePosition = { ...state.gameTarget };
    state.gameTarget = null;
    return;
  }
  updateJellyPosition({
    x: state.gamePosition.x + (dx / distance) * step,
    y: state.gamePosition.y + (dy / distance) * step
  }, false);
}

function updateJellyPosition(position, renderNow) {
  state.gamePosition = {
    x: clamp(Number(position.x), 2, 98),
    y: clamp(Number(position.y), 4, 96)
  };
  if (renderNow && state.page === "game") renderGameArena();
}

function eatNearbyFood() {
  let ate = 0;
  const radius = massToArenaRadius(state.gameMass);
  state.gameFood = state.gameFood.map((food) => {
    const distance = Math.hypot(food.x - state.gamePosition.x, food.y - state.gamePosition.y);
    if (distance > radius * 0.82 + 1.2) return food;
    ate += Number(food.value || 1);
    return makeGameFood(food.id);
  });

  if (!ate) return;
  state.gameMass = clamp(state.gameMass + ate * 0.9, 14, 260);
  state.gameScore += ate * 12;
}

function checkJellyCollisions() {
  if (Date.now() < state.gameSafeUntil) return;
  const me = makeGamePlayer(getSelectedGameMember());
  const players = getGamePlayersForRender();
  for (const other of players) {
    if (!other || other.userId === state.gameUserId) continue;
    if (!canJellyPlayersFight(me, other)) continue;
    const distance = Math.hypot(Number(other.x || 50) - state.gamePosition.x, Number(other.y || 50) - state.gamePosition.y);
    const myRadius = massToArenaRadius(state.gameMass);
    const otherRadius = massToArenaRadius(other.mass || 18);

    if (state.gameMass > Number(other.mass || 18) * 1.15 && distance < myRadius * 0.9) {
      eatJellyPlayer(other);
      return;
    }

    if (Number(other.mass || 18) > state.gameMass * 1.15 && distance < otherRadius * 0.86) {
      getEatenByJelly(other);
      return;
    }
  }
}

function eatJellyPlayer(other) {
  const member = getSelectedGameMember();
  const gain = Math.max(4, Math.round(Number(other.mass || 18) * 0.42));
  state.gameMass = clamp(state.gameMass + gain, 18, 280);
  state.gameScore += Math.max(60, Math.round(Number(other.mass || 18) * 18));
  const text = `${member?.nickname || "익명"} → ${other.nickname || "상대"} 흡수! +${gain} 질량`;
  void addGameEvent(text, "eat");

  if (other.isBot) {
    respawnGameBot(other.userId);
  } else if (state.gameClient?.enabled) {
    const respawn = randomGamePosition();
    void state.gameClient.markPlayerEaten(other.userId, {
      x: respawn.x,
      y: respawn.y,
      mass: 18,
      score: Math.max(0, Math.floor(Number(other.score || 0) * 0.45)),
      eatenAt: new Date().toISOString(),
      lastEvent: `${member?.nickname || "누군가"}에게 흡수됨`
    });
  }

  void syncGamePlayer(true);
}

function getEatenByJelly(other) {
  const member = getSelectedGameMember();
  const text = `${other.nickname || "상대"} → ${member?.nickname || "익명"} 흡수! 도망 실패`;
  void addGameEvent(text, "eat");
  state.gamePosition = randomGamePosition();
  state.gameTarget = null;
  state.gameMass = 18;
  state.gameScore = Math.max(0, Math.floor(Number(state.gameScore || 0) * 0.45));
  state.gameSafeUntil = Date.now() + 2800;
  void syncGamePlayer(true);
}

function moveGameBots() {
  if (!state.gameBots.length) return;
  state.gameBots = state.gameBots.map((bot) => {
    let vx = Number(bot.vx || 0);
    let vy = Number(bot.vy || 0);
    if (Math.random() < 0.055) {
      vx = (Math.random() - 0.5) * 1.8;
      vy = (Math.random() - 0.5) * 1.8;
    }
    let x = Number(bot.x || 50) + vx;
    let y = Number(bot.y || 50) + vy;
    if (x < 5 || x > 95) vx *= -1;
    if (y < 8 || y > 92) vy *= -1;
    x = clamp(x, 5, 95);
    y = clamp(y, 8, 92);
    return { ...bot, x, y, vx, vy };
  });
}

function respawnGameBot(userId) {
  state.gameBots = state.gameBots.map((bot) => {
    if (bot.userId !== userId) return bot;
    const next = randomGamePosition();
    return {
      ...bot,
      x: next.x,
      y: next.y,
      mass: 16 + Math.random() * 20,
      score: Math.max(0, Math.floor(Number(bot.score || 0) * 0.35)),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5
    };
  });
}

async function syncGamePlayer(force = false) {
  if (!state.gameJoined) return;
  const now = Date.now();
  if (!force && now - state.gameLastSyncAt < 240) return;
  state.gameLastSyncAt = now;

  const player = makeGamePlayer(getSelectedGameMember());
  if (state.gameClient?.enabled) {
    await state.gameClient.upsertPlayer(player);
  } else {
    upsertLocalGamePlayer(player);
  }
}

function syncLocalJellyFromServer(players) {
  if (!state.gameJoined) return;
  const me = players.find((player) => player.userId === state.gameUserId);
  if (!me) return;
  if (me.eatenAt && me.eatenAt !== state.gameLastEatenAt) {
    state.gameLastEatenAt = me.eatenAt;
    state.gamePosition = { x: clamp(me.x, 2, 98), y: clamp(me.y, 4, 96) };
    state.gameTarget = null;
    state.gameMass = Math.max(18, Number(me.mass || 18));
    state.gameScore = Math.max(0, Number(me.score || 0));
    state.gameSafeUntil = Date.now() + 2800;
    return;
  }

  if (Number(me.mass || 0) > state.gameMass + 2) state.gameMass = Number(me.mass);
  if (Number(me.score || 0) > state.gameScore) state.gameScore = Number(me.score);
}

function makeGamePlayer(member) {
  return {
    userId: state.gameUserId,
    memberKey: virtualMemberKey(member),
    nickname: member?.nickname || "익명",
    guild: member?.guild || "-",
    job: member?.job || "-",
    team: state.gameTeam || "solo",
    x: clamp(Number(state.gamePosition.x), 2, 98),
    y: clamp(Number(state.gamePosition.y), 4, 96),
    mass: Math.round(Number(state.gameMass || 18)),
    score: Math.round(Number(state.gameScore || 0)),
    safeUntil: state.gameSafeUntil ? new Date(state.gameSafeUntil).toISOString() : "",
    lastSeen: new Date().toISOString()
  };
}

function upsertLocalGamePlayer(player) {
  const byId = new Map((state.gamePlayers || []).map((item) => [item.userId, item]));
  byId.set(player.userId, player);
  state.gamePlayers = [...byId.values()];
}

function getGamePlayersForRender() {
  const map = new Map();
  const membersByKey = new Map((state.data?.members || []).map((member) => [virtualMemberKey(member), member]));

  for (const player of state.gamePlayers || []) {
    if (!isRecentGamePlayer(player)) continue;
    const member = membersByKey.get(player.memberKey) || findMemberByName(player.guild, player.nickname);
    map.set(player.userId, { ...player, member });
  }

  if (state.gameJoined) {
    map.set(state.gameUserId, makeGamePlayer(getSelectedGameMember()));
  }

  const realCount = [...map.values()].filter((item) => !item.isBot).length;
  if (!state.gameClient?.enabled || realCount < 4) {
    for (const bot of state.gameBots) {
      if (!map.has(bot.userId)) map.set(bot.userId, bot);
    }
  }

  return [...map.values()].sort((a, b) => Number(a.mass || 0) - Number(b.mass || 0));
}

function getJellyRelationClass(player) {
  if (!state.gameJoined || player.userId === state.gameUserId) return "";
  const me = makeGamePlayer(getSelectedGameMember());
  if (!canJellyPlayersFight(me, player)) return "is-team";
  if (state.gameMass > Number(player.mass || 18) * 1.15) return "can-eat";
  if (Number(player.mass || 18) > state.gameMass * 1.15) return "is-danger";
  return "is-even";
}

function canJellyPlayersFight(a, b) {
  const teamA = a?.team || "solo";
  const teamB = b?.team || "solo";
  if (teamA === "solo" || teamB === "solo") return true;
  return teamA !== teamB;
}

function getSelectedGameMember() {
  const members = state.data?.members || [];
  return members.find((member) => virtualMemberKey(member) === state.gameSelectedKey) || members[0] || null;
}

function createGameFood(count) {
  return Array.from({ length: count }, (_, index) => makeGameFood(`food-${index}`));
}

function makeGameFood(id) {
  const roll = Math.random();
  const type = roll > 0.9 ? "gold" : roll > 0.68 ? "mint" : roll > 0.42 ? "blue" : "pink";
  const value = type === "gold" ? 4 : type === "mint" ? 2 : 1;
  return {
    id,
    type,
    value,
    size: type === "gold" ? 14 : type === "mint" ? 11 : 8,
    x: Math.round((4 + Math.random() * 92) * 10) / 10,
    y: Math.round((6 + Math.random() * 88) * 10) / 10
  };
}

function randomGamePosition() {
  return {
    x: 8 + Math.random() * 84,
    y: 10 + Math.random() * 80
  };
}

function getJellyMoveStep() {
  return clamp(3.35 - Math.sqrt(Number(state.gameMass || 18)) / 12, 0.85, 2.65);
}

function massToBlobSize(mass) {
  return clamp(30 + Math.sqrt(Number(mass || 18)) * 10.8, 48, 152);
}

function massToArenaRadius(mass) {
  return clamp(2.2 + Math.sqrt(Number(mass || 18)) * 0.32, 3.1, 11.8);
}

function isRecentGamePlayer(player) {
  if (player.isBot) return true;
  const lastSeen = new Date(player.lastSeen || player.updatedAt || Date.now()).getTime();
  if (!Number.isFinite(lastSeen)) return true;
  return Date.now() - lastSeen < 1000 * 60 * 20;
}

async function addGameEvent(text, type = "info") {
  const member = getSelectedGameMember();
  const event = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: state.gameUserId,
    nickname: member?.nickname || "익명",
    guild: member?.guild || "-",
    type,
    text: String(text || "").slice(0, 160),
    createdAt: new Date().toISOString()
  };

  if (state.gameClient?.enabled) {
    await state.gameClient.addEvent(event);
    return;
  }

  state.gameEvents = [...state.gameEvents, event].slice(-80);
  try {
    localStorage.setItem(LOCAL_GAME_EVENTS_KEY, JSON.stringify({ events: state.gameEvents }));
  } catch {}
  if (state.page === "game") renderGameEventLog();
}

function readLocalGameEvents() {
  try {
    const raw = localStorage.getItem(LOCAL_GAME_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function getOrCreateGameUserId() {
  try {
    const existing = localStorage.getItem(LOCAL_GAME_KEY);
    if (existing) return existing;
    const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(LOCAL_GAME_KEY, id);
    return id;
  } catch {
    return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function getGameTeamLabel(team) {
  switch (team) {
    case "blue": return "파랑팀";
    case "violet": return "보라팀";
    case "green": return "초록팀";
    case "orange": return "주황팀";
    default: return "개인전";
  }
}

function getGuildFilteredMembers() {
  return [...(state.data?.members || [])]
    .filter((member) => state.guildFilter === "all" || member.guild === state.guildFilter);
}

function normalizeMemberServerRanks(members) {
  return (Array.isArray(members) ? members : []).map((member) => {
    const hasServerScope = member.rankScope === "server"
      || member.serverPowerRank != null
      || member.serverTobeolRank != null;
    const serverPowerRank = normalizePositiveRank(member.serverPowerRank ?? (hasServerScope ? member.powerRank : null));
    const hasRaidScore = Number(member.sourceTobeolValue ?? member.tobeolValue ?? 0) > 0;
    const serverTobeolRank = hasRaidScore
      ? normalizePositiveRank(member.serverTobeolRank ?? (hasServerScope ? member.tobeolRank : null))
      : null;
    const serverRaidRankAdvantage = serverPowerRank != null && serverTobeolRank != null
      ? serverPowerRank - serverTobeolRank
      : null;
    return {
      ...member,
      rankScope: "server",
      serverPowerRank,
      serverTobeolRank,
      serverRaidRankAdvantage,
      powerRank: serverPowerRank,
      tobeolRank: serverTobeolRank,
      raidRankAdvantage: serverRaidRankAdvantage
    };
  });
}

function normalizePositiveRank(value) {
  const rank = Number(value);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}

function getFilteredMembers() {
  const keyword = state.keyword.toLowerCase();
  return getGuildFilteredMembers()
    .filter((member) => {
      if (!keyword) return true;
      return `${member.guild} ${member.nickname} ${member.job}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => getSortValue(b, state.sort) - getSortValue(a, state.sort));
}

function getSortValue(member, sort) {
  switch (sort) {
    case "powerGrowth": return Number(member.powerGrowthValue ?? -Infinity);
    case "power": return Number(member.powerValue || 0);
    case "tobeol": return Number(member.tobeolValue || 0);
    case "lastWeekTobeol": return Number(member.lastWeekTobeolValue ?? -Infinity);
    case "level": return Number(member.level || 0);
    case "rank": return -Number(member.rank || 0);
    default: return 0;
  }
}

function getTableSpec(tab) {
  if (tab === "tobeol") {
    return {
      title: "토벌전 주차별 기록",
      desc: "길드 상세 data-gb 원본과 월요일 확정 이력을 분리한 점수입니다.",
      columns: [
        col("#", (_, index) => `<span class="badge">${index + 1}</span>`),
        col("길드", renderGuild),
        col("닉네임", renderName),
        col("레벨", (member) => `Lv.${member.level}`),
        col("MGF 원본 점수", (member) => formatKoreanPower(member.sourceTobeolValue ?? member.tobeolValue)),
        col("지난주 기록", (member) => member.lastWeekTobeolText || "-"),
        col("상태", (member) => member.lastWeekTobeolValue == null ? `<span class="muted">이력 없음</span>` : `<span class="good">${member.lastWeekTobeolIsFinal ? "확정" : "마지막 수집"}</span>`)
      ]
    };
  }

  return {
    title: "전투력 성장",
    desc: "길드원 전투력 수집 데이터 기준입니다.",
    columns: [
      col("#", (_, index) => `<span class="badge">${index + 1}</span>`),
      col("길드", renderGuild),
      col("길드순위", (member) => `<span class="badge">${member.rank}</span>`),
      col("닉네임", renderName),
      col("레벨", (member) => `Lv.${member.level}`),
      col("현재 전투력", (member) => member.powerText || formatKoreanPower(member.powerValue)),
      col("7일 전 전투력", (member) => member.previousPowerText || "-"),
      col("성장", (member) => renderGrowth(member.powerGrowthValue, member.powerGrowthText)),
      col("성장률", (member) => renderRate(member.powerGrowthRate))
    ]
  };
}

function col(label, render) {
  return { label, render };
}

function renderGuild(member) {
  return `<span class="guild-pill">${escapeHtml(member.guild || "-")}</span>`;
}

function renderName(member) {
  const manualBadge = member.isManual ? `<span class="manual-badge">수정</span>` : "";
  const statusBadge = renderMemberStatusBadge(member);
  return `
    <div class="nickname">${escapeHtml(member.nickname)} ${manualBadge} ${statusBadge}</div>
    <div class="muted">${escapeHtml(member.job || "-")}</div>
  `;
}

function renderMemberStatusBadge(member) {
  if (member?.memberStatus === "new") return `<span class="status-badge new">신규</span>`;
  if (member?.memberStatus === "departed") return `<span class="status-badge departed">탈퇴</span>`;
  return "";
}

function getMemberChangeSummary(data, guildFilter) {
  const changes = data?.memberChanges || {};
  const guilds = guildFilter && guildFilter !== "all" ? [guildFilter] : getGuildsFromData(data);
  return guilds.reduce((acc, guild) => {
    const item = changes[guild] || {};
    acc.newCount += Number(item.newCount || 0);
    acc.departedCount += Number(item.departedCount || 0);
    return acc;
  }, { newCount: 0, departedCount: 0 });
}

function renderGrowth(value, text) {
  if (value == null) return `<span class="muted">비교 데이터 없음</span>`;
  if (Number(value) > 0) return `<span class="good">${escapeHtml(text)}</span>`;
  if (Number(value) < 0) return `<span class="bad">${escapeHtml(text)}</span>`;
  return `<span class="muted">0</span>`;
}

function renderRate(value) {
  if (value == null) return `<span class="muted">-</span>`;
  const className = Number(value) >= 0 ? "good" : "bad";
  return `<span class="${className}">${numberFormat(value)}%</span>`;
}

function openEditor() {
  if (!state.rawData) return;
  refs.editDialog.showModal();
  refs.passwordMessage && (refs.passwordMessage.textContent = "");
  refs.editorMessage.textContent = "";
  state.editorUnlocked = true;
  showEditorView();
}

function closeEditor() {
  refs.editDialog.close();
}

function unlockEditor() {
  if (!refs.editorPassword) return;
  if (refs.editorPassword.value !== EDIT_PASSWORD) {
    refs.passwordMessage.textContent = "비밀번호가 맞지 않습니다.";
    refs.editorPassword.select();
    return;
  }

  state.editorUnlocked = true;
  showEditorView();
}

function showEditorView() {
  refs.passwordView?.classList.add("hidden");
  refs.editorView.classList.remove("hidden");
  renderEditorRows();
}

function renderEditorRows() {
  const baseMembers = state.rawData?.members || [];
  const manual = mergeManualObjects([
    state.manualFromFile,
    state.localManual,
    state.serverManual
  ], state.rawData?.capturedDate);
  const manualMap = new Map(manual.items.map((item) => [manualKey(item), item]));

  refs.editorBody.innerHTML = baseMembers.map((member, index) => {
    const override = manualMap.get(manualKey(member)) || {};
    const powerValue = valueFromManual(override, "power", member.powerValue);
    const previousPowerValue = valueFromManual(override, "previousPower", member.previousPowerValue);
    const tobeolValue = valueFromManual(override, "tobeol", member.tobeolValue);
    const previousTobeolValue = valueFromManual(override, "previousTobeol", member.previousTobeolValue);

    return `
      <tr data-index="${index}">
        <td>${escapeHtml(member.guild || "-")}</td>
        <td>
          <strong>${escapeHtml(member.nickname)}</strong>
          <div class="muted">${escapeHtml(member.job || "-")} · Lv.${member.level || "-"}</div>
        </td>
        <td>
          <input data-field="powerText" value="${escapeAttr(formatEditablePower(powerValue))}" placeholder="예: 1조 2345억" />
        </td>
        <td>
          <input data-field="previousPowerText" value="${escapeAttr(formatEditablePower(previousPowerValue))}" placeholder="예: 1조 2345억" />
        </td>
        <td>
          <input data-field="tobeolText" value="${escapeAttr(formatEditablePower(tobeolValue))}" placeholder="예: 987억" />
        </td>
        <td>
          <input data-field="previousTobeolText" value="${escapeAttr(formatEditablePower(previousTobeolValue))}" placeholder="예: 987억" />
        </td>
        <td>
          <input data-field="memo" value="${escapeAttr(override.memo || "")}" placeholder="선택" />
        </td>
      </tr>
    `;
  }).join("");
}

function collectManualFromEditor() {
  const date = state.rawData?.capturedDate || todayString();
  const comparisonTargetDate = state.rawData?.comparisonTargetDate || "";
  const rows = [...refs.editorBody.querySelectorAll("tr")];
  const baseMembers = state.rawData?.members || [];
  const items = [];

  for (const row of rows) {
    const index = Number(row.dataset.index);
    const member = baseMembers[index];
    if (!member) continue;

    const powerText = row.querySelector('[data-field="powerText"]')?.value.trim() || "";
    const previousPowerText = row.querySelector('[data-field="previousPowerText"]')?.value.trim() || "";
    const tobeolText = row.querySelector('[data-field="tobeolText"]')?.value.trim() || "";
    const previousTobeolText = row.querySelector('[data-field="previousTobeolText"]')?.value.trim() || "";
    const memo = row.querySelector('[data-field="memo"]')?.value.trim() || "";

    const powerValue = parseEditablePowerValue(powerText);
    const previousPowerValue = parseEditablePowerValue(previousPowerText);
    const tobeolValue = parseEditablePowerValue(tobeolText);
    const previousTobeolValue = parseEditablePowerValue(previousTobeolText);

    const basePower = nullableNumber(member.powerValue);
    const basePreviousPower = nullableNumber(member.previousPowerValue);
    const baseTobeol = nullableNumber(member.tobeolValue);
    const basePreviousTobeol = nullableNumber(member.previousTobeolValue);

    const powerChanged = !sameNullableNumber(powerValue, basePower);
    const previousPowerChanged = !sameNullableNumber(previousPowerValue, basePreviousPower);
    const tobeolChanged = !sameNullableNumber(tobeolValue, baseTobeol);
    const previousTobeolChanged = !sameNullableNumber(previousTobeolValue, basePreviousTobeol);

    if (!powerChanged && !previousPowerChanged && !tobeolChanged && !previousTobeolChanged && !memo) continue;

    const item = {
      guild: member.guild,
      nickname: member.nickname
    };

    if (powerChanged) {
      item.powerText = powerText;
      item.powerValue = powerValue;
    }

    if (previousPowerChanged) {
      item.previousPowerText = previousPowerText;
      item.previousPowerValue = previousPowerValue;
    }

    if (tobeolChanged) {
      item.tobeolText = tobeolText;
      item.tobeolValue = tobeolValue;
    }

    if (previousTobeolChanged) {
      item.previousTobeolText = previousTobeolText;
      item.previousTobeolValue = previousTobeolValue;
    }

    if (memo) item.memo = memo;
    items.push(item);
  }

  return { date, comparisonTargetDate, items };
}

async function applyManualFromEditor() {
  const manual = collectManualFromEditor();
  refs.applyManual.disabled = true;
  refs.editorMessage.textContent = "수정 내용을 저장 중입니다...";

  try {
    if (state.manualClient?.enabled) {
      await state.manualClient.saveManual(manual);
      state.serverManual = manual;
      refs.editorMessage.textContent = `수정 내용 ${manual.items.length}건을 저장했습니다.`;
    } else {
      state.localManual = manual;
      localStorage.setItem(LOCAL_MANUAL_KEY, JSON.stringify(manual));
      refs.editorMessage.textContent = `수정 내용 ${manual.items.length}건을 이 브라우저에 저장했습니다.`;
    }

    rebuildData();
    initGuildFilter();
    initVisualFilters();
    initVirtualPicker();
    initGamePicker();
    render();
    if (state.page === "characters") renderCharactersPage();
    if (state.page === "virtual") renderVirtualPage();
    if (state.page === "game") renderGamePage();
  } catch (error) {
    refs.editorMessage.textContent = `저장 실패: ${error.message}`;
  } finally {
    refs.applyManual.disabled = false;
  }
}

async function clearLocalManual() {
  const emptyManual = {
    date: state.rawData?.capturedDate || todayString(),
    comparisonTargetDate: state.rawData?.comparisonTargetDate || "",
    items: []
  };

  if (!confirm("저장된 수정값을 초기화할까요?")) return;

  refs.clearManual.disabled = true;
  try {
    if (state.manualClient?.enabled) {
      await state.manualClient.saveManual(emptyManual);
      state.serverManual = emptyManual;
      refs.editorMessage.textContent = "저장된 수정값을 초기화했습니다.";
    } else {
      localStorage.removeItem(LOCAL_MANUAL_KEY);
      state.localManual = null;
      refs.editorMessage.textContent = "이 브라우저의 수정값을 초기화했습니다.";
    }

    rebuildData();
    render();
    if (state.page === "characters") renderCharactersPage();
    if (state.page === "virtual") renderVirtualPage();
    if (state.page === "game") renderGamePage();
    renderEditorRows();
  } catch (error) {
    refs.editorMessage.textContent = `초기화 실패: ${error.message}`;
  } finally {
    refs.clearManual.disabled = false;
  }
}



function initFirebaseBoard() {
  state.firebaseBoard = createGuideBoardClient({
    config: FIREBASE_CONFIG,
    collectionName: FIREBASE_COLLECTION,
    onPosts: (posts) => {
      state.firebasePosts = posts;
      state.boardLoaded = true;
      rebuildPosts();
      if (state.page === "guide") renderPosts();
    },
    onError: (error) => {
      console.error(error);
      state.boardLoaded = true;
      syncBoardUi("error", `게시판 연결 실패: ${error.message}`);
      if (state.page === "guide") renderPosts();
    },
    onStatus: syncBoardUi
  });

  if (!state.firebaseBoard.enabled) {
    state.boardMode = "local";
    state.boardLoaded = true;
  }
}

function initManualClient() {
  const capturedDate = state.rawData?.capturedDate || todayString();
  const documentId = `weekly-${capturedDate}`;

  state.manualClient = createManualOverrideClient({
    config: FIREBASE_CONFIG,
    collectionName: FIREBASE_MANUAL_COLLECTION,
    documentId,
    onManual: (manual) => {
      state.serverManual = manual;
      state.manualLoaded = true;
      rebuildData();
      if (state.page === "dashboard") {
        render();
        if (state.editorUnlocked && refs.editDialog.open) renderEditorRows();
      }
      if (state.page === "characters") {
        renderCharactersPage();
      }
      if (state.page === "virtual") {
        renderVirtualPage();
      }
    },
    onError: (error) => {
      console.error(error);
      state.manualLoaded = true;
    }
  });

  if (!state.manualClient.enabled) {
    state.manualLoaded = true;
  }
}


function syncBoardUi(status, message) {
  if (refs.boardStatus) {
    const mode = state.firebaseBoard?.enabled ? "online" : "local";
    refs.boardStatus.className = `board-status ${status || mode}`;
    refs.boardStatus.textContent = message || (mode === "online" ? "실시간 게시판 연결됨" : "임시 저장 모드");
  }

  if (refs.firebaseSetupNotice) {
    refs.firebaseSetupNotice.hidden = Boolean(state.firebaseBoard?.enabled);
  }

  if (refs.importPosts) {
    refs.importPosts.closest("label")?.classList.toggle("hidden", Boolean(state.firebaseBoard?.enabled));
  }

  if (refs.clearLocalPosts) {
    refs.clearLocalPosts.textContent = state.firebaseBoard?.enabled ? "" : "";
    refs.clearLocalPosts.disabled = Boolean(state.firebaseBoard?.enabled);
  }
}

function openPostEditor() {
  refs.postDialog.showModal();
  refs.postMessage.textContent = "";
  setTimeout(() => refs.postPassword.focus(), 0);
}

function closePostEditor() {
  refs.postDialog.close();
}

async function savePostFromForm() {
  if (refs.postPassword.value !== EDIT_PASSWORD) {
    refs.postMessage.textContent = "비밀번호가 맞지 않습니다.";
    refs.postPassword.select();
    return;
  }

  const title = refs.postTitle.value.trim();
  const content = refs.postContent.value.trim();
  const author = refs.postAuthor.value.trim() || "익명";
  const category = refs.postCategory.value || "기타";

  if (!title || !content) {
    refs.postMessage.textContent = "제목과 내용을 입력해주세요.";
    return;
  }

  const post = {
    id: `post-${Date.now()}`,
    title,
    content,
    author,
    category,
    createdAt: new Date().toISOString()
  };

  refs.savePost.disabled = true;
  refs.postMessage.textContent = "공략글 저장 중입니다...";

  try {
    if (state.firebaseBoard?.enabled) {
      await state.firebaseBoard.addPost(post);
      refs.postMessage.textContent = "공략글을 저장했습니다.";
    } else {
      const localPosts = normalizePosts(state.localPosts);
      state.localPosts = [post, ...localPosts];
      localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify({ posts: state.localPosts }));
      rebuildPosts();
      renderPosts();
      refs.postMessage.textContent = "이 브라우저에 임시 저장했습니다.";
    }
    resetPostForm(false);
  } catch (error) {
    refs.postMessage.textContent = `저장 실패: ${error.message}`;
  } finally {
    refs.savePost.disabled = false;
  }
}

function resetPostForm(clearMessage = true) {
  refs.postPassword.value = "";
  refs.postTitle.value = "";
  refs.postContent.value = "";
  refs.postAuthor.value = "";
  refs.postCategory.value = "토벌전";
  if (clearMessage) refs.postMessage.textContent = "";
}

function rebuildPosts() {
  const byId = new Map();
  const sources = state.firebaseBoard?.enabled
    ? normalizePosts(state.firebasePosts)
    : [...normalizePosts(state.postsFromFile), ...normalizePosts(state.localPosts)];

  for (const post of sources) {
    if (!post.title || !post.content) continue;
    const id = post.id || `${post.title}-${post.createdAt || ""}`;
    byId.set(id, { ...post, id });
  }

  state.posts = [...byId.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  syncBoardUi();
}

function renderPosts() {
  if (!refs.postList) return;

  if (state.firebaseBoard?.enabled && !state.boardLoaded) {
    refs.postList.innerHTML = `
      <div class="empty board-empty">
        게시판 서버에서 공략글을 불러오는 중입니다...
      </div>
    `;
    return;
  }

  if (!state.posts.length) {
    refs.postList.innerHTML = `
      <div class="empty board-empty">
        아직 등록된 공략이 없습니다.<br />
        <strong>공략 작성하기</strong> 버튼으로 첫 글을 작성해보세요.
      </div>
    `;
    return;
  }

  refs.postList.innerHTML = state.posts.map((post) => `
    <article class="post-card">
      <div class="post-meta">
        <span class="guild-pill">${escapeHtml(post.category || "기타")}</span>
        <span>${escapeHtml(post.author || "익명")}</span>
        <span>${formatPostDate(post.createdAt)}</span>
        ${post.source === "firebase" ? `<span class="server-badge">실시간</span>` : `<span class="server-badge local">임시</span>`}
      </div>
      <div class="post-title-row">
        <h3>${escapeHtml(post.title)}</h3>
        <button class="text-danger-btn" data-delete-post-id="${escapeAttr(post.id)}" type="button">삭제</button>
      </div>
      <p>${escapeHtml(post.content).replace(/\n/g, "<br />")}</p>
    </article>
  `).join("");
}

function downloadPosts() {
  const value = {
    updatedAt: new Date().toISOString(),
    posts: state.posts
  };
  downloadJson("guide-posts.json", value);
}

async function importPostsFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    state.localPosts = normalizePosts(JSON.parse(text));
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify({ posts: state.localPosts }));
    rebuildPosts();
    renderPosts();
  } catch (error) {
    alert(`guide-posts.json 불러오기 실패: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function clearLocalPosts() {
  if (state.firebaseBoard?.enabled) return;
  if (!confirm("이 브라우저에 저장된 공략 임시글을 초기화할까요?")) return;
  localStorage.removeItem(LOCAL_POSTS_KEY);
  state.localPosts = null;
  rebuildPosts();
  renderPosts();
}


async function handlePostListClick(event) {
  const button = event.target.closest("[data-delete-post-id]");
  if (!button) return;

  const id = button.dataset.deletePostId;
  const password = prompt("삭제 비밀번호를 입력하세요.");
  if (password !== EDIT_PASSWORD) {
    alert("비밀번호가 맞지 않습니다.");
    return;
  }

  if (!confirm("이 공략글을 삭제할까요?")) return;

  try {
    button.disabled = true;
    if (state.firebaseBoard?.enabled) {
      await state.firebaseBoard.deletePost(id);
    } else {
      state.localPosts = normalizePosts(state.localPosts).filter((post) => post.id !== id);
      localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify({ posts: state.localPosts }));
      rebuildPosts();
      renderPosts();
    }
  } catch (error) {
    alert(`삭제 실패: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function readLocalPosts() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    return raw ? normalizePosts(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function normalizePosts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.posts)) return value.posts;
  return [];
}

function formatPostDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function readLocalManual() {
  try {
    const raw = localStorage.getItem(LOCAL_MANUAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function mergeManualObjects(manualObjects, capturedDate) {
  const map = new Map();

  for (const manual of manualObjects) {
    if (!manual || !Array.isArray(manual.items)) continue;
    if (manual.date && capturedDate && manual.date !== capturedDate) continue;

    for (const item of manual.items) {
      if (!item?.guild || !item?.nickname) continue;
      map.set(manualKey(item), {
        ...(map.get(manualKey(item)) || {}),
        ...item
      });
    }
  }

  return {
    date: capturedDate || "",
    items: [...map.values()]
  };
}

function applyManualOverrides(data, manual) {
  if (!Array.isArray(data.members) || !manual?.items?.length) return;

  const manualMap = new Map(manual.items.map((item) => [manualKey(item), item]));

  data.members = data.members.map((member) => {
    const override = manualMap.get(manualKey(member));
    if (!override) return member;

    const hasPower = hasManualValue(override, "power");
    const hasPreviousPower = hasManualValue(override, "previousPower");
    const hasTobeol = hasManualValue(override, "tobeol");
    const hasPreviousTobeol = hasManualValue(override, "previousTobeol");
    const next = {
      ...member,
      isManual: Boolean(hasPower || hasPreviousPower || hasTobeol || hasPreviousTobeol || override.memo),
      manualMemo: override.memo || ""
    };

    if (hasPower) {
      next.powerValue = valueFromManual(override, "power", next.powerValue);
      next.powerText = next.powerValue == null ? "" : formatKoreanPower(next.powerValue);
      next.powerRaw = next.powerValue == null ? "" : String(Math.max(0, Math.trunc(next.powerValue)));
    }

    if (hasPreviousPower) {
      next.previousPowerValue = valueFromManual(override, "previousPower", next.previousPowerValue);
      next.previousPowerText = next.previousPowerValue == null ? "" : formatKoreanPower(next.previousPowerValue);
    }

    if (hasPower || hasPreviousPower) {
      next.powerGrowthValue = next.previousPowerValue == null ? null : Number(next.powerValue || 0) - Number(next.previousPowerValue || 0);
      next.powerGrowthText = next.powerGrowthValue == null ? null : formatSignedKoreanPower(next.powerGrowthValue);
      next.powerGrowthRate = calcGrowthRate(next.powerValue, next.previousPowerValue);
    }

    if (hasTobeol) {
      next.tobeolValue = valueFromManual(override, "tobeol", next.tobeolValue);
      next.tobeolText = next.tobeolValue == null ? "" : formatKoreanPower(next.tobeolValue);
      next.sourceTobeolValue = next.tobeolValue;
      next.sourceTobeolText = next.tobeolText;
      next.sourceTobeolRaw = next.tobeolValue == null ? "" : String(Math.max(0, Math.trunc(next.tobeolValue)));
      next.tobeolRaw = next.sourceTobeolRaw;
      if (next.currentWeekTobeolValue != null) {
        next.currentWeekTobeolValue = next.tobeolValue;
        next.currentWeekTobeolText = next.tobeolText;
      }
    }

    if (hasPreviousTobeol) {
      next.previousTobeolValue = valueFromManual(override, "previousTobeol", next.previousTobeolValue);
      next.previousTobeolText = next.previousTobeolValue == null ? "" : formatKoreanPower(next.previousTobeolValue);
      next.lastWeekTobeolValue = next.previousTobeolValue;
      next.lastWeekTobeolText = next.previousTobeolText;
    }

    if (hasTobeol || hasPreviousTobeol) {
      next.tobeolGrowthValue = null;
      next.tobeolGrowthText = null;
      next.tobeolGrowthRate = null;
    }

    return next;
  });
}

function hasManualValue(item, prefix) {
  return item?.[`${prefix}Value`] !== undefined || item?.[`${prefix}Text`] !== undefined;
}


function valueFromManual(item, prefix, fallback) {
  const valueKey = `${prefix}Value`;
  const textKey = `${prefix}Text`;

  if (item[valueKey] !== undefined && item[valueKey] !== "") {
    return item[valueKey] == null ? null : Number(item[valueKey] || 0);
  }

  if (item[textKey] !== undefined) {
    const text = String(item[textKey] || "").trim();
    return text ? parseKoreanPowerValue(text) : null;
  }

  return fallback == null ? null : Number(fallback || 0);
}

function parseEditablePowerValue(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  return parseKoreanPowerValue(source);
}

function formatEditablePower(value) {
  return value == null ? "" : formatKoreanPower(value);
}

function nullableNumber(value) {
  return value == null ? null : Number(value || 0);
}

function sameNullableNumber(a, b) {
  if (a == null && b == null) return true;
  return Number(a || 0) === Number(b || 0);
}


function manualKey(item) {
  return `${String(item.guild || "").trim()}::${String(item.nickname || "").trim()}`;
}

function downloadJson(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSummary(members) {
  return {
    guildCount: new Set(members.map((member) => member.guild).filter(Boolean)).size,
    memberCount: members.length,
    totalPowerValue: members.reduce((sum, member) => sum + Number(member.powerValue || 0), 0),
    totalTobeolValue: members.reduce((sum, member) => sum + Number(member.sourceTobeolValue ?? member.tobeolValue ?? 0), 0),
    totalCurrentWeekTobeolValue: members.reduce((sum, member) => sum + Number(member.currentWeekTobeolValue || 0), 0),
    totalLastWeekTobeolValue: members.reduce((sum, member) => sum + Number(member.lastWeekTobeolValue || 0), 0),
    lastWeekKnownCount: members.filter((member) => member.lastWeekTobeolValue != null).length
  };
}

function parseKoreanPowerValue(text) {
  const source = String(text || "").replace(/,/g, "").trim();
  if (!source) return 0;

  if (/^\d+(\.\d+)?$/.test(source)) {
    return Number(source);
  }

  const gyeong = getLastUnitValue(source, "경");
  const jo = getLastUnitValue(source, "조");
  const eok = getLastUnitValue(source, "억");
  const man = getLastUnitValue(source, "만");

  return (gyeong * 10_000_000_000_000_000) +
    (jo * 1_000_000_000_000) +
    (eok * 100_000_000) +
    (man * 10_000);
}

function getLastUnitValue(source, unit) {
  const pattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "g");
  const matches = [...String(source || "").matchAll(pattern)].map((item) => Number(item[1]));
  return matches.length ? matches[matches.length - 1] : 0;
}

function formatKoreanPower(value) {
  let n = Math.max(0, Math.floor(Number(value || 0)));
  const units = [
    ["경", 10_000_000_000_000_000],
    ["조", 1_000_000_000_000],
    ["억", 100_000_000],
    ["만", 10_000]
  ];
  const parts = [];

  for (const [label, size] of units) {
    const unitValue = Math.floor(n / size);
    n %= size;
    if (unitValue > 0) parts.push(`${unitValue}${label}`);
  }

  return parts.join(" ") || "0";
}

function formatSignedKoreanPower(value) {
  const n = Number(value || 0);
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "-"}${formatKoreanPower(Math.abs(n))}`;
}

function calcGrowthRate(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (!p) return null;
  return Number((((c - p) / p) * 100).toFixed(2));
}

function numberFormat(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function todayString() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}



function moveFeaturedWindow(delta) {
  const members = getFilteredMembers();
  const size = 5;
  if (!members.length) return;
  const maxStart = Math.max(0, Math.floor((members.length - 1) / size) * size);
  state.featuredStartIndex = Math.max(0, Math.min(maxStart, state.featuredStartIndex + delta));
  renderFeaturedMembers();
}

function renderFeaturedMembers() {
  if (!refs.featuredMemberList) return;
  const members = getFilteredMembers();
  if (!members.length) {
    refs.featuredMemberList.innerHTML = `<div class="empty featured-empty">표시할 길드원이 없습니다.</div>`;
    if (refs.featuredPrev) refs.featuredPrev.disabled = true;
    if (refs.featuredNext) refs.featuredNext.disabled = true;
    return;
  }

  const pageSize = 5;
  const maxStart = Math.max(0, Math.floor((members.length - 1) / pageSize) * pageSize);
  if (state.featuredStartIndex > maxStart) state.featuredStartIndex = maxStart;
  const windowMembers = members.slice(state.featuredStartIndex, state.featuredStartIndex + pageSize);
  refs.featuredMemberList.innerHTML = windowMembers.map((member, index) => renderFeaturedMemberItem(member, state.featuredStartIndex + index)).join("");

  if (refs.featuredPrev) refs.featuredPrev.disabled = state.featuredStartIndex <= 0;
  if (refs.featuredNext) refs.featuredNext.disabled = state.featuredStartIndex + pageSize >= members.length;
}

function renderFeaturedMemberItem(member, absoluteIndex) {
  const imageUrl = getCharacterImageUrl(member.nickname);
  const rank = member.rank ? `${member.rank}` : `${absoluteIndex + 1}`;
  const currentPower = compactPowerText(member.powerText, member.powerValue);
  const previousPower = member.previousPowerText ? compactPowerText(member.previousPowerText, member.previousPowerValue) : "비교 없음";
  const growthRate = Number(member.powerGrowthRate);
  const hasGrowthRate = Number.isFinite(growthRate);
  const growthText = hasGrowthRate ? `${growthRate > 0 ? "+" : ""}${growthRate.toFixed(2)}%` : "비교 없음";
  const growthClass = !hasGrowthRate ? "empty" : growthRate > 0 ? "high" : growthRate < 0 ? "down" : "normal";
  const growthValue = member.powerGrowthText || formatSignedKoreanPower(member.powerGrowthValue);
  const metaText = `Lv.${escapeHtml(member.level || "-")}${member.job ? ` · ${escapeHtml(member.job)}` : ""}`;

  return `
    <article class="featured-member-item power-row">
      <div class="featured-rank ${Number(rank) <= 3 ? `top-${escapeAttr(String(rank))}` : ""}">${escapeHtml(rank)}</div>
      <div class="featured-avatar-wrap">
        <img class="featured-avatar" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(member.nickname || "캐릭터")}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'; this.parentElement.classList.add('is-missing');" />
        <span class="featured-avatar-fallback">🌸</span>
      </div>
      <div class="featured-info">
        <strong class="featured-name">${escapeHtml(member.nickname || "-")}</strong>
        <small class="featured-meta">${metaText}</small>
      </div>
      <div class="featured-score-box power-score">
        <span>현재 전투력</span>
        <strong>${escapeHtml(currentPower)}</strong>
        <small>7일 전 ${escapeHtml(previousPower)}</small>
      </div>
      <span class="featured-grade ${growthClass}">${escapeHtml(growthText)}</span>
      <small class="featured-growth-value">${escapeHtml(growthValue || "-")}</small>
    </article>
  `;
}

function compactPowerText(text, value) {
  const source = String(text || formatKoreanPower(value) || "-").replace(/,/g, "").trim();
  if (!source || source === "-") return "-";
  const unitParts = source.match(/\d+(?:\.\d+)?\s*(?:경|조|억|만)/g);
  if (unitParts?.length) return unitParts.slice(0, 2).join(" ");
  return source;
}

function shortNumberKorean(value, fallbackText = "-") {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return fallbackText || "0";
  const num = Number(value);
  if (num >= 1000000000000) {
    return `${Math.floor(num / 1000000000000)}조`;
  }
  if (num >= 100000000) {
    return `${Math.floor(num / 100000000)}억`;
  }
  if (num >= 10000) {
    return `${Math.floor(num / 10000)}만`;
  }
  return `${Math.floor(num)}`;
}

// src/main.js renderTable
function renderTable() {
  if (!refs.tableHead || !refs.tableBody || !refs.panelTitle || !refs.panelDesc) return;
  const members = getFilteredMembers();
  const table = getTableSpec("power");

  refs.panelTitle.textContent = "길드원 현황";
  refs.panelDesc.textContent = "캐릭터 이미지 · 전투력 · 토벌전 점수 · 변화량";
  refs.tableHead.innerHTML = `<tr>${table.columns.map((column) => `<th>${column.label}</th>`).join("")}</tr>`;

  if (members.length === 0) {
    refs.tableBody.innerHTML = `<tr><td colspan="${table.columns.length}" class="empty">표시할 데이터가 없습니다.</td></tr>`;
    if (refs.mobileCardList) {
      refs.mobileCardList.innerHTML = `<div class="empty mobile-empty">표시할 데이터가 없습니다.</div>`;
    }
    return;
  }

  refs.tableBody.innerHTML = members.map((member, index) => `
    <tr class="${member.isManual ? "manual-row" : ""}">
      ${table.columns.map((column) => `<td>${column.render(member, index)}</td>`).join("")}
    </tr>
  `).join("");

  if (refs.mobileCardList) {
    refs.mobileCardList.innerHTML = members.map((member, index) => renderMemberCard(member, index)).join("");
  }
}

function renderMemberCard(member, index) {
  const rank = member.rank ? `#${escapeHtml(member.rank)}` : `#${index + 1}`;
  const manualBadge = member.isManual ? `<span class="manual-badge">수정</span>` : "";
  const statusBadge = renderMemberStatusBadge(member);
  const imageUrl = getCharacterImageUrl(member.nickname);

  return `
    <article class="member-card ${member.isManual ? "manual-card" : ""}">
      <div class="member-card-head">
        <div class="member-badges">
          <span class="member-rank-chip">${rank}</span>
          ${renderGuild(member)}
        </div>
        <div class="member-hero-row">
          <div class="member-avatar-wrap">
            <img class="member-avatar" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(member.nickname || "캐릭터")}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'; this.parentElement.classList.add('is-missing');" />
            <span class="member-avatar-fallback">✨</span>
          </div>
          <div class="member-name-block">
            <div class="member-name">${escapeHtml(member.nickname || "-")} ${manualBadge} ${statusBadge}</div>
            <div class="member-sub">${escapeHtml(member.job || "-")} · Lv.${escapeHtml(member.level || "-")}</div>
          </div>
        </div>
      </div>

      <div class="member-score-row">
        <div class="member-highlight score-indigo">
          <span>전투력</span>
          <strong>${escapeHtml(member.powerText || formatKoreanPower(member.powerValue))}</strong>
        </div>
        <div class="member-highlight score-pink">
          <span>토벌전</span>
          <strong>${escapeHtml(member.tobeolText || formatKoreanPower(member.tobeolValue))}</strong>
        </div>
      </div>

      <div class="member-metrics compact dual-metrics">
        ${renderMetric("전투력 변화", renderGrowth(member.powerGrowthValue, member.powerGrowthText))}
        ${renderMetric("지난주 토벌", member.lastWeekTobeolValue == null ? `<span class="muted">이력 없음</span>` : `<span>${escapeHtml(formatKoreanPower(member.lastWeekTobeolValue))}</span>`)}
        ${renderMetric("전투력 성장률", renderRate(member.powerGrowthRate))}
        ${renderMetric("토벌 기준", `<span class="muted">${escapeHtml(state.data?.raidPeriod?.metricLabel || "주차별")}</span>`)}
      </div>
    </article>
  `;
}

function renderMetric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}
