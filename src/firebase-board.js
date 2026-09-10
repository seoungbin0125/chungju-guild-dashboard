import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function isFirebaseConfigured(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !String(config.apiKey).includes("PASTE")
  );
}

export function createGuideBoardClient({
  config,
  collectionName = "guidePosts",
  onPosts,
  onError,
  onStatus
}) {
  if (!isFirebaseConfigured(config)) {
    onStatus?.("local", "Firebase 설정 전: 브라우저 임시 저장 모드");
    return {
      enabled: false,
      async addPost() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async deletePost() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      unsubscribe() {}
    };
  }

  const app = getFirebaseApp(config);
  const db = getFirestore(app);
  const postsRef = collection(db, collectionName);
  const postsQuery = query(postsRef, orderBy("createdAt", "desc"));

  onStatus?.("connecting", "게시판 서버 연결 중...");

  const unsubscribe = onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((item) => normalizeFirestorePost(item.id, item.data()));
      onPosts?.(posts);
      onStatus?.("online", `실시간 게시판 연결됨 · ${posts.length}개 글`);
    },
    (error) => {
      onError?.(error);
      onStatus?.("error", `게시판 연결 실패: ${error.message}`);
    }
  );

  return {
    enabled: true,
    async addPost(post) {
      await addDoc(postsRef, {
        title: post.title,
        content: post.content,
        author: post.author || "익명",
        category: post.category || "기타",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    },
    async deletePost(id) {
      await deleteDoc(doc(db, collectionName, id));
    },
    unsubscribe
  };
}


export function createManualOverrideClient({
  config,
  collectionName = "weeklyOverrides",
  documentId,
  onManual,
  onError,
  onStatus
}) {
  if (!isFirebaseConfigured(config)) {
    onStatus?.("local", "Firebase 설정 전: 이 브라우저에만 저장됩니다.");
    return {
      enabled: false,
      async saveManual() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      unsubscribe() {}
    };
  }

  const app = getFirebaseApp(config);
  const db = getFirestore(app);
  const manualRef = doc(db, collectionName, documentId || "current");

  onStatus?.("connecting", "수동 보정값 서버 연결 중...");

  const unsubscribe = onSnapshot(
    manualRef,
    (snapshot) => {
      const manual = snapshot.exists()
        ? normalizeFirestoreManual(snapshot.data())
        : null;
      onManual?.(manual);
      onStatus?.("online", manual?.items?.length ? `수동 보정값 ${manual.items.length}건 적용 중` : "수동 보정값 없음");
    },
    (error) => {
      onError?.(error);
      onStatus?.("error", `수동 보정값 연결 실패: ${error.message}`);
    }
  );

  return {
    enabled: true,
    async saveManual(manual) {
      await setDoc(manualRef, {
        date: manual.date || "",
        comparisonTargetDate: manual.comparisonTargetDate || "",
        items: Array.isArray(manual.items) ? manual.items : [],
        updatedAt: serverTimestamp()
      }, { merge: true });
    },
    unsubscribe
  };
}


export function createVirtualLobbyClient({
  config,
  collectionName = "virtualLobby",
  onParticipants,
  onMessages,
  onError,
  onStatus
}) {
  if (!isFirebaseConfigured(config)) {
    onStatus?.("local", "Firebase 설정 전: 이 브라우저에서만 움직이는 데모 모드");
    return {
      enabled: false,
      async upsertParticipant() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async patchParticipant() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async leave() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async sendMessage() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      unsubscribe() {}
    };
  }

  const app = getFirebaseApp(config);
  const db = getFirestore(app);
  const participantsRef = collection(db, collectionName, "plaza", "participants");
  const messagesRef = collection(db, collectionName, "plaza", "messages");
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

  onStatus?.("connecting", "버츄얼 광장 연결 중...");

  const unsubscribeParticipants = onSnapshot(
    participantsRef,
    (snapshot) => {
      const participants = snapshot.docs.map((item) => normalizeVirtualParticipant(item.id, item.data()));
      onParticipants?.(participants);
      onStatus?.("online", `실시간 광장 연결됨 · ${participants.length}명 접속`);
    },
    (error) => {
      onError?.(error);
      onStatus?.("error", `광장 연결 실패: ${error.message}`);
    }
  );

  const unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((item) => normalizeVirtualMessage(item.id, item.data())).slice(-80);
      onMessages?.(messages);
    },
    (error) => {
      onError?.(error);
    }
  );

  return {
    enabled: true,
    async upsertParticipant(participant) {
      const id = safeDocId(participant.userId);
      await setDoc(doc(participantsRef, id), {
        userId: String(participant.userId || id),
        memberKey: String(participant.memberKey || ""),
        nickname: String(participant.nickname || "익명").slice(0, 30),
        guild: String(participant.guild || "-").slice(0, 30),
        job: String(participant.job || "-").slice(0, 40),
        x: Number(participant.x || 50),
        y: Number(participant.y || 55),
        hp: Number(participant.hp || 1),
        maxHp: Number(participant.maxHp || participant.hp || 1),
        jailedUntil: String(participant.jailedUntil || "").slice(0, 40),
        shieldUntil: String(participant.shieldUntil || "").slice(0, 40),
        attackedAt: String(participant.attackedAt || "").slice(0, 40),
        lastAttacker: String(participant.lastAttacker || "").slice(0, 30),
        lastMessage: String(participant.lastMessage || "").slice(0, 120),
        lastSeen: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    },
    async patchParticipant(userId, patch) {
      await setDoc(doc(participantsRef, safeDocId(userId)), {
        ...(patch.x == null ? {} : { x: Number(patch.x) }),
        ...(patch.y == null ? {} : { y: Number(patch.y) }),
        ...(patch.hp == null ? {} : { hp: Number(patch.hp) }),
        ...(patch.maxHp == null ? {} : { maxHp: Number(patch.maxHp) }),
        ...(patch.jailedUntil == null ? {} : { jailedUntil: String(patch.jailedUntil || "").slice(0, 40) }),
        ...(patch.shieldUntil == null ? {} : { shieldUntil: String(patch.shieldUntil || "").slice(0, 40) }),
        attackedAt: String(patch.attackedAt || "").slice(0, 40),
        lastAttacker: String(patch.lastAttacker || "").slice(0, 30),
        lastMessage: String(patch.lastMessage || "").slice(0, 120),
        lastSeen: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    },
    async leave(userId) {
      await deleteDoc(doc(participantsRef, safeDocId(userId)));
    },
    async sendMessage(message) {
      await addDoc(messagesRef, {
        userId: String(message.userId || ""),
        nickname: String(message.nickname || "익명").slice(0, 30),
        guild: String(message.guild || "-").slice(0, 30),
        text: String(message.text || "").slice(0, 120),
        createdAt: serverTimestamp()
      });
    },
    unsubscribe() {
      unsubscribeParticipants();
      unsubscribeMessages();
    }
  };
}

function normalizeVirtualParticipant(id, data) {
  return {
    id,
    userId: String(data.userId || id),
    memberKey: String(data.memberKey || ""),
    nickname: String(data.nickname || "익명"),
    guild: String(data.guild || "-"),
    job: String(data.job || "-"),
    x: Number(data.x || 50),
    y: Number(data.y || 55),
    hp: Number(data.hp || data.maxHp || 1),
    maxHp: Number(data.maxHp || data.hp || 1),
    jailedUntil: String(data.jailedUntil || ""),
    shieldUntil: String(data.shieldUntil || ""),
    attackedAt: String(data.attackedAt || ""),
    lastAttacker: String(data.lastAttacker || ""),
    lastMessage: String(data.lastMessage || ""),
    lastSeen: String(data.lastSeen || ""),
    updatedAt: toIsoString(data.updatedAt) || data.updatedAt || ""
  };
}

function normalizeVirtualMessage(id, data) {
  return {
    id,
    userId: String(data.userId || ""),
    nickname: String(data.nickname || "익명"),
    guild: String(data.guild || "-"),
    text: String(data.text || ""),
    createdAt: toIsoString(data.createdAt) || data.createdAt || new Date().toISOString()
  };
}


export function createJellyGameClient({
  config,
  collectionName = "jellyGame",
  onPlayers,
  onEvents,
  onError,
  onStatus
}) {
  if (!isFirebaseConfigured(config)) {
    onStatus?.("local", "Firebase 설정 전: 이 브라우저에서 봇과 연습하는 데모 모드");
    return {
      enabled: false,
      async upsertPlayer() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async markPlayerEaten() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async leave() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      async addEvent() {
        throw new Error("Firebase 설정이 없습니다.");
      },
      unsubscribe() {}
    };
  }

  const app = getFirebaseApp(config);
  const db = getFirestore(app);
  const playersRef = collection(db, collectionName, "arena", "players");
  const eventsRef = collection(db, collectionName, "arena", "events");
  const eventsQuery = query(eventsRef, orderBy("createdAt", "asc"));

  onStatus?.("connecting", "젤리난투 서버 연결 중...");

  const unsubscribePlayers = onSnapshot(
    playersRef,
    (snapshot) => {
      const players = snapshot.docs.map((item) => normalizeJellyPlayer(item.id, item.data()));
      onPlayers?.(players);
      onStatus?.("online", `실시간 젤리난투 연결됨 · ${players.length}명 참여`);
    },
    (error) => {
      onError?.(error);
      onStatus?.("error", `게임 연결 실패: ${error.message}`);
    }
  );

  const unsubscribeEvents = onSnapshot(
    eventsQuery,
    (snapshot) => {
      const events = snapshot.docs.map((item) => normalizeJellyEvent(item.id, item.data())).slice(-80);
      onEvents?.(events);
    },
    (error) => {
      onError?.(error);
    }
  );

  return {
    enabled: true,
    async upsertPlayer(player) {
      const id = safeDocId(player.userId);
      await setDoc(doc(playersRef, id), {
        userId: String(player.userId || id),
        memberKey: String(player.memberKey || ""),
        nickname: String(player.nickname || "익명").slice(0, 30),
        guild: String(player.guild || "-").slice(0, 30),
        job: String(player.job || "-").slice(0, 40),
        team: String(player.team || "solo").slice(0, 16),
        x: Number(player.x || 50),
        y: Number(player.y || 52),
        mass: Number(player.mass || 18),
        score: Number(player.score || 0),
        safeUntil: String(player.safeUntil || "").slice(0, 40),
        eatenAt: String(player.eatenAt || "").slice(0, 40),
        lastEvent: String(player.lastEvent || "").slice(0, 160),
        lastSeen: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    },
    async markPlayerEaten(userId, patch) {
      await setDoc(doc(playersRef, safeDocId(userId)), {
        x: Number(patch.x || 50),
        y: Number(patch.y || 52),
        mass: Number(patch.mass || 18),
        score: Number(patch.score || 0),
        safeUntil: new Date(Date.now() + 2800).toISOString(),
        eatenAt: String(patch.eatenAt || new Date().toISOString()).slice(0, 40),
        lastEvent: String(patch.lastEvent || "흡수됨").slice(0, 160),
        lastSeen: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    },
    async leave(userId) {
      await deleteDoc(doc(playersRef, safeDocId(userId)));
    },
    async addEvent(event) {
      await addDoc(eventsRef, {
        userId: String(event.userId || "").slice(0, 80),
        nickname: String(event.nickname || "익명").slice(0, 30),
        guild: String(event.guild || "-").slice(0, 30),
        type: String(event.type || "info").slice(0, 20),
        text: String(event.text || "").slice(0, 160),
        createdAt: serverTimestamp()
      });
    },
    unsubscribe() {
      unsubscribePlayers();
      unsubscribeEvents();
    }
  };
}

function normalizeJellyPlayer(id, data) {
  return {
    id,
    userId: String(data.userId || id),
    memberKey: String(data.memberKey || ""),
    nickname: String(data.nickname || "익명"),
    guild: String(data.guild || "-"),
    job: String(data.job || "-"),
    team: String(data.team || "solo"),
    x: Number(data.x || 50),
    y: Number(data.y || 52),
    mass: Number(data.mass || 18),
    score: Number(data.score || 0),
    safeUntil: String(data.safeUntil || ""),
    eatenAt: String(data.eatenAt || ""),
    lastEvent: String(data.lastEvent || ""),
    lastSeen: String(data.lastSeen || ""),
    updatedAt: toIsoString(data.updatedAt) || data.updatedAt || ""
  };
}

function normalizeJellyEvent(id, data) {
  return {
    id,
    userId: String(data.userId || ""),
    nickname: String(data.nickname || "익명"),
    guild: String(data.guild || "-"),
    type: String(data.type || "info"),
    text: String(data.text || ""),
    createdAt: toIsoString(data.createdAt) || data.createdAt || new Date().toISOString()
  };
}

function safeDocId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

function getFirebaseApp(config) {
  return getApps().length ? getApp() : initializeApp(config);
}

function normalizeFirestoreManual(data) {
  return {
    date: String(data.date || ""),
    comparisonTargetDate: String(data.comparisonTargetDate || ""),
    items: Array.isArray(data.items) ? data.items : []
  };
}

function normalizeFirestorePost(id, data) {
  const createdAt = toIsoString(data.createdAt) || data.createdAt || new Date().toISOString();
  const updatedAt = toIsoString(data.updatedAt) || data.updatedAt || createdAt;

  return {
    id,
    title: String(data.title || ""),
    content: String(data.content || ""),
    author: String(data.author || "익명"),
    category: String(data.category || "기타"),
    createdAt,
    updatedAt,
    source: "firebase"
  };
}

function toIsoString(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return "";
}
