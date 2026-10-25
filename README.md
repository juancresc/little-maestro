# 🦇 Little Maestro

Sheet music for kids with a spooky-cute jazz band. Pick a song, watch the notes light up, and mix the band.

```bash
docker compose up -d --build
open http://localhost:8080
```

## What's inside
- **59 songs**:
  - classical: Mozart, Beethoven, Bach, Grieg, Vivaldi, Pachelbel, Brahms, plus spooky and dreamy picks from Mutopia (*Toccata and Fugue in D minor*, *Night on Bald Mountain*, *Rondo alla Turca*, *March of the Wooden Soldiers*, *Gymnopédie No. 1*, *Clair de Lune*) and our own arrangement of Chopin's *Funeral March*
  - kids' songs
  - jazz: Saints, *Twinkle Swing*, plus three originals (*Purple Bat Blues*, *Boo's Boogie-Woogie*, *Midnight Cat Swing*)
  - Brazilian: three originals with real percussion (*Carnaval do Morcego* samba-reggae batucada, *Bossa da Lua*, *Baião do Fantasma*)
  - six complete Scott Joplin rags. These came from public-domain MIDI files on the [Mutopia Project](https://www.mutopiaproject.org), converted to sheet music with `midi2abc`.
  - video game: Game Boy Advance themes, made from fan MIDIs on [VGMusic](https://www.vgmusic.com/music/console/nintendo/gba/) with `midi2abc`: 11 from Pokémon (Ruby/Sapphire and FireRed/LeafGreen: *Littleroot Town*, *Route 101*, *Pokémon Center*, *Lavender Town*, *Wild Pokémon Battle*…), 3 from Kirby: Nightmare in Dream Land, 5 from Zelda: The Minish Cap (*Hyrule Town*, *Fairy Fountain*, *Syrup the Witch*…) and 3 from Golden Sun. There are also four 8-bit originals (*Tall Grass Route*, *Spooky Tower*, *Wild Bat Appears!*, *Healing Center*)
- **🎭 Theater**: a stage with a wooden floor, side drapes, spotlights and footlights, which fills the browser window (⛶ for real full screen). Click a character to pause it (the rest of the band keeps playing), or click the empty stage to fade out. Autoplay moves on to the next song with the curtain staying up, and ⏭ skips ahead.
- **The curtain**: Press ▶ on the curtain and it rises. Only the characters in the song are on stage, and they move to the notes they play:
  - hands travel along the piano or xylophone to the pitch
  - the violin bow changes direction on every note
  - the drummer alternates sticks and the kick drum thumps
  - string players put their fingers on the real string and position for each note (the string lights up), and the violin bow tilts to the string
  - trumpet and tuba press the real valves, and sax, clarinet and flute cover the real tone holes
  - the drummer follows the drum pattern: cymbal, snare and kick
  - wind instruments tilt up for high notes
- **Cursor**: a conductor's baton with a sparkle trail, and the characters' eyes follow it. Click a character and it jumps and plays a note. Click the empty stage to pause and bring the curtain down.
- **Longer songs**: short songs repeat until the show is about 1½–2 minutes. The time is shown on stage.
- **🎼 Music**: the full sheet music (no scroll box), the song library with SQLite search, the band mixer, the keyboard and the song writer.
- **Pick the band**: there are 7 characters (Purple Bat, Mummy Wrap, Pumpkin Jack, Candy Stripes, Stitchy, Boo, Midnight) and 12 instruments, and any character can play any instrument. Your choices are saved for each song. Invite the drummer to any song, or press 🎷 Jazz it up.
- **🌍 More music**: links to free music sites, plus **Import** for tune links from thesession.org or any page with ABC notation.
- **Volume** starts at 35%.

## Adding music
Put any `.abc` file in `./scores/`. It shows up straight away. Optional comment lines add it to the search filters and set up the band:

```
% category: Jazz            % mood: happy, cool      % level: 1-3
% emoji: 🎺                 % tags: swing, band       % about: A fun fact for kids
% instrument: 65            (General MIDI program for single-voice tunes)
% voices: 🦇 Bat · Sax ; 🧟 Mummy · Trumpet
% swing: 66   % drums: on   % gchord: fcfc   % chordprog: 0   % bassprog: 32
```
In multi-voice tunes, put a `%%MIDI program N` line right after each `V:` line. The band's instrument menus swap that number.

You can find thousands more tunes at abcnotation.com and in the folk and classical collections on IMSLP and Mutopia.

## YouTube videos
Each song can become a 1080p video of the theater show: the curtain rises with the song's title, the band plays the whole song (with its repeats), bows, and the curtain comes down. The buttons, the baton and the sheet music don't appear. The videos are made by a background job on the server. A headless Chrome plays the show for real, so **each song takes about as long as its show** (1½–2 minutes for most, longer for long pieces). Nothing in the app starts it: use the command line.

```bash
./fastdeploy.sh video list                    # the songs you can render (their ids)
./fastdeploy.sh video make twinkle canon-in-d # start the job for some songs…
./fastdeploy.sh video make --all              # …or for every song
./fastdeploy.sh video status                  # progress, and the videos ready on the server
./fastdeploy.sh video get                     # download the finished videos into ./videos
```
- The job keeps running if you close the terminal. Only one runs at a time.
- Add `--on=<subdomain>` to use another deployed app, e.g. `./fastdeploy.sh video list --on=music`.
- Each video is named after the song (YouTube uses the file name as the title). A `.txt` next to it has the YouTube title and a description that explains Little Maestro, lists who plays in the song and links to the song in the app.
- The band is each song's default band (choices saved in a browser don't apply).
- Videos stay on the server in `~/apps/<subdomain>/videos/`. `deploy` never touches or uploads them.
- The first `make` or `list` builds the job's image (Chrome + ffmpeg, about 2 GB), which takes a few minutes. After that it starts right away. It uses up to 1.5 GB of memory while it runs.

**On your computer** (the app must be running):
```bash
docker compose run --rm video --list          # same options: --list | --all | <song-id …>
docker compose run --rm video twinkle         # → ./videos
```
or without Docker: `cd tools/video && npm install && npx playwright install chromium-headless-shell && node export.mjs --list`.

Games and TV themes are copyrighted, so YouTube will flag those videos. Classical pieces and Little Maestro originals are safe.

## Characters
Characters and instruments are SVG drawings in `app/static/characters.js`. Bodies are in `CHARACTERS` and instruments are in `PROPS`. Animations live at the end of `style.css`.

## Deploy (no GitHub needed)
```bash
./fastdeploy.sh deploy                # → https://littlemaestro.crescente.com.ar (no command = help, never deploys)
./fastdeploy.sh deploy otro-nombre    # same app on another subdomain
./fastdeploy.sh status | logs | down [subdomain]   # down = stop, keeps data
./fastdeploy.sh undeploy [subdomain]               # deletes everything [--no-backup] [--yes-really]
```
The script copies this folder over SSH (rsync) to the 3k server (`~/apps/<subdomain>`) and builds it there with Docker. It also adds Traefik labels for `<subdomain>.crescente.com.ar`. The wildcard DNS record `*.crescente.com.ar → 3.136.238.189` (Cloudflare, DNS only) means any new subdomain works straight away, and Traefik gets the HTTPS certificate on the first visit. Songs saved on the server are kept. Deploys only add or update library songs. `undeploy` first copies the server's `scores/` to `./backups/<subdomain>-scores-<date>/`, asks you to type the subdomain, then removes the containers, images and `~/apps/<subdomain>` (DNS and Traefik stay).

**Links:** `…/#/<song>` opens that song in the theater, for example https://littlemaestro.crescente.com.ar/#/canon-in-d. `…/#/music/<song>` opens its sheet music.
