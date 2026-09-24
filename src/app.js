import { createChineseFallbackLoader } from "./chinese-fallback.js";
import { segmentFrenchText } from "./reader.js";
import { containsHan, createDictionaryIndex, getEntry, searchDictionary } from "./search-engine.js";
import {
  dismissInstallHint,
  isInstallHintDismissed,
  loadFavorites,
  loadReaderDraft,
  saveFavorites,
  saveReaderDraft,
} from "./storage.js";

const elements = Object.fromEntries(
  [
    "aboutBackdrop",
    "aboutButton",
    "aboutSheet",
    "brandIcon",
    "brandSubtitle",
    "brandTitle",
    "clearSearch",
    "closeAbout",
    "closeSheet",
    "dictionaryStatus",
    "dictionaryView",
    "dismissInstallHint",
    "emptyState",
    "entryContent",
    "entrySheet",
    "errorMessage",
    "errorState",
    "favorites",
    "favoritesEmpty",
    "favoritesView",
    "fallbackState",
    "installHint",
    "loadingState",
    "resultCount",
    "results",
    "resultsSection",
    "retryButton",
    "readerAnalyzeButton",
    "readerClearButton",
    "readerEmpty",
    "readerFile",
    "readerImportButton",
    "readerInput",
    "readerResults",
    "readerSentenceCount",
    "readerSentences",
    "readerView",
    "searchForm",
    "searchInput",
    "sheetBackdrop",
    "sourceCount",
    "sourceChineseCount",
    "sourceFallback",
    "sourceLicense",
    "sourceName",
    "sourceRevision",
    "statusDot",
    "suggestions",
    "toast",
    "welcome",
    "welcomeBody",
    "welcomeEyebrow",
    "welcomeMascot",
    "welcomeTitle",
  ].map((id) => [id, document.getElementById(id)]),
);

const grammarLabels = {
  adj: "形容词",
  adv: "副词",
  conj: "连词",
  fem: "阴性",
  interj: "感叹词",
  masc: "阳性",
  n: "名词",
  num: "数词",
  prep: "介词",
  pron: "代词",
  v: "动词",
};

let dictionary = null;
let favorites = loadFavorites();
let activeEntryId = null;
let lastFocusedElement = null;
let searchTimer = null;
let searchGeneration = 0;
let toastTimer = null;
let loadedEntryCount = 0;
let offlineReady = false;
let readerSentences = [];
const lookupChineseFallback = createChineseFallbackLoader();

const defaultBrand = {
  id: "global",
  theme: "global",
  title: "胖猫",
  subtitle: "我学法语",
  icon: "./icons/icon-192.png",
  iconAlt: "胖猫图标",
  mascot: "",
  themeColor: "#0f6b4f",
  welcomeEyebrow: "法语 ⇄ 中文",
  welcomeTitle: "两种语言，都可以直接搜索",
  welcomeBody: "输入法语，查看中文含义；输入中文，找到对应的法语词。词典首次载入后可离线使用。",
};

function node(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type) element.type = options.type;
  if (options.ariaLabel) element.setAttribute("aria-label", options.ariaLabel);
  if (options.dataset) Object.assign(element.dataset, options.dataset);
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  }
  element.append(...children.filter(Boolean));
  return element;
}

function applyBranding(value) {
  const brand = { ...defaultBrand, ...(value ?? {}) };
  document.documentElement.dataset.brand = brand.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", brand.themeColor);
  elements.brandTitle.textContent = brand.title;
  elements.brandSubtitle.textContent = brand.subtitle;
  elements.brandIcon.src = brand.icon;
  elements.brandIcon.alt = brand.iconAlt;
  elements.welcomeEyebrow.textContent = brand.welcomeEyebrow;
  elements.welcomeTitle.textContent = brand.welcomeTitle;
  elements.welcomeBody.textContent = brand.welcomeBody;
  if (brand.mascot) {
    elements.welcomeMascot.src = brand.mascot;
    elements.welcomeMascot.hidden = false;
  } else {
    elements.welcomeMascot.hidden = true;
    elements.welcomeMascot.removeAttribute("src");
  }
}

async function loadBranding() {
  try {
    const response = await fetch("./brand.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applyBranding(await response.json());
  } catch (error) {
    console.warn("Unable to load branding; using global defaults", error);
    applyBranding(defaultBrand);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function setStatus(kind, message) {
  elements.statusDot.className = `status-dot${kind ? ` ${kind}` : ""}`;
  elements.dictionaryStatus.textContent = message;
}

function updateReadyStatus() {
  if (!loadedEntryCount) return;
  const count = new Intl.NumberFormat("zh-CN").format(loadedEntryCount);
  setStatus("", `${count} 个词条${offlineReady ? " · 可离线使用" : ""}`);
}

function grammarFacts(entry) {
  const values = [...entry.partsOfSpeech, ...entry.genders];
  return [...new Set(values)].map((value) => grammarLabels[value] ?? value);
}

function previewFor(result) {
  const indexes = result.matchedSenseIndexes?.length
    ? result.matchedSenseIndexes
    : result.entry.senses.map((_, index) => index);
  const values = indexes.flatMap((index) => result.entry.senses[index]?.chinese ?? []);
  return [...new Set(values)].slice(0, 6).join(" · ") || "暂无中文释义";
}

function resultCard(result) {
  const entry = result.entry;
  const wordBlock = node("div", {}, [
    node("h3", { className: "result-word", text: entry.headword }),
    entry.pronunciations.length
      ? node("div", { className: "pronunciation", text: `/${entry.pronunciations.join("/ · /")}/` })
      : null,
  ]);
  const facts = grammarFacts(entry);
  const topLine = node("div", { className: "result-topline" }, [
    wordBlock,
    facts.length ? node("span", { className: "grammar-badge", text: facts[0] }) : null,
  ]);
  const children = [
    topLine,
    node("p", { className: "meaning-preview", text: previewFor(result) }),
  ];
  if (result.matchType === "inflection") {
    children.push(
      node("span", {
        className: "match-note",
        text: `已识别词形，显示原形：${entry.headword}`,
      }),
    );
  }
  const card = node(
    "button",
    {
      className: "result-card",
      type: "button",
      ariaLabel: `打开词条：${entry.headword}`,
    },
    children,
  );
  card.addEventListener("click", () => openEntry(entry.id));
  return card;
}

function fallbackResultCard(query, record) {
  const inferred = record.kind === "inferred";
  const meanings = inferred ? record.possibleFrench ?? [] : record.french ?? [];
  const meaningItems = meanings.map((meaning) =>
    node("li", {}, [
      node("span", { text: meaning, attributes: { lang: "fr" } }),
      (() => {
        const button = node("button", {
          className: "fallback-speak",
          text: "♪",
          type: "button",
          ariaLabel: `播放法语发音：${meaning}`,
        });
        button.addEventListener("click", () => speakFrench(meaning));
        return button;
      })(),
    ]),
  );
  const note = inferred
    ? `根据与“${record.inferredFrom}”相同的词典释义推测；这不是直接收录的法语翻译。`
    : "来自胖猫补充词典的直接法语释义。";
  return node("article", { className: `result-card fallback-card${inferred ? " inferred" : ""}` }, [
    node("div", { className: "fallback-heading" }, [
      node("div", {}, [
        node("h3", { className: "result-word", text: query }),
      ]),
      node("span", {
        className: `fallback-badge${inferred ? " inferred" : ""}`,
        text: inferred ? "可能含义" : "补充词典",
      }),
    ]),
    node("ul", { className: "fallback-meanings" }, meaningItems),
    node("p", { className: "fallback-note", text: note }),
  ]);
}

function renderResults(results) {
  elements.results.replaceChildren(...results.map(resultCard));
  elements.resultCount.textContent = results.length ? `${results.length} 条` : "";
  elements.resultsSection.hidden = results.length === 0;
  elements.emptyState.hidden = results.length !== 0;
}

function renderFallbackResults(query, records) {
  elements.results.replaceChildren(...records.map((record) => fallbackResultCard(query, record)));
  elements.resultCount.textContent = records.length ? `${records.length} 条补充结果` : "";
  elements.resultsSection.hidden = records.length === 0;
  elements.emptyState.hidden = records.length !== 0;
}

async function runSearch({ focus = false } = {}) {
  if (!dictionary) return;
  const generation = ++searchGeneration;
  const query = elements.searchInput.value.trim();
  elements.clearSearch.hidden = query.length === 0;
  elements.welcome.hidden = query.length > 0;
  elements.emptyState.hidden = true;
  elements.fallbackState.hidden = true;

  if (!query) {
    elements.resultsSection.hidden = true;
    elements.results.replaceChildren();
    elements.resultCount.textContent = "";
  } else {
    const results = searchDictionary(dictionary, query);
    renderResults(results);
    if (results.length === 0 && containsHan(query)) {
      elements.emptyState.hidden = true;
      elements.fallbackState.hidden = false;
      try {
        const fallbackResults = await lookupChineseFallback(query);
        if (generation !== searchGeneration || elements.searchInput.value.trim() !== query) return;
        elements.fallbackState.hidden = true;
        renderFallbackResults(query, fallbackResults);
      } catch (error) {
        console.warn("Unable to load Chinese fallback", error);
        if (generation !== searchGeneration) return;
        elements.fallbackState.hidden = true;
        elements.emptyState.hidden = false;
      }
    }
  }
  if (focus) elements.searchInput.focus();
}

function searchFor(query) {
  switchView("dictionaryView");
  elements.searchInput.value = query;
  runSearch();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function speakFrench(text) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    showToast("这台设备暂不支持语音播放");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.82;
  const frenchVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLocaleLowerCase().startsWith("fr"));
  if (frenchVoice) utterance.voice = frenchVoice;
  utterance.onerror = () => showToast("发音播放失败，请稍后重试");
  window.speechSynthesis.speak(utterance);
}

function findReaderEntry(candidates) {
  if (!dictionary) return null;
  for (const candidate of candidates) {
    const result = searchDictionary(dictionary, candidate, 12).find(
      ({ matchType }) => matchType === "exact" || matchType === "inflection",
    );
    if (result) return result.entry;
  }
  return null;
}

function readerWordNode(token) {
  if (!token.isWord) return node("span", { text: token.text });
  const button = node("button", {
    className: "reader-word",
    text: token.text,
    type: "button",
    ariaLabel: `查看词条：${token.text}`,
    attributes: { lang: "fr" },
  });
  button.addEventListener("click", () => {
    if (!dictionary) {
      showToast("词典仍在载入，请稍后再试");
      return;
    }
    const entry = findReaderEntry(token.lookupCandidates);
    if (!entry) {
      showToast(`词典里还没有“${token.text}”`);
      return;
    }
    openEntry(entry.id);
  });
  return button;
}

function readerSentenceCard(sentence, index) {
  const speakButton = node("button", {
    className: "reader-speak",
    text: "♪ 朗读本句",
    type: "button",
    ariaLabel: `朗读第 ${index + 1} 句`,
  });
  speakButton.addEventListener("click", () => speakFrench(sentence.text));
  return node("article", { className: "reader-sentence-card" }, [
    node("div", { className: "reader-sentence-header" }, [
      node("span", { className: "reader-sentence-number", text: `第 ${index + 1} 句` }),
      speakButton,
    ]),
    node(
      "p",
      { className: "reader-sentence-text", attributes: { lang: "fr" } },
      sentence.tokens.map(readerWordNode),
    ),
  ]);
}

function renderReader() {
  const totalWords = readerSentences.reduce((total, sentence) => total + sentence.wordCount, 0);
  elements.readerSentences.replaceChildren(
    ...readerSentences.map((sentence, index) => readerSentenceCard(sentence, index)),
  );
  elements.readerSentenceCount.textContent = readerSentences.length
    ? `${readerSentences.length} 句 · ${totalWords} 个词`
    : "";
  elements.readerResults.hidden = readerSentences.length === 0;
  elements.readerEmpty.hidden = readerSentences.length !== 0;
}

function analyzeReader({ announce = true } = {}) {
  const value = elements.readerInput.value;
  saveReaderDraft(value);
  readerSentences = segmentFrenchText(value);
  renderReader();
  if (!readerSentences.length) {
    if (announce) showToast("请先输入一段法语文本");
    elements.readerInput.focus();
  } else if (announce) {
    showToast(`已拆分为 ${readerSentences.length} 句`);
  }
}

function clearReader() {
  window.speechSynthesis?.cancel();
  elements.readerInput.value = "";
  saveReaderDraft("");
  readerSentences = [];
  renderReader();
  elements.readerInput.focus();
}

function readTextFile(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsText(file, "UTF-8");
  });
}

async function importReaderFile() {
  const [file] = elements.readerFile.files ?? [];
  elements.readerFile.value = "";
  if (!file) return;
  if (!file.name.toLocaleLowerCase().endsWith(".txt")) {
    showToast("当前只支持 .txt 文本文件");
    return;
  }
  if (file.size > 1024 * 1024) {
    showToast("文件不能超过 1 MB");
    return;
  }
  try {
    const value = await readTextFile(file);
    if (!value.trim() || value.includes("\0")) throw new Error("Invalid text file");
    elements.readerInput.value = value.slice(0, 100_000);
    analyzeReader({ announce: false });
    showToast(`已导入 ${file.name}`);
  } catch (error) {
    console.warn("Unable to import reader text", error);
    showToast("无法读取这个文本文件");
  }
}

function chineseGlossaryCard(entry) {
  const groups = entry.chineseGlosses ?? [];
  if (!groups.length) return null;
  return node("section", { className: "chinese-glossary" }, [
    node("div", { className: "glossary-heading" }, [
      node("strong", { text: "中文解释" }),
      node("span", { text: "中文维基词典" }),
    ]),
    ...groups.map((group) =>
      node("div", { className: "glossary-group" }, [
        group.label ? node("span", { className: "glossary-pos", text: group.label }) : null,
        node("p", { text: group.glosses.join("；") }),
      ]),
    ),
  ]);
}

function senseCard(sense, index) {
  const chinese = sense.chinese.map((translation) => {
    const chip = node("button", {
      className: "chinese-chip",
      text: translation,
      type: "button",
      ariaLabel: `搜索中文：${translation}`,
    });
    chip.addEventListener("click", () => {
      closeEntry();
      searchFor(translation);
    });
    return chip;
  });
  const definitions = sense.definitions.join("；");
  const sourceDetails = node("details", { className: "source-definition" }, [
    node("summary", { text: "查看法语原始释义" }),
    definitions
      ? node("p", { text: definitions, attributes: { lang: "fr" } })
      : node("p", { text: "暂无法语原始释义" }),
  ]);
  return node("section", { className: "sense-card" }, [
    node("span", { className: "sense-number", text: String(index + 1) }),
    node("span", { className: "sense-label", text: "中文释义" }),
    chinese.length ? node("div", { className: "chinese-list" }, chinese) : null,
    sourceDetails,
  ]);
}

function favoriteButton(entry) {
  const selected = favorites.has(entry.id);
  const button = node("button", {
    className: `round-action${selected ? " active" : ""}`,
    text: selected ? "♥" : "♡",
    type: "button",
    ariaLabel: selected ? "取消收藏" : "收藏",
    attributes: { "aria-pressed": String(selected) },
  });
  button.addEventListener("click", () => {
    if (favorites.has(entry.id)) {
      favorites.delete(entry.id);
      showToast("已取消收藏");
    } else {
      favorites.add(entry.id);
      showToast("已收藏");
    }
    saveFavorites(favorites);
    renderFavorites();
    openEntry(entry.id, { preserveFocus: true });
  });
  return button;
}

function entryDetails(entry) {
  const facts = grammarFacts(entry);
  const wordRow = node("div", { className: "sheet-word-row" }, [
    node("div", {}, [
      node("h2", { text: entry.headword, attributes: { id: "entryTitle", lang: "fr" } }),
      entry.pronunciations.length
        ? node("div", {
            className: "pronunciation",
            text: `/${entry.pronunciations.join("/ · /")}/`,
          })
        : null,
    ]),
    node("div", { className: "sheet-actions" }, [
      (() => {
        const button = node("button", {
          className: "round-action",
          text: "♪",
          type: "button",
          ariaLabel: `播放法语发音：${entry.headword}`,
        });
        button.addEventListener("click", () => speakFrench(entry.headword));
        return button;
      })(),
      favoriteButton(entry),
    ]),
  ]);
  return [
    wordRow,
    facts.length
      ? node(
          "div",
          { className: "entry-facts" },
          facts.map((fact) => node("span", { text: fact })),
        )
      : null,
    chineseGlossaryCard(entry),
    ...entry.senses.map(senseCard),
  ].filter(Boolean);
}

function openEntry(entryId, { preserveFocus = false } = {}) {
  if (!dictionary) return;
  const entry = getEntry(dictionary, entryId);
  if (!entry) return;
  if (!preserveFocus) lastFocusedElement = document.activeElement;
  activeEntryId = entryId;
  elements.entryContent.replaceChildren(...entryDetails(entry));
  elements.sheetBackdrop.hidden = false;
  elements.entrySheet.hidden = false;
  document.body.classList.add("sheet-open");
  elements.closeSheet.focus({ preventScroll: true });
}

function closeEntry({ restoreFocus = true } = {}) {
  if (elements.entrySheet.hidden) return;
  window.speechSynthesis?.cancel();
  elements.entrySheet.hidden = true;
  elements.sheetBackdrop.hidden = true;
  elements.entryContent.replaceChildren();
  document.body.classList.remove("sheet-open");
  activeEntryId = null;
  if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus({ preventScroll: true });
  }
}

function openAbout() {
  lastFocusedElement = document.activeElement;
  elements.aboutBackdrop.hidden = false;
  elements.aboutSheet.hidden = false;
  document.body.classList.add("sheet-open");
  elements.closeAbout.focus({ preventScroll: true });
}

function closeAbout() {
  if (elements.aboutSheet.hidden) return;
  elements.aboutSheet.hidden = true;
  elements.aboutBackdrop.hidden = true;
  document.body.classList.remove("sheet-open");
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus({ preventScroll: true });
}

function renderFavorites() {
  if (!dictionary) return;
  const entries = [...favorites]
    .map((entryId) => getEntry(dictionary, entryId))
    .filter(Boolean)
    .sort((left, right) => left.headword.localeCompare(right.headword, "fr"));
  const missingIds = [...favorites].filter((entryId) => !getEntry(dictionary, entryId));
  if (missingIds.length) {
    missingIds.forEach((entryId) => favorites.delete(entryId));
    saveFavorites(favorites);
  }
  elements.favorites.replaceChildren(
    ...entries.map((entry) =>
      resultCard({
        entry,
        matchedSenseIndexes: entry.senses.map((_, index) => index),
        matchType: "favorite",
      }),
    ),
  );
  elements.favoritesEmpty.hidden = entries.length > 0;
}

function switchView(viewId) {
  for (const candidate of ["dictionaryView", "readerView", "favoritesView"]) {
    elements[candidate].hidden = candidate !== viewId;
  }
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === viewId;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (viewId === "favoritesView") renderFavorites();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillSourceDetails(pack) {
  const supplementSources = pack.supplementSources ?? [];
  elements.sourceName.textContent = [pack.source, ...supplementSources]
    .map((source) => source.name)
    .join(" + ");
  elements.sourceRevision.textContent = pack.source.revision;
  const enrichmentLicenses = (pack.enrichmentSources ?? []).map((source) => source.license);
  const supplementLicenses = supplementSources.map((source) => source.license);
  elements.sourceLicense.textContent = [
    ...new Set([pack.source.license, ...enrichmentLicenses, ...supplementLicenses]),
  ].join(" / ");
  elements.sourceCount.textContent = new Intl.NumberFormat("zh-CN").format(pack.entryCount);
  elements.sourceChineseCount.textContent = pack.enrichedEntryCount
    ? `${new Intl.NumberFormat("zh-CN").format(pack.enrichedEntryCount)} 个法语词条`
    : "仅显示法中对应词";
  elements.sourceFallback.textContent = "按需载入 · 直接释义与明确标记的推测分开";
}

async function loadDictionary() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  setStatus("loading", "正在载入词典");
  try {
    const response = await fetch("./data/french-pack.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pack = await response.json();
    dictionary = createDictionaryIndex(pack);
    loadedEntryCount = pack.entryCount;
    fillSourceDetails(pack);
    renderFavorites();
    elements.loadingState.hidden = true;
    updateReadyStatus();
    runSearch();
  } catch (error) {
    console.error("Unable to load dictionary", error);
    dictionary = null;
    loadedEntryCount = 0;
    elements.loadingState.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = navigator.onLine
      ? "词典数据无法读取，请稍后重试。"
      : "当前没有网络，且离线词典尚未下载完成。";
    setStatus("error", "词典载入失败");
  }
}

function configureInstallHint() {
  const userAgent = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  elements.installHint.hidden = !(iOS && safari && !standalone && !isInstallHintDismissed());
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    runSearch();
    elements.searchInput.blur();
  });
  elements.searchInput.addEventListener("input", () => {
    elements.clearSearch.hidden = elements.searchInput.value.length === 0;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 140);
  });
  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    runSearch({ focus: true });
  });
  elements.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-query]");
    if (button) searchFor(button.dataset.query);
  });
  elements.readerInput.addEventListener("input", () => {
    saveReaderDraft(elements.readerInput.value);
  });
  elements.readerAnalyzeButton.addEventListener("click", () => analyzeReader());
  elements.readerClearButton.addEventListener("click", clearReader);
  elements.readerImportButton.addEventListener("click", () => elements.readerFile.click());
  elements.readerFile.addEventListener("change", importReaderFile);
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  elements.closeSheet.addEventListener("click", () => closeEntry());
  elements.sheetBackdrop.addEventListener("click", () => closeEntry());
  elements.aboutButton.addEventListener("click", openAbout);
  elements.closeAbout.addEventListener("click", closeAbout);
  elements.aboutBackdrop.addEventListener("click", closeAbout);
  elements.retryButton.addEventListener("click", loadDictionary);
  elements.dismissInstallHint.addEventListener("click", () => {
    dismissInstallHint();
    elements.installHint.hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!elements.entrySheet.hidden) closeEntry();
    else if (!elements.aboutSheet.hidden) closeAbout();
  });
  window.addEventListener("online", () => {
    if (!dictionary) loadDictionary();
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    offlineReady = true;
    updateReadyStatus();
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

applyBranding(defaultBrand);
elements.readerInput.value = loadReaderDraft();
bindEvents();
configureInstallHint();
loadBranding();
loadDictionary();
registerServiceWorker();
