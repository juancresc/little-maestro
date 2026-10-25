"""Little Maestro — tiny API that indexes ABC scores into SQLite and serves the player UI."""
import html
import ipaddress
import socket
import json
import os
import re
import sqlite3
import unicodedata
import urllib.parse
import urllib.request
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).parent
SCORES_DIR = Path(os.environ.get("SCORES_DIR", BASE.parent / "scores"))
DB_PATH = Path(os.environ.get("DB_PATH", BASE / "maestro.db"))
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
META_RE = re.compile(r"^%\s*([a-z]+)\s*:\s*(.*)$", re.I)
VOICE_RE = re.compile(r"^\[?V:\s*([^\s\]]+)", re.M)

# Keys from "% key: value" comment lines that the player uses for the band.
PLAYBACK_KEYS = {"instrument", "voices", "swing", "gchord", "chordprog", "bassprog", "drums", "drum"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  composer TEXT,
  category TEXT,
  moods TEXT,
  tags TEXT,
  level INTEGER,
  emoji TEXT,
  about TEXT,
  voices INTEGER,
  is_band INTEGER,
  source TEXT,
  playback TEXT,
  abc TEXT NOT NULL,
  mtime REAL
);
CREATE INDEX IF NOT EXISTS idx_scores_category ON scores(category);
"""

app = FastAPI(title="Little Maestro")


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def split_list(value: str) -> list[str]:
    return [v.strip().lower() for v in re.split(r"[,;]", value) if v.strip()]


def parse_score(score_id: str, abc: str) -> dict:
    meta: dict = {}
    titles: list[str] = []
    composer = ""
    for raw in abc.splitlines():
        line = raw.strip()
        if m := META_RE.match(line):
            meta[m.group(1).lower()] = m.group(2).strip()
        elif line.startswith("T:"):
            titles.append(line[2:].strip())
        elif line.startswith("C:") and not composer:
            composer = line[2:].strip()

    voices = len(dict.fromkeys(VOICE_RE.findall(abc))) or 1
    playback = {k: meta[k] for k in PLAYBACK_KEYS if k in meta}
    try:
        level = max(1, min(3, int(meta.get("level", 1))))
    except ValueError:
        level = 1
    return {
        "id": score_id,
        "title": titles[0] if titles else score_id,
        "subtitle": titles[1] if len(titles) > 1 else "",
        "composer": composer,
        "category": meta.get("category", "My Songs").strip() or "My Songs",
        "moods": ",".join(split_list(meta.get("mood", ""))),
        "tags": ",".join(split_list(meta.get("tags", ""))),
        "level": level,
        "emoji": meta.get("emoji", "🎵"),
        "about": meta.get("about", ""),
        "voices": voices,
        "is_band": int(voices > 1 or "gchord" in meta or meta.get("drums") == "on"),
        "source": meta.get("source", "library"),
        "playback": json.dumps(playback, ensure_ascii=False),
        "abc": abc,
    }


def sync_index() -> None:
    """Mirror the .abc files on disk into SQLite (only re-parses changed files)."""
    SCORES_DIR.mkdir(parents=True, exist_ok=True)
    with closing(db()) as conn, conn:
        conn.executescript(SCHEMA)
        known = {r["id"]: r["mtime"] for r in conn.execute("SELECT id, mtime FROM scores")}
        on_disk = set()
        for path in SCORES_DIR.glob("*.abc"):
            score_id = path.stem
            if not ID_RE.match(score_id):
                continue
            on_disk.add(score_id)
            mtime = path.stat().st_mtime
            if known.get(score_id) == mtime:
                continue
            row = parse_score(score_id, path.read_text(encoding="utf-8"))
            row["mtime"] = mtime
            cols = ",".join(row)
            conn.execute(
                f"INSERT OR REPLACE INTO scores ({cols}) VALUES ({','.join('?' * len(row))})",
                list(row.values()),
            )
        for gone in set(known) - on_disk:
            conn.execute("DELETE FROM scores WHERE id = ?", (gone,))


def row_to_dict(row: sqlite3.Row, with_abc: bool = False) -> dict:
    d = dict(row)
    d["moods"] = [m for m in (d["moods"] or "").split(",") if m]
    d["tags"] = [t for t in (d["tags"] or "").split(",") if t]
    d["playback"] = json.loads(d["playback"] or "{}")
    d["is_band"] = bool(d["is_band"])
    d.pop("mtime", None)
    if not with_abc:
        d.pop("abc", None)
    return d


@app.on_event("startup")
def startup() -> None:
    sync_index()


@app.get("/api/scores")
def list_scores(q: str = "", category: str = "", mood: str = "", level: int = 0, band: bool = False):
    sync_index()
    sql, args = "SELECT * FROM scores WHERE 1=1", []
    if q.strip():
        like = f"%{q.strip().lower()}%"
        sql += " AND (lower(title||' '||subtitle||' '||composer||' '||tags||' '||about||' '||category) LIKE ?)"
        args.append(like)
    if category:
        sql += " AND category = ?"
        args.append(category)
    if mood:
        sql += " AND (','||moods||',') LIKE ?"
        args.append(f"%,{mood.lower()},%")
    if level:
        sql += " AND level = ?"
        args.append(level)
    if band:
        sql += " AND is_band = 1"
    sql += " ORDER BY level, title"
    with closing(db()) as conn:
        return [row_to_dict(r) for r in conn.execute(sql, args)]


@app.get("/api/facets")
def facets():
    """Categories and moods with counts, for the filter chips."""
    sync_index()
    with closing(db()) as conn:
        rows = conn.execute("SELECT category, moods, is_band FROM scores").fetchall()
    categories: dict[str, int] = {}
    moods: dict[str, int] = {}
    for r in rows:
        categories[r["category"]] = categories.get(r["category"], 0) + 1
        for m in filter(None, (r["moods"] or "").split(",")):
            moods[m] = moods.get(m, 0) + 1
    return {
        "categories": [{"name": k, "count": v} for k, v in sorted(categories.items())],
        "moods": [{"name": k, "count": v} for k, v in sorted(moods.items(), key=lambda kv: -kv[1])],
        "band": sum(r["is_band"] for r in rows),
        "total": len(rows),
    }


@app.get("/api/scores/{score_id}")
def get_score(score_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT * FROM scores WHERE id = ?", (score_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Score not found")
    return row_to_dict(row, with_abc=True)


class NewScore(BaseModel):
    abc: str = Field(min_length=10, max_length=100_000)
    category: str = Field(default="My Songs", max_length=40)
    emoji: str = Field(default="🎵", max_length=8)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "my-song"


@app.post("/api/scores", status_code=201)
def create_score(body: NewScore):
    if "K:" not in body.abc:
        raise HTTPException(400, "ABC needs at least a K: (key) line")
    title = next((l[2:].strip() for l in body.abc.splitlines() if l.startswith("T:")), "My song")
    base = slugify(title)
    score_id, n = base, 2
    while (SCORES_DIR / f"{score_id}.abc").exists():
        score_id, n = f"{base}-{n}", n + 1
    # Strip any metadata the user typed for these keys, then add ours on top.
    lines = [l for l in body.abc.strip().splitlines()
             if not re.match(r"^%\s*(source|category|emoji)\s*:", l, re.I)]
    header = [f"% source: user", f"% category: {body.category.strip() or 'My Songs'}", f"% emoji: {body.emoji}"]
    (SCORES_DIR / f"{score_id}.abc").write_text("\n".join(header + lines) + "\n", encoding="utf-8")
    sync_index()
    return get_score(score_id)


class ImportRequest(BaseModel):
    url: str = Field(min_length=8, max_length=500)


SESSION_RE = re.compile(r"^https?://(?:www\.)?thesession\.org/tunes/(\d+)")
# The Session doesn't give a meter, only the dance type.
SESSION_METERS = {"reel": "4/4", "hornpipe": "4/4", "barndance": "4/4", "strathspey": "4/4", "march": "4/4",
                  "jig": "6/8", "slide": "12/8", "slip jig": "9/8", "polka": "2/4", "waltz": "3/4",
                  "mazurka": "3/4", "three-two": "3/2"}


def check_public_url(url: str) -> None:
    """Only fetch public web addresses: never localhost, the private network or cloud
    metadata endpoints (e.g. 169.254.169.254), which an imported "link" could otherwise reach."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise HTTPException(400, "Please paste a web link (http:// or https://)")
    if parts.port not in (None, 80, 443):
        raise HTTPException(400, "Only normal web links are allowed")
    try:
        infos = socket.getaddrinfo(parts.hostname, parts.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise HTTPException(400, "That website doesn't seem to exist")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise HTTPException(400, "That link points to a private address")


class _CheckedRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_public_url(newurl)  # a public page must not bounce us to an internal one
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_CheckedRedirects)


def fetch_text(url: str, limit: int = 600_000) -> str:
    check_public_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": "LittleMaestro/1.0 (kids music player)"})
    with _opener.open(req, timeout=12) as res:
        return res.read(limit).decode("utf-8", errors="replace")


def abc_from_session(tune_id: str) -> tuple[str, list[str]]:
    data = json.loads(fetch_text(f"https://thesession.org/tunes/{tune_id}?format=json"))
    setting = data["settings"][0]
    kind = data.get("type", "")
    key = re.sub(r"(major|minor|mixolydian|dorian)$", lambda m: m.group(1)[:3], setting.get("key", "C"))
    body = setting["abc"].replace("! ", "\n").replace("!", "\n")
    abc = "\n".join([
        "X:1", f"T:{data['name']}", f"C:Traditional (via thesession.org)", f"R:{kind}",
        f"M:{SESSION_METERS.get(kind, '4/4')}", "L:1/8", f"K:{key}", body,
    ])
    return abc, ["folk", kind]


def abc_from_page(url: str) -> str:
    text = fetch_text(url)
    if "<" in text and ">" in text:  # an HTML page: drop tags, keep the text
        text = html.unescape(re.sub(r"<[^>]+>", "\n", text))
    lines = text.replace("\r", "").split("\n")
    for i, line in enumerate(lines):
        if re.match(r"^X:\s*\d+", line.strip()):
            tune = []
            for l in lines[i:]:
                if not l.strip() and any(t.startswith("K:") for t in tune):
                    break
                tune.append(l.strip())
            if any(t.startswith("K:") for t in tune):
                return "\n".join(tune)
    raise HTTPException(422, "No ABC tune found at that link")


@app.post("/api/import", status_code=201)
def import_score(body: ImportRequest):
    url = body.url.strip()
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "Please paste a web link (http:// or https://)")
    try:
        if m := SESSION_RE.match(url):
            abc, tags = abc_from_session(m.group(1))
            category = "Folk"
        else:
            abc, tags, category = abc_from_page(url), [], "Imported"
    except HTTPException:
        raise
    except Exception as exc:  # network errors, bad JSON, …
        raise HTTPException(502, f"Couldn't read that link ({exc.__class__.__name__})")
    meta = f"% tags: {', '.join(t for t in tags if t)}\n% about: Imported from {url}\n"
    return create_score(NewScore(abc=meta + abc, category=category, emoji="🌍"))


@app.delete("/api/scores/{score_id}", status_code=204)
def delete_score(score_id: str):
    if not ID_RE.match(score_id):
        raise HTTPException(400, "Bad id")
    score = get_score(score_id)
    if score["source"] != "user":
        raise HTTPException(403, "Only songs you added can be deleted")
    (SCORES_DIR / f"{score_id}.abc").unlink(missing_ok=True)
    sync_index()


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
