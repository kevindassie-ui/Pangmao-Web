import { validateDiagnostic, createDiagnosticPlayer, CONDITIONS, VERSION } from "./player.js";

const samples = document.getElementById("samples");
const status = document.getElementById("playStatus");
const voice = document.getElementById("voice");
const names = { male: "Pierre", female: "Jessica" };
const messages = { stopped: "选择一段 · Choisis un extrait", loading: "载入中 · Chargement", playing: "播放中 · Lecture",
  ended: "播放结束 · Lecture terminée", error: "无法播放，请联网重试 · Lecture impossible, vérifie la connexion",
  "tap-play": "请按播放器的 ▶ · Appuie sur ▶ dans le lecteur" };
const played = new Set();
const player = createDiagnosticPlayer(document.getElementById("audio"), (state) => {
  const c = state.current;
  status.textContent = messages[state.kind] + (c ? ` — ${names[c.voice]} · ${c.id} · ${c.key === "mp3" ? "A" : c.key === "wav" ? "B" : "C"}` : "");
  if (state.kind === "ended") played.add(`${c.voice}/${c.id}/${c.key}`);
  for (const button of samples.querySelectorAll("button")) button.setAttribute("aria-pressed", String(
    ["loading", "playing", "tap-play"].includes(state.kind) && button.dataset.sample === c?.id && button.dataset.condition === c?.key));
});
document.getElementById("stop").addEventListener("click", player.stop);
window.addEventListener("pagehide", player.stop);
document.addEventListener("visibilitychange", () => { if (document.hidden) player.stop(); });
let manifest;
function render() {
  samples.replaceChildren();
  for (const sample of manifest.samples) {
    const card = document.createElement("section"); card.className = "sample";
    const title = document.createElement("h2"); title.textContent = sample.id === "nombres" ? "fixé" : sample.id === "quotidien" ? "baguette et prendre" : sample.text;
    const text = document.createElement("p"); text.className = "text"; text.lang = "fr"; text.textContent = sample.text;
    const actions = document.createElement("div"); actions.className = "actions";
    for (const key of Object.keys(CONDITIONS)) {
      if (!sample.clips[voice.value][key]) continue;
      const button = document.createElement("button"); button.type = "button"; button.textContent = CONDITIONS[key];
      button.dataset.sample = sample.id; button.dataset.condition = key; button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${names[voice.value]} · ${sample.text} · ${CONDITIONS[key]}`);
      button.addEventListener("click", () => player.play(sample, voice.value, key)); actions.append(button);
    }
    card.append(title, text, actions); samples.append(card);
  }
}
try {
  const response = await fetch(`./manifest.json?v=${VERSION}`, { cache: "no-cache" });
  if (!response.ok) throw new Error("Manifest unavailable");
  manifest = validateDiagnostic(await response.json());
  render(); document.getElementById("loading").hidden = true;
  document.getElementById("size").textContent = `${(manifest.totalAudioBytes / 1_000_000).toFixed(2)} Mo pour tous les extraits ; seuls ceux écoutés sont chargés.`;
} catch { document.getElementById("loading").textContent = "无法载入，请联网重试 · Diagnostic indisponible, reconnecte-toi puis recharge."; }
voice.addEventListener("change", () => { player.stop(); if (manifest) render(); });
document.getElementById("copyFeedback").addEventListener("click", async () => {
  const report = document.getElementById("report");
  report.value = `Pangmao — diagnostic ${VERSION}\nExtraits terminés : ${[...played].join(", ") || "aucun"}\n${document.getElementById("comment").value}`;
  report.hidden = false;
  try { await navigator.clipboard.writeText(report.value); document.getElementById("copyStatus").textContent = "已复制 · Avis copié"; }
  catch { report.focus(); report.select(); document.getElementById("copyStatus").textContent = "请手动复制 · Copie manuellement le résumé"; }
});
