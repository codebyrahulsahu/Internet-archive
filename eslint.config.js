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
      globals: { ...globals.browser, Archive: "writable" }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
    }
  },
  {
    // js/archive.js declares the `Archive` global consumed by js/app.js —
    // declaring a page-level global triggers no-redeclare, which is intended here
    files: ["js/archive.js"],
    rules: {
      "no-redeclare": "off"
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
