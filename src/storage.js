const FAVORITES_KEY = "pangmao.web.favorites.v1";
const INSTALL_HINT_KEY = "pangmao.web.install-hint-dismissed.v1";
const READER_DRAFT_KEY = "pangmao.web.reader-draft.v1";
const FRENCH_VOICE_KEY = "pangmao.web.french-voice.v1";
const FRENCH_VOICE_PROFILE_KEY = "pangmao.web.french-voice-profile.v1";

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

export function loadFrenchVoiceId(storage = window.localStorage) {
  try {
    const value = storage.getItem(FRENCH_VOICE_KEY);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

export function saveFrenchVoiceId(value, storage = window.localStorage) {
  try {
    storage.setItem(FRENCH_VOICE_KEY, String(value ?? ""));
    return true;
  } catch {
    return false;
  }
}

function sanitizeVoiceIdentifier(value) {
  return typeof value === "string" ? value : "";
}

export function loadFrenchVoiceProfile(storage = window.localStorage) {
  const value = readJson(storage, FRENCH_VOICE_PROFILE_KEY, {});
  const voices = value && typeof value.voices === "object" ? value.voices : {};
  return {
    activeGender: value?.activeGender === "male" ? "male" : "female",
    voices: {
      female: sanitizeVoiceIdentifier(voices?.female),
      male: sanitizeVoiceIdentifier(voices?.male),
    },
  };
}

export function saveFrenchVoiceProfile(profile, storage = window.localStorage) {
  const normalized = {
    activeGender: profile?.activeGender === "male" ? "male" : "female",
    voices: {
      female: sanitizeVoiceIdentifier(profile?.voices?.female),
      male: sanitizeVoiceIdentifier(profile?.voices?.male),
    },
  };
  try {
    storage.setItem(FRENCH_VOICE_PROFILE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
