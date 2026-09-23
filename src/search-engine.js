const HAN_RANGES = [
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x20000, 0x323af],
];

const IRREGULAR_FRENCH_FORMS = new Map(
  Object.entries({
    suis: "être",
    es: "être",
    est: "être",
    sommes: "être",
    etes: "être",
    sont: "être",
    etais: "être",
    etait: "être",
    etions: "être",
    etiez: "être",
    etaient: "être",
    serai: "être",
    seras: "être",
    sera: "être",
    serons: "être",
    serez: "être",
    seront: "être",
    ete: "être",
    ai: "avoir",
    as: "avoir",
    a: "avoir",
    avons: "avoir",
    avez: "avoir",
    ont: "avoir",
    avais: "avoir",
    avait: "avoir",
    avions: "avoir",
    aviez: "avoir",
    avaient: "avoir",
    eu: "avoir",
    vais: "aller",
    vas: "aller",
    va: "aller",
    allons: "aller",
    allez: "aller",
    vont: "aller",
    alle: "aller",
    allee: "aller",
    alles: "aller",
    allees: "aller",
    irai: "aller",
    iras: "aller",
    ira: "aller",
    irons: "aller",
    irez: "aller",
    iront: "aller",
  }),
);

export function normalizeFrench(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr")
    .replaceAll("’", "'")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .trim();
}

export function containsHan(value) {
  for (const character of String(value ?? "")) {
    const codePoint = character.codePointAt(0);
    if (HAN_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end)) {
      return true;
    }
  }
  return false;
}

function frenchCandidates(query) {
  const normalized = normalizeFrench(query);
  const candidates = [{ value: normalized, kind: "exact" }];
  const irregular = IRREGULAR_FRENCH_FORMS.get(normalized);
  if (irregular) candidates.push({ value: normalizeFrench(irregular), kind: "inflection" });

  if (normalized.length >= 4 && normalized.endsWith("s")) {
    candidates.push({ value: normalized.slice(0, -1), kind: "inflection" });
  }
  if (normalized.length >= 5 && normalized.endsWith("es")) {
    candidates.push({ value: normalized.slice(0, -2), kind: "inflection" });
  }
  if (normalized.length >= 4 && normalized.endsWith("e")) {
    candidates.push({ value: normalized.slice(0, -1), kind: "inflection" });
  }
  if (normalized.length >= 5 && normalized.endsWith("aux")) {
    candidates.push({ value: `${normalized.slice(0, -3)}al`, kind: "inflection" });
  }
  return candidates.filter(
    (candidate, index, values) =>
      candidate.value && values.findIndex((item) => item.value === candidate.value) === index,
  );
}

function prepareEntry(entry) {
  return {
    entry,
    forms: entry.forms.map(normalizeFrench),
    definitions: entry.senses.flatMap((sense) => sense.definitions).map(normalizeFrench),
    chineseBySense: entry.senses.map((sense) => sense.chinese),
  };
}

export function createDictionaryIndex(pack) {
  if (pack?.schemaVersion !== 1 || !Array.isArray(pack.entries)) {
    throw new Error("词典数据格式不受支持");
  }

  const prepared = pack.entries.map(prepareEntry);
  return {
    pack,
    prepared,
    byId: new Map(prepared.map((item) => [item.entry.id, item.entry])),
  };
}

function matchedChineseSenses(item, query) {
  const matches = [];
  let score = Number.POSITIVE_INFINITY;
  item.chineseBySense.forEach((equivalents, senseIndex) => {
    equivalents.forEach((equivalent) => {
      let candidateScore = Number.POSITIVE_INFINITY;
      if (equivalent === query) candidateScore = 0;
      else if (equivalent.startsWith(query)) candidateScore = 10;
      else if (equivalent.includes(query)) candidateScore = 20;
      if (candidateScore < Number.POSITIVE_INFINITY) {
        score = Math.min(score, candidateScore);
        if (!matches.includes(senseIndex)) matches.push(senseIndex);
      }
    });
  });
  return { score, matches };
}

function matchFrench(item, query) {
  const candidates = frenchCandidates(query);
  let score = Number.POSITIVE_INFINITY;
  let matchType = "";
  let matchedForm = "";

  candidates.forEach((candidate, candidateIndex) => {
    item.forms.forEach((form, formIndex) => {
      let candidateScore = Number.POSITIVE_INFINITY;
      let candidateType = "";
      if (form === candidate.value) {
        candidateScore = candidate.kind === "exact" ? 0 : 4 + candidateIndex;
        candidateType = candidate.kind;
      } else if (candidate.kind === "exact" && form.startsWith(candidate.value)) {
        candidateScore = 10;
        candidateType = "prefix";
      } else if (candidate.kind === "exact" && form.includes(candidate.value)) {
        candidateScore = 20;
        candidateType = "contains";
      }
      if (candidateScore < score) {
        score = candidateScore;
        matchType = candidateType;
        matchedForm = item.entry.forms[formIndex];
      }
    });
  });

  if (score === Number.POSITIVE_INFINITY) {
    const normalized = candidates[0]?.value ?? "";
    if (normalized && item.definitions.some((definition) => definition.includes(normalized))) {
      score = 30;
      matchType = "definition";
    }
  }
  return { score, matchType, matchedForm };
}

export function searchDictionary(index, rawQuery, limit = 40) {
  const query = String(rawQuery ?? "").trim();
  if (!query || limit <= 0) return [];

  const chineseQuery = containsHan(query);
  if (!chineseQuery && !/[\p{L}\p{N}]/u.test(normalizeFrench(query))) return [];
  const ranked = [];
  for (const item of index.prepared) {
    if (chineseQuery) {
      const match = matchedChineseSenses(item, query);
      if (Number.isFinite(match.score)) {
        ranked.push({
          entry: item.entry,
          score: match.score,
          matchType: match.score === 0 ? "exact" : match.score === 10 ? "prefix" : "contains",
          matchedSenseIndexes: match.matches,
          matchedForm: "",
        });
      }
    } else {
      const match = matchFrench(item, query);
      if (Number.isFinite(match.score)) {
        ranked.push({
          entry: item.entry,
          score: match.score,
          matchType: match.matchType,
          matchedSenseIndexes: item.entry.senses.map((_, indexValue) => indexValue),
          matchedForm: match.matchedForm,
        });
      }
    }
  }

  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  ranked.sort(
    (left, right) =>
      left.score - right.score ||
      left.entry.headword.length - right.entry.headword.length ||
      collator.compare(left.entry.headword, right.entry.headword),
  );
  return ranked.slice(0, limit);
}

export function getEntry(index, entryId) {
  return index.byId.get(entryId) ?? null;
}
