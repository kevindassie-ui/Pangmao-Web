export const VERSION = "2026-10-08-d1";
const IDS = ["medecin", "avocat", "nombres", "quotidien"];
export const VOICES = ["female", "male"];
export const CONDITIONS = { mp3: "A · 压缩音频 · Audio compressé", wav: "B · 无压缩 · Sans compression", explicit: "C · 明确发音 · Prononciation explicite" };

export function validateDiagnostic(m) {
  if (m?.schemaVersion !== 1 || m.version !== VERSION || m.purpose !== "input-codec-diagnostic" ||
      m.language !== "fr-FR" || !Array.isArray(m.samples) || m.samples.length !== 4 ||
      !Array.isArray(m.voices) || m.voices.length !== 2 ||
      m.voices.some((v, i) => v.id !== VOICES[i])) throw new Error("Invalid diagnostic manifest");
  let total = 0;
  for (const [i, sample] of m.samples.entries()) {
    if (sample.id !== IDS[i] || typeof sample.text !== "string" || !sample.text.trim()) throw new Error("Invalid diagnostic text");
    const keys = i < 2 ? ["mp3", "wav", "explicit"] : ["mp3", "wav"];
    for (const voice of VOICES) {
      const clips = sample.clips?.[voice];
      if (!clips || Object.keys(clips).sort().join() !== [...keys].sort().join()) throw new Error("Invalid diagnostic conditions");
      for (const key of keys) {
        const c = clips[key];
        const filename = `audio/${voice}-${sample.id}-${key === "explicit" ? "explicit" : "current"}.${key === "mp3" ? "mp3" : "wav"}`;
        if (c?.file !== filename || !/^[a-f0-9]{64}$/.test(c.sha256) || !/^[a-f0-9]{64}$/.test(c.sourcePcmSha256) ||
            !Number.isInteger(c.bytes) || c.bytes <= 0 || c.bytes > 500_000 ||
            !Number.isInteger(c.pcmFrames) || c.pcmFrames <= 0 || c.pcmFrames !== c.decodedFrames ||
            c.sampleRate !== 22050 || !Number.isFinite(c.durationSeconds) || c.durationSeconds <= 0 || c.durationSeconds > 15 ||
            !Array.isArray(c.phonemes) || !c.phonemes.length) throw new Error("Invalid diagnostic clip");
        total += c.bytes;
      }
      for (const field of ["sourcePcmSha256", "pcmFrames", "sampleRate", "synthesisText"])
        if (clips.mp3[field] !== clips.wav[field]) throw new Error("A and B are not the same synthesis");
      if (JSON.stringify(clips.mp3.phonemes) !== JSON.stringify(clips.wav.phonemes)) throw new Error("A and B differ in phonemes");
    }
  }
  if (total !== m.totalAudioBytes || total > 2_000_000) throw new Error("Invalid diagnostic size");
  return m;
}

export function createDiagnosticPlayer(audio, onState) {
  let generation = 0;
  let current = null;
  audio.preload = "none";
  function stop() {
    generation++;
    current = null;
    audio.pause(); audio.removeAttribute("src"); audio.load();
    onState({ kind: "stopped" });
  }
  for (const kind of ["ended", "error"]) audio.addEventListener(kind, () => {
    if (current) onState({ kind, current });
  });
  function play(sample, voice, key) {
    const clip = sample.clips?.[voice]?.[key];
    const filename = `audio/${voice}-${sample.id}-${key === "explicit" ? "explicit" : "current"}.${key === "mp3" ? "mp3" : "wav"}`;
    if (!IDS.includes(sample.id) || !VOICES.includes(voice) || !Object.hasOwn(CONDITIONS, key) ||
        clip?.file !== filename || !/^[a-f0-9]{64}$/.test(clip.sha256)) throw new Error("Unsafe diagnostic clip");
    stop(); current = { id: sample.id, voice, key };
    const request = generation;
    audio.src = `./${clip.file}?v=${clip.sha256.slice(0, 12)}`;
    audio.playbackRate = 1; audio.preservesPitch = true;
    onState({ kind: "loading", current });
    try {
      return Promise.resolve(audio.play()).then(() => {
        if (request === generation) onState({ kind: "playing", current });
      }).catch((error) => {
        if (request === generation) onState({ kind: error?.name === "NotAllowedError" ? "tap-play" : "error", current });
      });
    } catch {
      onState({ kind: "error", current });
      return Promise.resolve();
    }
  }
  return { play, stop };
}
