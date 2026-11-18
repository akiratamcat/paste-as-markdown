/** Translations parsed from one PO file, keyed by `msgid`; plural entries hold one string per plural form. */
export type PoCatalog = ReadonlyMap<string, readonly string[]>;

/** One PO entry in progress. Index -1 holds a singular `msgstr`; 0..n hold `msgstr[n]`. */
interface PoEntry {
    msgid?: string;
    hasContext: boolean;
    fuzzy: boolean;
    translations: Map<number, string>;
    /** Where continuation lines (bare quoted strings) are appended. */
    target?: { kind: 'msgid' } | { kind: 'msgstr'; index: number } | { kind: 'ignored' };
}

/**
 * Matches a keyword line and captures its keyword, optional plural index, and quoted value, e.g.
 * `msgid "Paste"`, `msgid_plural "%s images"`, `msgstr[1] "%s 枚"`, `msgctxt "menu"`.
 */
const KEYWORD_LINE_PATTERN = /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+(".*")\s*$/;

/** Matches a continuation line holding only a quoted string, e.g. `"second half of a long msgstr"`. */
const CONTINUATION_LINE_PATTERN = /^(".*")\s*$/;

/** Matches a flags comment marking the entry fuzzy, e.g. `#, fuzzy` or `#, fuzzy, c-format`. */
const FUZZY_FLAG_PATTERN = /^#,.*\bfuzzy\b/;

/** Matches one backslash escape inside a PO string, e.g. `\n`, `\"`, `\\`, `\t`. */
const ESCAPE_PATTERN = /\\(.)/g;

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' };

/** Index under which a singular `msgstr` is stored. */
const SINGULAR_INDEX = -1;

function unquote(quoted: string): string {
    return quoted.slice(1, -1).replace(ESCAPE_PATTERN, (match, char: string) => ESCAPES[char] ?? match);
}

function newEntry(): PoEntry {
    return { hasContext: false, fuzzy: false, translations: new Map() };
}

/** Returns the entry's translations in plural-form order, or nothing when the entry must not be used. */
function finishEntry(entry: PoEntry): readonly string[] | undefined {
    // The header (empty msgid), fuzzy entries, and context-specific entries are not looked up by `msgid`.
    if (!entry.msgid || entry.fuzzy || entry.hasContext) return undefined;
    const singular = entry.translations.get(SINGULAR_INDEX);
    const forms =
        singular === undefined
            ? [...entry.translations.entries()]
                  .filter(([index]) => index !== SINGULAR_INDEX)
                  .toSorted(([a], [b]) => a - b)
                  .map(([, text]) => text)
            : [singular];
    // An untranslated entry (any empty form) falls back to the English source text.
    if (forms.length === 0 || forms.some((form) => form === '')) return undefined;
    return forms;
}

function appendToTarget(entry: PoEntry, text: string): void {
    const target = entry.target;
    if (!target || target.kind === 'ignored') return;
    if (target.kind === 'msgid') {
        entry.msgid = (entry.msgid ?? '') + text;
        return;
    }
    entry.translations.set(target.index, (entry.translations.get(target.index) ?? '') + text);
}

function applyKeyword(entry: PoEntry, keyword: string, index: string | undefined, text: string): void {
    switch (keyword) {
        case 'msgctxt':
            entry.hasContext = true;
            entry.target = { kind: 'ignored' };
            return;
        case 'msgid':
            entry.msgid = text;
            entry.target = { kind: 'msgid' };
            return;
        case 'msgid_plural':
            // The plural source text is only for translators; lookups use the singular msgid.
            entry.target = { kind: 'ignored' };
            return;
        default: {
            const formIndex = index === undefined ? SINGULAR_INDEX : Number(index);
            entry.translations.set(formIndex, text);
            entry.target = { kind: 'msgstr', index: formIndex };
        }
    }
}

/**
 * Parses the translations from PO file text.
 *
 * Supports `msgid`, `msgid_plural`, `msgstr`, `msgstr[n]`, multi-line strings, and the common
 * backslash escapes. The header, fuzzy entries, entries with a `msgctxt`, and untranslated entries
 * are skipped so that lookups fall back to the English source text.
 */
export function parsePo(text: string): PoCatalog {
    const state: ParserState = { catalog: new Map(), entry: newEntry() };
    for (const line of text.split('\n')) {
        parseLine(state, line.trim());
    }
    flushEntry(state);
    return state.catalog;
}

interface ParserState {
    catalog: Map<string, readonly string[]>;
    entry: PoEntry;
}

function flushEntry(state: ParserState): void {
    const { entry } = state;
    const forms = finishEntry(entry);
    if (forms && entry.msgid) state.catalog.set(entry.msgid, forms);
    state.entry = newEntry();
}

function parseComment(state: ParserState, line: string): void {
    // A comment after the entry's strings starts the next entry.
    if (state.entry.msgid !== undefined) flushEntry(state);
    if (FUZZY_FLAG_PATTERN.test(line)) state.entry.fuzzy = true;
}

function parseKeyword(state: ParserState, match: RegExpExecArray): void {
    const [, keyword = '', index, quoted = '""'] = match;
    // A new msgid (or msgctxt) after a complete entry starts the next entry.
    const startsEntry = keyword === 'msgid' || keyword === 'msgctxt';
    if (startsEntry && state.entry.translations.size > 0) flushEntry(state);
    applyKeyword(state.entry, keyword, index, unquote(quoted));
}

/** Parses one trimmed line: a blank line ends the entry, then comments, keywords, and continuations. */
function parseLine(state: ParserState, line: string): void {
    if (line === '') {
        flushEntry(state);
        return;
    }
    if (line.startsWith('#')) {
        parseComment(state, line);
        return;
    }
    const keywordMatch = KEYWORD_LINE_PATTERN.exec(line);
    if (keywordMatch) {
        parseKeyword(state, keywordMatch);
        return;
    }
    const continuation = CONTINUATION_LINE_PATTERN.exec(line)?.[1];
    if (continuation) appendToTarget(state.entry, unquote(continuation));
}
