export function normalizeVoiceLanguage(value) {
  return String(value ?? "").trim().replaceAll("_", "-").toLocaleLowerCase("fr");
}

export function isFrenchVoice(voice) {
  const language = normalizeVoiceLanguage(voice?.lang);
  return language === "fr" || language.startsWith("fr-");
}

export function voiceIdentifier(voice) {
  if (!voice) return "";
  return String(voice.voiceURI || `${voice.name ?? ""}|${voice.lang ?? ""}`);
}

function voiceScore(voice) {
  const language = normalizeVoiceLanguage(voice?.lang);
  let score = language === "fr-fr" ? 100 : language.startsWith("fr-") ? 80 : 60;
  if (voice?.localService) score += 5;
  if (voice?.default) score += 1;
  return score;
}

export function listFrenchVoices(voices) {
  return [...(voices ?? [])]
    .filter(isFrenchVoice)
    .sort(
      (left, right) =>
        voiceScore(right) - voiceScore(left) ||
        String(left.name ?? "").localeCompare(String(right.name ?? ""), "fr"),
    );
}

export function selectFrenchVoice(voices, preferredIdentifier = "") {
  const frenchVoices = listFrenchVoices(voices);
  return (
    frenchVoices.find((voice) => voiceIdentifier(voice) === preferredIdentifier) ??
    frenchVoices[0] ??
    null
  );
}

export function availableVoices(synth) {
  if (!synth || typeof synth.getVoices !== "function") return [];
  try {
    return Array.from(synth.getVoices() ?? []);
  } catch {
    return [];
  }
}

export function waitForFrenchVoice({
  synth,
  preferredIdentifier = "",
  timeoutMs = 1_800,
  pollIntervalMs = 120,
}) {
  const current = selectFrenchVoice(availableVoices(synth), preferredIdentifier);
  if (current || !synth) return Promise.resolve(current);

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const finish = (voice) => {
      if (settled) return;
      settled = true;
      if (pollTimer !== null) globalThis.clearInterval(pollTimer);
      if (timeoutTimer !== null) globalThis.clearTimeout(timeoutTimer);
      synth.removeEventListener?.("voiceschanged", check);
      resolve(voice);
    };
    const check = () => {
      const voice = selectFrenchVoice(availableVoices(synth), preferredIdentifier);
      if (voice) finish(voice);
    };

    synth.addEventListener?.("voiceschanged", check);
    pollTimer = globalThis.setInterval(check, Math.max(20, pollIntervalMs));
    timeoutTimer = globalThis.setTimeout(() => finish(null), Math.max(0, timeoutMs));
    check();
  });
}

export function speakWithFrenchVoice({
  synth,
  Utterance,
  text,
  preferredIdentifier = "",
  selectedVoice = null,
  rate = 0.82,
  onError = null,
  onEnd = null,
}) {
  if (!synth || typeof Utterance !== "function") {
    return { ok: false, reason: "unsupported", voice: null, utterance: null };
  }
  const voice = isFrenchVoice(selectedVoice)
    ? selectedVoice
    : selectFrenchVoice(availableVoices(synth), preferredIdentifier);
  if (!voice) {
    return { ok: false, reason: "no-french-voice", voice: null, utterance: null };
  }

  const utterance = new Utterance(String(text ?? ""));
  utterance.voice = voice;
  utterance.lang = voice.lang || "fr-FR";
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (typeof onError === "function") utterance.onerror = onError;
  if (typeof onEnd === "function") utterance.onend = onEnd;
  try {
    synth.cancel();
    if (typeof synth.resume === "function") synth.resume();
    synth.speak(utterance);
  } catch {
    return { ok: false, reason: "speak-failed", voice, utterance };
  }
  return { ok: true, reason: "", voice, utterance };
}
