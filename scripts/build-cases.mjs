#!/usr/bin/env node
// cases/*.md（frontmatter + Markdown）を docs/data/cases.json に変換する。
// 依存パッケージなし（Node 20+ 標準モジュールのみ）。簡易frontmatterパーサを内蔵。
//
// 使い方: node scripts/build-cases.mjs
// publishedAt が空、または未来日の記事は「下書き」として cases.json から除外する。

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.join(__dirname, '..', 'cases');
const OUT_FILE = path.join(__dirname, '..', 'docs', 'data', 'cases.json');

function jstNowIso(){
  // ざっくり +09:00 表記のタイムスタンプを作る（ビルド時刻の記録用途）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const y = jst.getUTCFullYear();
  const mo = pad(jst.getUTCMonth() + 1);
  const d = pad(jst.getUTCDate());
  const h = pad(jst.getUTCHours());
  const mi = pad(jst.getUTCMinutes());
  const s = pad(jst.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
}

function stripQuotes(s){
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// 簡易YAML風frontmatterパーサ。対応するのは「key: value」の単純な行と、
// 「key: [...]」形式のJSON配列（例: receiptIds: ["R-2026-0001"]）のみ。
function parseFrontmatter(raw){
  const fm = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value === '') {
      fm[key] = '';
    } else if (value.startsWith('[')) {
      try {
        fm[key] = JSON.parse(value);
      } catch (e) {
        fm[key] = [];
      }
    } else {
      fm[key] = stripQuotes(value);
    }
  }
  return fm;
}

function parseSteps(body){
  const steps = [];
  const lines = body.split('\n');
  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      if (current) steps.push(current);
      current = { h: h[1].trim(), pLines: [] };
    } else if (current) {
      if (line.trim() !== '') current.pLines.push(line.trim());
    }
  }
  if (current) steps.push(current);
  return steps.map((s) => ({ h: s.h, p: s.pLines.join('') }));
}

function isDraft(publishedAt){
  if (!publishedAt) return true;
  const d = new Date(publishedAt + 'T00:00:00+09:00');
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  return d.getTime() > now.getTime();
}

function loadCaseFiles(){
  let files;
  try {
    files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.md'));
  } catch (e) {
    return [];
  }
  return files.sort();
}

function main(){
  const files = loadCaseFiles();
  const items = [];
  const drafts = [];

  for (const file of files) {
    const full = path.join(CASES_DIR, file);
    const raw = readFileSync(full, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) {
      console.warn(`[build-cases] skip (no frontmatter): ${file}`);
      continue;
    }
    const fm = parseFrontmatter(fmMatch[1]);
    const body = fmMatch[2] || '';
    const steps = parseSteps(body);

    const record = {
      id: fm.id || '',
      slug: fm.slug || '',
      title: fm.title || '',
      category: fm.category || '',
      city: fm.city || '',
      month: fm.month || '',
      summary: fm.summary || '',
      receiptIds: Array.isArray(fm.receiptIds) ? fm.receiptIds : [],
      sources: fm.sources || '',
      publishedAt: fm.publishedAt || '',
      steps
    };

    if (isDraft(fm.publishedAt)) {
      drafts.push(file);
      continue;
    }
    items.push(record);
  }

  items.sort((a, b) => {
    if (a.month !== b.month) return a.month < b.month ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  const out = { generatedAt: jstNowIso(), items };
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`[build-cases] wrote ${OUT_FILE}`);
  console.log(`[build-cases] published: ${items.length} / total files: ${files.length}`);
  if (drafts.length) {
    console.log(`[build-cases] drafts (excluded, publishedAt empty or future): ${drafts.join(', ')}`);
  }
}

main();
