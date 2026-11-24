import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const serverPath = path.resolve('dist/index.js');
const workDir = process.cwd();

// Чистое состояние — иначе FR-001 может уже существовать
await fs.rm(path.join(workDir, '.reqexpert'), { recursive: true, force: true });

const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, REQEXPERT_WORKSPACE: workDir },
});

const requests = [
  {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0' },
    },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  {
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: {
      name: 'add_requirement',
      arguments: {
        title: 'Система должна позволять входить по email и паролю',
        priority: 'Must',
        description: 'Пользователь вводит email и пароль на странице входа.',
        acceptanceCriteria: 'При верных данных создаётся сессия; при неверных возвращается ошибка 401.',
      },
    },
  },
  {
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'get_requirement', arguments: { id: 'FR-001' } },
  },
  {
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'search_requirements', arguments: { priority: 'Must' } },
  },
  {
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'coverage_report', arguments: { priority: 'Must' } },
  },
  {
    jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: {
      name: 'preview_validation',
      arguments: {
        title: 'Система должна быстро и удобно работать',
        description: 'Простой интерфейс.',
      },
    },
  },
  {
    jsonrpc: '2.0', id: 7, method: 'tools/call',
    params: { name: 'list_rules', arguments: {} },
  },
];

let buffer = '';
const responses = new Map();
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined) responses.set(msg.id, msg);
    } catch {}
  }
});

let i = 0;
const sendNext = () => {
  if (i >= requests.length) return;
  child.stdin.write(JSON.stringify(requests[i]) + '\n');
  i++;
  if (i < requests.length) setTimeout(sendNext, 150);
};
sendNext();

setTimeout(async () => {
  child.stdin.end();

  const unwrap = (id) => {
    const r = responses.get(id);
    const txt = r?.result?.content?.[0]?.text;
    return txt ? JSON.parse(txt) : null;
  };

  const checks = [];
  const assert = (name, cond, detail = '') => checks.push({ name, pass: !!cond, detail });

  const add = unwrap(2);
  assert('add_requirement → id = FR-001', add?.requirement?.id === 'FR-001', `got ${add?.requirement?.id}`);
  assert('qualityScore = 67', add?.qualityScore === 67, `got ${add?.qualityScore}`);
  assert('evaluation.passed = false', add?.evaluation?.passed === false);
  const failedIds = (add?.evaluation?.failedRules ?? []).map((r) => r.ruleId).sort();
  assert('failedRules = [D25, T01]', JSON.stringify(failedIds) === JSON.stringify(['D25', 'T01']), `got ${JSON.stringify(failedIds)}`);

  const got = unwrap(3);
  assert('get_requirement → same id', got?.requirement?.id === 'FR-001');

  const search = unwrap(4);
  assert('search_requirements total = 1', search?.total === 1, `got ${search?.total}`);
  assert('search total/returned consistent', search?.returned === 1);

  const cov = unwrap(5);
  assert('coverage codeCoveragePercent = 0', cov?.codeCoveragePercent === 0, `got ${cov?.codeCoveragePercent}`);
  assert('coverage testCoveragePercent = 0', cov?.testCoveragePercent === 0, `got ${cov?.testCoveragePercent}`);
  assert('coverage uncovered[0].id = FR-001', cov?.uncovered?.[0]?.id === 'FR-001');
  assert('coverage uncovered[0].missing = both', cov?.uncovered?.[0]?.missing === 'both');

  const prev = unwrap(6);
  const prevFailed = (prev?.evaluation?.failedRules ?? []).map((r) => r.ruleId).sort();
  assert('preview flags D25 (atomicity: "и")', prevFailed.includes('D25'), `got ${JSON.stringify(prevFailed)}`);
  assert('preview flags D26 (ambiguity: "быстро", "удобно", "простой")', prevFailed.includes('D26'), `got ${JSON.stringify(prevFailed)}`);
  assert('preview flags H78 (no acceptanceCriteria)', prevFailed.includes('H78'), `got ${JSON.stringify(prevFailed)}`);
  assert('preview flags T01 (Must + no codeRefs)', prevFailed.includes('T01'), `got ${JSON.stringify(prevFailed)}`);

  const rules = unwrap(7);
  const ruleIds = (rules ?? []).map((r) => r.id).sort();
  assert('list_rules includes all 6', JSON.stringify(ruleIds) === JSON.stringify(['D25', 'D26', 'D27', 'D28', 'H78', 'T01']), `got ${JSON.stringify(ruleIds)}`);
  assert('all rules have categories', (rules ?? []).every((r) => typeof r.category === 'string' && r.category.length > 0));

  const activitiesPath = path.join(workDir, '.reqexpert', 'activities.jsonl');
  const actRaw = await fs.readFile(activitiesPath, 'utf-8').catch(() => '');
  const actLines = actRaw.trim().split('\n').filter(Boolean);
  assert('activities.jsonl has ≥ 1 entry', actLines.length >= 1, `got ${actLines.length}`);
  let lastAct = null;
  try { lastAct = JSON.parse(actLines[actLines.length - 1]); } catch {}
  assert('last activity type = requirement.created', lastAct?.type === 'requirement.created', `got ${lastAct?.type}`);

  const files = await fs.readdir(path.join(workDir, '.reqexpert')).catch(() => []);
  const requiredFiles = ['project.json', 'requirements.json', 'stakeholders.json', 'business-rules.json', 'activities.jsonl'];
  assert('.reqexpert has all 5 files', requiredFiles.every((f) => files.includes(f)), `got ${files.join(',')}`);

  console.log('\n=== SMOKE REPORT ===');
  let passed = 0, failed = 0;
  for (const c of checks) {
    if (c.pass) { passed++; console.log(`✓ ${c.name}`); }
    else { failed++; console.log(`✗ ${c.name} — ${c.detail}`); }
  }
  console.log(`\n${passed}/${checks.length} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}, 2000);