/* Little Maestro — render the theater show as a YouTube video: curtain up, the band playing the song
 * (with its repeats), the bow and the curtain coming down. No sheet music, no buttons.
 *
 *   node export.mjs --list                  # the songs you can render
 *   node export.mjs twinkle canon-in-d      # some songs
 *   node export.mjs --all                   # every song
 *   options: --url <app>  --out <folder>  --public-url <link for the description>
 *
 * Usually run as a job on the server (see "YouTube videos" in the README):  ./fastdeploy.sh video …
 *
 * How: a headless Chrome opens the song in the theater and plays the show for real. Every frame of the
 * stage is captured as it is drawn (Chrome's screencast), the band's sound is tapped straight from the
 * app's audio, both carry the same clock, and ffmpeg puts them together into a 1080p MP4. Each video has
 * a .txt next to it with a ready-to-paste YouTube title and description.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1920, HEIGHT = 1080;
const LEAD_IN = 1500; // ms of closed curtain (with the song's title) before the show
const TAIL = 4500;    // ms after the last note: the bow and the curtain coming down

const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
}
const BASE = option('--url', process.env.MAESTRO_URL || 'http://localhost:8080').replace(/\/$/, '');
const OUT_DIR = resolve(option('--out', process.env.OUT_DIR || resolve(HERE, '../../videos')));
const PUBLIC_URL = option('--public-url', process.env.PUBLIC_URL || BASE).replace(/\/$/, '');
const list = args.includes('--list');
const all = args.includes('--all');
const ids = args.filter((a) => !a.startsWith('--'));

if (!list && !all && !ids.length) {
  console.log(`Usage: node export.mjs --list | --all | <song-id …>
  --list               show the songs you can render
  --all                render every song
  --url <app>          where the app runs (now ${BASE})
  --out <folder>       where the videos go (now ${OUT_DIR})
  --public-url <link>  the app link written in the YouTube description (now ${PUBLIC_URL})`);
  process.exit(1);
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// The video's name, used for the file too: YouTube fills in the title from the file name on upload.
function videoTitle(score) {
  // Just the composer's name ("W. A. Mozart — theme of K. 265" → "W. A. Mozart"), so the title stays short.
  const composer = (score.composer || '').split(/\s+[—–(]|,\s/)[0].trim();
  const name = `${score.title} - ${composer && !/^traditional/i.test(composer) ? composer + ' - ' : ''}Little Maestro Band for Kids`;
  return name.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').slice(0, 100).trim();
}

function youtubeText(score, band) {
  const desc = [
    `${score.emoji || '🎵'} ${score.title}${score.subtitle ? ' ' + score.subtitle : ''}${score.composer ? ' by ' + score.composer : ''}`,
    '',
    score.about || '',
    '',
    'What is this? 🦇',
    'Little Maestro is a spooky-cute band for kids: a purple bat, a mummy, a pumpkin, a little ghost,',
    'a black cat and their friends. The curtain goes up and the band plays the song. Watch closely:',
    'every character plays the real notes, so the hands move to the right keys, strings and valves.',
    '',
    ...(band.length ? ['Who plays in this song:', ...band.map((b) => `• ${b}`), ''] : []),
    `Play it yourself, pick the band and change the instruments: ${PUBLIC_URL}/#/${score.id}`,
    '',
    `#kidsmusic #musicforkids #${(score.category || 'music').replace(/[^a-z]/gi, '').toLowerCase()}`,
  ].join('\n');
  return `TITLE\n${videoTitle(score)}\n\nDESCRIPTION\n${desc}\n`;
}

// --- Runs inside the app page ---

// Get the stage ready: no autoplay, no buttons or baton, curtain down. Tap the band's sound: everything abcjs
// plays goes through the master gain, so copy its samples (with the clock time they were made) as they pass.
async function prepareStage() {
  state.autoplay = false;
  setTab('show');
  document.body.classList.add('recording');
  window.__finished = new Promise((resolve) => document.addEventListener('song-finished', resolve, { once: true }));
  await document.fonts.ready;

  if (!ABCJS.synth.activeAudioContext()) ABCJS.synth.registerAudioContext();
  const ctx = ABCJS.synth.activeAudioContext();
  await ctx.resume();
  const boost = ctx.createGain();
  boost.gain.value = Math.min(3, 0.45 / Math.max(0.05, state.volume)); // full level whatever the volume slider says
  const limiter = ctx.createDynamicsCompressor(); // so loud chords never clip
  limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.15;
  const tap = ctx.createScriptProcessor(1024, 2, 2);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  const cap = { rate: ctx.sampleRate, left: [], right: [], startMs: null, recording: true };
  // Context time → wall clock (ms since 1970), the same clock as the screencast frames.
  const ct0 = ctx.currentTime, pn0 = performance.now();
  const wall = (t) => performance.timeOrigin + pn0 + (t - ct0) * 1000;
  tap.onaudioprocess = (e) => {
    if (!cap.recording) return;
    if (cap.startMs === null) cap.startMs = wall(e.playbackTime - e.inputBuffer.duration);
    cap.left.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    cap.right.push(new Float32Array(e.inputBuffer.getChannelData(1)));
  };
  masterGain(ctx).connect(boost);
  boost.connect(limiter);
  limiter.connect(tap);
  tap.connect(silent);
  nativeConnect.call(silent, ctx.destination); // keeps the tap running; its output is silent
  window.__cap = cap;
  return { title: state.score.title, seconds: totalSeconds() };
}

function wallNow() {
  return performance.timeOrigin + performance.now();
}

// The captured sound as 16-bit stereo WAV, in base64.
function capturedWav() {
  const cap = window.__cap;
  cap.recording = false;
  const n = cap.left.reduce((sum, c) => sum + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const text = (o, s) => [...s].forEach((ch, k) => v.setUint8(o + k, ch.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, cap.rate, true); v.setUint32(28, cap.rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44;
  cap.left.forEach((l, c) => {
    const r = cap.right[c];
    for (let k = 0; k < l.length; k++, o += 4) {
      v.setInt16(o, Math.max(-1, Math.min(1, l[k])) * 32767, true);
      v.setInt16(o + 2, Math.max(-1, Math.min(1, r[k])) * 32767, true);
    }
  });
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return { wav: btoa(bin), startMs: cap.startMs };
}

function bandList() {
  return state.members.filter((m) => m.inBand && !m.muted)
    .map((m) => `${CHARACTERS[m.char]?.name || 'A friend'} · ${instrumentName(m)}${m.kind === 'voice' && m.role !== 'Melody' ? ` (${m.role})` : ''}`);
}

// --- The job ---

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderSong(browser, id) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  page.on('pageerror', (err) => console.error(`\n  page error: ${err.message}`));
  const work = mkdtempSync(join(tmpdir(), `maestro-${id}-`));
  try {
    await page.goto(`${BASE}/#/${id}`);
    await page.waitForFunction((id) => state.score?.id === id && state.visualObj, id, { timeout: 30000 });
    const { title, seconds } = await page.evaluate(prepareStage);
    await wait(800); // fonts and the curtain settle

    // Every frame Chrome draws, with its time.
    const cdp = await page.context().newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = join(work, `f${String(frames.length).padStart(6, '0')}.jpg`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t: metadata.timestamp * 1000 });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: WIDTH, maxHeight: HEIGHT });

    await wait(LEAD_IN);
    await page.evaluate(() => togglePlay());
    const started = Date.now();
    const progress = setInterval(() => {
      process.stdout.write(`\r  ${id}: playing ${fmt((Date.now() - started) / 1000)} / ${fmt(seconds)}   `);
    }, 1000);
    await page.evaluate(() => window.__finished, null);
    clearInterval(progress);
    await wait(TAIL);
    const endMs = await page.evaluate(wallNow);
    await cdp.send('Page.stopScreencast');
    const { wav, startMs } = await page.evaluate(capturedWav);
    const band = await page.evaluate(bandList);
    const score = await page.evaluate(() => state.score);
    if (frames.length < 10) throw new Error('the stage was not captured');
    writeFileSync(join(work, 'audio.wav'), Buffer.from(wav, 'base64'));

    // Each frame lasts until the next one; the video runs from the first frame to the end of the tail.
    const t0 = frames[0].t;
    let listTxt = '';
    frames.forEach((f, k) => {
      const until = k + 1 < frames.length ? frames[k + 1].t : endMs;
      listTxt += `file '${f.file}'\nduration ${Math.max(0.001, (until - f.t) / 1000).toFixed(4)}\n`;
    });
    listTxt += `file '${frames.at(-1).file}'\n`; // concat needs the last file twice
    writeFileSync(join(work, 'frames.txt'), listTxt);
    const total = (endMs - t0) / 1000;
    const offset = (startMs - t0) / 1000; // when the sound starts, relative to the first frame
    const sync = offset >= 0 ? `adelay=${Math.round(offset * 1000)}:all=1` : `atrim=start=${(-offset).toFixed(3)},asetpts=PTS-STARTPTS`;

    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, `${videoTitle(score)}.mp4`);
    process.stdout.write(`\r  ${id}: encoding ${frames.length} frames…            `);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'concat', '-safe', '0', '-i', join(work, 'frames.txt'),
      '-i', join(work, 'audio.wav'),
      '-af', `${sync},apad,loudnorm=I=-14:TP=-1.5:LRA=11`,
      '-t', total.toFixed(3),
      '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
      '-r', '30', '-fps_mode', 'cfr',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart',
      out,
    ]);
    writeFileSync(join(OUT_DIR, `${videoTitle(score)}.txt`), youtubeText(score, band));
    const fps = frames.length / total;
    console.log(`\r  ✅ ${title}: ${out} (${fmt(total)}, ${fps.toFixed(0)} fps captured)        `);
  } finally {
    await page.close();
    rmSync(work, { recursive: true, force: true });
  }
}

const scores = await (await fetch(`${BASE}/api/scores`)).json();
if (list) {
  const w = Math.max(...scores.map((s) => s.id.length));
  scores.forEach((s) => console.log(`  ${s.id.padEnd(w)}  ${s.emoji || '🎵'} ${s.title}${s.composer ? ' — ' + s.composer : ''}  [${s.category}]`));
  console.log(`\n${scores.length} songs. Render with: <song-id …> or --all`);
  process.exit(0);
}

const todo = all ? scores.map((s) => s.id) : ids;
const unknown = todo.filter((id) => !scores.some((s) => s.id === id));
if (unknown.length) {
  console.error(`Unknown song(s): ${unknown.join(', ')}. See --list.`);
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
console.log(`Rendering ${todo.length} show(s) from ${BASE} → ${OUT_DIR}`);
let failed = 0;
try {
  for (const id of todo) {
    try { await renderSong(browser, id); } catch (err) { failed++; console.error(`\n  ❌ ${id}: ${err.message}`); }
  }
} finally {
  await browser.close();
}
console.log(failed ? `Done, ${failed} failed.` : 'Done.');
process.exitCode = failed ? 1 : 0;
