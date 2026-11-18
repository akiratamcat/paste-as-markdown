/** PO files are imported as their raw text; see `src/i18n/catalogs.ts`. */
declare module '*.po' {
    const content: string;
    export default content;
}
