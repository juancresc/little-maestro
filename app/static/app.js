/* Little Maestro — library, sheet music, the band and the show. */
const SOUNDFONT = 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/';

// abcjs connects its sounds straight to the speakers. Route them through one master
// gain per audio context instead, so the music can fade out smoothly when paused.
const masterGains = new WeakMap();
const nativeConnect = AudioNode.prototype.connect;
function masterGain(ctx) {
  let g = masterGains.get(ctx);
  if (!g) {
    g = ctx.createGain();
    nativeConnect.call(g, ctx.destination);
    masterGains.set(ctx, g);
  }
  return g;
}
AudioNode.prototype.connect = function (dest, ...rest) {
  if (dest instanceof AudioDestinationNode && this.context === dest.context && !(this.context instanceof OfflineAudioContext)) {
    state.audioCtx = this.context;
    return nativeConnect.call(this, masterGain(this.context), ...rest);
  }
  return nativeConnect.call(this, dest, ...rest);
};
function setMasterGain(value, seconds = 0) {
  if (!state.audioCtx) return;
  const g = masterGain(state.audioCtx).gain, now = state.audioCtx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  if (seconds) g.linearRampToValueAtTime(value, now + seconds);
  else g.setValueAtTime(value, now);
}

const INSTRUMENTS = [
  [0, '🎹 Piano'], [4, '🎹 Electric piano'], [6, '🎼 Harpsichord'], [8, '✨ Celesta'],
  [10, '🎁 Music box'], [11, '🔔 Vibraphone'], [12, '🪵 Marimba'], [13, '🪵 Xylophone'],
  [19, '⛪ Organ'], [21, '🪗 Accordion'], [24, '🎸 Guitar'], [105, '🪕 Banjo'],
  [32, '🎻 Double bass'], [33, '🎸 Bass guitar'], [58, '📯 Tuba'], [42, '🎻 Cello'],
  [40, '🎻 Violin'], [45, '🎻 Pizzicato'], [46, '🪉 Harp'], [48, '🎻 String section'],
  [52, '🎤 Choir'], [56, '🎺 Trumpet'], [59, '🎺 Muted trumpet'], [57, '🎺 Trombone'],
  [65, '🎷 Alto sax'], [66, '🎷 Tenor sax'], [71, '🎶 Clarinet'], [70, '🎶 Bassoon'],
  [73, '🪈 Flute'], [75, '🪈 Pan flute'], [79, '🪈 Ocarina'], [108, '🎵 Kalimba'],
  [114, '🥁 Steel drums'], [80, '👾 8-bit'],
];

// Accompaniment patterns per meter. In abcjs gchord: f = bass note, c = chord, z = rest.
const GCHORD = { '4/4': 'fcfc', '2/2': 'fcfc', '3/4': 'fcc', '2/4': 'fc', '6/8': 'fzcfzc', '3/8': 'fcc' };
const DRUM = {
  '4/4': 'dddd 36 42 38 42 100 70 90 70',
  '2/2': 'dddd 36 42 38 42 100 70 90 70',
  '3/4': 'ddd 36 42 42 100 70 70',
  '2/4': 'dd 36 38 100 85',
  '6/8': 'd2dd2d 36 42 38 42 100 60 90 60',
  '3/8': 'ddd 36 42 42 90 60 60',
};
const JAZZ_DRUM = {
  '4/4': 'd2ddd2dd 51 42 51 51 42 51 100 90 70 100 90 70',
  '2/2': 'd2ddd2dd 51 42 51 51 42 51 100 90 70 100 90 70',
  '3/4': 'd2d2dd 51 42 42 51 100 85 85 70',
  '2/4': 'd2dd 51 42 51 100 90 70',
  '6/8': 'd2dd2d 51 42 51 42 100 70 90 70',
  '3/8': 'd2d 51 42 100 80',
};
const MOOD_EMOJI = { happy: '😄', calm: '😌', sleepy: '😴', spooky: '👻', dance: '💃', exciting: '⚡', cool: '😎' };
const NOTE_COLORS = ['#ef4444', '#f0643a', '#f97316', '#f5a524', '#e6b800', '#84cc16', '#2fb39a', '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'];
const LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const NOTE_GLYPHS = ['♪', '♫', '♩', '♬'];
const KEY_LOW = 48, KEY_HIGH = 84; // C3..C6
const VOICE_CHARS = ['bat', 'mummy', 'ghost', 'cat'];
const TARGET_SECONDS = 100; // short songs repeat until the show is about this long

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const state = {
  filters: { q: '', category: '', mood: '', level: 0, band: false },
  list: [],          // songs currently shown in the library (used by prev/next)
  score: null,       // the selected score (from the API, or a draft from the composer)
  visualObj: null,
  members: [],       // band members for the current score
  jazz: false,
  noteInfo: new WeakMap(), // SVG note element -> { voice, el }
  lit: [],
  solfege: false,
  volume: loadPref('maestro-volume', 0.35), // 0..1 — starts gentle
  tab: loadPref('maestro-tab', 'show'),
  autoplay: loadPref('maestro-autoplay', true),
  audioCtx: null,
  songSeconds: 0,    // one pass through the song
  passes: 1,         // how many times the song plays in a row
  pass: 0,           // which pass we're on
  passMs: 0,         // one pass, as measured by the player (includes tempo changes)
  elapsed: 0,
};

/* ---------- Tabs ---------- */

function songHash(id, tab) {
  return id ? (tab === 'music' ? '#/music/' : '#/') + id : '';
}

function setTab(tab) {
  state.tab = tab;
  if (state.score?.id) history.replaceState(null, '', songHash(state.score.id, tab));
  savePref('maestro-tab', tab);
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $('#view-show').hidden = tab !== 'show';
  $('#view-music').hidden = tab !== 'music';
  document.body.classList.toggle('mode-show', tab === 'show');
  if (tab !== 'show' && document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
$$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
$('#to-music').addEventListener('click', () => setTab('music'));

// From the Music tab, jump straight into the theater: full screen, curtain up, band playing.
$('#to-theater').addEventListener('click', async () => {
  setTab('show');
  if (synthControl.isStarted) setPlaying(true);
  else if (state.score) await togglePlay();
});

/* ---------- Library ---------- */

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.status === 204 ? null : res.json();
}

function chip(label, active, onClick, count) {
  const b = document.createElement('button');
  b.className = 'chip' + (active ? ' on' : '');
  b.innerHTML = esc(label) + (count != null ? ` <small>${count}</small>` : '');
  b.onclick = onClick;
  return b;
}

async function loadFacets() {
  const f = await api('/api/facets');
  const cats = $('#categories');
  cats.replaceChildren(chip('All', !state.filters.category, () => setFilter('category', '')));
  f.categories.forEach((c) => cats.append(chip(c.name, state.filters.category === c.name, () => setFilter('category', c.name), c.count)));
  $('#category-list').innerHTML = f.categories.map((c) => `<option value="${esc(c.name)}">`).join('');

  const moods = $('#moods');
  moods.replaceChildren(chip('Any', !state.filters.mood, () => setFilter('mood', '')));
  f.moods.forEach((m) => moods.append(chip(`${MOOD_EMOJI[m.name] || '🎵'} ${m.name}`, state.filters.mood === m.name, () => setFilter('mood', m.name))));

  const levels = $('#levels');
  levels.replaceChildren(chip('Any', !state.filters.level, () => setFilter('level', 0)));
  [1, 2, 3].forEach((l) => levels.append(chip('⭐'.repeat(l), state.filters.level === l, () => setFilter('level', l))));
}

function setFilter(key, value) {
  state.filters[key] = state.filters[key] === value && value ? (typeof value === 'number' ? 0 : '') : value;
  loadFacets();
  loadScores();
}

async function loadScores() {
  const f = state.filters;
  const qs = new URLSearchParams({ q: f.q, category: f.category, mood: f.mood, level: f.level, band: f.band });
  const scores = await api('/api/scores?' + qs);
  state.list = scores;
  $('#count').textContent = `${scores.length} song${scores.length === 1 ? '' : 's'}`;
  $('#cards').innerHTML = scores.map((s) => `
    <li><button class="card" data-id="${esc(s.id)}">
      <span class="card-emoji">${esc(s.emoji)}</span>
      <span class="card-body">
        <strong>${esc(s.title)}</strong>
        <span class="card-sub">${esc(s.composer)}</span>
        <span class="card-tags"><span class="pill">${esc(s.category)}</span>${s.is_band ? '<span class="pill band">🎺 band</span>' : ''}<span class="stars">${'⭐'.repeat(s.level)}</span></span>
      </span>
    </button></li>`).join('') || '<li class="empty">No songs match — try another filter 🦇</li>';
  markCurrent();
}

function markCurrent() {
  $$('.card').forEach((c) => c.classList.toggle('current', c.dataset.id === state.score?.id));
}

$('#cards').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openScore(card.dataset.id);
});

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.filters.q = e.target.value; loadScores(); }, 200);
});
$('#band-only').addEventListener('change', (e) => { state.filters.band = e.target.checked; loadScores(); });

function stepSong(delta) {
  if (!state.list.length) return;
  const i = state.list.findIndex((s) => s.id === state.score?.id);
  const next = state.list[(i + delta + state.list.length) % state.list.length];
  openScore(next.id);
}
$('#prev').addEventListener('click', () => stepSong(-1));
$('#next').addEventListener('click', () => stepSong(1));

/* ---------- Importing more music ---------- */

$('#import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#import-status');
  status.textContent = '⏳ Fetching the tune…';
  try {
    const score = await api('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: $('#import-url').value }),
    });
    status.textContent = `✅ Added “${score.title}” to your library!`;
    $('#import-url').value = '';
    await loadFacets(); await loadScores();
    openScore(score.id);
  } catch (err) {
    status.textContent = '❌ ' + err.message;
  }
});

/* ---------- Opening a score ---------- */

async function openScore(id) {
  const score = await api('/api/scores/' + encodeURIComponent(id));
  history.replaceState(null, '', songHash(id, state.tab));
  await showScore(score);
}

let showToken = 0;

async function showScore(score) {
  const token = ++showToken;
  const wasPlaying = synthControl.isStarted;
  if (synthControl.isStarted) synthControl.pause();
  state.score = score;
  state.jazz = false;
  state.pass = 0;
  state.passMs = 0;
  state.chordName = null;
  state.elapsed = 0;
  $('#now-emoji').textContent = $('#show-emoji').textContent = score.emoji;
  $('#now-title').textContent = $('#show-title').textContent = score.title + (score.subtitle ? ' ' + score.subtitle : '');
  $('#now-composer').textContent = $('#show-composer').textContent = score.composer;
  $('#now-about').textContent = score.about || '';
  $('#now-category').textContent = score.category;
  $('#now-level').textContent = '⭐'.repeat(score.level || 1);
  markCurrent();

  render();
  state.members = buildMembers(score, state.visualObj);
  updateLength();
  renderBand();
  $$('.play-btn, .jazz-btn').forEach((b) => { b.disabled = false; });
  updateJazzButtons();
  // If music was already playing, carry on with the new song (the curtain stays up).
  await loadTune(wasPlaying);
  if (token !== showToken) return; // another song was picked while this one loaded
  if (wasPlaying) await synthControl.play();
  setPlaying(synthControl.isStarted);
}

// Hand the current tune to the player. `userAction` = we're inside a click, so audio may start.
async function loadTune(userAction) {
  await synthControl.setTune(state.visualObj, userAction, audioParams());
  // setTune(…, false) doesn't build the new audio, and abcjs would otherwise keep
  // playing the previously loaded song — force a rebuild on the next play().
  if (!userAction) synthControl.isLoaded = false;
}

/* ---------- Song length, repeats and time ---------- */

// One pass through the song, in seconds (before the tempo slider).
function estimateSeconds() {
  const seq = state.visualObj.setUpAudio({});
  let end = 0;
  seq.tracks.forEach((t) => t.forEach((e) => { if (e.cmd === 'note') end = Math.max(end, e.start + e.duration); }));
  const m = state.visualObj.getMeterFraction();
  return (end / (m.num / m.den)) * state.visualObj.millisecondsPerMeasure() / 1000;
}

function updateLength() {
  state.songSeconds = estimateSeconds() || 30;
  state.passes = Math.max(1, Math.min(5, Math.round(TARGET_SECONDS / state.songSeconds)));
  updateTime();
}

function totalSeconds() {
  const pass = state.passMs ? state.passMs / 1000 : state.songSeconds * 100 / (synthControl.warp || 100);
  return pass * state.passes;
}

function updateTime() {
  const total = totalSeconds();
  const text = `${fmtTime(state.elapsed)} / ${fmtTime(total)}`;
  $('#show-time').textContent = text;
  $('#music-time').textContent = '⏱ ' + text;
  const times = state.passes > 1 ? ` · plays ${state.passes} times` : '';
  $('#curtain-info').textContent = state.elapsed > 0 && state.elapsed < total - 1
    ? `⏸ Paused at ${fmtTime(state.elapsed)} of ${fmtTime(total)}`
    : `⏱ ${fmtTime(total)}${times}`;
}

/* ---------- Rendering the sheet ---------- */

// Each voice starts with "V:…" followed by "%%MIDI program N" or, for a percussion part, "%%MIDI channel 10".
const VOICE_MIDI_RE = /^(V:[^\n]*\n%%MIDI )(program (\d+)|channel 10)/gm;

// Swap the band's instrument picks into the ABC (percussion parts keep their drum kit).
function abcWithBandInstruments(abc) {
  let i = -1;
  return abc.replace(VOICE_MIDI_RE, (m, head, what, prog) => {
    i++;
    if (!prog) return m;
    const member = state.members.find((x) => x.kind === 'voice' && x.index === i);
    return head + 'program ' + (member ? member.program : prog);
  });
}

function render() {
  const abc = abcWithBandInstruments(state.score.abc);
  // Size from the window, not the (possibly hidden) Music tab.
  const width = Math.min(900, Math.max(320, window.innerWidth - (window.innerWidth < 900 ? 64 : 440)));
  state.visualObj = ABCJS.renderAbc('paper', abc, {
    responsive: 'resize',
    add_classes: true,
    clickListener: onNoteClick,
    // A wide staff squeezed into the column draws the music small, with more bars per line.
    staffwidth: width < 600 ? width * 1.4 : width * 1.9,
    wrap: { minSpacing: 1.8, maxSpacing: 2.8, preferredMeasuresPerLine: width < 600 ? 3 : 8 },
    paddingtop: 6, paddingbottom: 10, paddingleft: 8, paddingright: 8,
    format: { titlefont: 'Fredoka 22', composerfont: 'Nunito 12', gchordfont: 'Nunito 13', vocalfont: 'Nunito 13' },
  })[0];
  mapNotes();
  addCursor();
}

// abcjs numbers voices per staff; record each note's overall voice and its abc element.
function mapNotes() {
  state.noteInfo = new WeakMap();
  state.visualObj.lines.forEach((line) => {
    let voiceIndex = 0;
    (line.staff || []).forEach((staff) => staff.voices.forEach((voice) => {
      const v = voiceIndex++;
      voice.forEach((el) => (el.abselem?.elemset || []).forEach((svgEl) => state.noteInfo.set(svgEl, { voice: v, el })));
    }));
  });
}

function countVoices(visualObj) {
  const line = visualObj.lines.find((l) => l.staff);
  return line ? line.staff.reduce((n, s) => n + s.voices.length, 0) : 1;
}

function addCursor() {
  const svg = $('#paper svg');
  if (!svg) return;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'abcjs-cursor');
  ['x1', 'x2', 'y1', 'y2'].forEach((a) => line.setAttributeNS(null, a, 0));
  svg.appendChild(line);
}

/* ---------- The band ---------- */

function pickCharacter(label, index) {
  const l = (label || '').toLowerCase();
  for (const [id, words] of [['mummy', ['mummy']], ['bat', ['bat']], ['ghost', ['ghost', 'boo']], ['cat', ['cat', 'midnight']],
    ['pumpkin', ['pumpkin']], ['candy', ['candy']], ['monster', ['stitchy', 'monster']]]) {
    if (words.some((w) => l.includes(w))) return id;
  }
  return VOICE_CHARS[index % VOICE_CHARS.length];
}

function buildMembers(score, visualObj) {
  const pb = score.playback || {};
  const labels = (pb.voices || '').split(';').map((s) => s.trim()).filter(Boolean);
  const voiceDefs = [...score.abc.matchAll(VOICE_MIDI_RE)].map((m) => ({ program: m[3] ? +m[3] : null, perc: !m[3] }));
  const hasChords = /"[A-G][^"]*"/.test(score.abc.replace(/^(w:|%).*$/gm, ''));
  const members = [];
  const n = countVoices(visualObj);
  for (let i = 0; i < n; i++) {
    members.push({
      kind: 'voice', index: i, char: voiceDefs[i]?.perc ? 'monster' : pickCharacter(labels[i], i),
      role: (labels[i] || (n === 1 ? 'Melody' : `Voice ${i + 1}`)).replace(/^.*?·\s*/, ''),
      program: voiceDefs[i]?.program ?? (+pb.instrument || 0), perc: !!voiceDefs[i]?.perc,
      muted: false, inBand: true, canJoin: true,
    });
  }
  members.push({ kind: 'chords', index: 0, char: 'pumpkin', role: 'Chords', program: +(pb.chordprog ?? 0), muted: false, inBand: hasChords, canJoin: hasChords });
  members.push({ kind: 'bass', index: 0, char: 'candy', role: 'Bass line', program: +(pb.bassprog ?? 32), muted: false, inBand: hasChords, canJoin: hasChords });
  members.push({ kind: 'drums', index: 0, char: 'monster', role: 'Drums', program: 0, muted: false, inBand: pb.drums === 'on', canJoin: true });

  // Bring back the choices made for this song last time.
  const saved = score.id ? loadPref('maestro-band:' + score.id, null) : null;
  (saved || []).forEach((s) => {
    const m = members.find((x) => x.kind === s.kind && x.index === s.index);
    if (!m) return;
    if (CHARACTERS[s.char]) m.char = s.char;
    if (Number.isInteger(s.program)) m.program = s.program;
    m.muted = !!s.muted;
    m.inBand = m.canJoin && !!s.inBand;
  });
  return members;
}

function saveBand() {
  if (!state.score?.id) return;
  savePref('maestro-band:' + state.score.id, state.members.map(({ kind, index, char, program, muted, inBand }) => ({ kind, index, char, program, muted, inBand })));
}

const propOf = (m) => (m.kind === 'drums' || m.perc ? 'drums' : propForProgram(m.program));

function instrumentName(m) {
  if (m.kind === 'drums') return '🥁 Drum kit';
  if (m.perc) return '🥁 Percussion';
  return (INSTRUMENTS.find(([p]) => p === m.program) || [, `🎵 Instrument ${m.program}`])[1];
}

function renderBand() {
  renderStage();
  renderShow();
}

// Music tab: the mixer, plus invitations for anyone not in this song.
function renderStage() {
  $('#stage').innerHTML = state.members.map((m, i) => {
    if (!m.inBand) return '';
    const c = CHARACTERS[m.char];
    return `
      <div class="member band-${i}${m.muted ? ' muted' : ''}" data-i="${i}">
        ${characterHTML(m.char, propOf(m))}
        <div class="member-name">${esc(c.name)}</div>
        <div class="member-role">${esc(m.role)} · ${instrumentName(m)}</div>
        <div class="member-actions">
          <button class="mini pick" data-i="${i}">✏️ Change</button>
          <button class="mini mute" data-i="${i}" aria-pressed="${!m.muted}">${m.muted ? '🔇 Out' : '🔊 On'}</button>
        </div>
      </div>`;
  }).join('');
  $('#stage-invites').innerHTML = state.members.map((m, i) => (!m.inBand && m.canJoin
    ? `<button class="invite" data-i="${i}">➕ Invite ${esc(CHARACTERS[m.char].name)} <small>(${esc(m.role)})</small></button>` : '')).join('');
}

// Show tab: only the characters playing in this song, as big as the screen allows.
function renderShow() {
  const band = state.members.map((m, i) => ({ m, i })).filter(({ m }) => m.inBand);
  $('#show-band').style.setProperty('--n', band.length);
  $('#show-band').innerHTML = band.map(({ m, i }) => {
    const c = CHARACTERS[m.char];
    return `
      <div class="show-member band-${i}${m.muted ? ' muted' : ''}" data-i="${i}" style="--delay:${(i * 0.37) % 1.3}s"
        title="${esc(c.name)} — click to pause / wake up">
        <div class="fx"></div>
        ${characterHTML(m.char, propOf(m))}
      </div>`;
  }).join('');
  layoutBand();
}

// Stand the band on the stage floor. Everyone fits in one row when possible; otherwise extra
// rows stand further back: higher up the floor, a little smaller, and behind the front row.
// The front row gets the first players (the melody), the back rows the rest.
function layoutBand() {
  const members = [...$$('#show-band .show-member')];
  const n = members.length;
  if (!n) return;
  const W = theater.clientWidth || window.innerWidth, H = theater.clientHeight || window.innerHeight;
  const portrait = H > W * 1.1;
  const maxRows = portrait ? 3 : 2;
  // Phones are tall: a deeper floor, so rows can stand further apart.
  const stepFrac = portrait ? 0.62 : 0.4;        // row spacing, as a fraction of a character's height
  const floorTop = portrait ? 0.46 : 0.32;       // back row's feet must stay below this (fraction of H)
  const maxCharH = portrait ? 0.4 : 0.5;         // keep it a stage, not a close-up
  const front = 0.035;                           // front row's feet, as a fraction of the stage height
  const scaleOf = (r) => 1 - r * 0.12;           // back rows are a little smaller (further away)
  let best = null;
  for (let rows = 1; rows <= Math.min(n, maxRows); rows++) {
    const cols = Math.ceil(n / rows);
    // Rows step back by at least 40% of a character's height so every face stays visible,
    // and the back row's feet must stay on the floor (below 32% of the stage height).
    const byWidth = (W * (portrait ? 0.96 : 0.9)) / cols;
    const byHeight = (0.9 - front) * H * 0.909 / (1 + (rows - 1) * stepFrac * scaleOf(1));
    const byFloor = rows > 1 ? ((floorTop - front) * H * 0.909) / ((rows - 1) * stepFrac) : Infinity;
    const w = Math.min(byWidth, byHeight, byFloor, maxCharH * H * 0.909);
    const score = w * (1 - 0.15 * (rows - 1));   // prefer fewer rows when sizes are similar
    if (!best || score > best.score) best = { rows, cols, w, score };
  }
  const step = (best.w / 0.909) * stepFrac / H;    // how far up the floor each row stands
  members.forEach((el, i) => {
    const r = Math.floor(i / best.cols);           // 0 = front row: the first players (melody)
    const inRow = Math.min(best.cols, n - r * best.cols);
    const c = i % best.cols;
    const w = best.w * scaleOf(r);
    const x = W / 2 + (c - (inRow - 1) / 2) * w * (best.rows > 1 ? 1.05 : 1.02);
    Object.assign(el.style, { width: `${w}px`, left: `${x - w / 2}px`, bottom: `${(front + r * step) * H}px`, zIndex: String(20 - r) });
    el.classList.toggle('back-row', r > 0);
  });
}
window.addEventListener('resize', () => layoutBand());

$('#stage').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = +btn.dataset.i;
  if (btn.classList.contains('pick')) openPicker(i);
  if (btn.classList.contains('mute')) { state.members[i].muted = !state.members[i].muted; bandChanged('mix'); }
});
$('#stage-invites').addEventListener('click', (e) => {
  const btn = e.target.closest('.invite');
  if (!btn) return;
  const m = state.members[+btn.dataset.i];
  m.inBand = true;
  m.muted = false;
  bandChanged();
});

// audio: true = rebuild the sound (new instruments), 'mix' = only who's playing changed, false = no sound change.
function bandChanged(audio = true) {
  saveBand();
  renderBand();
  if (audio === 'mix') remixWhilePlaying();
  else if (audio) applySettings();
}

/* ---------- Picker: choose who plays, and on what ---------- */

let pickerIndex = -1;
function openPicker(i) {
  pickerIndex = i;
  renderPicker();
  $('#picker').showModal();
}

function renderPicker() {
  const m = state.members[pickerIndex];
  $('#picker-title').textContent = `${m.role}: who plays?`;
  $('#pick-chars').innerHTML = Object.entries(CHARACTERS).map(([id, c]) => `
    <button class="pick-char${id === m.char ? ' on' : ''}" data-char="${id}">
      ${characterHTML(id, propOf(m))}<span>${esc(c.name)}</span>
    </button>`).join('');
  const drums = m.kind === 'drums' || m.perc;
  $('#pick-inst-h').hidden = drums;
  $('#pick-insts').hidden = drums;
  $('#pick-insts').innerHTML = INSTRUMENTS.map(([p, name]) =>
    `<button class="chip${p === m.program ? ' on' : ''}" data-program="${p}">${name}</button>`).join('');
  $('#pick-mute').textContent = m.muted ? '🔊 Play again' : '🔇 Sit out';
  $('#pick-home').hidden = m.kind === 'voice';
}

$('#pick-chars').addEventListener('click', (e) => {
  const b = e.target.closest('.pick-char');
  if (!b) return;
  state.members[pickerIndex].char = b.dataset.char;
  bandChanged(false);
  renderPicker();
});
$('#pick-insts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-program]');
  if (!b) return;
  const m = state.members[pickerIndex];
  m.program = +b.dataset.program;
  bandChanged();
  renderPicker();
  previewInstrument(m.program);
});
$('#pick-mute').addEventListener('click', () => {
  const m = state.members[pickerIndex];
  m.muted = !m.muted;
  bandChanged('mix');
  renderPicker();
});
$('#pick-home').addEventListener('click', () => {
  state.members[pickerIndex].inBand = false;
  bandChanged();
  $('#picker').close();
});

$$('.jazz-btn').forEach((b) => b.addEventListener('click', () => {
  state.jazz = !state.jazz;
  if (state.jazz) state.members.forEach((m) => { if (m.canJoin && m.kind !== 'voice') { m.inBand = true; m.muted = false; } });
  updateJazzButtons();
  bandChanged();
}));

function updateJazzButtons() {
  $$('.jazz-btn').forEach((b) => {
    b.setAttribute('aria-pressed', state.jazz);
    b.textContent = state.jazz ? '🎷 Jazz mode ON' : '🎷 Jazz it up!';
  });
}

function meterKey() {
  const m = state.visualObj.getMeterFraction();
  return `${m.num}/${m.den}`;
}

function audioParams() {
  const pb = state.score.playback || {};
  const off = (m) => !m || m.muted || !m.inBand;
  const voices = state.members.filter((m) => m.kind === 'voice');
  const chords = state.members.find((m) => m.kind === 'chords');
  const bass = state.members.find((m) => m.kind === 'bass');
  const drums = state.members.find((m) => m.kind === 'drums');
  const meter = meterKey();
  const params = {
    soundFontUrl: SOUNDFONT,
    // abcjs boosts this soundfont 3x by default, which is loud; scale it by the volume slider.
    soundFontVolumeMultiplier: 3 * state.volume,
    program: voices[0]?.program ?? 0,
    voicesOff: voices.filter(off).map((m) => m.index),
    chordprog: chords.program,
    bassprog: bass.program,
    // abcjs plays accompaniment very softly by default (48/64); make Pumpkin and Candy audible.
    chordvol: 80,
    bassvol: 95,
  };

  let pattern = pb.gchord || GCHORD[meter] || 'fcfc';
  if (off(chords)) pattern = pattern.replace(/b/g, 'f').replace(/c/g, 'z');
  if (off(bass)) pattern = pattern.replace(/b/g, 'c').replace(/f/g, 'z');
  if (!chords.canJoin || /^z*$/.test(pattern)) params.chordsOff = true;
  else params.gchord = pattern;

  if (!off(drums)) {
    const drum = state.jazz ? (pb.drum || JAZZ_DRUM[meter]) : (pb.drum || DRUM[meter]);
    if (drum) { params.drum = drum; params.drumBars = 1; }
  }
  state.drumHits = params.drum ? parseDrumPattern(params.drum, state.visualObj.getBeatsPerMeasure()) : null;
  const swing = state.jazz ? 66 : +pb.swing || 0;
  if (swing > 50) params.swing = swing;
  return params;
}

// Re-render (voice instruments live in the ABC text) and keep playing from the same spot.
let applying = Promise.resolve();
function applySettings() {
  applying = applying.then(async () => {
    const wasPlaying = synthControl.isStarted;
    const percent = synthControl.percent || 0;
    if (wasPlaying) synthControl.pause();
    render();
    await loadTune(wasPlaying);
    if (wasPlaying) {
      await synthControl.play();
      synthControl.seek(percent);
    }
    setPlaying(synthControl.isStarted);
  }).catch((err) => console.error(err));
}

/* ---------- Playback + animation ---------- */

const activeTimers = {};
const hitTimers = {};
const lastNote = {};

// Make a band member react to what they just played (in both tabs).
// `pitches` drives where hands go on the keys / neck; every hit squashes and alternates.
function activate(i, pitches, opts = {}) {
  const m = state.members[i];
  const beatMs = 60000 / (synthControl.currentTempo || 100);
  const els = $$(`.band-${i}`);
  let pos = Math.random() * 0.6 + 0.2;
  let posL = Math.random() * 0.5 + 0.1;
  if (pitches?.length) {
    const top = Math.max(...pitches), low = Math.min(...pitches);
    pos = clamp01((top - 55) / 30);
    posL = clamp01((low - 36) / 30);
    // Keyboard instruments: a single low note is played by the left hand.
    if (pitches.length === 1 && top < 60) pos = null;
  }
  const reach = m ? keyboardReach(propOf(m), pitches) : null;
  const finger = m ? fingering(m, pitches, opts.drums) : null;
  els.forEach((el) => {
    el.classList.add('on');
    if (reach) pressKeys(el, reach);
    if (finger) showFingering(el, finger);
    if (pos !== null) el.style.setProperty('--pos', pos.toFixed(2));
    el.style.setProperty('--pos-l', posL.toFixed(2));
    el.classList.toggle('alt');
    el.classList.toggle('kick', !!(opts.kick || finger?.kick));
    el.classList.remove('hit');
    void el.offsetWidth; // restart the hit transition
    el.classList.add('hit');
  });
  clearTimeout(hitTimers[i]);
  hitTimers[i] = setTimeout(() => els.forEach((el) => el.classList.remove('hit', 'kick', 'hit-snare', 'hit-cym')), Math.min(160, beatMs * 0.4));
  clearTimeout(activeTimers[i]);
  activeTimers[i] = setTimeout(() => $$(`.band-${i}`).forEach((el) => el.classList.remove('on')), Math.max(500, beatMs * 1.6));

  const now = performance.now();
  if (state.tab === 'show' && m && now - (lastNote[i] || 0) > Math.max(200, beatMs * 0.8)) {
    lastNote[i] = now;
    spawnNote(i, pitches?.length ? Math.max(...pitches) : null);
  }
}

// "G", "Am", "D7", "Cmaj7", "F#m", "Bb"… -> { root: bass note, chord: notes around middle C }
function chordPitches(name) {
  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(name || '');
  if (!m) return null;
  const pc = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (/[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0) + 12) % 12;
  const q = m[3];
  const minor = /^m(?!aj)/.test(q), dim = /dim|°/.test(q);
  const third = minor || dim ? 3 : 4, fifth = dim ? 6 : 7;
  const tones = [0, third, fifth];
  if (/maj7/.test(q)) tones.push(11); else if (/7/.test(q)) tones.push(10);
  if (/6/.test(q)) tones.push(9);
  const base = 60 + pc - (pc > 5 ? 12 : 0); // keep the chord near middle C
  return { root: 36 + pc, chord: tones.map((t) => base + t) };
}

// Piano & xylophone: work out exactly where each hand / mallet goes for these notes.
// Returns { l, r } horizontal shifts (SVG units) and the keys or bars to light up.
const XYLO_DEGREE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // pitch class -> bar (sharps share the bar below)
function keyboardReach(prop, pitches) {
  if ((prop !== 'piano' && prop !== 'xylophone') || !pitches?.length) return null;
  const sorted = [...new Set(pitches)].sort((a, b) => a - b);
  if (prop === 'piano') {
    const fold = (p) => { while (p < 48) p += 12; while (p > 83) p -= 12; return p; };
    const keys = sorted.map(fold);
    const top = keys[keys.length - 1], low = keys[0];
    const out = { keys, lit: keys.map((k) => `.p-key[data-p="${k}"]`) };
    // Right hand plays the highest note; the left hand takes the lowest if it's a different/low note.
    if (sorted.length > 1 || top < 60) out.l = PIANO_KEY_X[low] - PIANO_HAND_X.l;
    if (sorted.length > 1 || top >= 60) out.r = PIANO_KEY_X[top] - PIANO_HAND_X.r;
    out.pitches = keys;
    return out;
  }
  const bars = sorted.map((p) => (p % 12 === 0 && p >= 72 ? 7 : XYLO_DEGREE[p % 12]));
  const top = bars[bars.length - 1], low = bars[0];
  const out = { lit: bars.map((b) => `.p-bar[data-bar="${b}"]`), pitches: sorted };
  if (bars.length > 1 || top < 4) out.l = XYLO_BAR_X[low] - XYLO_HEAD_X.l;
  if (bars.length > 1 || top >= 4) out.r = XYLO_BAR_X[top] - XYLO_HEAD_X.r;
  return out;
}

const keyTimers = new WeakMap();
const HAND_SLIDE_MS = 60; // keep in sync with .p-slide-* transition in style.css
function pressKeys(el, reach) {
  if (reach.l !== undefined) el.style.setProperty('--hx-l', `${reach.l.toFixed(1)}px`);
  if (reach.r !== undefined) el.style.setProperty('--hx-r', `${reach.r.toFixed(1)}px`);
  el.querySelectorAll('.lit').forEach((k) => k.classList.remove('lit'));
  clearTimeout(keyTimers.get(el));
  // Light the key once the hand has arrived (the slide takes HAND_SLIDE_MS).
  keyTimers.set(el, setTimeout(() => {
    reach.lit.forEach((sel, j) => {
      const key = el.querySelector(sel);
      if (!key) return;
      key.classList.add('lit');
      key.style.setProperty('--lit', NOTE_COLORS[reach.pitches[j] % 12]);
    });
    keyTimers.set(el, setTimeout(() => el.querySelectorAll('.lit').forEach((k) => k.classList.remove('lit')), 240));
  }, HAND_SLIDE_MS));
}

// Every other instrument: the fingering a real player would use for the note.
// Strings: open-string pitches, lowest first. The note goes on the highest string that can reach it,
// which keeps the hand low on the neck (fret 0 = open string, no finger down).
const TUNINGS = { violin: [55, 62, 69, 76], cello: [36, 43, 50, 57], bass: [28, 33, 38, 43], guitar: [40, 45, 50, 55, 59, 64] };
const BOW_TILT = [7, 2, -3, -8]; // violinists tilt the bow to reach each string (G … E)
// Brass: an open note of the horn, minus 0–6 semitones, needs these valves.
const VALVES = [[], [2], [1], [1, 2], [2, 3], [1, 3], [1, 2, 3]];
const TRUMPET_PARTIALS = [60, 67, 72, 76, 79, 84]; // written pitch (a trumpet sounds a tone lower)
const TUBA_PARTIALS = [41, 46, 50, 53, 58, 62];
// Sax / clarinet / flute: by written note C, C#, D … B — the three left-hand holes, and whether the right hand is down.
const WIND_FINGERS = ['010', '000', '111R', '111R', '111R', '111R', '111R', '111', '111', '110', '100', '100'];
const WIND_TRANSPOSE = { 64: 2, 65: 9, 66: 2, 67: 9, 69: 7, 71: 2 }; // soprano/alto/tenor/bari sax, English horn, clarinet

function fold(p, low, high) {
  while (p < low) p += 12;
  while (p > high) p -= 12;
  return p;
}

function fingering(m, pitches, drums) {
  const prop = propOf(m);
  if (prop === 'drums') {
    // Drum kit: pitches come from the drum pattern; a percussion voice brings its own notes.
    const hits = drums || pitches;
    if (!hits?.length) return null;
    return {
      kick: hits.some((p) => p === 35 || p === 36),
      snare: hits.some((p) => (p >= 37 && p <= 41) || (p >= 43 && p <= 48 && p !== 44 && p !== 46) || p >= 60),
      cym: hits.some((p) => p === 42 || p === 44 || p === 46 || (p >= 49 && p <= 59)),
    };
  }
  if (!pitches?.length) return null;
  const top = Math.max(...pitches);
  const tuningName = prop === 'bass' && (m.program === 42 || m.program === 43) ? 'cello' : prop;
  const tuning = TUNINGS[tuningName];
  if (tuning) {
    const p = fold(top, tuning[0], tuning.at(-1) + 12);
    let string = tuning.length - 1;
    while (string > 0 && tuning[string] > p) string--;
    const fret = p - tuning[string];
    // A guitar strumming a chord rings every string.
    const lit = prop === 'guitar' && pitches.length > 1 ? tuning.map((_, k) => k) : [string];
    return { string, fret: Math.min(1, fret / 12), open: fret === 0, lit, color: NOTE_COLORS[top % 12], bowTilt: BOW_TILT[string] };
  }
  if (prop === 'trumpet' || prop === 'tuba') {
    const [partials, shift] = prop === 'trumpet' ? [TRUMPET_PARTIALS, 2] : [TUBA_PARTIALS, 0];
    const p = fold(top + shift, partials[0] - 6, partials.at(-1));
    const open = partials.find((q) => q >= p);
    return { valves: VALVES[open - p] || [] };
  }
  if (prop === 'sax' || prop === 'clarinet' || prop === 'flute') {
    const f = WIND_FINGERS[(top + (WIND_TRANSPOSE[m.program] || 0)) % 12];
    return { holes: [...f.slice(0, 3)].map((c) => c === '1'), right: f.endsWith('R') };
  }
  return null;
}

function showFingering(el, f) {
  if (f.fret !== undefined) {
    el.style.setProperty('--fret', f.fret.toFixed(2));
    el.style.setProperty('--string', f.string);
    el.style.setProperty('--bow-tilt', `${f.bowTilt ?? 0}deg`);
    el.classList.toggle('open-string', f.open);
    // Light the string(s) being played, like the piano keys.
    clearTimeout(keyTimers.get(el));
    el.querySelectorAll('.p-string').forEach((s) => {
      s.classList.toggle('lit', f.lit.includes(+s.dataset.s));
      s.style.setProperty('--lit', f.color);
    });
    keyTimers.set(el, setTimeout(() => el.querySelectorAll('.p-string.lit').forEach((s) => s.classList.remove('lit')), 240));
  }
  if (f.valves) el.querySelectorAll('.p-valve').forEach((v) => v.classList.toggle('down', f.valves.includes(+v.dataset.v)));
  if (f.holes) {
    el.querySelectorAll('.p-hole').forEach((h, k) => h.classList.toggle('closed', f.holes[k]));
    el.querySelector('.p-press-l')?.classList.toggle('down', f.holes.some(Boolean));
    el.querySelector('.p-press-r')?.classList.toggle('down', f.right);
  }
  if (f.snare !== undefined) {
    el.classList.toggle('hit-snare', f.snare);
    el.classList.toggle('hit-cym', f.cym);
  }
}

// Drum pattern "d2dd 51 42 51 100 90 70" → the hits in one bar: [{ at: beats from the bar start, pitch }].
function parseDrumPattern(pattern, beatsPerBar) {
  const [steps, ...nums] = pattern.trim().split(/\s+/);
  const lens = [...steps.matchAll(/([dz])(\d*)/g)].map(([, kind, n]) => ({ kind, len: +n || 1 }));
  const units = lens.reduce((sum, x) => sum + x.len, 0);
  const hits = [];
  let at = 0, k = 0;
  lens.forEach(({ kind, len }) => {
    if (kind === 'd') hits.push({ at: (at / units) * beatsPerBar, pitch: +nums[k++] });
    at += len;
  });
  return hits;
}

// Called on every half beat: play the drummer's hits that fall in this half beat, on time.
function playDrumHits(beat) {
  const i = state.members.findIndex((m) => m.kind === 'drums');
  const m = state.members[i];
  if (!state.drumHits || !m?.inBand || m.muted) return;
  const perBar = state.visualObj.getBeatsPerMeasure();
  const from = beat % perBar;
  const beatMs = 60000 / (synthControl.currentTempo || 100);
  const now = state.drumHits.filter((h) => h.at >= from && h.at < from + 0.5);
  const byTime = new Map();
  now.forEach((h) => byTime.set(h.at, [...(byTime.get(h.at) || []), h.pitch]));
  byTime.forEach((drums, at) => setTimeout(() => activate(i, null, { drums }), (at - from) * beatMs));
}

function spawnNote(i, pitch, big = false) {
  const fx = $(`.show-member[data-i="${i}"] .fx`);
  if (!fx) return;
  const n = document.createElement('span');
  n.className = 'fnote' + (big ? ' big' : '');
  n.textContent = NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)];
  n.style.setProperty('--x', `${Math.round(Math.random() * 120 - 60)}px`);
  n.style.setProperty('--r', `${Math.round(Math.random() * 50 - 25)}deg`);
  n.style.color = pitch != null ? NOTE_COLORS[pitch % 12] : NOTE_COLORS[Math.floor(Math.random() * 12)];
  n.addEventListener('animationend', () => n.remove());
  fx.append(n);
}

function setBeatLength() {
  const bpm = synthControl.currentTempo || 100;
  document.documentElement.style.setProperty('--beat', `${(60 / bpm).toFixed(3)}s`);
}

const cursorControl = {
  beatSubdivisions: 2,
  onStart() { clearHighlights(); setBeatLength(); },
  onFinished() {
    clearHighlights();
    state.pass = 0;
    state.elapsed = 0;
    // With autoplay the next song follows on an open stage; otherwise the band bows and the curtain falls.
    const nextUp = state.autoplay && state.list.length;
    setPlaying(false, !nextUp);
    if (nextUp) $('#theater').classList.add('open');
    updateTime();
    queueNextSong();
    document.dispatchEvent(new Event('song-finished')); // the video exporter waits for this
  },
  onBeat(beat, total, totalTime) {
    if (totalTime) state.passMs = totalTime;
    playDrumHits(beat);
    state.elapsed = (state.pass * state.passMs + (total ? beat / total : 0) * state.passMs) / 1000;
    if (beat % 1 === 0) updateTime();
    if (beat % 1 !== 0) return;
    const chord = chordPitches(state.chordName);
    state.members.forEach((m, i) => {
      if (m.muted || !m.inBand || m.kind === 'voice' || (m.kind === 'drums' && state.drumHits)) return;
      if (m.kind === 'bass' && beat % 2 !== 0) return;
      // Pumpkin plays the current chord's notes, Candy its root, low.
      const pitches = !chord ? null : m.kind === 'chords' ? chord.chord : m.kind === 'bass' ? [chord.root] : null;
      activate(i, pitches, { kick: m.kind === 'drums' && beat % 2 === 0 });
    });
  },
  onEvent(ev) {
    if (ev.measureStart && ev.left === null) return;
    clearHighlights();
    const byVoice = new Map();
    ev.elements.forEach((group) => group.forEach((el) => {
      el.classList.add('hl');
      state.lit.push(el);
      const info = state.noteInfo.get(el);
      if (info?.el.chord?.length) state.chordName = info.el.chord[0].name;
      if (!info || byVoice.has(info.voice)) return;
      byVoice.set(info.voice, (info.el.midiPitches || []).map((p) => p.pitch));
    }));
    state.members.forEach((m, i) => {
      if (m.kind !== 'voice' || m.muted || !m.inBand || !byVoice.has(m.index)) return;
      const pitches = byVoice.get(m.index);
      if (pitches.length) activate(i, pitches); // rests don't count
    });
    lightKeys((ev.midiPitches || []).map((p) => p.pitch));
    moveCursor(ev);
  },
};

function moveCursor(ev) {
  const cursor = $('#paper .abcjs-cursor');
  if (!cursor) return;
  cursor.setAttribute('x1', ev.left - 2); cursor.setAttribute('x2', ev.left - 2);
  cursor.setAttribute('y1', ev.top); cursor.setAttribute('y2', ev.top + ev.height);
}

function clearHighlights() {
  state.lit.forEach((el) => el.classList.remove('hl'));
  state.lit = [];
}

const synthControl = new ABCJS.synth.SynthController();
synthControl.load('#audio', cursorControl, { displayLoop: true, displayRestart: true, displayPlay: false, displayProgress: true, displayWarp: true });

// Short songs play several times in a row: when a pass ends, start the next one.
const abcjsFinished = synthControl.finished;
synthControl.finished = function () {
  if (!synthControl.isLooping && state.pass < state.passes - 1) {
    state.pass++;
    synthControl.isLooping = true;
    const result = abcjsFinished();
    synthControl.isLooping = false;
    return result;
  }
  return abcjsFinished();
};

function setPlaying(on, ended = false) {
  $$('.play-btn').forEach((b) => {
    b.textContent = on ? '❚❚' : '▶';
    b.setAttribute('aria-label', on ? 'Pause' : 'Play');
  });
  document.body.classList.toggle('is-playing', on);
  $('#theater').classList.toggle('open', on);
  $('#theater').classList.toggle('bravo', ended);
  if (on) $('#theater').classList.remove('bravo');
}

// iPhones/iPads mute web audio when the ring/silent switch is on; Safari 16.4+ lets a page
// declare itself as media playback so it stays audible. (No silent <audio> trick: looping a
// sound element froze Chrome.)
function unlockAudioOnIOS() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
}

async function togglePlay() {
  unlockAudioOnIOS();
  cancelAutoplay();
  $$('.play-btn').forEach((b) => b.classList.add('loading'));
  try {
    setMasterGain(1);
    await synthControl.play();
    setBeatLength();
  } finally {
    $$('.play-btn').forEach((b) => b.classList.remove('loading'));
    setPlaying(synthControl.isStarted);
  }
}
$$('.play-btn').forEach((btn) => btn.addEventListener('click', togglePlay));

// Small stage buttons: next song, and optional full screen (the theater already fills the window).
$('#stage-next').addEventListener('click', (e) => { e.stopPropagation(); cancelAutoplay(); stepSong(1); });
$('#stage-music').addEventListener('click', (e) => { e.stopPropagation(); setTab('music'); });
$('#stage-fs').addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else $('#theater').requestFullscreen?.().catch(() => {});
});

/* ---------- Autoplay: one song after the other ---------- */

let autoplayTimer = 0;
function cancelAutoplay() {
  clearTimeout(autoplayTimer);
  autoplayTimer = 0;
}
function updateAutoplayButtons() {
  $$('.autoplay-btn').forEach((b) => {
    b.setAttribute('aria-pressed', state.autoplay);
    b.textContent = state.autoplay ? '⏭ Autoplay on' : '⏹ Autoplay off';
  });
}
$$('.autoplay-btn').forEach((b) => b.addEventListener('click', () => {
  state.autoplay = !state.autoplay;
  savePref('maestro-autoplay', state.autoplay);
  if (!state.autoplay) cancelAutoplay();
  updateAutoplayButtons();
}));
updateAutoplayButtons();

function queueNextSong() {
  if (!state.autoplay || !state.list.length) return;
  const i = state.list.findIndex((s) => s.id === state.score?.id);
  const next = state.list[(i + 1) % state.list.length];
  $('#curtain-info').textContent = `⏭ Next up: ${next.emoji} ${next.title}…`;
  cancelAutoplay();
  autoplayTimer = setTimeout(async () => {
    autoplayTimer = 0;
    if (synthControl.isStarted) return;
    await openScore(next.id);
    $('#theater').classList.add('open'); // loading the song closes it; reopen in the same frame so it never moves
    await togglePlay();
  }, 1500);
}

// Pause with a gentle fade: the music dims, the stage dims, then the curtain falls.
let fading = false;
function fadeOutAndPause() {
  if (!synthControl.isStarted || fading) return;
  fading = true;
  $('#theater').classList.add('fading');
  setMasterGain(0, 0.8);
  setTimeout(async () => {
    // play() toggles: this pauses *and* clears abcjs's isStarted flag (pause() alone doesn't).
    if (synthControl.isStarted) await synthControl.play();
    setMasterGain(1);
    $('#theater').classList.remove('fading');
    setPlaying(false);
    updateTime();
    fading = false;
  }, 850);
}

function playPitches(pitches, program) {
  if (!pitches?.length) return;
  const notes = pitches.map((p) => ({ pitch: p.pitch ?? p, volume: Math.round(110 * state.volume), start: 0, duration: 0.6, instrument: program ?? p.instrument ?? 0, gap: 0 }));
  ABCJS.synth.playEvent(notes, [], 1000, SOUNDFONT).catch(() => {});
  lightKeys(notes.map((n) => n.pitch));
}

function onNoteClick(abcElem) {
  if (abcElem.midiPitches) playPitches(abcElem.midiPitches);
}

function previewInstrument(program) {
  playPitches([60, 64, 67], program);
}

/* ---------- Show stage: baton cursor, sparkles, eyes that follow you ---------- */

const theater = $('#theater');
let lastSparkle = 0;
let eyeFrame = 0;
theater.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - lastSparkle > 35) {
    lastSparkle = now;
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = Math.random() < 0.3 ? '✦' : '✧';
    s.style.left = e.clientX - theater.getBoundingClientRect().left + 'px';
    s.style.top = e.clientY - theater.getBoundingClientRect().top + 'px';
    s.style.color = NOTE_COLORS[Math.floor(Math.random() * 12)];
    s.addEventListener('animationend', () => s.remove());
    $('#sparkles').append(s);
  }
  cancelAnimationFrame(eyeFrame);
  eyeFrame = requestAnimationFrame(() => lookAt(e.clientX, e.clientY));
});
theater.addEventListener('pointerleave', () => $$('.show-member .c-eyes').forEach((g) => { g.style.translate = ''; }));

/* ---------- A black cat hiding behind the curtain ---------- */

// Now and then, once the curtain is down for a break, the cat pops up behind it for a moment.
const peekCat = $('#peek-cat');
let catTimer = 0;
function maybeShowCat() {
  clearTimeout(catTimer);
  peekCat.classList.remove('peek');
  if (Math.random() < 0.4) return;
  peekCat.style.setProperty('--at', (Math.random() < 0.5 ? 8 + Math.random() * 22 : 62 + Math.random() * 22) + '%');
  catTimer = setTimeout(() => {
    peekCat.classList.add('peek');
    catTimer = setTimeout(() => peekCat.classList.remove('peek'), 1400);
  }, 1400);
}

function lookAt(x, y) {
  $$('.show-member .c-eyes').forEach((g) => {
    const r = g.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    g.style.translate = `${(dx / d) * 3.5}px ${(dy / d) * 3}px`;
  });
}

// Click a friend: they pause (freeze and sit out) or wake up and join back in.
// Click the empty stage: the show fades out and the curtain falls.
theater.addEventListener('click', (e) => {
  if (e.target.closest('.curtain, .stage-ctl')) return;
  const member = e.target.closest('.show-member');
  if (!member) { fadeOutAndPause(); return; }
  const i = +member.dataset.i;
  const m = state.members[i];
  m.muted = !m.muted;
  saveBand();
  member.classList.toggle('muted', m.muted);
  if (!m.muted) {
    member.classList.remove('jump');
    void member.offsetWidth;
    member.classList.add('jump');
    for (let k = 0; k < 4; k++) setTimeout(() => spawnNote(i, null, true), k * 70);
  }
  renderStage();
  remixWhilePlaying();
});

// Someone sits out or joins back in: the music keeps going. The new mix is built while the old one plays,
// then swapped in at the same spot (abcjs would otherwise stop, rebuild and restart, leaving a gap).
let remixing = Promise.resolve();
function remixWhilePlaying() {
  if (!synthControl.isStarted || !synthControl.midiBuffer) { applySettings(); return; }
  remixing = remixing.then(async () => {
    synthControl.options = audioParams(); // later rebuilds (pause/play, tempo) keep the new mix
    const next = new ABCJS.synth.CreateSynth();
    await next.init({
      visualObj: state.visualObj,
      options: synthControl.options,
      millisecondsPerMeasure: state.visualObj.millisecondsPerMeasure() * 100 / synthControl.warp,
    });
    await next.prime();
    const old = synthControl.midiBuffer;
    if (!synthControl.isStarted || synthControl.midiBuffer !== old) return; // paused or replaced meanwhile
    next.seek(ABCJS.synth.activeAudioContext().currentTime - old.startTimeSec, 'seconds');
    old.stop();
    synthControl.midiBuffer = next;
    next.start();
  }).catch((err) => { console.error(err); applySettings(); });
}

/* ---------- Volume ---------- */

function syncVolumeUI() {
  const v = Math.round(state.volume * 100);
  $$('.volume-input').forEach((inp) => { inp.value = v; });
  $$('.volume-icon').forEach((ic) => { ic.textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊'; });
}
$$('.volume-input').forEach((inp) => {
  inp.addEventListener('input', () => { state.volume = inp.value / 100; syncVolumeUI(); });
  inp.addEventListener('change', () => {
    savePref('maestro-volume', state.volume);
    if (state.score) applySettings();
  });
});
syncVolumeUI();

/* ---------- Keyboard ---------- */

function buildKeys() {
  let html = '';
  for (let p = KEY_LOW; p <= KEY_HIGH; p++) {
    const pc = p % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    html += `<button class="key ${black ? 'black' : 'white'}" data-p="${p}" style="--c:${NOTE_COLORS[pc]}" aria-label="${LETTERS[pc]}${Math.floor(p / 12) - 1}">${!black && pc === 0 ? `<span>${noteName(p)}</span>` : ''}</button>`;
  }
  $('#keys').innerHTML = html;
}

function noteName(p) {
  const pc = p % 12;
  return state.solfege ? SOLFEGE[pc] : LETTERS[pc] + (Math.floor(p / 12) - 1);
}

let keyTimer;
function lightKeys(pitches) {
  $$('.key.on').forEach((k) => k.classList.remove('on'));
  pitches.forEach((p) => $(`.key[data-p="${p}"]`)?.classList.add('on'));
  if (pitches.length) {
    const top = Math.max(...pitches);
    const nn = $('#note-name');
    nn.textContent = [...new Set(pitches)].sort((a, b) => b - a).map(noteName).join(' · ');
    nn.style.color = NOTE_COLORS[top % 12];
  }
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => $$('.key.on').forEach((k) => k.classList.remove('on')), 700);
}

$('#keys').addEventListener('pointerdown', (e) => {
  const key = e.target.closest('.key');
  if (key) playPitches([+key.dataset.p], state.members.find((m) => m.kind === 'voice')?.program ?? 0);
});

$('#solfege').addEventListener('change', (e) => { state.solfege = e.target.checked; buildKeys(); });

/* ---------- Hand-drawn wobble on the show stage ---------- */

// Safari re-renders SVG filters very slowly, so it gets the stage without the wobble.
const IS_SAFARI = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent);
document.documentElement.classList.toggle('safari', IS_SAFARI);
let boil = 0;
setInterval(() => {
  if (IS_SAFARI || state.tab !== 'show' || document.hidden) return;
  boil = (boil + 1) % 3;
  theater.dataset.boil = boil;
}, 160);

/* ---------- Composer ---------- */

const TEMPLATE = `X:1
T:My Spooky Song
C:Me!
M:4/4
L:1/4
Q:1/4=110
K:C
"C"C E G E|"F"F A c2|"G"B G D G|"C"c4|
"Am"A c e c|"F"F A c A|"G"G F E D|"C"C4|]
`;

let previewTimer;
function previewCompose() {
  const out = ABCJS.renderAbc('compose-preview', $('#compose-abc').value, { responsive: 'resize', add_classes: true })[0];
  const warnings = out?.warnings || [];
  $('#compose-status').textContent = warnings.length ? '⚠️ ' + warnings[0].replace(/<[^>]+>/g, '') : '✅ Looks good!';
}
$('#open-compose').addEventListener('click', () => {
  if (!$('#compose-abc').value) $('#compose-abc').value = TEMPLATE;
  $('#compose').showModal();
  previewCompose();
});
$('#compose-abc').addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(previewCompose, 250); });
$('#compose-try').addEventListener('click', () => {
  const abc = $('#compose-abc').value;
  const title = (abc.match(/^T:(.*)$/m) || [, 'My song'])[1].trim();
  $('#compose').close();
  showScore({ id: '', title, subtitle: '(draft)', composer: 'You!', category: 'Draft', level: 1, emoji: $('#compose-emoji').value || '🎵', about: 'Not saved yet — press 💾 in the song writer to keep it.', playback: {}, abc });
});
$('#compose-save').addEventListener('click', async () => {
  try {
    const score = await api('/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abc: $('#compose-abc').value, category: $('#compose-category').value, emoji: $('#compose-emoji').value }),
    });
    $('#compose').close();
    await loadFacets(); await loadScores();
    openScore(score.id);
  } catch (err) {
    $('#compose-status').textContent = '❌ ' + err.message;
  }
});

/* ---------- Start ---------- */

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.score && !synthControl.isStarted) { render(); loadTune(false); } }, 300);
});

(async function init() {
  // A shared link "#/<song>" opens in the theater; "#/music/<song>" opens the sheet music.
  const [, musicTab, fromHash] = location.hash.match(/^#\/(music\/)?([a-z0-9-]*)/) || [];
  setTab(fromHash ? (musicTab ? 'music' : 'show') : state.tab === 'music' ? 'music' : 'show');
  buildKeys();
  await Promise.all([loadFacets(), loadScores()]);
  const random = state.list[Math.floor(Math.random() * state.list.length)]?.id;
  openScore(fromHash || random || 'twinkle').catch(() => openScore('twinkle'));
})();
