// PO files are bundled as plain text (esbuild `loader: { ".po": "text" }` in plugin.config.json).
import de from '../../locales/de.po';
import es from '../../locales/es.po';
import fr from '../../locales/fr.po';
import it from '../../locales/it.po';
import ja from '../../locales/ja.po';
import ko from '../../locales/ko.po';
import ptBR from '../../locales/pt_BR.po';
import ru from '../../locales/ru.po';
import zhCN from '../../locales/zh_CN.po';
import zhTW from '../../locales/zh_TW.po';
import type { SupportedLanguage } from './languages';

/** Raw PO text per supported language. Only the active language is parsed. */
export const PO_SOURCES: Readonly<Record<SupportedLanguage, string>> = {
    de,
    es,
    fr,
    it,
    ja,
    ko,
    pt_BR: ptBR,
    ru,
    zh_CN: zhCN,
    zh_TW: zhTW,
};
