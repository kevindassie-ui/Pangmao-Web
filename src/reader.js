const FRENCH_WORD = /[\p{L}\p{M}\p{N}]+(?:[’'\-][\p{L}\p{M}\p{N}]+)*/gu;
const ELISION_PREFIXES = new Set([
  "c",
  "d",
  "j",
  "l",
  "m",
  "n",
  "qu",
  "s",
  "t",
  "jusqu",
  "lorsqu",
  "puisqu",
]);

export function normalizeReaderText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replaceAll("\u00a0", " ")
    .trim();
}

function fallbackSentences(text) {
  const values = text.match(/[^.!?…]+(?:[.!?…]+[»”’"')\]]*|$)/gu) ?? [];
  return values.map((value) => value.trim()).filter(Boolean);
}

function splitSentences(text, Segmenter) {
  if (typeof Segmenter === "function") {
    try {
      return [...new Segmenter("fr", { granularity: "sentence" }).segment(text)]
        .map(({ segment }) => segment.trim())
        .filter(Boolean);
    } catch {
      // Older browsers can expose Intl.Segmenter without every granularity.
    }
  }
  return fallbackSentences(text);
}

export function readerLookupCandidates(token) {
  const normalized = String(token ?? "").trim().toLocaleLowerCase("fr").replaceAll("’", "'");
  if (!normalized) return [];
  const candidates = [normalized];
  const apostrophe = normalized.indexOf("'");
  if (apostrophe > 0 && apostrophe < normalized.length - 1) {
    const prefix = normalized.slice(0, apostrophe);
    if (ELISION_PREFIXES.has(prefix)) candidates.push(normalized.slice(apostrophe + 1));
  }
  return [...new Set(candidates)];
}

export function tokenizeFrenchSentence(sentence) {
  const tokens = [];
  let cursor = 0;
  for (const match of sentence.matchAll(FRENCH_WORD)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ text: sentence.slice(cursor, index), isWord: false, lookupCandidates: [] });
    }
    tokens.push({
      text: match[0],
      isWord: true,
      lookupCandidates: readerLookupCandidates(match[0]),
    });
    cursor = index + match[0].length;
  }
  if (cursor < sentence.length) {
    tokens.push({ text: sentence.slice(cursor), isWord: false, lookupCandidates: [] });
  }
  return tokens;
}

export function segmentFrenchText(value, Segmenter = globalThis.Intl?.Segmenter) {
  const text = normalizeReaderText(value);
  if (!text) return [];
  return splitSentences(text, Segmenter).map((sentence, index) => {
    const tokens = tokenizeFrenchSentence(sentence);
    return {
      id: `sentence-${index + 1}`,
      text: sentence,
      tokens,
      wordCount: tokens.filter((token) => token.isWord).length,
    };
  });
}
