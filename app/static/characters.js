// The Little Maestro band: characters (bodies) and instruments (props) are drawn
// separately, so any character can play any instrument. Everything lives in a
// 200x220 SVG space; the body's face is around (100, 110) and props are drawn in front.
// Parts are animated from style.css (.c-* = body parts, .p-* = instrument parts).
const INK = 'stroke="#2b2235" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const THIN = 'stroke="#2b2235" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" fill="none"';
const GOLD = '#f4c430';
const WOOD = '#b5652f';

// A thick outlined tube: ink stroke underneath, colored stroke on top.
const tube = (d, color, w = 9) =>
  `<path d="${d}" fill="none" stroke="#2b2235" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// A hand in the character's own color (set with --skin).
const hand = (x, y, cls = '') =>
  `<circle class="p-hand ${cls}" cx="${x}" cy="${y}" r="8" style="fill:var(--skin)" stroke="#2b2235" stroke-width="4"/>`;
// "o" mouth, shown while singing / blowing.
const oMouth = (x, y, fill = '#2b2235') => `<ellipse class="c-o" cx="${x}" cy="${y}" rx="4.5" ry="5.5" fill="${fill}"/>`;

window.CHARACTERS = {
  bat: {
    name: 'Purple Bat', skin: '#b9a3e3',
    body: `
      <g class="c-wing c-wing-l" style="transform-origin:58px 124px">
        <path d="M58 112 C36 96 14 100 4 116 C14 120 18 128 16 140 C26 136 34 142 36 152 C44 142 52 140 60 142 Z" fill="#5d4a72" ${INK}/>
      </g>
      <g class="c-wing c-wing-r" style="transform-origin:142px 124px">
        <path d="M142 112 C164 96 186 100 196 116 C186 120 182 128 184 140 C174 136 166 142 164 152 C156 142 148 140 140 142 Z" fill="#5d4a72" ${INK}/>
      </g>
      <path d="M88 180 L84 204 L96 204 M114 180 L116 204 L128 204" ${THIN} stroke-width="5"/>
      <g class="c-body" style="transform-origin:100px 186px">
        <path d="M62 80 L50 22 L94 60 Z" fill="#b9a3e3" ${INK}/>
        <path d="M65 68 L59 38 L82 58 Z" fill="#f2b6d3"/>
        <path d="M132 74 L148 18 L108 58 Z" fill="#8f7bb5" ${INK}/>
        <path d="M52 122 C46 74 74 58 100 58 C128 58 156 74 150 124 C148 166 128 184 100 184 C70 184 54 162 52 122 Z" fill="#b9a3e3" ${INK}/>
        <ellipse cx="102" cy="146" rx="28" ry="24" fill="#f2b6d3"/>
        <g class="c-eyes"><circle cx="85" cy="100" r="5.5" fill="#2b2235"/><circle cx="119" cy="100" r="5.5" fill="#2b2235"/></g>
        <g class="c-cheeks"><ellipse cx="74" cy="114" rx="7" ry="5" fill="#f59ac2"/><ellipse cx="130" cy="114" rx="7" ry="5" fill="#f59ac2"/></g>
        <path class="c-smile" d="M96 115 q5 5 10 0" ${THIN}/>
        ${oMouth(101, 117)}
      </g>`,
  },
  mummy: {
    name: 'Mummy Wrap', skin: '#fbfaf7',
    body: `
      <rect x="74" y="168" width="20" height="40" rx="6" fill="#fbfaf7" ${INK}/>
      <rect x="104" y="168" width="20" height="40" rx="6" fill="#fbfaf7" ${INK}/>
      <path d="M74 180 L94 176 M74 192 L94 196 M104 182 L124 178 M104 194 L124 198" ${THIN}/>
      <g class="c-body" style="transform-origin:100px 200px">
        <rect x="66" y="108" width="68" height="68" rx="20" fill="#fbfaf7" ${INK}/>
        <path d="M68 126 L132 118 M68 142 L132 150 M68 160 L132 156" ${THIN}/>
        <g class="c-tail" style="transform-origin:116px 48px">
          <path d="M112 48 L140 18 L150 26 L120 54 Z" fill="#fbfaf7" ${INK} stroke-width="4"/>
          <path d="M116 50 L154 44 L154 56 L118 58 Z" fill="#fbfaf7" ${INK} stroke-width="4"/>
        </g>
        <circle cx="100" cy="80" r="40" fill="#fbfaf7" ${INK}/>
        <path d="M62 70 L138 60 M61 96 L139 104 M74 50 L124 46" ${THIN}/>
        <g class="c-eyes"><circle cx="87" cy="84" r="5.5" fill="#2b2235"/><circle cx="113" cy="84" r="5.5" fill="#2b2235"/></g>
        <path class="c-smile" d="M95 104 q5 4 10 0" ${THIN}/>
        ${oMouth(100, 106)}
      </g>`,
  },
  pumpkin: {
    name: 'Pumpkin Jack', skin: '#8b5a2b',
    body: `
      <path d="M86 184 L84 206 L94 206 M114 184 L116 206 L126 206" ${THIN} stroke-width="6"/>
      <g class="c-body" style="transform-origin:100px 186px">
        <rect x="72" y="114" width="56" height="72" rx="22" fill="#8b5a2b" ${INK}/>
      </g>
      <g class="c-head" style="transform-origin:100px 118px">
        <g transform="translate(34 0)">
          <path d="M62 50 C60 38 64 30 72 26 L80 32 C72 36 70 42 72 50 Z" fill="#2f9e44" ${INK} stroke-width="4"/>
          <path d="M66 50 C26 46 16 80 22 100 C28 122 54 126 66 120 C80 126 106 122 112 100 C118 80 106 46 66 50 Z" fill="#f97316" ${INK}/>
          <path d="M48 52 C36 74 38 104 52 122 M84 52 C96 74 94 104 80 122" ${THIN}/>
          <g class="c-face" fill="#2b2235">
            <path d="M38 84 L48 66 L58 84 Z"/><path d="M74 84 L84 66 L94 84 Z"/>
            <path d="M62 92 L66 86 L70 92 Z"/>
            <path d="M36 98 Q66 122 96 98 L88 100 L84 106 L77 101 L70 108 L62 101 L54 107 L48 100 Z"/>
          </g>
        </g>
      </g>`,
  },
  candy: {
    name: 'Candy Stripes', skin: '#f6c02c',
    body: `
      <path d="M90 172 L86 204 L98 204 M112 172 L116 204 L128 204" ${THIN} stroke-width="5"/>
      <g class="c-body" style="transform-origin:100px 190px">
        <g transform="translate(34 0)">
          <path d="M60 72 L36 38 L58 46 L66 28 L76 50 L92 40 L82 74 Z" fill="#f6c02c" ${INK}/>
          <path d="M58 166 L40 192 L64 186 L76 200 L86 168 Z" fill="#f6c02c" ${INK}/>
          <ellipse cx="66" cy="120" rx="40" ry="54" fill="url(#cs-stripes)" ${INK}/>
          <ellipse cx="64" cy="114" rx="23" ry="16" fill="#f6c02c"/>
          <g class="c-eyes"><circle cx="55" cy="110" r="4.5" fill="#2b2235"/><circle cx="74" cy="110" r="4.5" fill="#2b2235"/></g>
          <path class="c-smile" d="M58 120 q6 6 12 0" ${THIN}/>
          ${oMouth(64, 122)}
        </g>
      </g>`,
  },
  monster: {
    name: 'Stitchy', skin: '#8bd450',
    body: `
      <g class="c-body" style="transform-origin:100px 196px">
        <path d="M66 84 C52 66 52 44 62 30 C68 50 80 62 90 70 Z" fill="#fff" ${INK}/>
        <path d="M134 84 C148 66 148 44 138 30 C132 50 120 62 110 70 Z" fill="#fff" ${INK}/>
        <path d="M46 204 C36 124 52 64 100 62 C148 64 164 124 154 204 Z" fill="#8bd450" ${INK}/>
        <path d="M76 76 C92 66 112 66 126 74" fill="none" stroke="#4a8bd4" stroke-width="10" stroke-linecap="round"/>
        <path d="M88 64 l5 14 M100 62 l3 14 M112 64 l1 14" ${THIN}/>
        <g class="c-eyes"><circle cx="84" cy="106" r="5.5" fill="#2b2235"/><circle cx="116" cy="106" r="5.5" fill="#2b2235"/></g>
        <path class="c-smile" d="M90 120 Q100 132 110 120" ${THIN}/>
        ${oMouth(100, 124)}
      </g>`,
  },
  ghost: {
    name: 'Boo', skin: '#f4f1ff',
    body: `
      <g class="c-body" style="transform-origin:100px 196px">
        <path d="M56 196 L56 104 C56 56 144 56 144 104 L144 196 L130 184 L115 196 L100 184 L85 196 L70 184 Z" fill="#f4f1ff" ${INK}/>
        <g class="c-eyes"><ellipse cx="86" cy="104" rx="5" ry="7.5" fill="#2b2235"/><ellipse cx="114" cy="104" rx="5" ry="7.5" fill="#2b2235"/></g>
        <ellipse cx="74" cy="120" rx="7" ry="4.5" fill="#f9b4cf"/><ellipse cx="126" cy="120" rx="7" ry="4.5" fill="#f9b4cf"/>
        <path class="c-smile" d="M94 120 q6 6 12 0" ${THIN}/>
        ${oMouth(100, 122)}
      </g>`,
  },
  cat: {
    name: 'Midnight', skin: '#3a3046',
    body: `
      <g class="c-tail" style="transform-origin:70px 178px">${tube('M70 178 C34 172 30 124 50 108', '#3a3046', 8)}</g>
      <ellipse cx="86" cy="202" rx="11" ry="6" fill="#3a3046" ${INK} stroke-width="4"/>
      <ellipse cx="114" cy="202" rx="11" ry="6" fill="#3a3046" ${INK} stroke-width="4"/>
      <g class="c-body" style="transform-origin:100px 200px">
        <ellipse cx="100" cy="152" rx="36" ry="44" fill="#3a3046" ${INK}/>
        <path d="M70 78 L64 38 L94 62 Z M130 78 L136 38 L106 62 Z" fill="#3a3046" ${INK}/>
        <path d="M70 66 L68 48 L84 60 Z M130 66 L132 48 L116 60 Z" fill="#f59ac2"/>
        <circle cx="100" cy="92" r="36" fill="#3a3046" ${INK}/>
        <g class="c-eyes">
          <ellipse cx="86" cy="90" rx="7.5" ry="8.5" fill="#ffd43b"/><ellipse cx="86" cy="91" rx="2.5" ry="6" fill="#2b2235"/>
          <ellipse cx="114" cy="90" rx="7.5" ry="8.5" fill="#ffd43b"/><ellipse cx="114" cy="91" rx="2.5" ry="6" fill="#2b2235"/>
        </g>
        <path d="M97 103 h6 l-3 4 z" fill="#f59ac2"/>
        <path class="c-smile" d="M92 110 q4 4 8 0 q4 4 8 0" fill="none" stroke="#f4f1ff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M60 100 l18 3 M60 110 l18 -1 M140 100 l-18 3 M140 110 l-18 -1" stroke="#f4f1ff" stroke-width="2" stroke-linecap="round"/>
        ${oMouth(100, 113, '#f59ac2')}
      </g>`,
  },
};

// Instruments. `label` is shown in pickers; parts with .p-* classes are animated per note.
// Piano keyboard: three octaves, C3 (48) to B5 (83), drawn key by key so a hand can land on
// the exact note. PIANO_KEY_X[pitch] = the key's centre in SVG units.
const PIANO_LOW = 48, PIANO_HIGH = 83, KB_X = 28, KB_W = 144;
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const PIANO_WHITES = [];
for (let p = PIANO_LOW; p <= PIANO_HIGH; p++) if (WHITE_PCS.includes(p % 12)) PIANO_WHITES.push(p);
const WW = KB_W / PIANO_WHITES.length, BW = WW * 0.62;
window.PIANO_KEY_X = {};
let PIANO_KEYS = '';
PIANO_WHITES.forEach((p, i) => {
  window.PIANO_KEY_X[p] = KB_X + (i + 0.5) * WW;
  PIANO_KEYS += `<rect class="p-key" data-p="${p}" x="${(KB_X + i * WW).toFixed(2)}" y="138" width="${WW.toFixed(2)}" height="14" fill="#fff" stroke="#2b2235" stroke-width="1"/>`;
});
PIANO_WHITES.forEach((p, i) => {
  if (p + 1 <= PIANO_HIGH && !WHITE_PCS.includes((p + 1) % 12)) {
    const x = KB_X + (i + 1) * WW;
    window.PIANO_KEY_X[p + 1] = x;
    PIANO_KEYS += `<rect class="p-key black" data-p="${p + 1}" x="${(x - BW / 2).toFixed(2)}" y="138" width="${BW.toFixed(2)}" height="8.5" fill="#2b2235"/>`;
  }
});
window.PIANO_HAND_X = { l: 72, r: 128 }; // where each hand is drawn before sliding
const BAR_COLORS = ['#ef4444', '#f97316', '#facc15', '#84cc16', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
// Xylophone bars C D E F G A B C; XYLO_BAR_X[k] = centre of bar k. Mallet heads start at 78 / 122.
window.XYLO_BAR_X = BAR_COLORS.map((c, k) => 34 + k * 17 + 6.5);
window.XYLO_HEAD_X = { l: 78, r: 122 };
const XYLO_BARS = BAR_COLORS.map((c, k) => {
  const h = 42 - k * 2.5, x = 34 + k * 17;
  return `<rect class="p-bar" data-bar="${k}" x="${x}" y="${166 - h / 2}" width="13" height="${h}" rx="3" fill="${c}" stroke="#2b2235" stroke-width="3"/>`;
}).join('');

window.PROPS = {
  piano: {
    label: 'Piano', grounded: true,
    svg: `
      <rect x="24" y="150" width="152" height="56" rx="4" fill="#8b5a2b" ${INK}/>
      <path d="M34 206 V214 M166 206 V214" ${THIN} stroke-width="6"/>
      <rect x="26" y="136" width="148" height="18" fill="none" ${INK} stroke-width="4"/>
      ${PIANO_KEYS}
      <g class="p-slide-l"><g class="p-press p-press-l">${hand(72, 140)}</g></g>
      <g class="p-slide-r"><g class="p-press p-press-r">${hand(128, 140)}</g></g>`,
  },
  xylophone: {
    label: 'Xylophone', grounded: true,
    svg: `
      <path d="M30 186 L170 178 M30 150 L170 154" ${THIN} stroke-width="5"/>
      <path d="M40 186 L36 212 M160 180 L164 212" ${THIN} stroke-width="5"/>
      ${XYLO_BARS}
      <g class="p-slide-l"><g class="p-press p-press-l" style="transform-origin:72px 128px">
        ${tube('M72 128 L78 160', '#d9b47a', 3)}<circle cx="78" cy="162" r="6" fill="#fff" ${INK} stroke-width="3"/>${hand(72, 128)}
      </g></g>
      <g class="p-slide-r"><g class="p-press p-press-r" style="transform-origin:128px 128px">
        ${tube('M128 128 L122 160', '#d9b47a', 3)}<circle cx="122" cy="162" r="6" fill="#fff" ${INK} stroke-width="3"/>${hand(128, 128)}
      </g></g>`,
  },
  guitar: {
    label: 'Guitar',
    svg: `
      <g class="p-inst" style="transform-origin:110px 150px">
        <g transform="rotate(-32 110 150)">
          <rect x="105" y="58" width="10" height="70" fill="#6b3b1c" ${INK} stroke-width="4"/>
          <rect x="102" y="46" width="16" height="16" rx="3" fill="#6b3b1c" ${INK} stroke-width="4"/>
          <circle cx="110" cy="134" r="19" fill="#d08a3c" ${INK}/>
          <circle cx="110" cy="164" r="25" fill="#d08a3c" ${INK}/>
          <circle cx="110" cy="148" r="7" fill="#2b2235"/>
          <path class="p-string" data-s="0" d="M105.5 60 V176" stroke="#fff3d6" stroke-width="0.9"/><path class="p-string" data-s="1" d="M107.3 60 V176" stroke="#fff3d6" stroke-width="0.9"/><path class="p-string" data-s="2" d="M109.1 60 V176" stroke="#fff3d6" stroke-width="0.9"/><path class="p-string" data-s="3" d="M110.9 60 V176" stroke="#fff3d6" stroke-width="0.9"/><path class="p-string" data-s="4" d="M112.7 60 V176" stroke="#fff3d6" stroke-width="0.9"/><path class="p-string" data-s="5" d="M114.5 60 V176" stroke="#fff3d6" stroke-width="0.9"/>
          <path d="M100 176 h20" ${THIN}/>
        </g>
      </g>
      <g class="p-fret">${hand(82, 100)}</g>
      <g class="p-strum">${hand(124, 152)}</g>`,
  },
  bass: {
    label: 'Double bass', grounded: true,
    svg: `
      <g class="p-inst" style="transform-origin:150px 206px">
        <g transform="translate(18 0)">
          <rect x="127" y="22" width="10" height="100" rx="3" fill="#6b3b1c" ${INK} stroke-width="4"/>
          <circle cx="132" cy="18" r="8" fill="#a0522d" ${INK} stroke-width="4"/>
          <path d="M124 30 h-6 M140 30 h6 M124 40 h-6 M140 40 h6" ${THIN}/>
          <path d="M132 108 C154 106 162 124 152 140 C170 150 172 192 132 198 C92 192 94 150 112 140 C102 124 110 106 132 108 Z" fill="${WOOD}" ${INK}/>
          <path d="M116 152 c-5 7 5 11 0 18 M148 152 c5 7 -5 11 0 18" ${THIN}/>
          <path d="M120 174 h24" ${THIN} stroke-width="4"/>
          <g class="p-strings"><path class="p-string" data-s="0" d="M129 26 V184" stroke="#2b2235" stroke-width="1.3"/><path class="p-string" data-s="1" d="M131.5 26 V184" stroke="#2b2235" stroke-width="1.3"/><path class="p-string" data-s="2" d="M134 26 V184" stroke="#2b2235" stroke-width="1.3"/><path class="p-string" data-s="3" d="M136.5 26 V184" stroke="#2b2235" stroke-width="1.3"/></g>
          <path d="M132 198 V212" ${THIN} stroke-width="4"/>
        </g>
      </g>
      <g class="p-fret">${hand(146, 60)}</g>
      <g class="p-pluck">${hand(154, 150)}</g>`,
  },
  violin: {
    label: 'Violin',
    svg: `
      <g class="p-inst" style="transform-origin:70px 140px">
        <g transform="rotate(-35 70 140)">
          <rect x="66" y="84" width="8" height="38" fill="#6b3b1c" ${INK} stroke-width="3"/>
          <circle cx="70" cy="82" r="5" fill="#6b3b1c" ${INK} stroke-width="3"/>
          <path d="M70 118 c12 0 16 8 12 16 c10 4 10 22 -12 24 c-22 -2 -22 -20 -12 -24 c-4 -8 0 -16 12 -16z" fill="${WOOD}" ${INK} stroke-width="4"/>
          <path class="p-string" data-s="0" d="M67 90 V156" stroke="#2b2235" stroke-width="0.8"/><path class="p-string" data-s="1" d="M69 90 V156" stroke="#2b2235" stroke-width="0.8"/><path class="p-string" data-s="2" d="M71 90 V156" stroke="#2b2235" stroke-width="0.8"/><path class="p-string" data-s="3" d="M73 90 V156" stroke="#2b2235" stroke-width="0.8"/>
        </g>
      </g>
      <g class="p-fret">${hand(48, 110)}</g>
      <g class="p-bow" style="transform-origin:72px 144px">
        <path d="M34 150 L178 126" stroke="#6b3b1c" stroke-width="4" stroke-linecap="round"/>
        <path d="M38 156 L176 132" stroke="#f5efe6" stroke-width="2" stroke-linecap="round"/>
        ${hand(150, 131)}
      </g>`,
  },
  trumpet: {
    label: 'Trumpet',
    svg: `
      <g class="p-inst" style="transform-origin:104px 112px">
        ${tube('M100 112 L160 106', GOLD, 7)}
        <rect class="p-valve" data-v="1" x="124" y="92" width="7" height="13" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <rect class="p-valve" data-v="2" x="135" y="91" width="7" height="13" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <rect class="p-valve" data-v="3" x="146" y="90" width="7" height="13" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <path d="M156 98 L194 80 L194 130 L156 114 Z" fill="${GOLD}" ${INK}/>
        <g class="p-press">${hand(138, 116)}</g>
      </g>`,
  },
  tuba: {
    label: 'Tuba',
    svg: `
      <g class="p-inst" style="transform-origin:100px 160px">
        ${tube('M100 116 C94 120 90 126 90 134', GOLD, 5)}
        <path d="M128 132 C134 106 144 80 152 64 L188 66 C176 86 158 112 146 136 Z" fill="${GOLD}" ${INK}/>
        <ellipse cx="170" cy="65" rx="19" ry="6" transform="rotate(4 170 65)" fill="#b8860b" ${INK} stroke-width="4"/>
        <ellipse cx="104" cy="158" rx="32" ry="34" fill="${GOLD}" ${INK}/>
        <ellipse cx="104" cy="158" rx="16" ry="18" fill="none" ${THIN}/>
        <rect class="p-valve" data-v="1" x="89" y="128" width="7" height="14" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <rect class="p-valve" data-v="2" x="100" y="128" width="7" height="14" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <rect class="p-valve" data-v="3" x="111" y="128" width="7" height="14" rx="2" fill="${GOLD}" ${INK} stroke-width="3"/>
        <g class="p-press">${hand(104, 138)}</g>
        ${hand(78, 166)}
      </g>`,
  },
  sax: {
    label: 'Saxophone',
    svg: `
      <g class="p-inst" style="transform-origin:104px 118px">
        ${tube('M104 118 C122 120 130 132 128 150 L126 176 C124 194 144 198 152 184 L158 170', GOLD)}
        <ellipse cx="160" cy="164" rx="15" ry="10" transform="rotate(-25 160 164)" fill="${GOLD}" ${INK}/>
        <ellipse cx="160" cy="164" rx="8" ry="4" transform="rotate(-25 160 164)" fill="#b8860b"/>
        <circle class="p-hole" cx="128" cy="142" r="3" fill="#fff3b0" stroke="#2b2235" stroke-width="2"/>
        <circle class="p-hole" cx="127" cy="156" r="3" fill="#fff3b0" stroke="#2b2235" stroke-width="2"/>
        <circle class="p-hole" cx="126" cy="170" r="3" fill="#fff3b0" stroke="#2b2235" stroke-width="2"/>
        <g class="p-press p-press-l">${hand(118, 146)}</g>
        <g class="p-press p-press-r">${hand(116, 170)}</g>
      </g>`,
  },
  clarinet: {
    label: 'Clarinet',
    svg: `
      <g class="p-inst" style="transform-origin:102px 116px">
        ${tube('M102 116 L120 184', '#3d3550', 8)}
        <path d="M114 180 L128 180 L134 198 L108 198 Z" fill="#3d3550" ${INK} stroke-width="4"/>
        <circle class="p-hole" cx="108" cy="138" r="2.5" fill="#d9dde6"/><circle class="p-hole" cx="112" cy="152" r="2.5" fill="#d9dde6"/><circle class="p-hole" cx="116" cy="166" r="2.5" fill="#d9dde6"/>
        <g class="p-press p-press-l">${hand(106, 140)}</g>
        <g class="p-press p-press-r">${hand(114, 166)}</g>
      </g>`,
  },
  flute: {
    label: 'Flute',
    svg: `
      <g class="p-inst" style="transform-origin:100px 114px">
        ${tube('M74 116 L184 102', '#d9dde6', 6)}
        <circle class="p-hole" cx="146" cy="107" r="2.2" fill="#d9dde6" stroke="#2b2235" stroke-width="1.2"/><circle class="p-hole" cx="156" cy="106" r="2.2" fill="#d9dde6" stroke="#2b2235" stroke-width="1.2"/><circle class="p-hole" cx="170" cy="104" r="2.2" fill="#d9dde6" stroke="#2b2235" stroke-width="1.2"/>
        <g class="p-press p-press-l">${hand(132, 110)}</g>
        <g class="p-press p-press-r">${hand(162, 106)}</g>
      </g>`,
  },
  mic: {
    label: 'Microphone (sing!)',
    svg: `
      <path d="M140 136 L156 206 M138 206 h36" ${THIN} stroke-width="5"/>
      <g class="p-inst" style="transform-origin:136px 134px">
        ${tube('M124 122 L138 136', '#6d6478', 5)}
        <circle cx="120" cy="116" r="10" fill="#9aa0ab" ${INK} stroke-width="4"/>
        <path d="M113 112 h14 M112 117 h16 M113 122 h14" stroke="#2b2235" stroke-width="1.2"/>
        ${hand(136, 134)}
      </g>`,
  },
  drums: {
    label: 'Drum kit', grounded: true,
    svg: `
      <path d="M176 192 L164 212 M176 192 L188 212 M176 128 V200" ${THIN} stroke-width="4"/>
      <g class="p-cymbal" style="transform-origin:176px 128px">
        <ellipse cx="176" cy="126" rx="21" ry="5.5" fill="${GOLD}" ${INK} stroke-width="4"/>
      </g>
      <path d="M24 186 L18 212 M56 186 L62 212" ${THIN} stroke-width="4"/>
      <path d="M18 160 L18 182 C18 190 62 190 62 182 L62 160 Z" fill="#e5484d" ${INK}/>
      <ellipse class="p-tom" cx="40" cy="160" rx="22" ry="6" fill="#fffaf0" ${INK} stroke-width="4"/>
      <g class="p-stick-l" style="transform-origin:64px 136px">${tube('M64 136 L34 156', '#d9b47a', 3)}${hand(64, 136)}</g>
      <g class="p-stick-r" style="transform-origin:138px 134px">${tube('M138 134 L170 124', '#d9b47a', 3)}${hand(138, 134)}</g>
      <g class="p-kick" style="transform-origin:100px 184px">
        <circle cx="100" cy="182" r="32" fill="#e5484d" ${INK}/>
        <circle cx="100" cy="182" r="24" fill="#fffaf0" ${INK} stroke-width="3"/>
      </g>`,
  },
};

// General MIDI program -> which instrument prop to draw.
window.propForProgram = function (program) {
  const p = +program;
  if (p >= 8 && p <= 15) return 'xylophone';
  if (p === 108 || p === 114 || p === 112) return 'xylophone';
  if ((p >= 24 && p <= 31) || p === 46 || (p >= 104 && p <= 107) || p === 110) return 'guitar';
  if ((p >= 32 && p <= 39) || p === 42 || p === 43) return 'bass';
  if (p >= 40 && p <= 51) return 'violin';
  if (p >= 52 && p <= 55) return 'mic';
  if (p === 58 || p === 60) return 'tuba';
  if (p >= 56 && p <= 63) return 'trumpet';
  if (p >= 64 && p <= 67) return 'sax';
  if (p >= 68 && p <= 71) return 'clarinet';
  if (p >= 72 && p <= 79) return 'flute';
  return 'piano';
};

window.characterHTML = function (id, prop) {
  const c = window.CHARACTERS[id] || window.CHARACTERS.bat;
  const p = window.PROPS[prop] || window.PROPS.piano;
  return `<div class="char char-${id} prop-${prop}" style="--skin:${c.skin}">
    <svg viewBox="0 0 200 220" aria-hidden="true">${p.grounded
      // Floor instruments stay put while the character dances behind them.
      ? `<g class="c-rig" style="transform-origin:100px 205px">${c.body}</g><g class="p-floor">${p.svg}</g>`
      : `<g class="c-rig" style="transform-origin:100px 205px">${c.body}${p.svg}</g>`}</svg>
  </div>`;
};
