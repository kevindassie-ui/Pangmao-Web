const FAVORITES_KEY = "pangmao.web.favorites.v1";
const INSTALL_HINT_KEY = "pangmao.web.install-hint-dismissed.v1";

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
  storage.setItem(FAVORITES_KEY, JSON.stringify([...favorites].sort()));
}

export function isInstallHintDismissed(storage = window.localStorage) {
  return storage.getItem(INSTALL_HINT_KEY) === "true";
}

export function dismissInstallHint(storage = window.localStorage) {
  storage.setItem(INSTALL_HINT_KEY, "true");
}
