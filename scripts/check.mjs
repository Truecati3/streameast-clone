#!/usr/bin/env node
/* Repo checks: JS syntax, local asset references, stub markers.
   No dependencies — runs on stock Node 18+. */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const notes = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* ---------- 1. JS syntax ---------- */

const jsFiles = walk(join(root, "js")).filter((f) => extname(f) === ".js");
jsFiles.push(join(root, "scripts", "check.mjs"));

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failures.push(`syntax: ${file.replace(root + "\\", "")}\n${err.stderr?.toString() || err.message}`);
  }
}
notes.push(`checked ${jsFiles.length} JS files`);

/* ---------- 2. local asset references ---------- */

const html = readFileSync(join(root, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|data:|#|mailto:)/i.test(u));

for (const ref of refs) {
  const clean = ref.split("?")[0].split("#")[0];
  if (!existsSync(join(root, clean))) failures.push(`missing asset: ${ref}`);
}
notes.push(`checked ${refs.length} local refs`);

/* ---------- 3. stub markers ---------- */

const banned = [/\bTODO\b/, /\bFIXME\b/i, /lorem ipsum/i, /not implemented/i];
const sourceFiles = walk(root).filter((f) =>
  [".js", ".css", ".html", ".md", ".py"].includes(extname(f))
);

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  banned.forEach((re) => {
    if (re.test(text)) {
      failures.push(`stub marker ${re} in ${file.replace(root + "\\", "")}`);
    }
  });
}

/* ---------- 4. required files ---------- */

for (const required of [
  "index.html",
  "css/style.css",
  "js/data.js",
  "js/app.js",
  "js/player.js",
  "serve.py",
  "README.md",
  "AGENTS.md"
]) {
  if (!existsSync(join(root, required))) failures.push(`missing required file: ${required}`);
}

/* ---------- report ---------- */

console.log(notes.join("\n"));

if (failures.length) {
  console.error("\nFAIL");
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}

console.log("\nOK");
