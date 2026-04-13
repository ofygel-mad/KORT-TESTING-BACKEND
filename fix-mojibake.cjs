#!/usr/bin/env node
/**
 * Fix mojibake (broken Cyrillic encoding) in source files.
 * Handles both single and double CP1251→UTF-8 re-encoding artifacts.
 * Also fixes \\uXXXX double-escaped unicode literals.
 */

const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixCp1251Mojibake(str) {
  try {
    const bytes = iconv.encode(str, 'cp1251');
    return iconv.decode(bytes, 'utf8');
  } catch (e) {
    return str;
  }
}

function fixSequence(str) {
  // Apply fix until stable (handles double/triple encoding)
  let prev = str;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(/[^\x00-\x7F]+/g, m => fixCp1251Mojibake(m));
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

function fixDoubleBackslashUnicode(str) {
  // Fix \\uXXXX → actual Unicode character (double-escaped unicode literals)
  return str.replace(/\\\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
    return String.fromCodePoint(parseInt(hex, 16));
  });
}

function processFile(filepath) {
  const original = fs.readFileSync(filepath, 'utf8');

  // Step 1: fix mojibake
  let fixed = fixSequence(original);

  // Step 2: fix \\uXXXX double-escaped unicode
  fixed = fixDoubleBackslashUnicode(fixed);

  if (fixed !== original) {
    fs.writeFileSync(filepath, fixed, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir, exts) {
  const results = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'coverage', '.next']);

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

const ROOT = path.join(__dirname);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css'];
const files = walkDir(ROOT, EXTS);

let changed = 0;
let unchanged = 0;

for (const f of files) {
  try {
    const wasChanged = processFile(f);
    const rel = path.relative(ROOT, f);
    if (wasChanged) {
      console.log('FIXED:', rel);
      changed++;
    } else {
      unchanged++;
    }
  } catch (e) {
    console.error('ERROR:', f, e.message);
  }
}

console.log(`\nDone: ${changed} files fixed, ${unchanged} unchanged.`);
