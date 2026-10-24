import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', '.lighthouseci'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // The engine must stay framework-free so it can run in a Web Worker,
    // in Node scripts (OG images, feeds) and in tests without a DOM.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react/*', 'react-dom', 'react-dom/*'] },
      ],
    },
  },
  {
    // Dense numeric kernels index fixed-size arrays whose bounds hold by
    // construction (Legendre tables, catalogue rows, projected points). `!` there
    // states that invariant; elsewhere it stays banned.
    files: ['src/engine/magnetic/wmm.ts', 'src/engine/sky/scene.ts', 'src/sky/drawSky.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // In tests, `!` after a lookup is an assertion the test itself checks.
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
)
