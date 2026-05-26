// Firebase config template.
//
// Setup:
//   1. Create a Firebase project in the console: https://console.firebase.google.com/
//   2. Add a Web App (Project Settings -> General -> Your apps -> Web)
//   3. Copy the firebaseConfig object Firebase shows you
//   4. Save this file as `firebase-config.js` (alongside this example) with the
//      values pasted in below
//   5. In Authentication -> Sign-in method, enable "Anonymous"
//   6. In Firestore -> Create database, pick a region (us-central1 is fine),
//      start in Production mode
//   7. From the project root, run: firebase deploy --only firestore:rules
//
// Without firebase-config.js, the highlights system silently falls back to
// localStorage so each browser only sees its own highlights. With it, the
// highlights become public across all visitors.

export const firebaseConfig = {
  apiKey: "PASTE_FROM_CONSOLE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "PASTE_FROM_CONSOLE",
  appId: "PASTE_FROM_CONSOLE",
};
