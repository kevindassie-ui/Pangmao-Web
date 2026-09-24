const FAVORITES_KEY = "pangmao.web.favorites.v1";
const INSTALL_HINT_KEY = "pangmao.web.install-hint-dismissed.v1";
const READER_DRAFT_KEY = "pangmao.web.reader-draft.v1";

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadFavorites(storage = window.localStorage) {
  const values = readJson(storage, FAVORITES_KEY, []);
  return new Set(Array.isArray(values) ? values.filter((value) => typeof value === "string") : []);
}

export function saveFavorites(favorites, storage = window.localStorage) {
  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify([...favorites].sort()));
    return true;
  } catch {
    return false;
  }
}

export function isInstallHintDismissed(storage = window.localStorage) {
  try {
    return storage.getItem(INSTALL_HINT_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissInstallHint(storage = window.localStorage) {
  try {
    storage.setItem(INSTALL_HINT_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

export function loadReaderDraft(storage = window.localStorage) {
  try {
    const value = storage.getItem(READER_DRAFT_KEY);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

export function saveReaderDraft(value, storage = window.localStorage) {
  try {
    storage.setItem(READER_DRAFT_KEY, String(value ?? ""));
    return true;
  } catch {
    return false;
  }
}
