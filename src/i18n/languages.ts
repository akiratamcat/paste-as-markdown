/** Languages that ship a PO file in `locales/`, named like Joplin's locales (`<language>` or `<language>_<REGION>`). */
export const SUPPORTED_LANGUAGES = ['de', 'es', 'fr', 'it', 'ja', 'ko', 'pt_BR', 'ru', 'zh_CN', 'zh_TW'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** How a language picks among its plural forms; `nplurals` must match the PO file's `Plural-Forms` header. */
export interface PluralRule {
    nplurals: number;
    select: (count: number) => number;
}

const NO_PLURALS: PluralRule = { nplurals: 1, select: () => 0 };
/** Singular only for exactly one, e.g. English, German: `nplurals=2; plural=(n != 1);` */
const ONE_OTHER: PluralRule = { nplurals: 2, select: (n) => (n === 1 ? 0 : 1) };
/** Singular for zero and one, e.g. French: `nplurals=2; plural=(n > 1);` */
const ZERO_ONE_OTHER: PluralRule = { nplurals: 2, select: (n) => (n > 1 ? 1 : 0) };

const RUSSIAN_FEW_MIN = 2;
const RUSSIAN_FEW_MAX = 4;
const TEENS_MIN = 10;
const TEENS_MAX = 20;

/**
 * East Slavic rule, e.g. 1/21 → 0, 2–4/22–24 → 1, 0/5–20/25 → 2:
 * `nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);`
 */
const EAST_SLAVIC: PluralRule = {
    nplurals: 3,
    select: (n) => {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastDigit === 1 && lastTwoDigits !== 11) return 0;
        const isTeen = lastTwoDigits >= TEENS_MIN && lastTwoDigits < TEENS_MAX;
        if (lastDigit >= RUSSIAN_FEW_MIN && lastDigit <= RUSSIAN_FEW_MAX && !isTeen) return 1;
        return 2;
    },
};

/**
 * Plural rules per language. Kept as code rather than evaluating the PO `Plural-Forms` expression,
 * so translation files can never inject executable code.
 */
export const PLURAL_RULES: Readonly<Record<SupportedLanguage, PluralRule>> = {
    de: ONE_OTHER,
    es: ONE_OTHER,
    fr: ZERO_ONE_OTHER,
    it: ONE_OTHER,
    ja: NO_PLURALS,
    ko: NO_PLURALS,
    pt_BR: ZERO_ONE_OTHER,
    ru: EAST_SLAVIC,
    zh_CN: NO_PLURALS,
    zh_TW: NO_PLURALS,
};

/** The English source text's rule, used when no translation is active. */
export const SOURCE_PLURAL_RULE = ONE_OTHER;

/** Joplin locales without their own PO file that read best in a related language, e.g. Hong Kong → Traditional Chinese. */
const LOCALE_ALIASES: Readonly<Record<string, SupportedLanguage>> = {
    zh: 'zh_CN',
    zh_SG: 'zh_CN',
    zh_HK: 'zh_TW',
    zh_MO: 'zh_TW',
    pt: 'pt_BR',
};

function isSupportedLanguage(value: string): value is SupportedLanguage {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Matches a locale's language and optional region, e.g. `ja_JP` → `ja`, `JP`; `pt-BR` → `pt`, `BR`; `ko` → `ko`. */
const LOCALE_PATTERN = /^([a-z]{2,3})(?:[_-]([a-z0-9]+))?/i;

/**
 * Picks the PO file for a Joplin locale, or `null` for English and unsupported locales.
 *
 * Tries the full locale (`zh_TW`), then its alias (`zh_HK` → `zh_TW`), then the language alone
 * (`ja_JP` → `ja`), then the language's alias (`pt_PT` → `pt` → `pt_BR`).
 */
export function resolveLanguage(locale: unknown): SupportedLanguage | null {
    if (typeof locale !== 'string') return null;
    const match = LOCALE_PATTERN.exec(locale.trim());
    if (!match?.[1]) return null;
    const language = match[1].toLowerCase();
    const full = match[2] ? `${language}_${match[2].toUpperCase()}` : language;
    for (const candidate of [full, LOCALE_ALIASES[full], language, LOCALE_ALIASES[language]]) {
        if (candidate && isSupportedLanguage(candidate)) return candidate;
    }
    return null;
}
