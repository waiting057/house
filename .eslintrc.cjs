/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
}
