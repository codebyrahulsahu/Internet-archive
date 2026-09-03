// Zero-dependency sanity check: every local asset referenced from
// index.html (and the JS files it loads) must actually exist on disk.
// Run with: npm run check
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const missing = [];
const found = [];

function checkRef(ref, from) {
  if (/^(https?:|data:|#|mailto:)/i.test(ref)) return; // remote / anchor — out of scope
  const path = resolve(dirname(from), ref.split("#")[0].split("?")[0]);
  if (!existsSync(path)) {
    missing.push(`${ref}  (referenced by ${from.slice(root.length + 1)})`);
  } else {
    found.push(ref);
  }
}

// 1. local href/src references in index.html
const indexPath = resolve(root, "index.html");
const html = readFileSync(indexPath, "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  checkRef(match[1], indexPath);
}

// 2. css urls() — e.g. url(../favicon.svg)
for (const cssFile of ["css/style.css"]) {
  const cssPath = resolve(root, cssFile);
  const css = readFileSync(cssPath, "utf8");
  for (const match of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
    checkRef(match[2], cssPath);
  }
}

// 3. entry JS files referenced by the page must parse
for (const jsFile of ["js/i18n.js", "js/archive.js", "js/app.js"]) {
  readFileSync(resolve(root, jsFile), "utf8");
}

for (const ref of found) console.log("✓", ref);

if (missing.length) {
  console.error(`\n✗ ${missing.length} missing asset(s):`);
  for (const m of missing) console.error("  -", m);
  process.exit(1);
}
console.log("\nAll referenced local assets exist.");
