// Data layer for highlights and reactions.
// Routes through Firestore when configured, otherwise through a localStorage
// stub with the same interface. UI code never branches on backend.

import { db, firestoreSdk, isConfigured, authReady } from './firebase-init.js';

// ===== Identity =====

const LOCAL_UID_KEY = 'wcbnc:localUid';
const DISPLAY_NAME_KEY = 'wcbnc:displayName';
const NAME_OPT_OUT_KEY = 'wcbnc:nameOptedOut';

function makeLocalUid() {
  const existing = localStorage.getItem(LOCAL_UID_KEY);
  if (existing) return existing;
  const fresh = 'local-' + Math.random().toString(36).slice(2, 12);
  localStorage.setItem(LOCAL_UID_KEY, fresh);
  return fresh;
}

let currentUid = makeLocalUid();

if (isConfigured) {
  try {
    currentUid = await authReady;
  } catch (err) {
    console.warn('Firebase auth failed; falling back to local uid', err);
  }
}

export function getCurrentUid() {
  return currentUid;
}

export function getDisplayName() {
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function setDisplayName(name) {
  const trimmed = (name || '').trim();
  if (trimmed) localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
  else localStorage.removeItem(DISPLAY_NAME_KEY);
}

export function hasOptedOutOfNamePrompt() {
  return localStorage.getItem(NAME_OPT_OUT_KEY) === '1' || !!getDisplayName();
}

export function optOutOfNamePrompt() {
  localStorage.setItem(NAME_OPT_OUT_KEY, '1');
}

// ===== LocalStorage fallback =====

const LS_HIGHLIGHTS_PREFIX = 'wcbnc:hl:';
const LS_ARTICLE_REACTIONS_PREFIX = 'wcbnc:ar:';
const lsSubs = { highlights: new Map(), articleReactions: new Map() };

function lsLoad(prefix, slug) {
  const raw = localStorage.getItem(prefix + slug);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function lsSave(prefix, slug, value, subsMap) {
  localStorage.setItem(prefix + slug, JSON.stringify(value));
  const subs = subsMap.get(slug);
  if (subs) for (const cb of subs) cb(value);
}

function lsSubscribe(subsMap, slug, cb, initial) {
  if (!subsMap.has(slug)) subsMap.set(slug, new Set());
  subsMap.get(slug).add(cb);
  cb(initial);
  return () => subsMap.get(slug)?.delete(cb);
}

function emptyCounts(seed = {}) {
  return { heart: 0, clap: 0, like: 0, mark: 0, total: 0, ...seed };
}

// ===== Highlights =====

export function listenHighlights(slug, callback) {
  if (isConfigured) {
    const { collection, onSnapshot } = firestoreSdk;
    const col = collection(db, 'articles', slug, 'highlights');
    return onSnapshot(col, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      callback(list);
    }, (err) => {
      console.error('listenHighlights error', err);
      callback([]);
    });
  }
  const list = lsLoad(LS_HIGHLIGHTS_PREFIX, slug) || [];
  return lsSubscribe(lsSubs.highlights, slug, callback, list);
}

export async function createHighlight(slug, anchor, reactionType /* 'heart'|'clap'|'like'|null */, displayName) {
  const uid = getCurrentUid();
  const initialReactions = reactionType ? [reactionType] : [];
  const counts = emptyCounts({
    mark: 1,
    total: 1 + initialReactions.length,
  });
  for (const r of initialReactions) counts[r] = 1;

  const base = {
    paragraphId: anchor.paragraphId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    quote: anchor.quote,
    creatorUid: uid,
    creatorName: displayName || null,
    reactions: { [uid]: initialReactions },
    counts,
  };

  if (isConfigured) {
    const { collection, addDoc, serverTimestamp } = firestoreSdk;
    const col = collection(db, 'articles', slug, 'highlights');
    const ref = await addDoc(col, { ...base, createdAt: serverTimestamp() });
    return ref.id;
  }
  const id = 'hl-' + Math.random().toString(36).slice(2, 10);
  const list = lsLoad(LS_HIGHLIGHTS_PREFIX, slug) || [];
  list.push({ id, ...base, createdAt: Date.now() });
  lsSave(LS_HIGHLIGHTS_PREFIX, slug, list, lsSubs.highlights);
  return id;
}

export async function toggleHighlightReaction(slug, highlightId, type) {
  const uid = getCurrentUid();

  if (isConfigured) {
    const { doc, getDoc, updateDoc, increment } = firestoreSdk;
    const ref = doc(db, 'articles', slug, 'highlights', highlightId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const mine = (data.reactions && data.reactions[uid]) || [];
    const has = mine.includes(type);
    const next = has ? mine.filter((r) => r !== type) : [...mine, type];
    await updateDoc(ref, {
      [`reactions.${uid}`]: next,
      [`counts.${type}`]: increment(has ? -1 : 1),
      [`counts.total`]: increment(has ? -1 : 1),
    });
    return;
  }
  const list = lsLoad(LS_HIGHLIGHTS_PREFIX, slug) || [];
  const hl = list.find((h) => h.id === highlightId);
  if (!hl) return;
  hl.reactions = hl.reactions || {};
  const mine = hl.reactions[uid] || [];
  const has = mine.includes(type);
  hl.reactions[uid] = has ? mine.filter((r) => r !== type) : [...mine, type];
  hl.counts = hl.counts || emptyCounts();
  hl.counts[type] = Math.max(0, (hl.counts[type] || 0) + (has ? -1 : 1));
  hl.counts.total = Math.max(0, (hl.counts.total || 0) + (has ? -1 : 1));
  lsSave(LS_HIGHLIGHTS_PREFIX, slug, list, lsSubs.highlights);
}

// ===== Article-level reactions =====

export function listenArticleReactions(slug, callback) {
  if (isConfigured) {
    const { collection, onSnapshot } = firestoreSdk;
    const col = collection(db, 'articles', slug, 'articleReactions');
    return onSnapshot(col, (snap) => {
      const counts = { heart: 0, clap: 0, like: 0 };
      let mine = [];
      snap.forEach((d) => {
        const reactions = d.data().reactions || [];
        for (const r of reactions) if (counts[r] != null) counts[r]++;
        if (d.id === currentUid) mine = reactions;
      });
      callback({ counts, mine });
    }, (err) => {
      console.error('listenArticleReactions error', err);
      callback({ counts: { heart: 0, clap: 0, like: 0 }, mine: [] });
    });
  }
  const map = lsLoad(LS_ARTICLE_REACTIONS_PREFIX, slug) || {};
  return lsSubscribe(lsSubs.articleReactions, slug, (value) => {
    const counts = { heart: 0, clap: 0, like: 0 };
    for (const reactions of Object.values(value)) {
      for (const r of reactions) if (counts[r] != null) counts[r]++;
    }
    callback({ counts, mine: value[currentUid] || [] });
  }, map);
}

export async function toggleArticleReaction(slug, type) {
  const uid = getCurrentUid();

  if (isConfigured) {
    const { doc, getDoc, setDoc } = firestoreSdk;
    const ref = doc(db, 'articles', slug, 'articleReactions', uid);
    const snap = await getDoc(ref);
    const mine = snap.exists() ? (snap.data().reactions || []) : [];
    const has = mine.includes(type);
    const next = has ? mine.filter((r) => r !== type) : [...mine, type];
    await setDoc(ref, { reactions: next, updatedAt: new Date() }, { merge: true });
    return;
  }
  const map = lsLoad(LS_ARTICLE_REACTIONS_PREFIX, slug) || {};
  const mine = map[uid] || [];
  const has = mine.includes(type);
  map[uid] = has ? mine.filter((r) => r !== type) : [...mine, type];
  lsSave(LS_ARTICLE_REACTIONS_PREFIX, slug, map, lsSubs.articleReactions);
}
