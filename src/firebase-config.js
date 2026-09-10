// Firebase 설정 파일입니다.
// Firebase Console에서 제공한 Web App config 값만 FIREBASE_CONFIG에 넣으세요.
// 아래 export 이름들은 main.js에서 사용하므로 삭제하지 마세요.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDTYYowPc2B4KKUOeuSciUGo3hQl2JkOsg",
  authDomain: "meki-guild1.firebaseapp.com",
  projectId: "meki-guild1",
  storageBucket: "meki-guild1.firebasestorage.app",
  messagingSenderId: "26303880990",
  appId: "1:26303880990:web:ef310d5f3159115578f30f",
  measurementId: "G-TSR1FVNPN3"
};

// Lovely 포털과 같은 Firebase 프로젝트를 사용해도 데이터가 섞이지 않도록 별도 컬렉션을 씁니다.
export const FIREBASE_COLLECTION = "chungjuGuidePosts";
export const FIREBASE_MANUAL_COLLECTION = "chungjuWeeklyOverrides";
export const FIREBASE_LOBBY_COLLECTION = "chungjuVirtualLobby";
export const FIREBASE_GAME_COLLECTION = "chungjuJellyGame";
