import { createTrialPlayer, validateManifest, TRIAL_VERSION } from "./player.js";

const status = document.getElementById("playStatus");
const loading = document.getElementById("loading");
const samples = document.getElementById("samples");
const messages = {
  stopped: "选择一段试听 · Choisis un extrait",
  loading: "正在载入声音… · Chargement de l’extrait…",
  playing: "正在播放 · Lecture en cours",
  ended: "播放结束 · Lecture terminée",
  "tap-play": "请按播放器的 ▶ · Appuie sur ▶ dans le lecteur",
  error: "声音无法载入，请联网重试 · Extrait indisponible, reconnecte-toi puis réessaie",
};
const player = createTrialPlayer(document.getElementById("audio"), (state) => {
  const voice = state.sample?.gender === "female" ? "女声 · Femme" : "男声 · Homme";
  status.textContent = `${messages[state.kind]}${state.sample ? ` — ${voice}` : ""}`;
  for (const button of samples.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(
      ["loading", "playing", "tap-play"].includes(state.kind) &&
      button.dataset.sample === state.sample?.id && button.dataset.gender === state.sample?.gender,
    ));
  }
});
document.getElementById("speed").addEventListener("change", (event) => player.setRate(event.target.value));
document.getElementById("stop").addEventListener("click", player.stop);
window.addEventListener("pagehide", player.stop);
document.addEventListener("visibilitychange", () => { if (document.hidden) player.stop(); });

try {
  const response = await fetch("./manifest.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Manifest unavailable");
  const manifest = validateManifest(await response.json());
  for (const sample of manifest.samples) {
    const card = document.createElement("section");
    card.className = "sample";
    const label = document.createElement("p");
    label.className = "label";
    label.textContent = sample.label;
    const text = document.createElement("p");
    text.className = "text";
    text.lang = "fr";
    text.textContent = sample.text;
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const gender of ["female", "male"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = gender === "female" ? "▶ 女声 · Femme" : "▶ 男声 · Homme";
      button.dataset.sample = sample.id;
      button.dataset.gender = gender;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${button.textContent} : ${sample.text}`);
      button.addEventListener("click", () => player.play(sample, gender));
      actions.append(button);
    }
    card.append(label, text, actions);
    samples.append(card);
  }
  loading.hidden = true;
  document.getElementById("size").textContent = `12 extraits : ${(manifest.totalAudioBytes / 1000).toFixed(0)} Ko au total, chargés à l’écoute.`;
} catch {
  loading.textContent = "试听暂时无法载入，请联网刷新 · Essai indisponible. Reconnecte-toi puis actualise la page.";
}

document.getElementById("copyFeedback").addEventListener("click", async () => {
  const report = document.getElementById("report");
  report.value = [
    `Pangmao — essai ${TRIAL_VERSION}`,
    `Femme (Jessica) : ${document.getElementById("femaleRating").value}`,
    `Homme (Pierre) : ${document.getElementById("maleRating").value}`,
    `Vitesse : ${document.getElementById("speed").value}`,
    `Remarque : ${document.getElementById("comment").value}`,
  ].join("\n");
  report.hidden = false;
  try {
    await navigator.clipboard.writeText(report.value);
    status.textContent = "已复制 · Avis copié";
  } catch {
    report.focus();
    report.select();
    status.textContent = "请手动复制下方摘要 · Copie manuellement le résumé affiché";
  }
});

const offline = document.getElementById("offlineStatus");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { type: "module", scope: "./" }).then((registration) => {
    offline.textContent = "Cache hors ligne en préparation. Les extraits restent accessibles en ligne.";
    const worker = registration.installing || registration.waiting || registration.active;
    const update = () => {
      if (worker?.state === "activated") offline.textContent = "Cache des extraits écoutés disponible, sans téléchargement global.";
      if (worker?.state === "redundant") offline.textContent = "Cache hors ligne indisponible. Écoute en ligne disponible.";
    };
    worker?.addEventListener("statechange", update);
    update();
  }).catch(() => { offline.textContent = "Cache hors ligne indisponible dans ce navigateur. Écoute en ligne disponible."; });
} else {
  offline.textContent = "Cache hors ligne indisponible dans ce navigateur. Écoute en ligne disponible.";
}
