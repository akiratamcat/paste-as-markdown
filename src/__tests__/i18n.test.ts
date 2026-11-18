import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { _, _n, initI18n, setLocale } from '../i18n';
import { PO_SOURCES } from '../i18n/catalogs';
import { PLURAL_RULES, SUPPORTED_LANGUAGES } from '../i18n/languages';
import { parsePo } from '../i18n/poParser';

vi.mock('api');

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC_DIR = path.join(ROOT, 'src');
const POT_PATH = path.join(ROOT, 'locales', 'messages.pot');

interface TemplateEntry {
    msgid: string;
    msgidPlural?: string;
}

/** Matches a single-line `msgid`/`msgid_plural` keyword line, e.g. `msgid "Paste"`. */
const TEMPLATE_KEYWORD_PATTERN = /^(msgid|msgid_plural) "(.*)"$/;

/** Reads the template's entries. The template keeps every string on one line, so a simple line scan suffices. */
function readTemplate(): TemplateEntry[] {
    const entries: TemplateEntry[] = [];
    for (const line of readFileSync(POT_PATH, 'utf8').split('\n')) {
        const match = TEMPLATE_KEYWORD_PATTERN.exec(line);
        if (!match) continue;
        const text = (match[2] ?? '').replace(/\\(.)/g, '$1');
        if (match[1] === 'msgid') {
            if (text) entries.push({ msgid: text });
        } else {
            const last = entries.at(-1);
            if (last) last.msgidPlural = text;
        }
    }
    return entries;
}

/**
 * Matches the string literal arguments of a translation call, e.g. `_('Paste')` → `Paste`;
 * `_n('%s image', '%s images', n)` → `%s image`, `%s images`.
 */
const TRANSLATION_CALL_PATTERN = /\b_(n?)\(\s*(['"])((?:\\.|(?!\2).)*)\2(?:\s*,\s*(['"])((?:\\.|(?!\4).)*)\4)?/g;

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listSourceFiles(fullPath);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [fullPath] : [];
    });
}

/** Removes backslash escapes from a string literal's contents, e.g. `it\'s` → `it's`. */
const unescapeLiteral = (text: string): string => text.replace(/\\(.)/g, '$1');

function extractSourceMessages(): TemplateEntry[] {
    const i18nDir = path.join(SRC_DIR, 'i18n');
    return listSourceFiles(SRC_DIR)
        .filter((file) => !file.startsWith(i18nDir))
        .flatMap((file) =>
            [...readFileSync(file, 'utf8').matchAll(TRANSLATION_CALL_PATTERN)].map((match) => {
                const entry: TemplateEntry = { msgid: unescapeLiteral(match[3] ?? '') };
                if (match[1] === 'n') entry.msgidPlural = unescapeLiteral(match[5] ?? '');
                return entry;
            })
        );
}

/** Matches a placeholder and captures its explicit position, e.g. `%s`, `%2$s`. */
const PLACEHOLDER_PATTERN = /%(?:(\d+)\$)?s/g;

/** Returns the argument positions a message uses, e.g. `"%s of %s"` and `"%2$s / %1$s"` both use `[1, 2]`. */
function placeholderPositions(message: string): number[] {
    let next = 0;
    const positions = [...message.matchAll(PLACEHOLDER_PATTERN)].map((match) =>
        match[1] === undefined ? ++next : Number(match[1])
    );
    return [...new Set(positions)].toSorted((a, b) => a - b);
}

/** Matches the `nplurals` count in a PO header, e.g. `"Plural-Forms: nplurals=3; plural=...;\n"`. */
const NPLURALS_PATTERN = /Plural-Forms:\s*nplurals=(\d+)/;

const byMsgid = (a: TemplateEntry, b: TemplateEntry): number => a.msgid.localeCompare(b.msgid);

describe('translation catalogs', () => {
    const template = readTemplate();

    test('the template lists exactly the messages used in the source', () => {
        const used = [...new Map(extractSourceMessages().map((entry) => [entry.msgid, entry])).values()];
        expect(used.toSorted(byMsgid)).toEqual(template.toSorted(byMsgid));
    });

    test.each(SUPPORTED_LANGUAGES)('%s translates every template message', (language) => {
        const catalog = parsePo(PO_SOURCES[language]);
        const missing = template.filter(({ msgid }) => !catalog.has(msgid)).map(({ msgid }) => msgid);
        expect(missing).toEqual([]);
        expect([...catalog.keys()].filter((msgid) => !template.some((entry) => entry.msgid === msgid))).toEqual([]);
    });

    test.each(SUPPORTED_LANGUAGES)('%s declares the plural form count its rule uses', (language) => {
        const nplurals = Number(NPLURALS_PATTERN.exec(PO_SOURCES[language])?.[1]);
        expect(nplurals).toBe(PLURAL_RULES[language].nplurals);

        const catalog = parsePo(PO_SOURCES[language]);
        const formCounts = template.map(({ msgid }) => [msgid, catalog.get(msgid)?.length]);
        const expectedCounts = template.map(({ msgid, msgidPlural }) => [
            msgid,
            msgidPlural === undefined ? 1 : nplurals,
        ]);
        expect(formCounts).toEqual(expectedCounts);
    });

    test.each(SUPPORTED_LANGUAGES)('%s keeps the placeholders of every message', (language) => {
        const catalog = parsePo(PO_SOURCES[language]);
        const forms = template.flatMap(({ msgid, msgidPlural }) =>
            (catalog.get(msgid) ?? []).map((form) => ({ form, source: msgidPlural ?? msgid }))
        );
        expect(forms.map(({ form }) => [form, placeholderPositions(form)])).toEqual(
            forms.map(({ form, source }) => [form, placeholderPositions(source)])
        );
    });
});

const resourcesCreatedMessage = (count: number): string =>
    _n(
        'Pasted as Markdown (%s image resource created)',
        'Pasted as Markdown (%s image resources created)',
        count,
        count
    );

describe('translation lookup', () => {
    afterEach(() => {
        setLocale(null);
    });

    test('returns the source text when no translation is active', () => {
        expect(_('Paste')).toBe('Paste');
        expect(_('Paste HTML as Markdown failed: %s', 'boom')).toBe('Paste HTML as Markdown failed: boom');
    });

    test('translates for the active locale', () => {
        expect(setLocale('ja_JP')).toBe('ja');
        expect(_('Cancel')).toBe('キャンセル');
        expect(_('Paste HTML as Markdown failed: %s', 'boom')).toBe(
            'HTML を Markdown として貼り付けできませんでした: boom'
        );
    });

    test('falls back to the source text for unknown messages', () => {
        setLocale('ja_JP');
        expect(_('Not in the catalog %s', 1)).toBe('Not in the catalog 1');
    });

    test('supports positional placeholders', () => {
        setLocale('ja_JP');
        expect(
            _n(
                'Pasted as Markdown (converted %s of %s image)',
                'Pasted as Markdown (converted %s of %s images)',
                3,
                2,
                3
            )
        ).toBe('Markdown として貼り付けました（画像 3 件中 2 件を変換）');
    });

    test('chooses English plural forms without a translation', () => {
        expect(_n('%s image resource', '%s image resources', 1, 1)).toBe('1 image resource');
        expect(_n('%s image resource', '%s image resources', 2, 2)).toBe('2 image resources');
    });

    test('chooses plural forms with the language rule', () => {
        setLocale('ru_RU');
        expect(resourcesCreatedMessage(1)).toBe('Вставлено как Markdown (создан 1 ресурс изображения)');
        expect(resourcesCreatedMessage(3)).toBe('Вставлено как Markdown (создано 3 ресурса изображений)');
        expect(resourcesCreatedMessage(5)).toBe('Вставлено как Markdown (создано 5 ресурсов изображений)');
    });
});

describe('initI18n', () => {
    let globalValues: ReturnType<typeof vi.fn<(keys: string[]) => Promise<unknown[]>>>;

    beforeEach(async () => {
        globalValues = vi.fn<(keys: string[]) => Promise<unknown[]>>();
        const joplinModule = await import('api');
        (joplinModule.default as unknown) = { settings: { globalValues } };
    });

    afterEach(() => {
        setLocale(null);
    });

    test("loads the translation for Joplin's locale", async () => {
        globalValues.mockResolvedValue(['zh_TW']);
        await initI18n();
        expect(globalValues).toHaveBeenCalledExactlyOnceWith(['locale']);
        expect(_('Cancel')).toBe('取消');
        expect(_('Paste options')).toBe('貼上選項');
    });

    test('keeps English when the locale cannot be read', async () => {
        setLocale('ja');
        globalValues.mockRejectedValue(new Error('unavailable'));
        await initI18n();
        expect(_('Cancel')).toBe('Cancel');
    });
});
