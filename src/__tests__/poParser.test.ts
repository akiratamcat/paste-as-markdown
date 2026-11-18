import { describe, expect, test } from 'vitest';

import { parsePo } from '../i18n/poParser';

const HEADER = ['msgid ""', 'msgstr ""', '"Language: ja\\n"', '"Plural-Forms: nplurals=1; plural=0;\\n"', ''].join(
    '\n'
);

describe('parsePo', () => {
    test('parses singular entries and skips the header', () => {
        const catalog = parsePo(`${HEADER}\nmsgid "Paste"\nmsgstr "貼り付け"\n`);
        expect([...catalog.entries()]).toEqual([['Paste', ['貼り付け']]]);
    });

    test('parses plural forms in index order', () => {
        const catalog = parsePo(
            [
                'msgid "%s image"',
                'msgid_plural "%s images"',
                'msgstr[1] "%s images (other)"',
                'msgstr[0] "%s image (one)"',
            ].join('\n')
        );
        expect(catalog.get('%s image')).toEqual(['%s image (one)', '%s images (other)']);
    });

    test('joins multi-line strings and decodes escapes', () => {
        const catalog = parsePo(
            ['msgid ""', '"Say \\"hi\\"\\n"', '"twice"', 'msgstr "Line\\tone "', '"\\\\ two"'].join('\n')
        );
        expect(catalog.get('Say "hi"\ntwice')).toEqual(['Line\tone \\ two']);
    });

    test('skips fuzzy, untranslated, and context-specific entries', () => {
        const catalog = parsePo(
            [
                '#, fuzzy',
                'msgid "Fuzzy"',
                'msgstr "曖昧"',
                '',
                'msgid "Untranslated"',
                'msgstr ""',
                '',
                'msgctxt "menu"',
                'msgid "File"',
                'msgstr "ファイル"',
                '',
                'msgid "Plural gap"',
                'msgid_plural "Plural gaps"',
                'msgstr[0] "a"',
                'msgstr[1] ""',
                '',
                'msgid "Kept"',
                'msgstr "保持"',
            ].join('\n')
        );
        expect([...catalog.keys()]).toEqual(['Kept']);
    });

    test('starts a new entry without a blank line separator', () => {
        const catalog = parsePo(
            ['msgid "One"', 'msgstr "1"', 'msgid "Two"', 'msgstr "2"', '# comment', 'msgid "Three"', 'msgstr "3"'].join(
                '\n'
            )
        );
        expect(Object.fromEntries(catalog)).toEqual({ One: ['1'], Two: ['2'], Three: ['3'] });
    });

    test('accepts CRLF line endings', () => {
        const catalog = parsePo('msgid "Cancel"\r\nmsgstr "キャンセル"\r\n');
        expect(catalog.get('Cancel')).toEqual(['キャンセル']);
    });
});
