import { describe, expect, test } from 'vitest';

import { PLURAL_RULES, resolveLanguage } from '../i18n/languages';

describe('resolveLanguage', () => {
    test.each([
        ['ja_JP', 'ja'],
        ['ja', 'ja'],
        ['ko_KR', 'ko'],
        ['zh_CN', 'zh_CN'],
        ['zh_TW', 'zh_TW'],
        ['zh_HK', 'zh_TW'],
        ['zh', 'zh_CN'],
        ['pt_BR', 'pt_BR'],
        ['pt_PT', 'pt_BR'],
        ['pt-br', 'pt_BR'],
        ['de_DE', 'de'],
        ['fr_FR', 'fr'],
        ['es_419', 'es'],
        ['it_IT', 'it'],
        ['ru_RU', 'ru'],
    ])('maps Joplin locale %s to %s', (locale, expected) => {
        expect(resolveLanguage(locale)).toBe(expected);
    });

    test.each([['en_GB'], ['en_US'], ['nl_NL'], [''], [undefined], [null], [42]])(
        'uses the English source text for %s',
        (locale) => {
            expect(resolveLanguage(locale)).toBeNull();
        }
    );
});

describe('PLURAL_RULES', () => {
    test('Russian distinguishes one, few, and many', () => {
        const select = PLURAL_RULES.ru.select;
        expect([1, 21, 101].map(select)).toEqual([0, 0, 0]);
        expect([2, 4, 22, 34].map(select)).toEqual([1, 1, 1, 1]);
        expect([0, 5, 11, 12, 14, 20, 111].map(select)).toEqual([2, 2, 2, 2, 2, 2, 2]);
    });

    test('French and Brazilian Portuguese treat zero as singular', () => {
        expect([0, 1, 2].map(PLURAL_RULES.fr.select)).toEqual([0, 0, 1]);
        expect([0, 1, 2].map(PLURAL_RULES.pt_BR.select)).toEqual([0, 0, 1]);
    });

    test('German treats only one as singular', () => {
        expect([0, 1, 2].map(PLURAL_RULES.de.select)).toEqual([1, 0, 1]);
    });

    test('CJK languages have a single form', () => {
        for (const language of ['ja', 'ko', 'zh_CN', 'zh_TW'] as const) {
            expect([0, 1, 2, 100].map(PLURAL_RULES[language].select)).toEqual([0, 0, 0, 0]);
        }
    });
});
