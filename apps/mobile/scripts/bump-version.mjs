#!/usr/bin/env node
// Uso: node scripts/bump-version.mjs [patch|minor|major]  (default: patch)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const level = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`Nivel inválido "${level}". Usá patch, minor o major.`);
  process.exit(1);
}

const appJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app.json');
const raw = readFileSync(appJsonPath, 'utf8');
const current = JSON.parse(raw).expo.version;

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current ?? '');
if (!match) {
  console.error(`expo.version "${current}" no tiene formato X.Y.Z`);
  process.exit(1);
}

let [major, minor, patch] = match.slice(1).map(Number);
if (level === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (level === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const next = `${major}.${minor}.${patch}`;
// Reemplazo puntual para no reformatear el resto de app.json.
const updated = raw.replace(`"version": "${current}"`, `"version": "${next}"`);
writeFileSync(appJsonPath, updated);
console.log(`expo.version: ${current} -> ${next}`);
