import joplin from 'api';
import { ContentScriptType, MenuItemLocation } from 'api/types';
import { createPasteOptionsDialog } from './dialog/pasteOptionsDialog';
import { isMarkdownEditorContextMenuOrigin } from './editor/editorIntegration';
import { _, initI18n } from './i18n';
import logger from './logger';
import { executePasteAsMarkdownCommand } from './pasteCommand';
import { registerPluginSettings } from './settings';
import type { PasteOptionsPrompt } from './types';

// IDs carry an `I18n` suffix so this fork can be installed next to the original plugin without clashing.
const PASTE_AS_MARKDOWN_COMMAND = 'pasteHtmlAsMarkdownI18n';
const PASTE_AS_MARKDOWN_SHORTCUT = 'Ctrl+Alt+V';
const PASTE_AS_MARKDOWN_MENU = 'pasteAsMarkdownMenuI18n';
const CODE_MIRROR_6_CONTENT_SCRIPT_ID = 'pasteAsMarkdownI18nCodeMirror6';
const CODE_MIRROR_5_CONTENT_SCRIPT_ID = 'pasteAsMarkdownI18nCodeMirror5';

/** Fallback when the dialog can't be created: pastes still work using the saved settings. */
const useSavedPasteOptions: PasteOptionsPrompt = (options) => Promise.resolve(options);

void joplin.plugins.register({
    onStart: async () => {
        // Must run before any labels are registered so the UI uses Joplin's language.
        await initI18n();

        // A failed registration only costs the content script's features, so keep starting up.
        try {
            await joplin.contentScripts.register(
                ContentScriptType.CodeMirrorPlugin,
                CODE_MIRROR_6_CONTENT_SCRIPT_ID,
                './editor/contentScripts/codeMirror6.js'
            );
            await joplin.contentScripts.register(
                ContentScriptType.CodeMirrorPlugin,
                CODE_MIRROR_5_CONTENT_SCRIPT_ID,
                './editor/contentScripts/codeMirror5.js'
            );
        } catch (err) {
            logger.error('Failed to register editor content scripts', err);
        }

        let promptForPasteOptions = useSavedPasteOptions;
        try {
            promptForPasteOptions = await createPasteOptionsDialog();
        } catch (err) {
            logger.error('Failed to create paste options dialog; pastes will use saved settings', err);
        }

        // Register command
        await joplin.commands.register({
            name: PASTE_AS_MARKDOWN_COMMAND,
            label: _('Paste HTML as Markdown'),
            iconName: 'fas fa-paste',
            execute: () => executePasteAsMarkdownCommand(promptForPasteOptions),
        });

        await registerPluginSettings();

        // Add menu item with accelerator in Edit menu for discoverability
        try {
            await joplin.views.menuItems.create(
                PASTE_AS_MARKDOWN_MENU,
                PASTE_AS_MARKDOWN_COMMAND,
                MenuItemLocation.Edit,
                {
                    accelerator: PASTE_AS_MARKDOWN_SHORTCUT,
                }
            );
        } catch (err) {
            logger.warn('Failed to create menu item', err);
        }

        // Joplin invokes this filter for editor and viewer context menus. The content scripts
        // provide a single-use marker that identifies right-clicks from either Markdown editor,
        // while editor.codeView excludes the rich text editor.
        joplin.workspace.filterEditorContextMenu(async (menu) => {
            if (!(await isMarkdownEditorContextMenuOrigin())) return menu;
            const exists = menu.items.some((i) => i.commandName === PASTE_AS_MARKDOWN_COMMAND);
            if (!exists) {
                menu.items.push({
                    commandName: PASTE_AS_MARKDOWN_COMMAND,
                    label: _('Paste HTML as Markdown'),
                    accelerator: PASTE_AS_MARKDOWN_SHORTCUT,
                });
            }
            return menu;
        });

        logger.info('Plugin started');
    },
});
