// Initializes Firebase if real config is present. Otherwise exports stubs so
// the rest of the system can run on a localStorage fallback.
//
// We dynamic-import the SDK only when configured, so the fallback path doesn't
// pay the bandwidth cost of pulling Firebase from the CDN.

const SDK_VERSION = '10.14.1';

function isRealConfig(cfg) {
  return !!(cfg && cfg.apiKey && cfg.apiKey !== 'PASTE_FROM_CONSOLE' && cfg.projectId);
}

// Config lives in ./firebase-config.js (gitignored). On a host where that file
// wasn't deployed, the import rejects and we fall back to localStorage rather
// than crashing the module.
let firebaseConfig = null;
try {
  ({ firebaseConfig } = await import('./firebase-config.js'));
} catch {
  firebaseConfig = null;
}

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
