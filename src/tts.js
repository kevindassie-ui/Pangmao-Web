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

export function speakWithFrenchVoice({
  synth,
  Utterance,
  text,
  preferredIdentifier = "",
  rate = 0.82,
  onError = null,
  onEnd = null,
}) {
  if (!synth || typeof Utterance !== "function") {
    return { ok: false, reason: "unsupported", voice: null, utterance: null };
  }
  const voice = selectFrenchVoice(synth.getVoices(), preferredIdentifier);
  if (!voice) {
    return { ok: false, reason: "no-french-voice", voice: null, utterance: null };
  }

  const utterance = new Utterance(String(text ?? ""));
  utterance.voice = voice;
  utterance.lang = voice.lang || "fr-FR";
  utterance.rate = rate;
  if (typeof onError === "function") utterance.onerror = onError;
  if (typeof onEnd === "function") utterance.onend = onEnd;
  synth.cancel();
  if (typeof synth.resume === "function") synth.resume();
  synth.speak(utterance);
  return { ok: true, reason: "", voice, utterance };
}
