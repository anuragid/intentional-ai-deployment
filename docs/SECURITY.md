# Security Overview

This project has a clean security posture. Defense is **enforcement-based** — production safety rests on Firebase security rules, authentication, and CI gating, not on obscurity. Public-by-design values (such as the Firebase Web API key) are treated as public; the rules layer is what actually constrains what any client can do.

## Secrets & credentials

| Secret | Location | Scope | Committed? |
| --- | --- | --- | --- |
| ElevenLabs API key | gitignored `.env` (local audio build) | Server-side only — used by `tools/audio/` build pipeline | No (not in git history) |
| Google service account | gitignored `service-account.json` | Server-side only — Admin SDK writes to Storage during build | No (not in git history) |
| Firebase Web config (`apiKey AIza...`) | gitignored `shared/firebase-config.js`; in prod loaded from Hosting `/__/firebase/init.json` | Client-side, **public-by-design** | No (gitignored locally) |

**Rules:**

- **Never commit real secret values.** Templates and examples must use placeholders only.
- The local **ElevenLabs key should be rotated** if the laptop or its `.env` is ever shared, lost, or otherwise exposed.
- The Firebase Web config being public is expected and safe — it is an identifier, not an access grant. What a client can actually do is governed by the security rules below.

## Firebase security model

The app uses Firebase **Hosting** (static site), **Firestore + Anonymous Auth** (browser reads/writes highlights and article reactions directly), and **Storage** (browser reads audio; the build tool writes via the Admin SDK). No Functions or Realtime Database.

Because the browser writes to Firestore and reads Storage directly, **the security rules are the real line of defense** — not application code.

**Firestore (`firestore.rules`) guarantees:**

- Writes require `request.auth` (authenticated, anonymous is fine).
- `creatorUid` must equal `request.auth.uid` on create.
- Content is **immutable after create**.
- Updates are restricted to the `['reactions','counts']` fields, and a caller may only modify **their own** reactions key.
- `delete: if false`.
- **Default-deny** — no catch-all allow rule.
- *Known soft spot (acknowledged, low impact):* denormalized `counts` are client-skewable.

**Storage (`storage.rules`) guarantees:**

- `/audio/**` is public-read, `write: false`.
- Catch-all is `read, write: false` — **not world-writable**.
- CORS is scoped to app origins + localhost, **GET/HEAD only**.

## CI/CD

Deploys are gated through GitHub Actions:

- `firebase-hosting-merge.yml` deploys to **live only on push to `main`**.
- `firebase-hosting-pull-request.yml` publishes a **PR preview channel**. It correctly uses the `pull_request` trigger (not `pull_request_target`) plus a fork-guard `if:` condition, so **fork PRs cannot exfiltrate the service-account secret**.

**Hardening applied in this branch:**

1. **Pinned third-party actions to commit SHAs** — `FirebaseExtended/action-hosting-deploy` and `actions/checkout` are pinned to immutable commit SHAs instead of floating tags.
2. **Least-privilege token** — added `permissions: contents: read` to the live-deploy (merge) workflow.
3. **Tighter ignore/deploy surface** — added global `.gitignore` catch patterns (`**/.env`, `**/service-account*.json`, `**/.DS_Store`) and excluded `audio/**` + `skills-lock.json` from the Hosting deploy surface.
4. **Secret scanning** — added a gitleaks workflow that runs on every push and PR.

## Operator action items (console / cannot be done in code)

These steps must be performed by the repo owner in the GitHub and Google Cloud / Firebase consoles. They cannot be committed as code.

1. **Enable branch protection on `main`** — require PR review and disallow direct pushes. This is the *real* gate on production deploys; the workflow alone only enforces "the commit reached `main`", not how it got there.
2. **(Optional) Add a GitHub `environment` with required reviewers** to the deploy job for a second gate before live deploys run.
3. **Restrict the Firebase Web API key** (Google Cloud console):
   - *Application restrictions* → **HTTP referrers** → allow only the prod domain(s) + localhost.
   - *API restrictions* → limit to only the Firebase APIs actually used: **Identity Toolkit, Firestore, Storage, Firebase Installations**.
   - Note: this limits abuse but the key remains public-by-design.
4. **Enable Firebase App Check** (reCAPTCHA v3 / Enterprise for web) and enforce it on **Firestore + Storage** to deter scripted abuse of the public write paths and the count-skew vector.
   - **IMPORTANT:** Do **NOT** flip enforcement ON until the web client is registered and initializing App Check with the site key — otherwise it will block **all** legitimate Firestore/Storage requests. Roll out in **monitor / unenforced mode first**, confirm legitimate traffic passes, then enforce.
5. **Consider periodic rotation** of the ElevenLabs key.

## What was NOT changed and why

- **App Check client code was intentionally not auto-added.** Wiring App Check into the web client requires a reCAPTCHA **site key from the console** and a **monitored rollout** (monitor mode → verify → enforce). Adding it blindly in code, or enforcing before the client initializes correctly, would break live Firestore/Storage writes. This is therefore an operator action item (#4 above), not an automated change.
