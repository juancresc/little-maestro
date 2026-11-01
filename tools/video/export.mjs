/* Little Maestro — render the theater show as a YouTube video: curtain up, the band playing the song
 * (with its repeats), the bow and the curtain coming down. No sheet music, no buttons.
 *
 *   node export.mjs --list                  # the songs you can render
 *   node export.mjs twinkle canon-in-d      # some songs
 *   node export.mjs --all                   # every song
 *   options: --url <app>  --out <folder>  --public-url <link for the description>
 *            --res 2160|1440|1080  --fps 60|30  --jobs <songs at once>
 *
 * Usually run as a job on the server (see "YouTube videos" in the README):  ./fastdeploy.sh video …
 *
 * How: the show is rendered, not filmed. A headless Chrome opens the song in the theater with its clock
 * frozen (timers, animation frames, CSS animations), then moves it forward exactly one frame at a time and
 * takes a picture of each frame. So no frame is ever dropped, and the picture can be bigger than the
 * screen: the 1920×1080 stage is drawn at 2× for 4K. The band's sound is mixed afterwards from the same
 * audio abcjs built for the show, placed at the frames where the show started it. ffmpeg makes the MP4.
 * Each video has a .txt next to it with a ready-to-paste YouTube title and description.
 */
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1920, HEIGHT = 1080; // the stage's layout size; --res scales the picture, not the layout
const LEAD_IN = 2000; // ms of closed curtain (with the song's title) before the show
const TAIL = 4500;    // ms after the last note: the bow and the curtain coming down

const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
}
const BASE = option('--url', process.env.MAESTRO_URL || 'http://localhost:8080').replace(/\/$/, '');
const OUT_DIR = resolve(option('--out', process.env.OUT_DIR || resolve(HERE, '../../videos')));
const PUBLIC_URL = option('--public-url', process.env.PUBLIC_URL || BASE).replace(/\/$/, '');
const RES = +option('--res', process.env.RES || 2160);
const FPS = +option('--fps', process.env.FPS || 60);
// On a Mac the GPU draws and a hardware encoder makes the MP4, so several songs fit at once; in Docker
// (the server) everything is done by the CPU, so one at a time.
const MAC = process.platform === 'darwin';
const JOBS = Math.max(1, +option('--jobs', process.env.JOBS || (MAC ? 6 : 1)));
const list = args.includes('--list');
const all = args.includes('--all');
const ids = args.filter((a) => !a.startsWith('--'));

if (!list && !all && !ids.length) {
  console.log(`Usage: node export.mjs --list | --all | <song-id …>
  --list               show the songs you can render
  --all                render every song
  --res <lines>        picture height: 2160 (4K), 1440 or 1080 (now ${RES})
  --fps <n>            frames per second (now ${FPS})
  --jobs <n>           songs rendered at the same time (now ${JOBS})
  --url <app>          where the app runs (now ${BASE})
  --out <folder>       where the videos go (now ${OUT_DIR})
  --public-url <link>  the app link written in the YouTube description (now ${PUBLIC_URL})`);
  process.exit(1);
}
if (![1080, 1440, 2160].includes(RES) || !(FPS >= 24 && FPS <= 60)) {
  console.error('--res must be 1080, 1440 or 2160, and --fps between 24 and 60.');
  process.exit(1);
}

const fmt = (s) => (s = Math.round(s), `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

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

// Before the app loads: note every sound the show starts and stops, on the page's (frozen) clock, so the
// mix can be rebuilt offline at exactly the same moments. And a stepper for CSS animations, which Chrome
// otherwise runs on the real clock: each frame, every animation is paused and set to where it should be.
function instrumentPage() {
  const sounds = [];
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, ...rest) {
    if (!(this.context instanceof OfflineAudioContext)) {
      this.__sound = { buffer: this.buffer, at: performance.now(), offset, stop: null };
      sounds.push(this.__sound);
    }
    return start.call(this, when, offset, ...rest);
  };
  AudioBufferSourceNode.prototype.stop = function (...rest) {
    if (this.__sound && this.__sound.stop === null) this.__sound.stop = performance.now();
    return stop.apply(this, rest);
  };
  window.__sounds = sounds;

  const born = new WeakMap();
  window.__stepAnimations = () => {
    const now = performance.now();
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished') continue;
      if (!born.has(a)) born.set(a, now);
      a.pause();
      const t = (now - born.get(a)) * a.playbackRate;
      const end = a.effect?.getComputedTiming().endTime;
      if (Number.isFinite(end) && t >= end) a.finish(); // fires animationend, like a real run
      else a.currentTime = t;
    }
    return window.__finished === true;
  };
}

// Get the stage ready: no autoplay, no buttons or baton, curtain down, and the song's audio built.
async function prepareStage() {
  state.autoplay = false;
  setTab('show');
  document.body.classList.add('recording');
  document.addEventListener('song-finished', () => { window.__finished = true; }, { once: true });
  await document.fonts.ready;
  if (!ABCJS.synth.activeAudioContext()) ABCJS.synth.registerAudioContext();
  await synthControl.runWhenReady(() => {}); // load the instruments and build the audio now, not on play
  return { title: state.score.title, seconds: totalSeconds() };
}

// The show's sounds, mixed offline from `t0` (the first frame) for `seconds`, as 16-bit stereo WAV in base64.
async function mixedWav([t0, seconds]) {
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const boost = ctx.createGain();
  boost.gain.value = Math.min(3, 0.45 / Math.max(0.05, state.volume)); // full level whatever the volume slider says
  const limiter = ctx.createDynamicsCompressor(); // so loud chords never clip
  limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.15;
  boost.connect(limiter);
  limiter.connect(ctx.destination);
  for (const s of window.__sounds) {
    if (!s.buffer) continue;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.connect(boost);
    const at = Math.max(0, (s.at - t0) / 1000);
    src.start(at, s.offset);
    if (s.stop !== null) src.stop(Math.max(at, (s.stop - t0) / 1000));
  }
  const out = await ctx.startRendering();
  const l = out.getChannelData(0), r = out.getChannelData(1), n = l.length;
  const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const text = (o, s) => [...s].forEach((ch, k) => v.setUint8(o + k, ch.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * 4, true);
  for (let k = 0, o = 44; k < n; k++, o += 4) {
    v.setInt16(o, Math.max(-1, Math.min(1, l[k])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, r[k])) * 32767, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(bin);
}

function bandList() {
  return state.members.filter((m) => m.inBand && !m.muted)
    .map((m) => `${CHARACTERS[m.char]?.name || 'A friend'} · ${instrumentName(m)}${m.kind === 'voice' && m.role !== 'Melody' ? ` (${m.role})` : ''}`);
}

// --- The job ---

// YouTube's recommended upload bitrates (Mbps), for 60 fps and for 30 fps or less.
const BITRATE = { 2160: [60, 40], 1440: [24, 16], 1080: [12, 8] }[RES][FPS > 30 ? 0 : 1];

// ffmpeg reading JPEG frames from a pipe, writing the picture-only video. Resolves when it is done.
function frameEncoder(file) {
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    ...(MAC
      ? ['-c:v', 'h264_videotoolbox', '-b:v', `${BITRATE}M`, '-maxrate', `${Math.round(BITRATE * 1.5)}M`, '-bufsize', `${BITRATE * 2}M`]
      : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
        // Its share of the cores: left alone, each x264 starts threads for the whole machine (2+ GB each at 4K).
        '-threads', String(Math.max(2, Math.floor(availableParallelism() / JOBS)))]),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(Math.round(FPS / 2)), '-bf', '2', // what YouTube asks for
    '-movflags', '+faststart', file,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((ok, fail) => ff.on('close', (code) => (code ? fail(new Error(`ffmpeg exited with ${code}`)) : ok())));
  return {
    write: (buf) => (ff.stdin.write(buf) ? null : new Promise((ok) => ff.stdin.once('drain', ok))),
    end: () => { ff.stdin.end(); return done; },
  };
}

async function renderSong(browser, id) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: RES / HEIGHT });
  await context.clock.install(); // the page's clock runs normally until it is paused below
  await context.addInitScript(instrumentPage);
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error(`\n  page error (${id}): ${err.message}`));
  const work = mkdtempSync(join(tmpdir(), `maestro-${id}-`));
  try {
    await page.goto(`${BASE}/#/${id}`);
    await page.waitForFunction((id) => state.score?.id === id && state.visualObj, id, { timeout: 30000, polling: 100 });
    const { title, seconds } = await page.evaluate(prepareStage);

    // Freeze time; from here on, the page only moves when it's told to, one frame at a time.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const t0 = await page.evaluate(() => performance.now());
    const cdp = await context.newCDPSession(page);
    // Without a scaled clip, Chrome hands back the picture at 1920×1080 whatever the device scale is.
    const clip = { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: RES / HEIGHT };
    const video = frameEncoder(join(work, 'video.mp4'));
    const leadFrames = Math.round((LEAD_IN / 1000) * FPS), tailFrames = Math.round((TAIL / 1000) * FPS);
    const expected = leadFrames + Math.round(seconds * FPS) + tailFrames;
    const started = Date.now();
    let frame = 0, clockMs = 0, endFrame = Infinity, reported = started;
    while (frame < endFrame) {
      if (frame === leadFrames) await page.evaluate(() => togglePlay());
      const finished = await page.evaluate(() => window.__stepAnimations());
      if (finished && endFrame === Infinity) endFrame = frame + tailFrames;
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true, clip });
      await video.write(Buffer.from(data, 'base64'));
      frame++;
      const target = (frame * 1000) / FPS;
      await page.clock.runFor(Math.round(target - clockMs));
      clockMs += Math.round(target - clockMs);
      if (Date.now() - reported > 30000) {
        reported = Date.now();
        const rate = frame / ((reported - started) / 1000);
        const left = Math.max(0, expected - frame) / rate;
        console.log(`  ${id}: ${Math.min(99, Math.round((100 * frame) / expected))}% (${fmt(frame / FPS)} of ~${fmt(expected / FPS)}, ${rate.toFixed(1)} frames/s, ~${fmt(left)} to go)`);
      }
      if (frame > expected * 2 + FPS * 60) throw new Error('the song never finished');
    }
    const total = frame / FPS;
    await video.end();

    const wav = await page.evaluate(mixedWav, [t0, total]);
    writeFileSync(join(work, 'audio.wav'), Buffer.from(wav, 'base64'));
    const band = await page.evaluate(bandList);
    const score = await page.evaluate(() => state.score);

    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, `${videoTitle(score)}.mp4`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', join(work, 'video.mp4'), '-i', join(work, 'audio.wav'),
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
      '-t', total.toFixed(3), '-movflags', '+faststart',
      out,
    ]);
    writeFileSync(join(OUT_DIR, `${videoTitle(score)}.txt`), youtubeText(score, band));
    const took = (Date.now() - started) / 1000;
    console.log(`  ✅ ${title}: ${out} (${fmt(total)}, ${RES}p${FPS}, rendered in ${fmt(took)})`);
  } finally {
    await context.close();
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

// Each job gets its own Chrome: one Chrome draws all its pages in a single process, so only separate
// Chromes render in parallel.
console.log(`Rendering ${todo.length} show(s) at ${RES}p${FPS}, ${Math.min(JOBS, todo.length)} at a time, from ${BASE} → ${OUT_DIR}`);
let failed = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, async () => {
  // The full Chromium in headless mode, which on a Mac draws with the GPU (the lighter headless shell can't).
  const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (let id; (id = queue.shift());) {
      try { await renderSong(browser, id); } catch (err) { failed++; console.error(`\n  ❌ ${id}: ${err.message}`); }
    }
  } finally {
    await browser.close();
  }
}));
console.log(failed ? `Done, ${failed} failed.` : 'Done.');
process.exitCode = failed ? 1 : 0;
