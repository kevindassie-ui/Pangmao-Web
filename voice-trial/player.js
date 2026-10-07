export const TRIAL_VERSION = "2026-10-08-v2";
export const TRIAL_RATES = [0.85, 1, 1.15];

export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.version !== TRIAL_VERSION ||
      manifest.language !== "fr-FR" || manifest.purpose !== "comparison-only" ||
      !Array.isArray(manifest.samples) || manifest.samples.length !== 6 ||
      new Set(manifest.samples.map((s) => s.id)).size !== 6) throw new Error("Invalid trial manifest");
  let total = 0;
  const paths = new Set();
  for (const sample of manifest.samples) {
    if (!/^[a-z]+$/.test(sample.id) || typeof sample.text !== "string" || !sample.text.trim() ||
        typeof sample.label !== "string") throw new Error("Invalid trial text");
    for (const gender of ["female", "male"]) {
      const clip = sample.clips?.[gender];
      if (clip?.file !== `audio/${gender}-${sample.id}.mp3` || paths.has(clip.file) ||
          !/^[a-f0-9]{64}$/.test(clip.sha256) || !Number.isInteger(clip.bytes) ||
          clip.bytes <= 0 || clip.bytes > 250_000 || !Number.isFinite(clip.durationSeconds) ||
          clip.durationSeconds <= 0 || clip.durationSeconds > 60) throw new Error("Invalid trial audio");
      paths.add(clip.file);
      total += clip.bytes;
    }
  }
  if (total !== manifest.totalAudioBytes || total > 1_000_000) throw new Error("Invalid audio budget");
  return manifest;
}

export function createTrialPlayer(audio, onState = () => {}) {
  let generation = 0;
  let current = null;
  let rate = 1;
  audio.preload = "none";
  audio.addEventListener("ended", () => {
    if (current) onState({ kind: "ended", sample: current });
  });
  audio.addEventListener("error", () => {
    if (current) onState({ kind: "error", sample: current });
  });
  function stop() {
    generation++;
    current = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    onState({ kind: "stopped" });
  }
  function setRate(value) {
    const candidate = Number(value);
    rate = TRIAL_RATES.includes(candidate) ? candidate : 1;
    audio.playbackRate = rate;
    audio.preservesPitch = true;
    return rate;
  }
  function play(sample, gender) {
    const clip = sample?.clips?.[gender];
    if (!clip || clip.file !== `audio/${gender}-${sample.id}.mp3` || !/^[a-f0-9]{64}$/.test(clip.sha256)) {
      throw new Error("Unsafe audio path");
    }
    stop();
    current = { id: sample.id, gender, text: sample.text };
    const request = generation;
    audio.src = `./${clip.file}?v=${clip.sha256.slice(0, 12)}`;
    setRate(rate);
    onState({ kind: "loading", sample: current });
    // Call synchronously inside the tap: important for Safari's playback policy.
    try {
      return Promise.resolve(audio.play()).then(() => {
        if (request === generation) onState({ kind: "playing", sample: current });
      }).catch((error) => {
        if (request === generation) onState({ kind: error?.name === "NotAllowedError" ? "tap-play" : "error", sample: current });
      });
    } catch {
      onState({ kind: "error", sample: current });
      return Promise.resolve();
    }
  }
  return { play, stop, setRate };
}
