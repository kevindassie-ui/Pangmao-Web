import { createChineseFallbackLoader } from "./chinese-fallback.js?v=0.3.3";
import { segmentFrenchText } from "./reader.js?v=0.3.3";
import { WEB_VERSION, versionedAsset } from "./release.js?v=0.3.3";
import {
  createDictionaryIndex,
  getEntry,
  needsExactChineseFallback,
  searchDictionary,
} from "./search-engine.js?v=0.3.3";
import {
  dismissInstallHint,
  isInstallHintDismissed,
  loadFrenchVoiceId,
  loadFrenchVoiceProfile,
  loadFavorites,
  loadReaderDraft,
  saveFrenchVoiceId,
  saveFrenchVoiceProfile,
  saveFavorites,
  saveReaderDraft,
} from "./storage.js?v=0.3.3";
import {
  availableVoices,
  formatFrenchVoiceDiagnostics,
  listFrenchVoices,
  selectFrenchVoice,
  speakWithFrenchVoice,
  waitForFrenchVoice,
  voiceIdentifier,
} from "./tts.js?v=0.3.3";

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
    "seasonalMooncakes",
    "seasonalOsmanthus",
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
    "voiceSelect",
    "voiceApplyButton",
    "voiceCopyButton",
    "voiceFemaleButton",
    "voiceMaleButton",
    "voiceHelp",
    "voiceStatus",
    "voiceTestButton",
    "webVersion",
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

const voiceGenderLabels = {
  female: "女声",
  male: "男声",
};
const frenchVoiceSample = "Bonjour, je voudrais acheter une baguette et prendre le train pour Toulouse.";

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
const legacyFrenchVoiceId = loadFrenchVoiceId();
let frenchVoiceProfile = loadFrenchVoiceProfile();
let pendingFrenchVoiceId = "";
let preferredFrenchVoiceId =
  frenchVoiceProfile.voices[frenchVoiceProfile.activeGender] ||
  (frenchVoiceProfile.activeGender === "female" ? legacyFrenchVoiceId : "");
let voiceRefreshTimers = [];
let activeFrenchUtterance = null;
let speechRequestGeneration = 0;
const lookupChineseFallback = createChineseFallbackLoader({ cacheTag: WEB_VERSION });

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
  seasonal: null,
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
  const seasonal = brand.seasonal && typeof brand.seasonal === "object" ? brand.seasonal : null;
  if (seasonal?.id && seasonal.osmanthus && seasonal.mooncakes) {
    document.documentElement.dataset.seasonal = seasonal.id;
    document.documentElement.style.setProperty(
      "--seasonal-osmanthus-image",
      `url("${seasonal.osmanthus}")`,
    );
    document.documentElement.style.setProperty(
      "--seasonal-mooncakes-image",
      `url("${seasonal.mooncakes}")`,
    );
    elements.seasonalOsmanthus.src = seasonal.osmanthus;
    elements.seasonalMooncakes.src = seasonal.mooncakes;
    elements.seasonalOsmanthus.hidden = false;
    elements.seasonalMooncakes.hidden = false;
  } else {
    delete document.documentElement.dataset.seasonal;
    document.documentElement.style.removeProperty("--seasonal-osmanthus-image");
    document.documentElement.style.removeProperty("--seasonal-mooncakes-image");
    elements.seasonalOsmanthus.hidden = true;
    elements.seasonalMooncakes.hidden = true;
    elements.seasonalOsmanthus.removeAttribute("src");
    elements.seasonalMooncakes.removeAttribute("src");
  }
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
    const response = await fetch(versionedAsset("./brand.json"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applyBranding(await response.json());
  } catch (error) {
    console.warn("Unable to load branding; using global defaults", error);
    applyBranding(defaultBrand);
  }
}

function showToast(message, duration = 2_200) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, duration);
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

function speechSupported() {
  return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

function voiceLabel(voice) {
  const locality = voice.localService ? "设备" : "在线";
  return `${voice.name} · ${voice.lang} · ${locality}`;
}

function activeVoiceGenderLabel() {
  return voiceGenderLabels[frenchVoiceProfile.activeGender];
}

function updateVoiceGenderControls({ disabled = false } = {}) {
  const female = frenchVoiceProfile.activeGender === "female";
  elements.voiceFemaleButton.setAttribute("aria-pressed", String(female));
  elements.voiceMaleButton.setAttribute("aria-pressed", String(!female));
  elements.voiceFemaleButton.disabled = disabled;
  elements.voiceMaleButton.disabled = disabled;
  elements.voiceApplyButton.textContent = `保存为${activeVoiceGenderLabel()}`;
}

function findVoiceByIdentifier(voices, identifier) {
  if (!identifier) return null;
  return voices.find((voice) => voiceIdentifier(voice) === identifier) ?? null;
}

function candidateVoiceForActiveProfile(voices) {
  const gender = frenchVoiceProfile.activeGender;
  const savedIdentifier = frenchVoiceProfile.voices[gender];
  const saved = findVoiceByIdentifier(voices, savedIdentifier);
  if (saved) return saved;

  const pending = findVoiceByIdentifier(voices, pendingFrenchVoiceId);
  if (pending) return pending;

  if (gender === "female") {
    const legacy = findVoiceByIdentifier(voices, legacyFrenchVoiceId);
    if (legacy) return legacy;
  }

  const otherGender = gender === "female" ? "male" : "female";
  const otherIdentifier = frenchVoiceProfile.voices[otherGender];
  return voices.find((voice) => voiceIdentifier(voice) !== otherIdentifier) ?? voices[0] ?? null;
}

function refreshFrenchVoiceControls() {
  updateVoiceGenderControls({ disabled: !speechSupported() });
  if (!speechSupported()) {
    elements.voiceSelect.disabled = true;
    elements.voiceTestButton.disabled = true;
    elements.voiceApplyButton.disabled = true;
    elements.voiceSelect.replaceChildren(new Option("此浏览器不支持语音", ""));
    elements.voiceStatus.textContent = "此浏览器没有提供网页语音合成功能。";
    return [];
  }

  const allVoices = availableVoices(window.speechSynthesis);
  const voices = listFrenchVoices(allVoices);
  elements.voiceSelect.replaceChildren();
  if (!voices.length) {
    elements.voiceSelect.append(new Option("未找到法语声音", ""));
    elements.voiceSelect.disabled = true;
    elements.voiceTestButton.disabled = false;
    elements.voiceApplyButton.disabled = true;
    elements.voiceTestButton.textContent = "重新检测";
    elements.voiceHelp.open = true;
    elements.voiceStatus.textContent = allVoices.length
      ? `浏览器返回了 ${allVoices.length} 个系统声音，但没有法语声音。请按下方步骤安装法语（法国）声音，然后重新检测。`
      : "浏览器暂未返回任何系统声音。请先从 Safari、Chrome 或主屏幕启动胖猫，再重新检测；若仍为空，请安装法语声音。";
    return [];
  }

  voices.forEach((voice) => {
    elements.voiceSelect.append(new Option(voiceLabel(voice), voiceIdentifier(voice)));
  });
  const selected = candidateVoiceForActiveProfile(voices);
  const savedIdentifier = frenchVoiceProfile.voices[frenchVoiceProfile.activeGender];
  const savedVoice = findVoiceByIdentifier(voices, savedIdentifier);
  pendingFrenchVoiceId = voiceIdentifier(selected);
  preferredFrenchVoiceId = voiceIdentifier(selected);
  elements.voiceSelect.value = preferredFrenchVoiceId;
  elements.voiceSelect.disabled = false;
  elements.voiceTestButton.disabled = false;
  elements.voiceApplyButton.disabled = false;
  elements.voiceTestButton.textContent = "试听当前声音";
  elements.voiceHelp.open = false;
  if (savedVoice) {
    elements.voiceStatus.textContent = `已保存${activeVoiceGenderLabel()}：${voiceLabel(savedVoice)}`;
  } else if (savedIdentifier) {
    elements.voiceStatus.textContent = `之前保存的${activeVoiceGenderLabel()}已不可用。请试听并保存新的声音。`;
  } else {
    elements.voiceStatus.textContent = `${activeVoiceGenderLabel()}尚未保存。请试听候选声音并确认选择。`;
  }
  return voices;
}

function setActiveVoiceGender(gender) {
  if (!(gender in voiceGenderLabels) || gender === frenchVoiceProfile.activeGender) return;
  cancelFrenchSpeech();
  frenchVoiceProfile = { ...frenchVoiceProfile, activeGender: gender };
  saveFrenchVoiceProfile(frenchVoiceProfile);
  pendingFrenchVoiceId = "";
  preferredFrenchVoiceId = frenchVoiceProfile.voices[gender] || "";
  refreshFrenchVoiceControls();
}

function saveActiveVoiceChoice() {
  const identifier = elements.voiceSelect.value;
  if (!identifier) {
    showToast("请先选择一个法语声音");
    return;
  }
  frenchVoiceProfile = {
    ...frenchVoiceProfile,
    voices: {
      ...frenchVoiceProfile.voices,
      [frenchVoiceProfile.activeGender]: identifier,
    },
  };
  pendingFrenchVoiceId = identifier;
  preferredFrenchVoiceId = identifier;
  saveFrenchVoiceProfile(frenchVoiceProfile);
  saveFrenchVoiceId(identifier);
  refreshFrenchVoiceControls();
  showToast(`已保存${activeVoiceGenderLabel()}`);
}

async function copyVoiceDiagnostics() {
  const diagnostics = formatFrenchVoiceDiagnostics(availableVoices(window.speechSynthesis), {
    releaseVersion: WEB_VERSION,
    activeGender: frenchVoiceProfile.activeGender,
    profileVoices: frenchVoiceProfile.voices,
  });
  try {
    await navigator.clipboard.writeText(diagnostics);
    showToast("声音信息已复制，可以粘贴给测试人员");
  } catch {
    showToast("无法复制声音信息；请截屏当前声音设置", 4_200);
  }
}

function initializeFrenchVoices() {
  elements.webVersion.textContent = WEB_VERSION;
  refreshFrenchVoiceControls();
  if (!speechSupported()) return;
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshFrenchVoiceControls);
  voiceRefreshTimers = [250, 1_000, 2_500, 5_000].map((delay) =>
    window.setTimeout(refreshFrenchVoiceControls, delay),
  );
  window.addEventListener("pageshow", refreshFrenchVoiceControls);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshFrenchVoiceControls();
  });
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
    if (needsExactChineseFallback(query, results)) {
      if (results.length === 0) elements.emptyState.hidden = true;
      elements.fallbackState.hidden = false;
      try {
        const fallbackResults = await lookupChineseFallback(query);
        if (generation !== searchGeneration || elements.searchInput.value.trim() !== query) return;
        elements.fallbackState.hidden = true;
        if (fallbackResults.length) renderFallbackResults(query, fallbackResults);
        else if (results.length === 0) renderResults([]);
      } catch (error) {
        console.warn("Unable to load Chinese fallback", error);
        if (generation !== searchGeneration) return;
        elements.fallbackState.hidden = true;
        if (results.length === 0) elements.emptyState.hidden = false;
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

async function speakFrench(text) {
  const synth = speechSupported() ? window.speechSynthesis : null;
  const requestGeneration = ++speechRequestGeneration;
  if (!synth) {
    showToast("这台设备暂不支持网页语音播放");
    return;
  }

  let selectedVoice = selectFrenchVoice(availableVoices(synth), preferredFrenchVoiceId);
  if (!selectedVoice) {
    showToast("正在重新读取设备上的法语声音…");
    selectedVoice = await waitForFrenchVoice({
      synth,
      preferredIdentifier: preferredFrenchVoiceId,
    });
    if (requestGeneration !== speechRequestGeneration) return;
    refreshFrenchVoiceControls();
  }
  if (!selectedVoice) {
    showToast("设备没有提供法语声音；请在“关于”中按步骤安装后重新检测", 5_200);
    return;
  }

  const result = speakWithFrenchVoice({
    synth,
    Utterance: window.SpeechSynthesisUtterance,
    text,
    preferredIdentifier: preferredFrenchVoiceId,
    selectedVoice,
    onError: (event) => {
      if (activeFrenchUtterance === event.currentTarget) activeFrenchUtterance = null;
      if (event.error !== "canceled" && event.error !== "interrupted") {
        showToast("法语发音播放失败；请在“关于”中测试其他声音");
      }
    },
    onEnd: (event) => {
      if (activeFrenchUtterance === event.currentTarget) activeFrenchUtterance = null;
    },
  });
  if (!result.ok) {
    refreshFrenchVoiceControls();
    showToast(
      result.reason === "no-french-voice"
        ? "没有找到法语声音；请在“关于”中查看语音设置"
        : "法语发音无法启动；请在“关于”中重新检测声音",
      4_200,
    );
    return;
  }
  activeFrenchUtterance = result.utterance;
}

function cancelFrenchSpeech() {
  speechRequestGeneration += 1;
  activeFrenchUtterance = null;
  window.speechSynthesis?.cancel();
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
  cancelFrenchSpeech();
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
  cancelFrenchSpeech();
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
  const editorialSources = pack.editorialSources ?? [];
  elements.sourceName.textContent = [pack.source, ...supplementSources, ...editorialSources]
    .map((source) => source.name)
    .join(" + ");
  elements.sourceRevision.textContent = pack.source.revision;
  const enrichmentLicenses = (pack.enrichmentSources ?? []).map((source) => source.license);
  const supplementLicenses = supplementSources.map((source) => source.license);
  const editorialLicenses = editorialSources.map((source) => source.license);
  elements.sourceLicense.textContent = [
    ...new Set([
      pack.source.license,
      ...enrichmentLicenses,
      ...supplementLicenses,
      ...editorialLicenses,
    ]),
  ].join(" / ");
  elements.sourceCount.textContent = new Intl.NumberFormat("zh-CN").format(pack.entryCount);
  elements.sourceChineseCount.textContent = pack.enrichedEntryCount
    ? `${new Intl.NumberFormat("zh-CN").format(pack.enrichedEntryCount)} 个法语词条`
    : "仅显示法中对应词";
  elements.sourceFallback.textContent = "按需载入 · 直接释义与明确标记的推测分开";
}

async function clearPangmaoWebCaches() {
  if (!("caches" in window)) return;
  const names = await window.caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith("pangmao-web-"))
      .map((name) => window.caches.delete(name)),
  );
}

async function fetchDictionaryPack() {
  const packUrl = versionedAsset("./data/french-pack.json");
  const readPack = async (url, cache) => {
    const response = await fetch(url, { cache });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  let pack = await readPack(packUrl, "no-cache");
  if (pack.releaseVersion === WEB_VERSION) return pack;

  console.warn(
    `Dictionary release mismatch: expected ${WEB_VERSION}, received ${pack.releaseVersion ?? "none"}`,
  );
  await clearPangmaoWebCaches();
  const separator = packUrl.includes("?") ? "&" : "?";
  pack = await readPack(`${packUrl}${separator}refresh=${Date.now()}`, "reload");
  if (pack.releaseVersion !== WEB_VERSION) {
    throw new Error(
      `Dictionary release mismatch after refresh: expected ${WEB_VERSION}, received ${pack.releaseVersion ?? "none"}`,
    );
  }
  return pack;
}

async function loadDictionary() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  setStatus("loading", "正在载入词典");
  try {
    const pack = await fetchDictionaryPack();
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
    elements.errorMessage.textContent = String(error?.message).includes("release mismatch")
      ? "应用更新尚未完成。请点“重试”；若仍失败，请完全关闭后重新打开胖猫。"
      : navigator.onLine
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
  elements.voiceSelect.addEventListener("change", () => {
    pendingFrenchVoiceId = elements.voiceSelect.value;
    preferredFrenchVoiceId = elements.voiceSelect.value;
    const description = elements.voiceSelect.selectedOptions[0]?.textContent ?? "";
    const saved = frenchVoiceProfile.voices[frenchVoiceProfile.activeGender] === preferredFrenchVoiceId;
    elements.voiceStatus.textContent = saved
      ? `已保存${activeVoiceGenderLabel()}：${description}`
      : `候选${activeVoiceGenderLabel()}：${description}。试听后请保存。`;
  });
  elements.voiceFemaleButton.addEventListener("click", () => setActiveVoiceGender("female"));
  elements.voiceMaleButton.addEventListener("click", () => setActiveVoiceGender("male"));
  elements.voiceApplyButton.addEventListener("click", saveActiveVoiceChoice);
  elements.voiceCopyButton.addEventListener("click", copyVoiceDiagnostics);
  elements.voiceTestButton.addEventListener("click", () => {
    if (elements.voiceSelect.value) {
      pendingFrenchVoiceId = elements.voiceSelect.value;
      preferredFrenchVoiceId = elements.voiceSelect.value;
    }
    speakFrench(frenchVoiceSample);
  });
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
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = `pangmao.web.controller-reload.${WEB_VERSION}`;
      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(reloadKey) === "true";
      } catch {
        // A restricted storage context still receives one in-memory guarded reload.
      }
      if (reloading || alreadyReloaded) return;
      reloading = true;
      try {
        window.sessionStorage.setItem(reloadKey, "true");
      } catch {
        // Reloading is still safe because reloading prevents a second event on this page.
      }
      window.location.reload();
    });
  }
  try {
    const registration = await navigator.serviceWorker.register(versionedAsset("./sw.js"), {
      scope: "./",
      updateViaCache: "none",
    });
    await registration.update();
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
initializeFrenchVoices();
loadBranding();
loadDictionary();
registerServiceWorker();
