module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty': 'warn',
    'prefer-const': 'warn',
    'no-undef': 'warn',
    'no-constant-condition': 'off',
    'no-irregular-whitespace': 'off',
    'no-unescaped-entities': 'off',
    'react/no-unescaped-entities': 'off',
    'react/no-children-prop': 'off',
    'no-inner-declarations': 'off',
    'no-case-declarations': 'off',
    'react-hooks/rules-of-hooks': 'off',
  },
  overrides: [
    // Src (frontend ESM): strict rules
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-var-requires': 'error',
        // Theme-token rule: no raw color hex literals in component files
        'no-restricted-syntax': [
          'warn',
          {
            selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
            message: 'Avoid raw color hex literals. Use theme tokens from cssTokens.ts instead.',
          },
        ],
      },
    },
    // Test files: relaxed
    {
      files: ['test/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
        'no-empty': 'off',
        'prefer-const': 'off',
      },
    },
    // Server files: allow require()
    {
      files: ['server/**'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    // Config and build files
    {
      files: ['*.config.*', '.eslintrc.*'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    },
  ],
};
