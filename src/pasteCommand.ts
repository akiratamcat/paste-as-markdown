import { ToastType } from 'api/types';
import { isMarkdownEditorMode } from './editor/editorIntegration';
import { getErrorMessage } from './errors';
import { _ } from './i18n';
import logger from './logger';
import { handlePasteAsMarkdown } from './pasteHandler';
import type { PasteOptionsPrompt } from './types';
import { showToast } from './utils';

/** Executes Paste as Markdown only when Joplin's Markdown editor is active. */
export async function executePasteAsMarkdownCommand(promptForOptions: PasteOptionsPrompt): Promise<void> {
    if (!(await isMarkdownEditorMode())) {
        await showToast(_('Paste HTML as Markdown is not supported in the rich text editor'), ToastType.Info);
        return;
    }

    try {
        const result = await handlePasteAsMarkdown(promptForOptions);
        if ('cancelled' in result) return;
        if (!result.success && result.warnings.length) {
            logger.warn('Paste reported warnings:', result.warnings);
        }
    } catch (err: unknown) {
        logger.error('Error handling paste command', err);
        await showToast(_('Paste HTML as Markdown failed: %s', getErrorMessage(err)), ToastType.Error);
    }
}
