// 輸出影片：逐格算圖（固定時間步進，不受算圖速度影響）→ ffmpeg 編碼
// 用法：node tools/render.mjs [--w 1920 --h 1080 --fps 30] [--shots 1,2,3] [--out out/cks-dusk.mp4]
//   每顆鏡頭先輸出成 out/segments/shot-XX.mp4（已存在就跳過，可中斷續跑），最後串接成一支。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch } from './snap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, k, i, arr) => (k.startsWith('--') ? [...a, [k.slice(2), arr[i + 1]]] : a), []));
const W = Number(args.w || 1920), H = Number(args.h || 1080), FPS = Number(args.fps || 30);
const OUT = path.resolve(ROOT, args.out || 'out/cks-dusk.mp4');
const SEG = path.join(path.dirname(OUT), 'segments');
fs.mkdirSync(SEG, { recursive: true });

const srv = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?zones=all&w=${W}&h=${H}&mode=shots&t=0&capture=1`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const { duration, shots } = await page.evaluate(() => ({ duration: window.__duration, shots: window.__shots }));
const shotLen = duration / shots.length;
const framesPerShot = Math.round(shotLen * FPS);
const want = args.shots ? args.shots.split(',').map(Number) : shots.map((s) => s.id);
console.log(`場景載入完成；${shots.length} 顆鏡頭 × ${framesPerShot} 格，${W}×${H} @ ${FPS}fps`);

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))));
  return { ff, done };
}

for (const [i, s] of shots.entries()) {
  if (!want.includes(s.id)) continue;
  const seg = path.join(SEG, `shot-${String(s.id).padStart(2, '0')}.mp4`);
  if (fs.existsSync(seg) && !args.force) { console.log(`鏡頭 ${s.id} 已存在，跳過`); continue; }
  const tmp = seg + '.part.mp4';
  const { ff, done } = encoder(tmp);
  const t0 = Date.now();
  for (let f = 0; f < framesPerShot; f++) {
    const t = i * shotLen + f / FPS;
    await page.evaluate((tt) => window.__renderAt(tt), t);
    const buf = await page.locator('#c').screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 30 === 29) {
      const per = (Date.now() - t0) / (f + 1) / 1000;
      console.log(`鏡頭 ${s.id}：${f + 1}/${framesPerShot} 格（每格 ${per.toFixed(2)} s，剩約 ${((framesPerShot - f - 1) * per / 60).toFixed(1)} 分）`);
    }
  }
  ff.stdin.end();
  await done;
  fs.renameSync(tmp, seg);
  console.log(`鏡頭 ${s.id} 完成：${seg}`);
}

await browser.close();
srv.close();

// 全部鏡頭都在 → 串接＋片頭淡入、片尾淡出
const segs = shots.map((s) => path.join(SEG, `shot-${String(s.id).padStart(2, '0')}.mp4`));
if (segs.every((f) => fs.existsSync(f))) {
  const list = path.join(SEG, 'list.txt');
  fs.writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n'));
  const total = shots.length * shotLen;
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
  });
  console.log(`完成：${OUT}`);
}
