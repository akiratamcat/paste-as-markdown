import joplin from 'api';
import logger from '../logger';
import { PO_SOURCES } from './catalogs';
import {
    PLURAL_RULES,
    type PluralRule,
    resolveLanguage,
    SOURCE_PLURAL_RULE,
    type SupportedLanguage,
} from './languages';
import { parsePo, type PoCatalog } from './poParser';

/** Joplin's global setting holding the app's UI language, e.g. `ja_JP`, `zh_TW`, `en_GB`. */
const JOPLIN_LOCALE_SETTING = 'locale';

interface ActiveTranslation {
    catalog: PoCatalog;
    pluralRule: PluralRule;
}

const SOURCE_TRANSLATION: ActiveTranslation = { catalog: new Map(), pluralRule: SOURCE_PLURAL_RULE };

let active: ActiveTranslation = SOURCE_TRANSLATION;

/** Message arguments substituted into `%s` placeholders. */
export type MessageArg = string | number;

/**
 * Matches a placeholder: `%s` takes the next argument and `%2$s` takes argument 2, so translations
 * can reorder arguments, e.g. `"converted %s of %s"` → `"%2$s 件中 %1$s 件を変換"`.
 */
const PLACEHOLDER_PATTERN = /%(?:(\d+)\$)?s/g;

function format(message: string, args: readonly MessageArg[]): string {
    let next = 0;
    return message.replace(PLACEHOLDER_PATTERN, (match, position: string | undefined) => {
        const index = position === undefined ? next++ : Number(position) - 1;
        const arg = args[index];
        return arg === undefined ? match : String(arg);
    });
}

/** Switches the UI language for a Joplin locale; English and unsupported locales use the source text. */
export function setLocale(locale: unknown): SupportedLanguage | null {
    const language = resolveLanguage(locale);
    active = language
        ? { catalog: parsePo(PO_SOURCES[language]), pluralRule: PLURAL_RULES[language] }
        : SOURCE_TRANSLATION;
    return language;
}

/**
 * Loads the translation matching Joplin's UI language. Call once at startup, before any UI is
 * registered: Joplin restarts when its language changes, so the language never changes at runtime.
 * On failure the UI stays in English.
 */
export async function initI18n(): Promise<void> {
    try {
        const values: unknown[] = await joplin.settings.globalValues([JOPLIN_LOCALE_SETTING]);
        const locale = values[0];
        const language = setLocale(locale);
        logger.debug('UI language resolved', { locale, language: language ?? 'en' });
    } catch (err) {
        logger.warn('Failed to load UI translation; using English', err);
        setLocale(null);
    }
}

/** Translates a message. `msgid` must be a string literal so it can be checked against `locales/messages.pot`. */
export function _(msgid: string, ...args: MessageArg[]): string {
    return format(active.catalog.get(msgid)?.[0] ?? msgid, args);
}

/**
 * Translates a message with plural forms, chosen by `count` using the active language's rule.
 * `count` is not substituted automatically; pass it in `args` when the message shows it.
 */
export function _n(singular: string, plural: string, count: number, ...args: MessageArg[]): string {
    return format(selectPluralMessage(singular, plural, count), args);
}

function selectPluralMessage(singular: string, plural: string, count: number): string {
    const forms = active.catalog.get(singular);
    if (!forms) return SOURCE_PLURAL_RULE.select(count) === 0 ? singular : plural;
    return forms[active.pluralRule.select(count)] ?? forms.at(-1) ?? singular;
}
