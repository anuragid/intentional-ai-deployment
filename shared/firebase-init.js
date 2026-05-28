// Initializes Firebase if real config is present. Otherwise exports stubs so
// the rest of the system can run on a localStorage fallback.
//
// We dynamic-import the SDK only when configured, so the fallback path doesn't
// pay the bandwidth cost of pulling Firebase from the CDN.

const SDK_VERSION = '10.14.1';

function isRealConfig(cfg) {
  return !!(cfg && cfg.apiKey && cfg.apiKey !== 'PASTE_FROM_CONSOLE' && cfg.projectId);
}

// Resolve the Firebase config without ever committing keys to the repo:
//   1. Firebase Hosting serves it at the reserved /__/firebase/init.json path
//      (production). Keys live in the hosting environment, not in git.
//   2. Local dev / non-Firebase hosts fall back to the gitignored
//      ./firebase-config.js module.
//   3. If neither resolves, the data layer uses its localStorage fallback.
async function loadConfig() {
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg && cfg.apiKey) return cfg;
    }
  } catch { /* not served by Firebase Hosting */ }

  try {
    const mod = await import('./firebase-config.js');
    if (mod.firebaseConfig) return mod.firebaseConfig;
  } catch { /* no local config module present */ }

  return null;
}

const firebaseConfig = await loadConfig();

let db = null;
let auth = null;
let firestoreSdk = null;
let authReady = Promise.resolve(null);

export const isConfigured = isRealConfig(firebaseConfig);

if (isConfigured) {
  const appMod = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`);
  const firestoreMod = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`);
  const authMod = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`);

  const app = appMod.initializeApp(firebaseConfig);
  db = firestoreMod.getFirestore(app);
  auth = authMod.getAuth(app);
  firestoreSdk = firestoreMod;

  authReady = new Promise((resolve, reject) => {
    const unsub = authMod.onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
        }
      },
      (err) => reject(err),
    );
    authMod.signInAnonymously(auth).catch((err) => {
      console.error('Anonymous sign-in failed:', err);
      reject(err);
    });
  });
}

export { db, auth, firestoreSdk, authReady };
