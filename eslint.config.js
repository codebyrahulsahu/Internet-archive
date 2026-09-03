const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/"]
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, Archive: "writable", I18N: "writable" }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
    }
  },
  {
    // js/archive.js and js/i18n.js declare page-level globals (Archive / I18N)
    // consumed by js/app.js — declaring a top-level const against the
    // configured global triggers no-redeclare and looks unused to eslint,
    // which is intended here.
    files: ["js/archive.js", "js/i18n.js"],
    rules: {
      "no-redeclare": "off",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^(Archive|I18N)$" }]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      ...js.configs.recommended.rules
    }
  }
];
