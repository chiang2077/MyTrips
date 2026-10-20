// 截圖工具（施工檢查用）
// 用法：
//   node tools/snap.mjs --zones hall,terrain --out /path/a.png --cam -200,60,40 --target 0,30,0 [--fov 40] [--w 1280 --h 720]
//   多張：在同一次執行裡重複 --out/--cam/--target（依序配對），只載一次場景
//   鏡頭時間軸：--t 12.5（取代 --cam/--target，用 shots.js 的鏡頭）
// 會印出各區建模耗時、三角面數與瀏覽器 console 錯誤。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

export function serve(root = ROOT) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
}

function parseArgs(argv) {
  const a = { outs: [], cams: [], targets: [], ts: [], zones: 'all', w: 1280, h: 720, fov: 40 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], val = argv[i + 1];
    if (k === '--out') { a.outs.push(val); i++; } else if (k === '--cam') { a.cams.push(val); i++; } else if (k === '--target') { a.targets.push(val); i++; } else if (k === '--t') { a.ts.push(Number(val)); i++; } else if (k.startsWith('--')) { a[k.slice(2)] = val; i++; }
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const srv = await serve();
  const port = srv.address().port;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: Number(a.w), height: Number(a.h) } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const t0 = Date.now();
  const first = a.ts.length ? `mode=shots&t=${a.ts[0]}` : `mode=still&cam=${a.cams[0] || '-700,160,250'}&target=${a.targets[0] || '-150,0,0'}`;
  await page.goto(`http://127.0.0.1:${port}/index.html?zones=${a.zones}&w=${a.w}&h=${a.h}&fov=${a.fov}&${first}`);
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
  } catch (e) { console.log('場景載入失敗或逾時'); }
  console.log(`載入 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log('各區：', JSON.stringify(await page.evaluate(() => window.__stats)));
  const n = Math.max(a.outs.length, 1);
  for (let i = 0; i < n; i++) {
    const out = a.outs[i] || '/tmp/snap.png';
    const r0 = Date.now();
    if (a.ts.length) {
      await page.evaluate((t) => window.__renderAt(t), a.ts[i] ?? a.ts[0]);
    } else if (i > 0) {
      await page.evaluate(([c, t, fov]) => window.__still(c, t, fov), [a.cams[i] || a.cams[0], a.targets[i] || a.targets[0], Number(a.fov)]);
    }
    await page.locator('#c').screenshot({ path: out });
    console.log(`→ ${out}（${((Date.now() - r0) / 1000).toFixed(1)} s）`);
  }
  if (errors.length) console.log('瀏覽器訊息：\n' + [...new Set(errors)].slice(0, 30).join('\n'));
  await browser.close();
  srv.close();
}
