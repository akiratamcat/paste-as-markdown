import path from 'path';
import { defineConfig } from 'vitest/config';

/** Matches PO translation files, e.g. `locales/ja.po`, optionally followed by a Vite query string. */
const PO_FILE_PATTERN = /\.po(?:\?.*)?$/;

export default defineConfig({
    plugins: [
        {
            // Mirrors the esbuild `loader: { ".po": "text" }` in plugin.config.json: PO files import as their raw text.
            name: 'po-as-text',
            transform(code, id) {
                if (!PO_FILE_PATTERN.test(id)) return null;
                return { code: `export default ${JSON.stringify(code)};`, map: null };
            },
        },
    ],
    resolve: {
        alias: [
            { find: /^api$/, replacement: path.resolve(import.meta.dirname, 'src/__tests__/__mocks__/api.ts') },
            {
                find: /^api\/(.*)$/,
                replacement: path.resolve(import.meta.dirname, 'src/__tests__/__mocks__/api/$1.ts'),
            },
        ],
    },
    test: {
        environment: 'jsdom',
        root: '.',
        pool: 'vmThreads',
        include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
        setupFiles: ['./src/__tests__/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/**/*.d.ts', 'src/__tests__/__mocks__/**', 'src/__tests__/setup.ts'],
        },
    },
});
