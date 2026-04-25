import baseConfig from '../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['.expo/**', 'expo-env.d.ts', 'metro.config.js'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
