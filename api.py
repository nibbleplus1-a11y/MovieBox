from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
import asyncio
import threading
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import time
from typing import Any, Dict, List, Optional
import urllib.parse
from urllib.parse import urlsplit, urlparse

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import httpx

try:
    from curl_cffi import requests as cr
except ImportError:
    cr = None

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

app = FastAPI(
    title="MovieVerse 1080p Cinema API",
    description="REST API for MovieVerse with 1080p Stream & Subtitle Extraction",
    version="2.5.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/sw.js")
def serve_sw():
    sw_path = os.path.join(STATIC_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(sw_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="Service worker not found")

@app.get("/app.apk")
@app.get("/movieverse.apk")
@app.get("/cinescope.apk")
@app.get("/download/app")
def download_apk():
    for name in ["movieverse.apk", "cinescope.apk"]:
        apk_path = os.path.join(STATIC_DIR, name)
        if os.path.exists(apk_path):
            return FileResponse(apk_path, media_type="application/vnd.android.package-archive", filename="MovieVerse.apk")
    raise HTTPException(status_code=404, detail="MovieVerse APK build in progress or not yet uploaded.")

@app.post("/api/admin/upload-apk")
async def upload_apk(request: Request, secret: Optional[str] = Query(None)):
    expected = os.getenv("DEPLOY_SECRET", "moviebox_deploy_2026")
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Unauthorized")
    body = await request.body()
    for name in ["movieverse.apk", "cinescope.apk"]:
        with open(os.path.join(STATIC_DIR, name), "wb") as f:
            f.write(body)
    return {"status": "success", "size": len(body), "path": "/download/app", "filename": "MovieVerse.apk"}

@app.post("/api/admin/report-log")
async def report_log(request: Request, secret: Optional[str] = Query(None)):
    expected = os.getenv("DEPLOY_SECRET", "moviebox_deploy_2026")
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Unauthorized")
    body = await request.body()
    log_path = os.path.join(STATIC_DIR, "build_error.log")
    with open(log_path, "wb") as f:
        f.write(body)
    return {"status": "received", "size": len(body)}

@app.post("/api/report-crash")
async def report_crash(request: Request):
    body = await request.body()
    crash_path = os.path.join(STATIC_DIR, "app_crash.log")
    with open(crash_path, "ab") as f:
        f.write(f"\n--- {datetime.utcnow().isoformat()} ---\n".encode("utf-8"))
        f.write(body)
        f.write(b"\n")
    return {"status": "ok"}

class SimpleCache:
    def __init__(self, maxsize: int = 500, default_ttl: int = 600):
        self.maxsize = maxsize
        self.default_ttl = default_ttl
        self.cache = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self.cache:
                val, exp = self.cache[key]
                if time.time() < exp:
                    return val
                del self.cache[key]
            return None

    def set(self, key: str, val: Any, ttl: Optional[int] = None) -> None:
        if ttl is None:
            ttl = self.default_ttl
        with self._lock:
            if len(self.cache) >= self.maxsize:
                self.cache.popitem(last=False)
            self.cache[key] = (val, time.time() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self.cache.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        with self._lock:
            keys = [k for k in list(self.cache.keys()) if k.startswith(prefix)]
            for k in keys:
                self.cache.pop(k, None)

app_cache = SimpleCache()
_bg_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="bg_imdb")

SECRET_KEY_DEFAULT_B64 = "NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw=="
SECRET_KEY_ALT_B64 = "WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ=="
MODERN_USER_AGENT = "com.community.mbox.in/50020130 (Linux; U; Android 14; en_IN; Pixel 8; Build/UD1A.230803.041; Cronet/145.0.7582.0)"
WEB_USER_AGENT = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36"
API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff"
NATIVE_API_BASE = "https://api3.aoneroom.com"
BOOTSTRAP_HOST = "https://apig.inmoviebox.com"
BOOTSTRAP_URL = f"{BOOTSTRAP_HOST}/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1"

WEB_DOMAINS = [
    "https://123moviesfree.club",
    "https://movie-box.co",
    "https://movieboxonline.net",
    "https://sflix.film",
    "https://h5-api.aoneroom.com",
    "https://netnaija.film",
    "https://movieboxhd.net",
]

def _b64decode(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    return base64.b64decode(s)

def get_secret_bytes(use_alt_key: bool = False) -> bytes:
    outer = SECRET_KEY_ALT_B64 if use_alt_key else SECRET_KEY_DEFAULT_B64
    inner = _b64decode(outer).decode("utf-8")
    return _b64decode(inner)

def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

def generate_device_id() -> str:
    return secrets.token_hex(16)

def generate_x_client_token(timestamp: int) -> str:
    ts_str = str(timestamp)
    reversed_ts = ts_str[::-1].encode("utf-8")
    return f"{ts_str},{md5_hex(reversed_ts)}"

def generate_client_info(device_id: str) -> str:
    return json.dumps(
        {
            "package_name": "com.community.mbox.in",
            "version_name": "4.0.03.0920.03",
            "version_code": 50020130,
            "os": "android",
            "os_version": "14",
            "device_id": device_id,
            "install_store": "official",
            "gaid": "1b2212c1-dadf-43c3-a0c8-bd6ce48ae22d",
            "brand": "Google",
            "model": "Pixel 8",
            "system_language": "en",
            "net": "NETWORK_WIFI",
            "region": "IN",
            "timezone": "Asia/Calcutta",
            "sp_code": "",
        },
        separators=(",", ":"),
    )

def build_canonical_string(method: str, accept: str | None, content_type: str | None, url: str, body: str | None, timestamp: int) -> str:
    parsed = urlsplit(url)
    path = parsed.path or "/"
    if parsed.query:
        pairs = []
        for segment in parsed.query.split("&"):
            if not segment:
                continue
            pieces = segment.split("=", 1)
            pairs.append((pieces[0], pieces[1] if len(pieces) > 1 else ""))
        pairs.sort(key=lambda kv: kv[0])
        canonical_query = "&".join(f"{k}={v}" for k, v in pairs)
        canonical_url = f"{path}?{canonical_query}"
    else:
        canonical_url = path

    body_bytes = body.encode("utf-8") if body is not None else None
    if body_bytes:
        body_length = str(len(body_bytes))
        body_hash = md5_hex(body_bytes[:102400])
    else:
        body_length = ""
        body_hash = ""

    return "\n".join(
        [
            method.upper(),
            accept or "",
            content_type or "",
            body_length,
            str(timestamp),
            body_hash,
            canonical_url,
        ]
    )

def generate_x_tr_signature(method: str, accept: str | None, content_type: str | None, url: str, body: str | None, timestamp: int, use_alt_key: bool = False) -> str:
    canonical = build_canonical_string(method, accept, content_type, url, body, timestamp)
    key = get_secret_bytes(use_alt_key)
    digest = hmac.new(key, canonical.encode("utf-8"), hashlib.md5).digest()
    sig_b64 = base64.b64encode(digest).decode("ascii")
    return f"{timestamp}|2|{sig_b64}"

def build_auth_headers(method: str, url: str, body: str | None = None, token: str | None = None, device_id: str | None = None, use_alt_key: bool = False, content_type: str = "application/json", accept: str = "application/json") -> Dict[str, str]:
    ts = int(time.time() * 1000)
    dev_id = device_id or generate_device_id()
    headers = {
        "user-agent": MODERN_USER_AGENT,
        "accept": accept,
        "content-type": content_type,
        "connection": "keep-alive",
        "x-client-token": generate_x_client_token(ts),
        "x-tr-signature": generate_x_tr_signature(method, accept, content_type, url, body, ts, use_alt_key),
        "x-client-info": generate_client_info(dev_id),
        "x-client-status": "0",
    }
    if token:
        headers["authorization"] = f"Bearer {token}"
    return headers

def extract_policy_resource(sign_cookie: str | None) -> str | None:
    if not sign_cookie:
        return None
    m_edge = re.search(r"Edge-Cache-Cookie=urlprefix=([^:;\s]+)", sign_cookie)
    if m_edge:
        try:
            decoded = _b64decode(m_edge.group(1)).decode("utf-8").rstrip("/")
            return decoded + "/index.mpd"
        except Exception:
            pass
    m_cf = re.search(r"CloudFront-Policy=([^;]+)", sign_cookie)
    if m_cf:
        raw = m_cf.group(1)
        for t in ("cf", "std"):
            try:
                b = raw.replace("-", "+").replace("_", "=") if t == "cf" else raw
                b += "=" * (-len(b) % 4)
                data = json.loads(base64.b64decode(b).decode("utf-8"))
                for s in data.get("Statement", []):
                    res = s.get("Resource")
                    if res:
                        return res.rstrip("*").rstrip("/") + "/index.mpd"
            except Exception:
                pass
    return None

# ─── SAFE SEARCH & ADULT/PORNOGRAPHIC CONTENT FILTER ─────────────────────────
ADULT_GENRES = {
    "adult", "erotica", "erotic", "18+", "porn", "porno", "hentai",
    "mature 18+", "nsfw", "sensual", "jav"
}

# Whitelist legitimate mainstream movies & television series so they are never blocked
MAINSTREAM_SAFE_PATTERNS = [
    r"^xxx(\s*\(\d{4}\)|\s*:\s*(state\s+of\s+the\s+union|return\s+of\s+xander\s+cage|the\s+next\s+level|xander\s*cage))?(\s*\[.*\])?$",
    r"\bsex\s+and\s+the\s+city\b",
    r"\bsex\s+education\b",
    r"\bmasters\s+of\s+sex\b",
    r"\bthe\s+sex\s+lives\s+of\s+college\s+girls\b",
    r"\bsex\s+tape\b",
    r"\bsex,\s*lies,\s*and\s*videotape\b",
    r"\bthe\s+girl\s+with\s+the\s+dragon\s+tattoo\b",
    r"\bbasic\s+instinct\b",
    r"\bamerican\s+pie\b",
    r"\bfifty\s+shades\b",
    r"\beyes\s+wide\s+shut\b",
    r"\bboogie\s+nights\b",
    r"\bwild\s+things\b",
    r"\bcalifornication\b",
    r"\beuphoria\b"
]
_SAFE_TITLE_REGEX = re.compile("|".join(MAINSTREAM_SAFE_PATTERNS), re.IGNORECASE)

ADULT_KEYWORD_PATTERNS = [
    # Explicit adult terms
    r"\b18\+\b", r"\bxxx\b", r"\bporn\b", r"\bporno\b", r"\bpornograph[a-z]*\b", r"\bhentai\b", r"\bjav\b",
    r"\bxxx\s*(video|movie|clip|film|tube|cam|pic|actress|porn|parody)\b",
    r"\btriple\s*x\s*porn\b",
    r"\bsex\s*(video|tape|clip|scene|act|mms|chat|cam|worker|toy)\b",
    r"\bpleasure\s*toy\b",
    r"\badult\s*(film|video|movie|industry|channel|xxx|site)\b",
    r"\bfor\s*adults\s*only\b",
    r"\berotic\b", r"\berotica\b", r"\bhardcore\b", r"\bsoftcore\b", r"\bbrazzers\b",
    r"\bxvideos?\b", r"\bcamgirl\b", r"\bstripper\b", r"\bblowjob\b", r"\bgangbang\b",
    r"\borgasm\b", r"\bincest\b", r"\bmilf\b", r"\bdildo\b", r"\bvoyeur\b",
    r"\bnudity\b", r"\bnude\b", r"\buncensored\b", r"\bnsfw\b",
    
    # Erotic Indian & Asian B-grade adult platforms & titles
    r"\bullu\b", r"\bkooku\b", r"\bprimeplay\b", r"\bmoodx\b", r"\bcharmsukh\b",
    r"\bpalang\s*tod\b", r"\bkavita\s*bhabhi\b", r"\brabbit\s*movies\b", r"\bhotshots\b",
    r"\bbhabhi\b", r"\bjane\s*anjane\b", r"\briiti\s*riwaz\b", r"\brateeq\b",
    r"\bdesi\s*kahani\b", r"\bhunters\b", r"\bbesharams\b", r"\bjalva\b",
    
    # Erotic tropes (Korean 18+, adult incest tropes, etc.)
    r"\byoung\s*sister[- ]in[- ]law\b", r"\bmother[- ]in[- ]law\b", r"\bfriend'?s\s*mother\b",
    r"\bnice\s*sister[- ]in[- ]law\b", r"\bstepmother'?s\s*friends?\b", r"\bdelicious\s*delivery\b",
    r"\btasty\s*boarding\b", r"\bfemale\s*boarding\s*house\b", r"\bpurpose\s*of\s*(sex|erotic)\b",
    r"\bprivate\s*sex\b", r"\berotic\s*island\b", r"\berotic\s*tutoring\b",
    r"\bhot\s*(scene|web\s*series)\b",
    r"\bseduction\b", r"\blust\s*stories\b"
]

_ADULT_REGEX = re.compile("|".join(ADULT_KEYWORD_PATTERNS), re.IGNORECASE)

def is_adult_content(item: Any) -> bool:
    if not item or not isinstance(item, dict):
        return False

    title = str(item.get("title") or "").strip()
    if _SAFE_TITLE_REGEX.search(title):
        return False

    slug = str(item.get("detail_path") or item.get("detailPath") or "")
    if slug and _SAFE_TITLE_REGEX.search(slug.replace("-", " ")):
        return False

    genre = str(item.get("genre") or "").lower()
    for g in genre.replace("/", ",").split(","):
        g_clean = g.strip()
        if g_clean in ADULT_GENRES:
            return True

    if re.search(r"\bsex\b", title, re.IGNORECASE) and not _SAFE_TITLE_REGEX.search(title):
        return True

    if _ADULT_REGEX.search(title):
        return True

    if slug and _ADULT_REGEX.search(slug):
        return True

    return False

def is_adult_query(query: str) -> bool:
    if not query:
        return False
    q = query.strip()
    if _SAFE_TITLE_REGEX.search(q):
        return False
    return bool(_ADULT_REGEX.search(q))

def classify_content_type(subject_type: Optional[int], title: Optional[str] = None, upstream_type: Optional[str] = None) -> str:
    """
    Intelligently classify content as 'Movie' or 'TV Series'.
    Prevents movies without subjectType or with subjectType=None from being incorrectly tagged as TV Series,
    and prevents series (like Breaking Bad, The Mentalist) from being incorrectly tagged as Movie.
    """
    clean_t = (title or "").strip()
    clean_low = clean_t.lower()
    
    # Explicit series patterns in title (e.g. 'Season 1', 'S02', 'The Series', 'Episode', 'Part 1')
    has_series_in_title = bool(re.search(r'\b(season\s*\d+|s\d{1,2}\b|tv\s*series|mini-series|complete\s*series|episode\s*\d+)\b', clean_t, re.IGNORECASE))
    
    # Known flagship TV series that might have ambiguous subject_type from upstream
    _KNOWN_SERIES = (
        "breaking bad", "better call saul", "game of thrones", "house of the dragon",
        "stranger things", "the mentalist", "the boys", "the last of us", "succession",
        "peaky blinders", "the sopranos", "the wire", "chernobyl", "fargo", "true detective",
        "sherlock", "dexter", "friends", "the office", "vikings", "prison break", "narcos",
        "money heist", "squid game", "dark", "westworld", "black mirror", "rick and morty",
        "attack on titan", "death note", "jujutsu kaisen", "demon slayer", "naruto", "one piece",
        "bleach", "my hero academia", "chainsaw man", "solo leveling", "vinland saga", "arcane",
        "the mandalorian", "loki", "wandavision", "daredevil", "the walking dead", "severance"
    )
    is_known_series = any(ks in clean_low for ks in _KNOWN_SERIES)
    if is_known_series or has_series_in_title:
        return "TV Series"

    if subject_type == 2:
        return "TV Series"
    if subject_type == 1:
        return "Movie"
        
    # If upstream explicitly specified type
    if upstream_type in ["Series", "TV Series"]:
        return "TV Series"
    if upstream_type == "Movie":
        return "Movie"

    # Default is Movie (vast majority of unclassified cinema items are movies)
    return "Movie"

class MovieBoxEngine:
    _instance = None

    def __init__(self):
        self.device_id = generate_device_id()
        self.bearer_token: Optional[str] = None
        if cr:
            self.session = cr.Session(impersonate="chrome120")
        else:
            self.session = httpx.Client(timeout=25, follow_redirects=True)

    @classmethod
    def get_instance(cls) -> "MovieBoxEngine":
        if cls._instance is None:
            cls._instance = MovieBoxEngine()
        return cls._instance

    def bootstrap_token(self, force: bool = False) -> str:
        if self.bearer_token and not force:
            return self.bearer_token
        headers = build_auth_headers("GET", BOOTSTRAP_URL, device_id=self.device_id)
        resp = self.session.get(BOOTSTRAP_URL, headers=headers, timeout=20)
        x_user = resp.headers.get("x-user")
        if not x_user:
            raise HTTPException(status_code=502, detail="Failed to bootstrap MovieBox token")
        token_data = json.loads(x_user)
        token = token_data.get("token")
        if not token:
            raise HTTPException(status_code=502, detail="Empty token in upstream header")
        self.bearer_token = token
        return token

    def api_request(self, method: str, path_or_url: str, body_dict: Optional[Dict[str, Any]] = None, use_token: bool = True, retry_auth: bool = True) -> Dict[str, Any]:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            full_url = path_or_url
        else:
            full_url = f"{NATIVE_API_BASE}{path_or_url}"
        if use_token and not self.bearer_token:
            self.bootstrap_token()
        body_str = json.dumps(body_dict, separators=(",", ":")) if body_dict is not None else None
        headers = build_auth_headers(
            method=method,
            url=full_url,
            body=body_str,
            token=self.bearer_token if use_token else None,
            device_id=self.device_id,
        )
        data_bytes = body_str.encode("utf-8") if body_str is not None else None
        if method.upper() == "POST":
            resp = self.session.post(full_url, headers=headers, data=data_bytes, timeout=25)
        else:
            resp = self.session.get(full_url, headers=headers, timeout=25)
        if resp.status_code in (401, 441) and retry_auth:
            self.bootstrap_token(force=True)
            return self.api_request(method, path_or_url, body_dict, use_token, retry_auth=False)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"API returned HTTP {resp.status_code}")
        return resp.json()

    def search(self, query: str, page: int = 1, per_page: int = 20) -> List[Dict[str, Any]]:
        safe_per_page = min(max(1, int(per_page or 20)), 20)
        if is_adult_query(query):
            return []

        cache_key = f"search:{query}:{page}:{safe_per_page}"
        cached = app_cache.get(cache_key)
        if cached is not None:
            return cached
        payload = {"keyword": query, "page": page, "perPage": safe_per_page}
        url = "/wefeed-mobile-bff/subject-api/search"
        try:
            data = self.api_request("POST", url, body_dict=payload).get("data", {})
        except Exception:
            try:
                data = self.api_request("POST", url, body_dict={"keyword": query, "page": page, "perPage": 10}).get("data", {})
            except Exception:
                data = {}
        raw_items = data.get("items", []) or data.get("list", [])
        results = []
        seen_canonical = {}

        for item in raw_items:
            sub = item.get("subject", item)
            # Enforce clean family-friendly results: strictly exclude pornographic/adult content
            if is_adult_content(sub):
                continue

            raw_title = sub.get("title") or ""
            if not raw_title:
                continue

            # Strip language/dub bracket tags like [Hindi], (English), [Tamil]
            clean_base = re.sub(r'\[.*?\]|\(.*?\)', '', raw_title)
            clean_base = re.sub(r'\s+', ' ', clean_base).strip().lower()

            rel_date = sub.get("releaseDate") or ""
            year_tag = str(rel_date)[:4] if rel_date else ""
            type_tag = str(sub.get("subjectType", 1))
            canonical_key = f"{clean_base}:{year_tag}:{type_tag}"

            # If we've already seen this movie/show with just an audio dub tag
            if canonical_key in seen_canonical:
                existing = seen_canonical[canonical_key]
                # If current has a cleaner title (no brackets), swap title
                if "[" not in raw_title and "(" not in raw_title and ("[" in existing["title"] or "(" in existing["title"]):
                    existing["title"] = raw_title
                    existing["subject_id"] = str(sub.get("subjectId"))
                continue

            is_cs = False
            if rel_date:
                try:
                    if date.fromisoformat(rel_date[:10]) > date.today():
                        is_cs = True
                except Exception:
                    pass

            entry = {
                "subject_id": str(sub.get("subjectId")),
                "title": raw_title,
                "type": classify_content_type(sub.get("subjectType"), raw_title),
                "subject_type": sub.get("subjectType"),
                "release_date": rel_date,
                "coming_soon": is_cs,
                "imdb_rating": sub.get("imdbRatingValue"),
                "genre": sub.get("genre"),
                "cover": sub.get("cover", {}).get("url") if isinstance(sub.get("cover"), dict) else None,
                "detail_path": sub.get("detailPath"),
                "language": sub.get("language")
            }
            seen_canonical[canonical_key] = entry
            results.append(entry)

        app_cache.set(cache_key, results, ttl=600)
        return results

    def get_details(self, subject_id: str) -> Dict[str, Any]:
        cache_key = f"details:{subject_id}"
        cached = app_cache.get(cache_key)
        if cached is not None:
            return cached
        url = f"/wefeed-mobile-bff/subject-api/get?subjectId={subject_id}"
        data = self.api_request("GET", url).get("data", {})
        detail_url_str = data.get("detailUrl", "")
        detail_path = detail_url_str.split("/")[-1] if "/" in detail_url_str else detail_url_str
        
        raw_dubs = data.get("dubs", [])
        dubs = [
            {
                "subject_id": str(d.get("subjectId")),
                "lang_name": d.get("lanName") or d.get("language") or "Dub",
                "language": d.get("language"),
            }
            for d in raw_dubs
            if isinstance(d, dict)
        ]
        
        # Cache parent mapping for each child dub
        main_id = str(data.get("subjectId"))
        original_subject_id = main_id  # Will be updated if this item is itself a dub
        for d in dubs:
            if d.get("subject_id") and d["subject_id"] != main_id:
                app_cache.set(f"dub_parent:{d['subject_id']}", main_id, ttl=7200)

        # If this item itself is a dub with no child dubs, look up parent's dubs
        if not dubs:
            parent_id = app_cache.get(f"dub_parent:{subject_id}")
            if not parent_id:
                # No cached parent — try to find the original by searching the clean title
                raw_title = data.get("title") or ""
                # Strip language/dub bracket tags like [Hindi], (English), [Tamil]
                clean_title = re.sub(r'\[.*?\]|\(.*?\)', '', raw_title).strip()
                if clean_title and clean_title.lower() != raw_title.lower():
                    # This title had a dub tag — search for the clean version
                    try:
                        search_results = self.search(clean_title, page=1, per_page=10)
                        rel_date = str(data.get("releaseDate") or "")[:4]
                        subject_type = data.get("subjectType")
                        for r in search_results:
                            r_sid = str(r.get("subject_id") or "")
                            if r_sid and r_sid != main_id:
                                # Prefer same type and similar year
                                r_year = str(r.get("release_date") or "")[:4]
                                r_type = r.get("subject_type")
                                if (not rel_date or not r_year or abs(int(rel_date or 0) - int(r_year or 0)) <= 1) and \
                                   (not subject_type or not r_type or subject_type == r_type):
                                    parent_id = r_sid
                                    app_cache.set(f"dub_parent:{main_id}", parent_id, ttl=7200)
                                    break
                    except Exception:
                        pass
            if parent_id and parent_id != subject_id:
                try:
                    p_details = self.get_details(parent_id)
                    dubs = p_details.get("dubs", [])
                    original_subject_id = parent_id  # The parent is the original
                    # Cache this child → parent link
                    app_cache.set(f"dub_parent:{main_id}", parent_id, ttl=7200)
                except Exception:
                    pass

        # Extract director and cast from staffList
        staff_list = data.get("staffList") or []
        directors = []
        actors = []
        for staff in staff_list:
            if not isinstance(staff, dict):
                continue
            staff_type = staff.get("staffType")
            name = staff.get("name") or staff.get("staffName") or ""
            if name:
                if staff_type == 2:
                    directors.append(name)
                elif staff_type == 1:
                    actors.append(name)

        # Trailer or preview video URL
        trailer_url = None
        trailer_obj = data.get("trailer")
        if isinstance(trailer_obj, dict):
            va = trailer_obj.get("VideoAddress")
            if isinstance(va, dict) and va.get("url"):
                trailer_url = va.get("url")
        if not trailer_url:
            pre_video = data.get("preVideoAddress")
            if isinstance(pre_video, list):
                for pv in reversed(pre_video):
                    if isinstance(pv, dict) and pv.get("url"):
                        trailer_url = pv.get("url")
                        break

        # Check coming_soon (based on future release date)
        coming_soon = False
        release_date = data.get("releaseDate") or ""
        if release_date:
            try:
                rd = date.fromisoformat(release_date[:10])
                if rd > date.today():
                    coming_soon = True
            except Exception:
                pass

        subs_avail = data.get("subtitles") or ""
        if subs_avail:
            app_cache.set(f"subtitles_available:{main_id}", subs_avail, ttl=7200)
        elif dubs:
            for d in dubs:
                dub_sid = str(d.get("subject_id") or "")
                if dub_sid and dub_sid != main_id:
                    cached_sub = app_cache.get(f"subtitles_available:{dub_sid}")
                    if cached_sub:
                        subs_avail = cached_sub
                        break

        res = {
            "subject_id": main_id,
            "original_subject_id": original_subject_id,
            "title": data.get("title"),
            "subject_type": data.get("subjectType"),
            "type": classify_content_type(data.get("subjectType"), data.get("title"), data.get("type")),
            "description": data.get("description"),
            "release_date": release_date,
            "coming_soon": coming_soon,
            "duration": data.get("duration"),
            "duration_seconds": data.get("durationSeconds"),
            "imdb_rating": data.get("imdbRatingValue"),
            "content_rating": data.get("contentRating"),
            "viewers": data.get("viewers"),
            "genre": data.get("genre"),
            "country": data.get("countryName"),
            "language": data.get("language"),
            "subtitles_available": subs_avail or data.get("subtitles"),
            "cover": data.get("cover", {}).get("url") if isinstance(data.get("cover"), dict) else None,
            "backdrop": data.get("stills", {}).get("url") if isinstance(data.get("stills"), dict) else None,
            "director": ", ".join(directors) if directors else None,
            "cast": ", ".join(actors[:6]) if actors else None,
            "trailer_url": trailer_url,
            "detail_path": detail_path,
            "dubs": dubs,
            "seasons": self.get_episodes(main_id) if data.get("subjectType") != 1 else []
        }
        app_cache.set(cache_key, res, ttl=1800)
        return res

    def get_episodes(self, subject_id: str) -> List[Dict[str, Any]]:
        cache_key = f"episodes:{subject_id}"
        cached = app_cache.get(cache_key)
        if cached is not None:
            return cached
        url = f"/wefeed-mobile-bff/subject-api/season-info?subjectId={subject_id}"
        res = self.api_request("GET", url)
        seasons = res.get("data", {}).get("seasons", [])
        season_list = []
        for s in seasons:
            se_num = int(s.get("se") or 1)
            max_ep = int(s.get("maxEp") or 1)
            ep_list = [
                {
                    "season": se_num,
                    "season_number": se_num,
                    "episode": ep_num,
                    "title": f"Episode {ep_num}"
                }
                for ep_num in range(1, max_ep + 1)
            ]
            season_list.append({
                "season": se_num,
                "season_number": se_num,
                "episode_count": max_ep,
                "episodes": ep_list,
                "resolutions": s.get("resolutions", [])
            })
        app_cache.set(cache_key, season_list, ttl=1800)
        return season_list

    def get_streams(self, subject_id: str, season: int = 0, episode: int = 0, detail_path: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_key = f"streams:{subject_id}:{season}:{episode}"
        cached = app_cache.get(cache_key)
        if cached is not None:
            return cached

        streams: List[Dict[str, Any]] = []
        seen_urls = set()

        # Step 1: Query Mobile Native CDN first (ultra-fast, ~250-400ms)
        try:
            native_url = f"/wefeed-mobile-bff/subject-api/play-info?subjectId={subject_id}&se={season}&ep={episode}"
            native_data = self.api_request("GET", native_url).get("data", {})
            for st in native_data.get("streams", []):
                raw_url = st.get("url") or ""
                if not raw_url:
                    continue
                # Block known interstitial warning / update notice clips
                if any(m in raw_url for m in ["b164fbfb4347792950bdfbfb563d39d9", "80da52722ee7de7a4303290af6783424", "/other/", "movieboxdownload"]):
                    continue
                size_bytes = int(st.get("size") or 0)
                dur = int(st.get("duration") or 0)
                if (0 < dur <= 45) or (0 < size_bytes <= 3 * 1024 * 1024):
                    continue

                cookie = st.get("signCookie")
                policy_url = extract_policy_resource(cookie) if cookie else None
                final_url = policy_url or raw_url
                if final_url in seen_urls:
                    continue
                seen_urls.add(final_url)
                res_str = str(st.get("resolutions", ""))
                quality_val = 0
                for q in (2160, 1440, 1080, 720, 480, 360, 240):
                    if str(q) in res_str:
                        quality_val = q
                        break
                size_mb = size_bytes / (1024 * 1024) if size_bytes else 0
                is_dash = bool(policy_url or ".mpd" in final_url)
                streams.append({
                    "source": "Mobile Native CDN",
                    "format": "DASH" if is_dash else st.get("format", "MP4"),
                    "quality": f"{quality_val}p" if quality_val else (res_str or "1080p"),
                    "quality_value": quality_val or (1080 if is_dash else 720),
                    "resolution_tag": res_str or "1080p",
                    "url": final_url,
                    "size_mb": round(size_mb, 1),
                    "codec": st.get("codecName") or "h264/aac",
                    "duration_sec": dur,
                    "headers": {
                        "User-Agent": MODERN_USER_AGENT,
                        "Referer": "https://api3.aoneroom.com/",
                    }
                })
        except Exception:
            pass

        # Step 2: If native didn't provide genuine 1080p full movie or <2 streams, supplement with Web CDNs in parallel
        has_real_1080 = any(s.get("quality_value", 0) >= 1080 and (s.get("size_mb", 0) > 20 or s.get("format") == "DASH") for s in streams)
        if len(streams) < 2 or not has_real_1080:
            if not detail_path:
                detail_path = app_cache.get(f"detail_path:{subject_id}")
            if not detail_path:
                try:
                    details = self.get_details(subject_id)
                    detail_path = details.get("detail_path", "") or ""
                    # If this subject has no detail_path (e.g. dubs), quickly inspect sibling dubs in parallel
                    if not detail_path and details.get("dubs"):
                        def _fetch_dub_path(dub):
                            dsid = str(dub.get("subject_id") or "")
                            if not dsid or dsid == subject_id:
                                return None
                            try:
                                d_det = self.get_details(dsid)
                                return d_det.get("detail_path") or None
                            except Exception:
                                return None
                        with ThreadPoolExecutor(max_workers=min(4, len(details["dubs"]))) as pool:
                            for p in pool.map(_fetch_dub_path, details["dubs"]):
                                if p:
                                    detail_path = p
                                    break
                except Exception:
                    detail_path = ""
            if detail_path:
                app_cache.set(f"detail_path:{subject_id}", detail_path, ttl=86400)
            try:
                token = self.bootstrap_token()
                def _fetch_domain(domain: str):
                    play_url = (
                        f"{domain}/wefeed-h5api-bff/subject/play?"
                        f"subjectId={subject_id}&se={season}&ep={episode}&detailPath={detail_path}&"
                        f"streamSignType=1&supportCodecs%5Bhevc%5D=1&supportCodecs%5Bh264%5D=1"
                    )
                    referer = f"{domain}/movies/{detail_path}?id={subject_id}&type=/movie/detail&detailSe=&detailEp=&lang=en"
                    headers = {
                        "User-Agent": WEB_USER_AGENT,
                        "Referer": referer,
                        "Accept": "application/json",
                        "x-client-info": '{"timezone":"Asia/Calcutta"}',
                        "x-request-lang": "en",
                        "x-source": "moviebox",
                        "Authorization": f"Bearer {token}",
                    }
                    try:
                        r = self.session.get(play_url, headers=headers, timeout=4)
                        if r.status_code == 200:
                            return domain, r.json().get("data", {})
                    except Exception:
                        pass
                    return domain, None

                # Check top 3 web domains concurrently with a short timeout
                with ThreadPoolExecutor(max_workers=3) as pool:
                    futures = [pool.submit(_fetch_domain, d) for d in WEB_DOMAINS[:3]]
                    for f in as_completed(futures):
                        try:
                            domain, data = f.result()
                            if not data:
                                continue
                            for st in data.get("streams", []):
                                url = st.get("url") or ""
                                if not url or url in seen_urls:
                                    continue
                                if any(m in url for m in ["b164fbfb4347792950bdfbfb563d39d9", "80da52722ee7de7a4303290af6783424", "/other/", "movieboxdownload"]):
                                    continue
                                size_bytes = int(st.get("size") or 0)
                                dur = int(st.get("duration") or 0)
                                if (0 < dur <= 45) or (0 < size_bytes <= 3 * 1024 * 1024):
                                    continue
                                seen_urls.add(url)
                                res_str = str(st.get("resolutions", "unknown"))
                                size_mb = size_bytes / (1024 * 1024) if size_bytes else 0
                                quality_val = 0
                                for q in (2160, 1440, 1080, 720, 480, 360, 240):
                                    if str(q) in res_str:
                                        quality_val = q
                                        break
                                streams.append({
                                    "source": f"Web CDN ({domain.split('//')[-1]})",
                                    "format": st.get("format", "MP4"),
                                    "quality": f"{quality_val}p" if quality_val else res_str,
                                    "quality_value": quality_val,
                                    "resolution_tag": res_str,
                                    "url": url,
                                    "size_mb": round(size_mb, 1),
                                    "codec": st.get("codecName") or "h264",
                                    "duration_sec": dur,
                                    "headers": {
                                        "User-Agent": "Mozilla/5.0",
                                        "Referer": f"{domain}/",
                                        "Origin": domain,
                                    }
                                })
                            for d in data.get("dash", []):
                                url = d.get("url")
                                cookie = d.get("signCookie")
                                extracted_mpd = extract_policy_resource(cookie) if cookie else None
                                final_url = extracted_mpd or url
                                if final_url and final_url not in seen_urls:
                                    seen_urls.add(final_url)
                                    res_tag = str(d.get("resolutions", "adaptive"))
                                    streams.append({
                                        "source": f"Web DASH ({domain.split('//')[-1]})",
                                        "format": "DASH",
                                        "quality": "1080p (Adaptive)" if "1080" in res_tag else "Adaptive",
                                        "quality_value": 1080 if "1080" in res_tag else 999,
                                        "resolution_tag": res_tag,
                                        "url": final_url,
                                        "size_mb": 0,
                                        "codec": "hevc/h264",
                                        "duration_sec": None,
                                        "cookie": cookie,
                                        "headers": {
                                            "User-Agent": "Mozilla/5.0",
                                            "Referer": f"{domain}/",
                                            "Origin": domain,
                                        }
                                    })
                        except Exception:
                            pass
            except Exception:
                pass

        # Sort priority:
        # 1. Prefer MP4 streams (directly playable in HTML5 video) over raw DASH manifests
        # 2. Quality value (e.g. 1080 > 720 > 480)
        # 3. Prefer genuine MP4 full-length sizes over zero/unknown sizes
        streams.sort(key=lambda s: (
            1 if s.get("format") == "MP4" else 0,
            s.get("quality_value", 0),
            s.get("size_mb", 0)
        ), reverse=True)
        if streams:
            app_cache.set(cache_key, streams, ttl=180)
        return streams

    def get_curated_feed(self) -> Dict[str, List[Dict[str, Any]]]:
        cache_key = "feed:home_curated"
        cached = app_cache.get(cache_key)
        if cached is not None:
            return cached

        feed: Dict[str, List[Dict[str, Any]]] = {
            "trending": [],
            "cinema": [],
            "hollywood": [],
            "bollywood": [],
            "south_indian": [],
            "series": [],
            "anime": [],
            "anime_movies": [],
            "anime_series": [],
            "anime_classic": [],
            "cartoons": [],
            "asian_drama": []
        }

        # Indian films that share names with anime – must NOT go into anime shelves
        _INDIAN_FILMS_BLOCKLIST = {"akira", "brahmastra", "baahubali", "rrr"}

        # Titles that belong in anime_classic (landmark/older anime)
        _ANIME_CLASSIC_TITLES = {
            "akira", "ghost in the shell", "nausicaa", "nausicaä", "castle in the sky",
            "grave of the fireflies", "dragon ball z", "sailor moon", "evangelion",
            "neon genesis evangelion", "cowboy bebop", "trigun", "ruroni kenshin",
            "rurouni kenshin", "inuyasha", "yu yu hakusho", "fullmetal alchemist",
            "code geass", "death note", "fma"
        }

        # Western cartoon keywords – these go in cartoons shelf, NOT anime
        _CARTOON_SHOW_TITLES = {
            "tom and jerry", "looney tunes", "mickey mouse", "donald duck",
            "scooby-doo", "scooby doo", "spongebob", "simpsons", "family guy",
            "south park", "futurama", "american dad", "king of the hill",
            "adventure time", "regular show", "gravity falls", "phineas and ferb",
            "teen titans", "justice league", "batman animated", "x-men", "spider-man",
            "avengers assemble", "ben 10", "dexter's laboratory", "powerpuff girls",
            "ed edd n eddy", "courage the cowardly dog", "johnny bravo",
            "ducktales", "chip and dale", "winnie the pooh", "peppa pig",
            "paw patrol", "bluey"
        }

        # Helper: strip language/dub tags to get canonical base title for dedup
        _LANG_STRIP_RE = re.compile(r'\s*[\[\(]\s*(hindi|english|tamil|telugu|korean|japanese|dubbed?|sub|dual audio|multi audio|original)[\]\)]\s*', re.IGNORECASE)
        def _base_title(t):
            return _LANG_STRIP_RE.sub('', re.sub(r'\[.*?\]|\(.*?\)', '', t or '')).strip().lower()

        # Cross-section dedup: track base titles seen globally to avoid showing same content twice
        _global_seen_ids: set = set()
        _global_seen_base: dict = {}  # base_title -> subject_id of first occurrence

        # Attempt 1: Fetch operating list from primary domain
        operating_lists = []
        for domain_host in ["movieboxhd.net", "movieboxonline.net", "sflix.film"]:
            try:
                url = f"{API_BASE}/home?host={domain_host}"
                resp = self.session.get(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": f"https://{domain_host}/"}, timeout=8)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    op_list = data.get("operatingList", [])
                    if op_list:
                        operating_lists = op_list
                        break
            except Exception:
                continue

        for op in operating_lists:
            title = (op.get("title") or "").lower()
            subs = op.get("subjects") or []
            target_key = None
            if "trending now" in title or ("trending" in title and "punjabi" not in title) or "popular" in title:
                target_key = "trending"
            elif "cinema" in title or "theater" in title:
                target_key = "cinema"
            elif "hollywood" in title or "western movies" in title:
                target_key = "hollywood"
            elif "bollywood" in title or "hindi" in title or "punjabi" in title:
                target_key = "bollywood"
            elif "south indian" in title or "tamil" in title or "telugu" in title:
                target_key = "south_indian"
            elif "top series" in title or "western tv" in title or "tv series" in title:
                target_key = "series"
            elif "anime" in title or "animation" in title:
                target_key = "anime"
            elif "asian drama" in title or "indian drama" in title or "turkish drama" in title or "k-drama" in title:
                target_key = "asian_drama"

            if target_key:
                for s in subs:
                    if s.get("subjectType") == 6 or is_adult_content(s):
                        continue
                    stype = s.get("subjectType")
                    if target_key in ["series", "asian_drama"] and stype == 1:
                        continue
                    if target_key in ["cinema", "hollywood"] and stype == 2:
                        continue
                    cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                    raw_title = s.get("title") or ""
                    item = {
                        "title": raw_title,
                        "subject_id": str(s.get("subjectId")),
                        "subject_type": stype,
                        "detail_path": s.get("detailPath"),
                        "cover": cover_url,
                        "rating": s.get("imdbRatingValue") or "N/A",
                        "genre": s.get("genre"),
                        "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                        "type": classify_content_type(stype, raw_title)
                    }
                    sid = item["subject_id"]
                    base = _base_title(raw_title)
                    year_tag = item["year"]

                    # Per-shelf dedup: skip if same subject_id OR same base title+year already in shelf
                    is_shelf_dup = any(
                        (x["subject_id"] == sid) or
                        (_base_title(x.get("title") or "") == base and x.get("year") == year_tag)
                        for x in feed[target_key]
                    )
                    # Language-variant dedup: skip Hindi/English dubs if original already in shelf
                    is_lang_dup = base in _global_seen_base and _global_seen_base[base] != sid and target_key in ["trending", "cinema", "hollywood"]

                    if not is_shelf_dup and not is_lang_dup:
                        feed[target_key].append(item)
                        if sid not in _global_seen_ids:
                            _global_seen_ids.add(sid)
                            _global_seen_base[base] = sid
                        # Also populate anime sub-shelves
                        if target_key == "anime":
                            # Skip Indian films that share anime names
                            if any(ib in base for ib in _INDIAN_FILMS_BLOCKLIST if len(ib) > 4):
                                feed[target_key].pop()  # remove what was just added
                                continue
                            genre_low = (item.get("genre") or "").lower()
                            title_low = base
                            # Check if this is a western cartoon
                            is_cartoon = any(ct in title_low for ct in _CARTOON_SHOW_TITLES)
                            # Check if classic anime
                            is_classic = any(cl in title_low for cl in _ANIME_CLASSIC_TITLES)
                            if is_cartoon:
                                if not any(x["subject_id"] == sid for x in feed["cartoons"]):
                                    feed["cartoons"].append(item)
                            elif is_classic:
                                if not any(x["subject_id"] == sid for x in feed["anime_classic"]):
                                    feed["anime_classic"].append(item)
                                if not any(x["subject_id"] == sid for x in feed["anime_movies"]):
                                    feed["anime_movies"].append(item)
                            elif stype == 2 or "series" in genre_low or "show" in genre_low:
                                if not any(x["subject_id"] == sid for x in feed["anime_series"]):
                                    feed["anime_series"].append(item)
                            else:
                                if not any(x["subject_id"] == sid for x in feed["anime_movies"]):
                                    feed["anime_movies"].append(item)

        # Fallback backfill for movie shelves (trending, cinema, hollywood)
        if any(len(feed[k]) < 8 for k in ["trending", "cinema", "hollywood"]):
            try:
                filter_url = f"{API_BASE}/subject/filter"
                payload = {
                    "tabId": 2,
                    "filter": {"sort": "RECOMMEND", "genre": "ALL", "country": "ALL", "year": "ALL", "language": "ALL"},
                    "page": 1,
                    "perPage": 36
                }
                f_resp = self.session.post(filter_url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=10)
                if f_resp.status_code == 200:
                    raw_items = f_resp.json().get("data", {}).get("items") or []
                    for s in raw_items:
                        if s.get("subjectType") == 6 or is_adult_content(s):
                            continue
                        cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                        raw_title = s.get("title") or ""
                        item = {
                            "title": raw_title,
                            "subject_id": str(s.get("subjectId")),
                            "subject_type": s.get("subjectType"),
                            "detail_path": s.get("detailPath"),
                            "cover": cover_url,
                            "rating": s.get("imdbRatingValue") or "N/A",
                            "genre": s.get("genre"),
                            "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                            "type": classify_content_type(s.get("subjectType"), raw_title)
                        }
                        sid = item["subject_id"]
                        base = _base_title(raw_title)
                        for k in ["trending", "cinema", "hollywood"]:
                            # Only add if not already in that shelf AND not a language dup of existing item
                            already_in = any(x["subject_id"] == sid or _base_title(x.get("title") or "") == base for x in feed[k])
                            if len(feed[k]) < 12 and not already_in:
                                feed[k].append(item)
            except Exception:
                pass

        # Parallel backfill for sparse shelves using ThreadPoolExecutor
        sparse_tasks = []
        if len(feed["bollywood"]) < 6:
            for kw in ["Kalki", "Jawan", "Animal", "Fighter", "Stree 2"]:
                sparse_tasks.append(("bollywood", kw))
        if len(feed["south_indian"]) < 6:
            for kw in ["Pushpa", "Salaar", "Devara", "Leo", "KGF"]:
                sparse_tasks.append(("south_indian", kw))
        if len(feed["series"]) < 10:
            for kw in ["Stranger Things", "Game of Thrones", "Breaking Bad", "The Boys", "Peaky Blinders", "Succession", "The Last of Us", "Severance", "House of the Dragon", "Fallout"]:
                sparse_tasks.append(("series", kw))
        if len(feed["asian_drama"]) < 6:
            for kw in ["Queen of Tears", "Squid Game", "Crash Landing on You", "All of Us Are Dead"]:
                sparse_tasks.append(("asian_drama", kw))
        if len(feed["anime"]) < 20:
            for kw in ["Attack on Titan", "Demon Slayer", "Jujutsu Kaisen", "One Piece", "Naruto", "Dragon Ball", "Bleach", "My Hero Academia", "Chainsaw Man", "Solo Leveling", "Vinland Saga", "Black Clover", "Spy x Family", "Hunter x Hunter", "Fullmetal Alchemist"]:
                sparse_tasks.append(("anime", kw))
        # Always backfill anime_movies since upstream anime list only returns TV series
        if len(feed["anime_movies"]) < 10:
            for kw in ["Spirited Away", "Your Name", "Princess Mononoke", "Howl's Moving Castle", "My Neighbor Totoro", "The Boy and the Heron", "Ghost in the Shell", "Weathering With You", "Nausicaa of the Valley"]:
                sparse_tasks.append(("anime_movies", kw))
        # Backfill anime_classic with landmark anime titles
        if len(feed["anime_classic"]) < 8:
            for kw in ["Akira 1988", "Ghost in the Shell 1995", "Grave of the Fireflies", "Cowboy Bebop", "Neon Genesis Evangelion", "Dragon Ball Z", "Sailor Moon", "Fullmetal Alchemist Brotherhood", "Death Note", "Code Geass"]:
                sparse_tasks.append(("anime_classic", kw))
        # Backfill cartoons shelf
        if len(feed["cartoons"]) < 8:
            for kw in ["Tom and Jerry", "Looney Tunes", "Scooby-Doo", "The Simpsons", "SpongeBob SquarePants", "Adventure Time", "Gravity Falls", "Teen Titans", "Spider-Man Animated", "Batman The Animated Series"]:
                sparse_tasks.append(("cartoons", kw))

        if sparse_tasks:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            def _fetch_kw(category, kw):
                try:
                    return category, self.search(kw, per_page=2)
                except Exception:
                    return category, []

            with ThreadPoolExecutor(max_workers=8) as executor:
                futures = [executor.submit(_fetch_kw, cat, kw) for cat, kw in sparse_tasks]
                for fut in as_completed(futures):
                    try:
                        cat, items = fut.result()
                        for it in items:
                            sid = it.get("subject_id")
                            if not sid:
                                continue
                            base = _base_title(it.get("title") or "")
                            already_in = any(_base_title(x.get("title") or "") == base or x["subject_id"] == sid for x in feed[cat])
                            if not already_in and len(feed[cat]) < 15:
                                feed[cat].append(it)
                                # Backfill anime sub-shelves too
                                if cat == "anime":
                                    stype = it.get("subject_type")
                                    item_type = it.get("type", "")
                                    title_low_it = _base_title(it.get("title") or "")
                                    is_cartoon_it = any(ct in title_low_it for ct in _CARTOON_SHOW_TITLES)
                                    is_classic_it = any(cl in title_low_it for cl in _ANIME_CLASSIC_TITLES)
                                    is_anime_series = stype == 2 or item_type == "TV Series"
                                    if is_cartoon_it:
                                        if not any(x["subject_id"] == sid for x in feed["cartoons"]):
                                            feed["cartoons"].append(it)
                                    elif is_classic_it:
                                        if not any(x["subject_id"] == sid for x in feed["anime_classic"]):
                                            feed["anime_classic"].append(it)
                                        if not any(x["subject_id"] == sid for x in feed["anime_movies"]):
                                            feed["anime_movies"].append(it)
                                    elif is_anime_series:
                                        if not any(x["subject_id"] == sid for x in feed["anime_series"]):
                                            feed["anime_series"].append(it)
                                    else:
                                        if not any(x["subject_id"] == sid for x in feed["anime_movies"]):
                                            feed["anime_movies"].append(it)
                                # Direct anime_movies backfill tasks
                                elif cat == "anime_movies":
                                    if not any(x["subject_id"] == sid for x in feed["anime_movies"]):
                                        feed["anime_movies"].append(it)
                                        if not any(x["subject_id"] == sid for x in feed["anime"]):
                                            feed["anime"].append(it)
                                # anime_classic backfill
                                elif cat == "anime_classic":
                                    if not any(x["subject_id"] == sid for x in feed["anime_classic"]):
                                        feed["anime_classic"].append(it)
                                    if not any(x["subject_id"] == sid for x in feed["anime"]):
                                        feed["anime"].append(it)
                                # cartoons backfill
                                elif cat == "cartoons":
                                    if not any(x["subject_id"] == sid for x in feed["cartoons"]):
                                        feed["cartoons"].append(it)
                    except Exception:
                        pass

        # Derive rich genre and highlight shelves for complete site catalog
        all_collected = []
        seen_all = set()
        for k in ["trending", "cinema", "hollywood", "series", "bollywood", "south_indian", "asian_drama", "anime"]:
            for it in feed.get(k, []):
                if it["subject_id"] not in seen_all:
                    seen_all.add(it["subject_id"])
                    all_collected.append(it)

        def _parse_rating(val):
            try:
                return float(val)
            except Exception:
                return 0.0

        top_rated_sorted = sorted([x for x in all_collected if _parse_rating(x.get("rating")) >= 6.5], key=lambda x: _parse_rating(x.get("rating")), reverse=True)
        feed["top_rated"] = top_rated_sorted[:24]
        feed["new_releases"] = [x for x in all_collected if str(x.get("year", "")) in ("2026", "2025")][:24]
        # Genre shelves: deduplicate across genre sections so each title appears in only one genre shelf
        seen_genre = set()
        action_items, scifi_items, comedy_items, horror_items = [], [], [], []
        for x in all_collected:
            g = (x.get("genre") or "").lower()
            sid = x["subject_id"]
            if sid in seen_genre:
                continue
            if any(gk in g for gk in ["action", "thriller", "adventure"]):
                action_items.append(x); seen_genre.add(sid)
            elif any(gk in g for gk in ["sci-fi", "fantasy", "supernatural"]):
                scifi_items.append(x); seen_genre.add(sid)
            elif any(gk in g for gk in ["comedy", "romance", "family"]):
                comedy_items.append(x); seen_genre.add(sid)
            elif any(gk in g for gk in ["horror", "mystery", "crime"]):
                horror_items.append(x); seen_genre.add(sid)
        feed["action"] = action_items[:24]
        feed["scifi"] = scifi_items[:24]
        feed["comedy"] = comedy_items[:24]
        feed["horror"] = horror_items[:24]

        total_items = sum(len(v) for v in feed.values())
        if total_items >= 20:
            app_cache.set(cache_key, feed, ttl=14400)  # 4-hour cache prevents slow reload stalls
        return feed


    def get_subtitles(self, subject_id: str, stream_id: Optional[str] = None, season: int = 0, episode: int = 0) -> List[Dict[str, Any]]:
        cache_key = f"subs:{subject_id}:{season}:{episode}"
        cached = app_cache.get(cache_key)
        if cached is not None and not stream_id:
            return cached

        subs: List[Dict[str, Any]] = []
        seen_urls = set()

        if not stream_id:
            try:
                native_url = f"/wefeed-mobile-bff/subject-api/play-info?subjectId={subject_id}&se={season}&ep={episode}"
                raw_streams = self.api_request("GET", native_url).get("data", {}).get("streams", [])
                if raw_streams and raw_streams[0].get("id"):
                    stream_id = str(raw_streams[0]["id"])
            except Exception:
                pass

        def _add_sub(item: Dict[str, Any]):
            u = item.get("url")
            if u and u not in seen_urls:
                seen_urls.add(u)
                subs.append({
                    "id": str(item.get("id", "")),
                    "language": item.get("lanName") or item.get("language") or "English",
                    "code": item.get("lan", ""),
                    "url": u,
                    "size": item.get("size")
                })

        if stream_id:
            try:
                url = f"/wefeed-mobile-bff/subject-api/get-stream-captions?subjectId={subject_id}&streamId={stream_id}"
                data = self.api_request("GET", url).get("data", {})
                captions = data if isinstance(data, list) else data.get("extCaptions") or data.get("captions") or []
                for s in captions:
                    if isinstance(s, dict):
                        _add_sub(s)
            except Exception:
                pass

        try:
            res_id = stream_id or "0"
            url = f"/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId={subject_id}&resourceId={res_id}&episode={episode}"
            data = self.api_request("GET", url).get("data", {})
            ext = data if isinstance(data, list) else data.get("extCaptions") or data.get("captions") or []
            for s in ext:
                if isinstance(s, dict):
                    _add_sub(s)
        except Exception:
            pass

        # Sibling Dub Fallback: If no subtitles were found for this subject, check sibling dubs
        if not subs:
            try:
                details = self.get_details(subject_id)
                dubs = details.get("dubs", [])
                for d in dubs:
                    dub_sid = str(d.get("subject_id") or "")
                    if not dub_sid or dub_sid == subject_id:
                        continue
                    try:
                        s_native_url = f"/wefeed-mobile-bff/subject-api/play-info?subjectId={dub_sid}&se={season}&ep={episode}"
                        s_raw = self.api_request("GET", s_native_url).get("data", {}).get("streams", [])
                        if s_raw and s_raw[0].get("id"):
                            s_stream_id = str(s_raw[0]["id"])
                            s_cap_url = f"/wefeed-mobile-bff/subject-api/get-stream-captions?subjectId={dub_sid}&streamId={s_stream_id}"
                            s_data = self.api_request("GET", s_cap_url).get("data", {})
                            s_caps = s_data if isinstance(s_data, list) else s_data.get("extCaptions") or s_data.get("captions") or []
                            for sc in s_caps:
                                if isinstance(sc, dict):
                                    _add_sub(sc)
                    except Exception:
                        pass
                    if subs:
                        break
            except Exception:
                pass

        if subs:
            app_cache.set(cache_key, subs, ttl=1800)
        return subs

engine = MovieBoxEngine.get_instance()

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>MovieBox 1080p Engine Active</h1><p>Visit <a href='/docs'>/docs</a> for Swagger documentation.</p>")

_STREAM_PROXY_CLIENT: Optional[httpx.AsyncClient] = None

def get_stream_proxy_client() -> httpx.AsyncClient:
    global _STREAM_PROXY_CLIENT
    if _STREAM_PROXY_CLIENT is None or _STREAM_PROXY_CLIENT.is_closed:
        timeout = httpx.Timeout(connect=8.0, read=None, write=30.0, pool=30.0)
        limits = httpx.Limits(max_keepalive_connections=200, max_connections=500, keepalive_expiry=120.0)
        _STREAM_PROXY_CLIENT = httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True)
    return _STREAM_PROXY_CLIENT

_WORKING_REFERERS: Dict[str, str] = {
    "bcdnxw.hakunaymatata.com": "https://movieboxonline.net/",
    "hakunaymatata.com": "https://movieboxonline.net/"
}

# Cache of direct-accessible CDN URLs (tested in last 5 min)
_direct_url_cache = SimpleCache(maxsize=1000, default_ttl=300)

@app.get("/api/resolve-stream")
async def resolve_stream_url(url: str = Query(...), referer: Optional[str] = None):
    """
    Resolve a stream URL to its final CDN URL and return it so the browser
    can fetch directly (bypassing the VPS bandwidth bottleneck).
    Also tests if the URL is directly accessible from this server.
    Returns: {direct_url, headers_needed, can_direct_access}
    """
    url_domain = urlparse(url).netloc

    # Check cache (5 min TTL)
    cached = _direct_url_cache.get(url)
    if cached:
        return {"direct_url": cached, "referer": referer or _WORKING_REFERERS.get(url_domain, ""), "ok": True}

    best_ref = referer or _WORKING_REFERERS.get(url_domain) or "https://movieboxonline.net/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": best_ref,
    }

    try:
        client = get_stream_proxy_client()
        # HEAD request to resolve final URL (follows redirects) and check accessibility
        req = client.build_request("HEAD", url, headers=headers)
        r = await client.send(req, stream=False)
        final_url = str(r.url)  # After redirect resolution
        await r.aclose() if hasattr(r, 'aclose') else None
        _direct_url_cache.set(url, final_url, ttl=300)
        return {"direct_url": final_url, "referer": best_ref, "ok": r.status_code < 400}
    except Exception as e:
        return {"direct_url": url, "referer": best_ref, "ok": False, "error": str(e)}

@app.api_route("/api/proxy/stream", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_stream(request: Request, url: str = Query(...), referer: Optional[str] = None, download: bool = False, filename: Optional[str] = None, subject_id: Optional[str] = None):
    if request.method == "OPTIONS":
        return Response(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400"
        })

    url_domain = urlparse(url).netloc

    # Smart candidate referers to prevent 429 rate-limiting from hakunaymatata CDN
    candidate_refs = []
    # Prioritize previously successful referer for this domain
    if url_domain in _WORKING_REFERERS and _WORKING_REFERERS[url_domain] not in candidate_refs:
        candidate_refs.append(_WORKING_REFERERS[url_domain])

    if referer and "aoneroom.com" not in referer and referer not in candidate_refs:
        candidate_refs.append(referer)

    if "hakunaymatata.com" in url or "hakunaymatata.com" in url_domain:
        candidate_refs.extend(["https://movieboxonline.net/", "https://123moviesfree.club/", "https://movie-box.co/", "https://moviebox.ph/"])
    else:
        candidate_refs.extend(["https://movieboxonline.net/", "https://movie-box.co/", "https://api3.aoneroom.com/"])

    seen_refs = set()
    unique_refs = []
    for cr in candidate_refs:
        if cr not in seen_refs:
            seen_refs.add(cr)
            unique_refs.append(cr)

    range_header = request.headers.get("range")
    client = get_stream_proxy_client()
    resp = None

    for ref in unique_refs:
        origin = ref.rstrip("/")
        if "://" in origin:
            parts = origin.split("://", 1)
            origin = f"{parts[0]}://{parts[1].split('/', 1)[0]}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": ref,
            "Origin": origin,
        }
        if range_header:
            headers["Range"] = range_header
        try:
            req_method = "HEAD" if request.method == "HEAD" else "GET"
            req = client.build_request(req_method, url, headers=headers)
            r = await client.send(req, stream=True)
            if r.status_code not in (429, 403):
                resp = r
                _WORKING_REFERERS[url_domain] = ref
                break
            else:
                await r.aclose()
        except Exception:
            continue

    if resp is None or resp.status_code in (429, 403):
        if subject_id:
            app_cache.delete_prefix(f"streams:{subject_id}:")
        err_msg = "Upstream CDN rate limit (429). Fresh URLs loaded — please try again." if (resp and resp.status_code == 429) else "Upstream CDN blocked request (403)."
        raise HTTPException(status_code=resp.status_code if resp else 502, detail=err_msg)

    response_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, Content-Type",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
    }
    for h in ["content-range", "content-length", "content-type", "accept-ranges", "etag", "last-modified"]:
        if h in resp.headers:
            response_headers[h] = resp.headers[h]
    if "accept-ranges" not in response_headers:
        response_headers["accept-ranges"] = "bytes"
    if "content-type" not in response_headers:
        response_headers["content-type"] = "video/mp4"

    # Ensure clean, human-readable filename for downloads & browser saves
    raw_fn = filename or (re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', subject_id or "Movie").strip())
    safe_fn = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', raw_fn).strip()
    if not safe_fn.lower().endswith(".mp4"):
        safe_fn += ".mp4"
    from urllib.parse import quote
    encoded_fn = quote(safe_fn)

    if download:
        response_headers["Content-Disposition"] = f'attachment; filename="{safe_fn}"; filename*=UTF-8\'\'{encoded_fn}'
    else:
        # Crucial: explicit inline disposition prevents playback stalls while providing clean filename on save
        response_headers["Content-Disposition"] = f'inline; filename="{safe_fn}"; filename*=UTF-8\'\'{encoded_fn}'

    if request.method == "HEAD":
        await resp.aclose()
        return Response(status_code=resp.status_code, headers=response_headers)

    async def content_iterator():
        try:
            # Yield fast 64KB slices immediately so player parses MP4 moov/ftyp header instantly without buffering
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        except Exception:
            pass
        finally:
            try:
                await resp.aclose()
            except Exception:
                pass

    return StreamingResponse(content_iterator(), status_code=resp.status_code, headers=response_headers)

def clean_to_webvtt(content: str) -> str:
    content = content.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")
    if content.strip().startswith("WEBVTT"):
        return content.strip() + "\n"
    def _fix_ts(m):
        hhmmss = m.group(1)
        ms = m.group(2).ljust(3, '0')[:3]
        return f"{hhmmss}.{ms}"
    converted = re.sub(r"(\d{1,2}:\d{2}:\d{2}),(\d{1,3})", _fix_ts, content)
    return "WEBVTT\n\n" + converted.strip() + "\n"

@app.get("/api/proxy/caption")
async def proxy_caption(url: str = Query(...), referer: Optional[str] = None):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": referer or "https://123moviesfree.club/",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Failed to fetch subtitle")
            content = r.text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch subtitle: {str(e)}")

    content = clean_to_webvtt(content)
    return Response(content=content, media_type="text/vtt; charset=utf-8", headers={"Access-Control-Allow-Origin": "*"})

@app.get("/api/proxy/online-caption")
async def proxy_online_caption(url: str = Query(...)):
    headers = {"User-Agent": "TemporaryUserAgent"}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Failed to fetch online subtitle")
            raw_bytes = r.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch online subtitle: {str(e)}")

    import gzip
    try:
        content = gzip.decompress(raw_bytes).decode("utf-8", errors="replace")
    except Exception:
        try:
            content = raw_bytes.decode("utf-8", errors="replace")
        except Exception:
            content = raw_bytes.decode("latin-1", errors="replace")

    content = clean_to_webvtt(content)
    return Response(content=content, media_type="text/vtt; charset=utf-8", headers={"Access-Control-Allow-Origin": "*"})

@app.get("/search")
def search(q: str = Query(..., min_length=1), page: int = 1, per_page: int = 20):
    if is_adult_query(q):
        return {"query": q, "page": page, "results": []}
    safe_per_page = min(max(1, int(per_page or 20)), 20)
    try:
        results = engine.search(q, page=page, per_page=safe_per_page)
        return {"query": q, "page": page, "results": results}
    except Exception:
        return {"query": q, "page": page, "results": []}

@app.get("/search/suggest")
def search_suggest(q: str = Query(..., min_length=1)):
    if is_adult_query(q):
        return {"suggestions": []}
    # Return real subject search matches with genuine posters, types, and valid subject IDs
    real_results = engine.search(q, per_page=8)
    suggestions = []
    seen_ids = set()
    for item in real_results:
        if is_adult_content(item):
            continue
        sid = str(item.get("subject_id") or "")
        if sid and sid != "None" and sid not in seen_ids:
            seen_ids.add(sid)
            suggestions.append({
                "title": item.get("title"),
                "slug": item.get("detail_path"),
                "subject_id": sid,
                "cover": item.get("cover"),
                "type": item.get("type", "Movie"),
                "coming_soon": bool(item.get("coming_soon")),
                "rating": item.get("imdb_rating") or item.get("rating"),
                "year": str(item.get("release_date") or "")[:4]
            })
    return {"suggestions": suggestions}

def _format_runtime(dur_val: Any) -> Optional[str]:
    if not dur_val:
        return None
    try:
        val = int(dur_val)
        mins = round(val / 60) if val > 500 else val
        h = mins // 60
        m = mins % 60
        return f"{h}h {m}m" if h > 0 else f"{m}m"
    except Exception:
        s = str(dur_val).strip()
        return s if ("h" in s or "m" in s) else None

@app.get("/detail/{subject_id}")
@app.get("/api/detail/{subject_id}")
def get_detail(subject_id: str):
    if not subject_id or subject_id == "None":
        raise HTTPException(status_code=400, detail="Invalid subject ID")
    res = engine.get_details(subject_id)
    if not res or not res.get("title") or is_adult_content(res):
        raise HTTPException(status_code=404, detail="Title not found")
    
    # Ensure duration is formatted cleanly for both web and mobile
    dur_raw = res.get("duration") or res.get("duration_seconds")
    formatted_dur = _format_runtime(dur_raw)
    if formatted_dur:
        res["duration_formatted"] = formatted_dur
        # If duration was numeric or missing standard format, provide readable string
        if not isinstance(res.get("duration"), str) or not ("h" in res.get("duration", "") or "m" in res.get("duration", "")):
            res["duration"] = formatted_dur

    # Mark pre-release titles as "Coming Soon" based on release date only
    release_date = res.get("release_date") or ""
    coming_soon = bool(res.get("coming_soon"))
    if coming_soon and release_date:
        res["coming_soon_date"] = release_date[:10]

    # For coming-soon movies, check stream availability in background to avoid blocking.
    # First check if a previous bg probe already confirmed streams exist.
    if coming_soon and res.get("type") == "Movie":
        override = app_cache.get(f"cs_override:{subject_id}")
        if override is not None:
            coming_soon = bool(override)
        else:
            # Fire background probe; don't block the response
            def _bg_cs_check():
                try:
                    if engine.get_streams(subject_id, season=0, episode=0):
                        app_cache.set(f"cs_override:{subject_id}", False, ttl=1800)
                except Exception:
                    pass
            _bg_executor.submit(_bg_cs_check)

    res["coming_soon"] = coming_soon
    return res

@app.get("/episodes/{subject_id}")
def get_episodes(subject_id: str):
    if not subject_id or subject_id == "None":
        return {"subject_id": subject_id, "seasons": []}
    return {"subject_id": subject_id, "seasons": engine.get_episodes(subject_id)}

def resolve_imdb_id(title: str, year: Optional[str] = None, is_series: bool = False) -> Optional[str]:
    if not title:
        return None
    clean_title = re.sub(r'\[.*?\]|\(.*?\)', '', title).strip()
    cache_key = f"imdb_id:{clean_title}:{year or ''}:{is_series}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    # Attempt 1: Cinemeta
    cat = "series" if is_series else "movie"
    try:
        url = f"https://v3-cinemeta.strem.io/catalog/{cat}/top/search={urllib.parse.quote(clean_title)}.json"
        r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        metas = r.json().get("metas", [])
        if metas:
            if year:
                for m in metas:
                    m_year = str(m.get("year") or m.get("releaseInfo") or "")
                    if year in m_year:
                        imdb_id = m.get("imdb_id") or m.get("id")
                        if imdb_id:
                            app_cache.set(cache_key, imdb_id, ttl=86400)
                            return imdb_id
            imdb_id = metas[0].get("imdb_id") or metas[0].get("id")
            if imdb_id:
                app_cache.set(cache_key, imdb_id, ttl=86400)
                return imdb_id
    except Exception:
        pass

    # Attempt 2: Official IMDb Suggestion API (handles titles like Tulsa King, etc.)
    try:
        q_slug = re.sub(r'[^a-zA-Z0-9 ]', '', clean_title).strip().lower()
        if q_slug:
            first_letter = q_slug[0]
            imdb_url = f"https://v3.sg.media-imdb.com/suggestion/{first_letter}/{urllib.parse.quote(q_slug)}.json"
            r = httpx.get(imdb_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            data = r.json().get("d", [])
            for item in data:
                it_id = item.get("id")
                if it_id and it_id.startswith("tt"):
                    it_year = str(item.get("y", ""))
                    if year and it_year and year != it_year and len(data) > 1:
                        continue
                    app_cache.set(cache_key, it_id, ttl=86400)
                    return it_id
            if data and data[0].get("id") and data[0]["id"].startswith("tt"):
                it_id = data[0]["id"]
                app_cache.set(cache_key, it_id, ttl=86400)
                return it_id
    except Exception:
        pass

    return None

def get_backup_servers(imdb_id: str, is_series: bool = False, season: int = 0, episode: int = 0) -> List[Dict[str, str]]:
    if not imdb_id:
        return []
    
    clean_id = imdb_id.strip()

    if is_series or season > 0 or episode > 0:
        s = max(1, season)
        e = max(1, episode)
        return [
            {
                "name": "Server 2 (VidLink Pro)",
                "id": "vidlink",
                "type": "iframe",
                "url": f"https://vidlink.pro/tv/{clean_id}/{s}/{e}?primaryColor=e50914&secondaryColor=ff4d4f",
            },
            {
                "name": "Server 3 (AutoEmbed Fast)",
                "id": "autoembed",
                "type": "iframe",
                "url": f"https://autoembed.co/tv/imdb/{clean_id}-{s}-{e}",
            },
            {
                "name": "Server 4 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={clean_id}&s={s}&e={e}",
            },
            {
                "name": "Server 5 (EmbedSu Fast)",
                "id": "embedsu",
                "type": "iframe",
                "url": f"https://embed.su/embed/tv/{clean_id}/{s}/{e}",
            },
            {
                "name": "Server 6 (RiveStream Ultra)",
                "id": "rivestream",
                "type": "iframe",
                "url": f"https://rivestream.live/embed?type=serie&id={clean_id}&season={s}&episode={e}",
            },
        ]
    else:
        return [
            {
                "name": "Server 2 (VidLink Pro)",
                "id": "vidlink",
                "type": "iframe",
                "url": f"https://vidlink.pro/movie/{clean_id}?primaryColor=e50914&secondaryColor=ff4d4f",
            },
            {
                "name": "Server 3 (AutoEmbed Fast)",
                "id": "autoembed",
                "type": "iframe",
                "url": f"https://autoembed.co/movie/imdb/{clean_id}",
            },
            {
                "name": "Server 4 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={clean_id}",
            },
            {
                "name": "Server 5 (EmbedSu Fast)",
                "id": "embedsu",
                "type": "iframe",
                "url": f"https://embed.su/embed/movie/{clean_id}",
            },
            {
                "name": "Server 6 (RiveStream Ultra)",
                "id": "rivestream",
                "type": "iframe",
                "url": f"https://rivestream.live/embed?type=movie&id={clean_id}",
            },
        ]

@app.get("/api/fallback-sources")
async def get_fallback_sources(
    title: str = Query(...),
    year: Optional[str] = Query(None),
    is_series: bool = Query(False),
    season: int = Query(0),
    episode: int = Query(0),
    subject_id: Optional[str] = Query(None)
):
    loop = asyncio.get_event_loop()
    real_is_series = is_series
    real_season = season
    real_episode = episode

    if subject_id and subject_id != "None":
        try:
            details = await loop.run_in_executor(_bg_executor, lambda: engine.get_details(subject_id))
            if details:
                st = details.get("subject_type")
                if st == 1 or details.get("type") == "Movie":
                    real_is_series = False
                    real_season = 0
                    real_episode = 0
                elif st == 2 or details.get("type") in ["Series", "TV Series"]:
                    real_is_series = True
                    if real_season == 0: real_season = 1
                    if real_episode == 0: real_episode = 1
        except Exception:
            pass

    imdb_id = await loop.run_in_executor(_bg_executor, lambda: resolve_imdb_id(title, year=year, is_series=real_is_series))
    if not imdb_id:
        return {"title": title, "imdb_id": None, "servers": []}
    servers = get_backup_servers(imdb_id, is_series=real_is_series, season=real_season, episode=real_episode)
    return {
        "title": title,
        "imdb_id": imdb_id,
        "is_series": real_is_series,
        "season": real_season,
        "episode": real_episode,
        "servers": servers
    }

@app.get("/api/probe-servers")
async def probe_stream_servers(
    subject_id: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    is_series: bool = Query(False),
    season: int = Query(0),
    episode: int = Query(0)
):
    """
    Parallel server health test (3s timeout).
    Tests Direct Stream and Fallback Servers concurrently.
    Returns status for each candidate and identifies the fastest healthy server.
    """
    candidates = []
    loop = asyncio.get_event_loop()

    # 1. Candidate: Direct CineScope / MovieBox Stream
    direct_stream_url = None
    if subject_id and subject_id != "None":
        try:
            streams = await loop.run_in_executor(_bg_executor, lambda: engine.get_streams(subject_id, season=season, episode=episode))
            if streams:
                # Find best direct stream
                playable = [s for s in streams if s.get("format") != "DASH" and ".mpd" not in s.get("url", "")]
                best_direct = playable[0] if playable else streams[0]
                direct_stream_url = best_direct.get("url")
                candidates.append({
                    "id": "direct",
                    "name": "Server 1 (Direct 1080p)",
                    "type": "direct",
                    "url": direct_stream_url,
                    "stream_meta": best_direct
                })
        except Exception:
            pass

    # 2. Candidates: Fallback Servers (VidLink, AutoEmbed, MultiEmbed, EmbedSu, RiveStream)
    resolved_title = title
    if not resolved_title and subject_id:
        try:
            details = await loop.run_in_executor(_bg_executor, lambda: engine.get_details(subject_id))
            resolved_title = details.get("title")
            if not year:
                year = str(details.get("release_date") or "")[:4] or None
        except Exception:
            pass

    fallback_servers = []
    if resolved_title:
        imdb_id = await loop.run_in_executor(_bg_executor, lambda: resolve_imdb_id(resolved_title, year=year, is_series=is_series))
        if imdb_id:
            fallback_servers = get_backup_servers(imdb_id, is_series=is_series, season=season, episode=episode)
            for s in fallback_servers:
                candidates.append(s)

    # 3. Probe each candidate in parallel with a 3.0s timeout
    async def _probe(candidate):
        cid = candidate.get("id")
        c_url = candidate.get("url")
        c_type = candidate.get("type", "iframe")
        if not c_url:
            return {**candidate, "status": "failed", "error": "No URL"}

        t_start = time.time()
        try:
            async with httpx.AsyncClient(timeout=3.0, follow_redirects=True, verify=False) as client:
                if c_type == "direct":
                    # Range probe on direct stream with authentic referer/origin
                    meta_headers = candidate.get("stream_meta", {}).get("headers", {})
                    ref = meta_headers.get("Referer", "https://123moviesfree.club/")
                    origin = meta_headers.get("Origin", ref.rstrip("/"))
                    r = await client.get(c_url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Referer": ref,
                        "Origin": origin,
                        "Range": "bytes=0-1024"
                    })
                    latency = round((time.time() - t_start) * 1000)
                    if r.status_code in (200, 206, 302):
                        return {**candidate, "status": "healthy", "latency_ms": latency}
                    else:
                        return {**candidate, "status": "failed", "error": f"HTTP {r.status_code}", "latency_ms": latency}
                else:
                    # Probe embed server
                    r = await client.head(c_url, headers={"User-Agent": "Mozilla/5.0"})
                    if r.status_code in (404, 405):
                        r = await client.get(c_url, headers={"User-Agent": "Mozilla/5.0"})
                    latency = round((time.time() - t_start) * 1000)
                    if r.status_code < 400 or r.status_code in (301, 302, 307):
                        return {**candidate, "status": "healthy", "latency_ms": latency}
                    else:
                        return {**candidate, "status": "failed", "error": f"HTTP {r.status_code}", "latency_ms": latency}
        except Exception as e:
            latency = round((time.time() - t_start) * 1000)
            return {**candidate, "status": "failed", "error": str(e)[:50], "latency_ms": latency}

    probe_tasks = [_probe(c) for c in candidates]
    results = await asyncio.gather(*probe_tasks, return_exceptions=True)

    tested_servers = []
    for r in results:
        if isinstance(r, dict):
            tested_servers.append(r)

    # Pick the fastest healthy server (preferring direct if healthy, else lowest latency fallback)
    healthy_direct = [s for s in tested_servers if s.get("id") == "direct" and s.get("status") == "healthy"]
    healthy_fallbacks = [s for s in tested_servers if s.get("id") != "direct" and s.get("status") == "healthy"]
    healthy_fallbacks.sort(key=lambda s: s.get("latency_ms", 9999))

    best_server = None
    if healthy_direct:
        best_server = healthy_direct[0]
    elif healthy_fallbacks:
        best_server = healthy_fallbacks[0]
    elif tested_servers:
        # Fallback to first candidate if all probes gave opaque / non-200 responses
        best_server = tested_servers[0]

    return {
        "title": resolved_title,
        "subject_id": subject_id,
        "best_server_id": best_server.get("id") if best_server else None,
        "best_server": best_server,
        "servers": tested_servers
    }


@app.get("/api/stream/{subject_id}")
async def get_streams(subject_id: str, se: int = 0, ep: int = 0, detail_path: Optional[str] = None, _bust: Optional[str] = None):
    if not subject_id or subject_id == "None":
        raise HTTPException(status_code=400, detail="Invalid subject ID")

    # If cache-bust requested, delete cached streams so we get fresh signed URLs
    if _bust:
        app_cache.delete_prefix(f"streams:{subject_id}:")

    loop = asyncio.get_event_loop()
    # Concurrently fetch streams and details in thread pool for 2x faster stream load time
    streams_fut = loop.run_in_executor(_bg_executor, lambda: engine.get_streams(subject_id, season=se, episode=ep, detail_path=detail_path))
    details_fut = loop.run_in_executor(_bg_executor, lambda: engine.get_details(subject_id))
    streams_res, details_res = await asyncio.gather(streams_fut, details_fut, return_exceptions=True)

    streams = streams_res if isinstance(streams_res, list) else []
    details = details_res if isinstance(details_res, dict) else None

    # If se=0 and ep=0 returned no streams, check if this subject is a TV series (Season 1 Episode 1)
    local_se, local_ep = se, ep
    if not streams and se == 0 and ep == 0:
        s1_streams = await loop.run_in_executor(_bg_executor, lambda: engine.get_streams(subject_id, season=1, episode=1, detail_path=detail_path))
        if s1_streams:
            streams = s1_streams
            local_se = 1
            local_ep = 1
    else:
        local_se, local_ep = se, ep

    try:
        if details and is_adult_content(details):
            raise HTTPException(status_code=404, detail="Title not found")
        dubs = details.get("dubs", []) if details else []
        title = details.get("title") if details else None
        cover = details.get("cover") if details else None
        is_coming_soon = bool(details and details.get("coming_soon") and len(streams) == 0)
        trailer_url = details.get("trailer_url") if details else None
        det_type = details.get("type", "") if details else ""
        det_release = str(details.get("release_date") or "")[:4] or None if details else None
    except HTTPException:
        raise
    except Exception:
        dubs = []
        title = None
        cover = None
        is_coming_soon = False
        trailer_url = None
        det_type = ""
        det_release = None

    # Check cache for IMDB/fallback servers first (avoids the slow 13s Cinemeta call)
    imdb_id = None
    fallback_servers = []
    if details and (details.get("subject_type") == 1 or det_type == "Movie"):
        local_se = 0
        local_ep = 0
        is_ser = False
    else:
        is_ser = bool(det_type in ("Series", "TV Series") or details.get("subject_type") == 2 or local_se > 0 or local_ep > 0)
        if is_ser and se == 0 and ep == 0:
            local_se, local_ep = 1, 1
            s1_streams = await loop.run_in_executor(_bg_executor, lambda: engine.get_streams(subject_id, season=1, episode=1, detail_path=detail_path))
            if s1_streams:
                streams = s1_streams

    if title and not is_coming_soon:
        cache_key_imdb = f"imdb_id:{re.sub(r'[\[\(].*?[\]\)]', '', title).strip()}:{det_release or ''}:{is_ser}"
        imdb_id = app_cache.get(cache_key_imdb)
        if imdb_id:
            # Cache hit — build servers immediately
            fallback_servers = get_backup_servers(imdb_id, is_series=is_ser, season=local_se, episode=local_ep)
        else:
            # Kick off IMDB resolution in background — don't block the stream response
            def _bg_resolve():
                resolved = resolve_imdb_id(title, year=det_release, is_series=is_ser)
                # result cached inside resolve_imdb_id already
                return resolved
            # Fire-and-forget — client can fetch /api/fallback-sources separately if needed
            _bg_executor.submit(_bg_resolve)

    return {
        "subject_id": subject_id,
        "season": local_se,
        "episode": local_ep,
        "count": len(streams),
        "streams": streams,
        "dubs": dubs,
        "title": title,
        "cover": cover,
        "coming_soon": is_coming_soon,
        "trailer_url": trailer_url,
        "imdb_id": imdb_id,
        "fallback_servers": fallback_servers
    }

@app.get("/api/stream/{subject_id}/captions")
async def get_captions(subject_id: str, se: int = 0, ep: int = 0, stream_id: Optional[str] = None):
    loop = asyncio.get_event_loop()
    raw_subs = await loop.run_in_executor(_bg_executor, lambda: engine.get_subtitles(subject_id, stream_id=stream_id, season=se, episode=ep))
    subs = []
    for s in (raw_subs or []):
        u = s.get("url") or ""
        if "/other/" in u or "aa348f2541d13ffe" in u:
            continue
        try:
            sz = int(s.get("size") or 0)
            if 0 < sz < 500:
                continue
        except Exception:
            pass
        subs.append(s)
    
    # Check if a genuine English subtitle exists
    def is_genuine_eng(s):
        lang = (s.get("language") or "").lower()
        code = (s.get("code") or "").lower()
        if "pk" in lang or "notice" in lang:
            return False
        return "eng" in lang or (code == "en" and "pk" not in lang)

    has_english = any(is_genuine_eng(s) for s in subs)
    if not has_english:
        try:
            details = await loop.run_in_executor(_bg_executor, lambda: engine.get_details(subject_id))
            title = details.get("title") or ""
            year = str(details.get("release_date") or "")[:4] or None
            imdb_id = details.get("imdb_id")
            if title:
                online_res = await loop.run_in_executor(_bg_executor, lambda: search_online_subtitles(title=title, year=year, imdb_id=imdb_id, se=se, ep=ep, lang="en"))
                online_subs = (online_res or {}).get("subtitles") or []
                if online_subs:
                    best = online_subs[0]
                    subs.insert(0, {
                        "id": f"online_{best['id']}",
                        "language": "English (Auto-Matched)",
                        "code": "en",
                        "url": best["proxy_url"],
                        "filename": best.get("filename", "English.srt")
                    })
        except Exception:
            pass

    return {
        "subject_id": subject_id,
        "season": se,
        "episode": ep,
        "count": len(subs),
        "captions": subs
    }

@app.get("/api/subtitles/online")
def search_online_subtitles(title: str = Query(..., min_length=1), year: Optional[str] = None, imdb_id: Optional[str] = None, se: int = 0, ep: int = 0, lang: Optional[str] = None):
    headers = {"User-Agent": "TemporaryUserAgent"}
    
    # Strip dub annotations like [Hindi], (Dubbed) from title for accurate subtitle matching
    clean_title = re.sub(r'[\[\(].*?[\]\)]', '', title).strip()
    
    # Auto-resolve exact IMDb ID using Title + Year if not provided
    if not imdb_id and clean_title:
        try:
            resolved = resolve_imdb_id(clean_title, year=year, is_series=(se > 0 or ep > 0))
            if resolved:
                imdb_id = resolved
        except Exception:
            pass

    url = None
    if imdb_id:
        num = imdb_id.lower().replace("tt", "").strip()
        if num.isdigit():
            if se > 0 and ep > 0:
                url = f"https://rest.opensubtitles.org/search/episode-{ep}/imdbid-{num}/season-{se}/sublanguageid-all"
            else:
                url = f"https://rest.opensubtitles.org/search/imdbid-{num}/sublanguageid-all"
    if not url:
        query_str = f"{clean_title} {year}".strip() if year else clean_title
        safe_q = urllib.parse.quote(query_str)
        url = f"https://rest.opensubtitles.org/search/query-{safe_q}/sublanguageid-all"

    results = []
    seen = set()

    def _parse_items(items):
        for item in items:
            dl = item.get("SubDownloadLink")
            if not dl or dl in seen:
                continue
            seen.add(dl)
            lan_name = item.get("LanguageName") or "English"
            lan_code = item.get("SubLanguageID") or "en"
            if lang and lang.lower() != "all" and lan_code.lower() != lang.lower() and lang.lower() not in lan_name.lower():
                continue
            
            try:
                dl_count = int(item.get("SubDownloadsCnt") or 0)
            except Exception:
                dl_count = 0
            try:
                rating_val = float(item.get("SubRating") or 0)
            except Exception:
                rating_val = 0.0

            results.append({
                "id": str(item.get("IDSubtitleFile") or len(results) + 1),
                "language": lan_name,
                "code": lan_code,
                "filename": item.get("SubFileName") or f"{clean_title}.srt",
                "downloads": str(dl_count),
                "downloads_num": dl_count,
                "rating": str(item.get("SubRating") or "0"),
                "rating_num": rating_val,
                "download_url": dl,
                "proxy_url": f"/api/proxy/online-caption?url={urllib.parse.quote(dl)}"
            })

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            if isinstance(data, list):
                _parse_items(data)
    except Exception:
        pass

    # If imdb_id search returned no results, retry with clean title query
    if not results and imdb_id and clean_title:
        try:
            query_str = f"{clean_title} {year}".strip() if year else clean_title
            safe_q = urllib.parse.quote(query_str)
            fallback_url = f"https://rest.opensubtitles.org/search/query-{safe_q}/sublanguageid-all"
            req = urllib.request.Request(fallback_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
                if isinstance(data, list):
                    _parse_items(data)
        except Exception:
            pass

    # Sort subtitles by rating and download count so top match is always highest quality
    results.sort(key=lambda x: (x.get("rating_num", 0), x.get("downloads_num", 0)), reverse=True)

    return {
        "title": title,
        "imdb_id": imdb_id,
        "season": se,
        "episode": ep,
        "count": len(results),
        "subtitles": results[:40]
    }

@app.get("/api/feed")
@app.get("/api/feed/home-curated")
def get_home_curated(_bust: Optional[str] = None):
    if _bust:
        app_cache.delete("feed:home_curated")
    return engine.get_curated_feed()

@app.post("/api/admin/deploy")
async def trigger_server_deploy(secret: Optional[str] = Query(None)):
    expected = os.getenv("DEPLOY_SECRET", "moviebox_deploy_2026")
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Unauthorized deploy secret")

    def _pull_and_restart():
        import subprocess
        log_lines = []
        try:
            r1 = subprocess.run(["git", "fetch", "origin", "main"], cwd="/home/ubuntu/MovieBox", capture_output=True, text=True, timeout=30)
            log_lines.append(f"fetch: {r1.stdout.strip()} {r1.stderr.strip()}")
            r2 = subprocess.run(["git", "reset", "--hard", "origin/main"], cwd="/home/ubuntu/MovieBox", capture_output=True, text=True, timeout=30)
            log_lines.append(f"reset: {r2.stdout.strip()} {r2.stderr.strip()}")
            r3 = subprocess.run(["./venv/bin/pip", "install", "-r", "requirements.txt"], cwd="/home/ubuntu/MovieBox", capture_output=True, text=True, timeout=60)
            log_lines.append(f"pip: {r3.stdout.strip()} {r3.stderr.strip()}")
            # Schedule service restart cleanly
            pid = os.getpid()
            subprocess.Popen(["bash", "-c", f"sleep 1 && (sudo -n systemctl restart moviebox || kill -9 {pid})"])
            log_lines.append(f"Service restart scheduled (pid: {pid})")
        except Exception as e:
            log_lines.append(f"error: {str(e)}")
        return "\n".join(log_lines)

    loop = asyncio.get_event_loop()
    res = await loop.run_in_executor(_bg_executor, _pull_and_restart)
    app_cache.delete("feed:home_curated")
    app_cache.delete_prefix("feed:")
    app_cache.delete_prefix("streams:")
    return {"status": "success", "message": "Deployed latest GitHub commit", "log": res}


@app.post("/api/admin/setup-ssl")
async def trigger_setup_ssl(
    secret: Optional[str] = Query(None),
    domain: str = Query("movieverse.click"),
    email: Optional[str] = Query(None)
):
    expected = os.getenv("DEPLOY_SECRET", "moviebox_deploy_2026")
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Unauthorized")

    def _execute_ssl_setup():
        import subprocess
        log_lines = []
        try:
            cmd = ["sudo", "bash", "setup-ssl.sh", domain]
            if email:
                cmd.append(email)
            log_lines.append(f"Executing: {' '.join(cmd)}")
            res = subprocess.run(
                cmd,
                cwd="/home/ubuntu/MovieBox",
                capture_output=True,
                text=True,
                timeout=180
            )
            log_lines.append(f"Return code: {res.returncode}")
            if res.stdout:
                log_lines.append("=== STDOUT ===")
                log_lines.append(res.stdout.strip())
            if res.stderr:
                log_lines.append("=== STDERR ===")
                log_lines.append(res.stderr.strip())
        except Exception as e:
            log_lines.append(f"Exception: {str(e)}")
        return "\n".join(log_lines)

    loop = asyncio.get_event_loop()
    output = await loop.run_in_executor(_bg_executor, _execute_ssl_setup)
    return {"status": "completed", "domain": domain, "log": output}



@app.get("/api/hero-trending")
def get_hero_trending():
    cache_key = "feed:hero_daily_trending"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    feed = engine.get_curated_feed()
    slides = []
    seen = set()

    # Prefer trending and cinema first, then hollywood
    candidates = feed.get("trending", []) + feed.get("new_releases", []) + feed.get("hollywood", [])
    for it in candidates:
        sid = it.get("subject_id")
        raw_title = it.get("title") or ""
        clean = re.sub(r'\[.*?\]|\(.*?\)', '', raw_title).strip()
        if not clean or clean.lower() in seen:
            continue
        seen.add(clean.lower())

        backdrop = it.get("cover")
        rating = it.get("rating") or "7.5"
        year = it.get("year") or "2026"
        genre = it.get("genre") or "Action, Cinema"

        slides.append({
            "title": clean,
            "raw_title": raw_title,
            "subject_id": sid,
            "rating": rating,
            "year": year,
            "genre": genre,
            "desc": f"Watch {clean} in crystal-clear 1080p Ultra HD streaming with verified CDN mirrors, multi-language dubs, and interactive cinema controls.",
            "backdrop": backdrop,
            "cover": it.get("cover"),
            "type": it.get("type", "Movie")
        })
        if len(slides) >= 7:
            break

    res = {
        "items": slides,
        "count": len(slides),
        "updated_at": int(time.time())
    }
    app_cache.set(cache_key, res, ttl=86400)  # 24-hour cache for daily auto-refresh
    return res


@app.get("/movies")
def get_movies(page: int = 1, per_page: int = 24, sort: str = "RECOMMEND", category: str = "all", genre: str = "ALL"):
    feed = engine.get_curated_feed()

    # Dedicated shelf category direct access
    shelf_keys = ["hollywood", "bollywood", "cinema", "south_indian", "trending", "action", "scifi", "comedy", "horror", "top_rated", "new_releases"]
    if category in shelf_keys:
        items = feed.get(category, [])
        total = len(items)
        start = (page - 1) * per_page
        end = start + per_page
        return {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": end < total,
            "category": category,
            "genre": genre,
            "items": items[start:end]
        }

    curated_pool = []
    seen = set()
    for cat in ["trending", "new_releases", "top_rated", "hollywood", "action", "scifi", "comedy", "horror", "bollywood", "south_indian"]:
        for it in feed.get(cat, []):
            # Strict filter: ONLY movies belong in the movie catalog!
            if it.get("subject_type") == 2 or it.get("type") in ["Series", "TV Series"]:
                continue
            raw_t = it.get("title") or ""
            clean_name = re.sub(r'\[.*?\]|\(.*?\)', '', raw_t).strip()
            if it["subject_id"] not in seen and clean_name.lower() not in seen:
                seen.add(it["subject_id"])
                seen.add(clean_name.lower())
                c = dict(it)
                c["raw_title"] = raw_t
                c["title"] = clean_name
                c["type"] = "Movie"
                curated_pool.append(c)

    cache_key = f"movies:{page}:{per_page}:{sort}:{category}:{genre}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    # If page 1, serve the top curated pool directly for instant 0ms response
    if page == 1 and category == "all" and genre == "ALL":
        res = {
            "page": 1,
            "per_page": per_page,
            "total": 10000,
            "has_more": True,
            "category": category,
            "genre": genre,
            "items": curated_pool[:per_page]
        }
        app_cache.set(cache_key, res, ttl=300)
        return res

    # For subsequent pages or specific queries, fetch from upstream filter API
    items = []
    try:
        url = f"{API_BASE}/subject/filter"
        payload = {
            "tabId": 2,
            "page": str(page),
            "perPage": str(per_page * 2)
        }
        resp = engine.session.post(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=12)
        raw = resp.json().get("data", {}).get("items") or []
        for s in raw:
            if s.get("subjectType") == 6 or is_adult_content(s):
                continue
            if s.get("subjectType") == 2:
                continue
            if not s.get("title"):
                continue
            sid = str(s.get("subjectId"))
            clean_title = re.sub(r'\[.*?\]|\(.*?\)', '', s.get("title") or '').strip()
            clean_key = clean_title.lower()
            if sid not in seen and clean_key not in seen:
                seen.add(sid)
                seen.add(clean_key)
                cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                items.append({
                    "title": clean_title,
                    "raw_title": s.get("title"),
                    "subject_id": sid,
                    "subject_type": 1,
                    "detail_path": s.get("detailPath"),
                    "cover": cover_url,
                    "rating": s.get("imdbRatingValue") or "N/A",
                    "genre": s.get("genre") or "Cinema",
                    "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                    "type": "Movie"
                })
            if len(items) >= per_page:
                break
    except Exception:
        pass

    # If upstream returned fewer than desired, backfill from pool slice
    if len(items) < per_page:
        start_idx = (page - 1) * per_page
        for extra in curated_pool[start_idx:start_idx + per_page]:
            if not any(x["subject_id"] == extra["subject_id"] for x in items):
                items.append(extra)
            if len(items) >= per_page:
                break

    res = {
        "page": page,
        "per_page": per_page,
        "total": 10000,
        "has_more": True,
        "category": category,
        "genre": genre,
        "items": items[:per_page]
    }
    app_cache.set(cache_key, res, ttl=300)
    return res


@app.get("/tv-series")
def get_tv_series(page: int = 1, per_page: int = 24, sort: str = "RECOMMEND", category: str = "all"):
    feed = engine.get_curated_feed()
    curated_series = []
    seen = set()
    for cat in ["series", "anime", "asian_drama", "trending", "bollywood", "south_indian"]:
        for it in feed.get(cat, []):
            # Strict filter: ONLY TV Series belong in the TV series catalog!
            if it.get("subject_type") == 1 or it.get("type") == "Movie":
                continue
            raw_t = it.get("title") or ""
            clean_name = re.sub(r'\[.*?\]|\(.*?\)', '', raw_t).strip()
            if it["subject_id"] not in seen and clean_name.lower() not in seen:
                seen.add(it["subject_id"])
                seen.add(clean_name.lower())
                c = dict(it)
                c["raw_title"] = raw_t
                c["title"] = clean_name
                c["type"] = "TV Series"
                curated_series.append(c)

    if category in ["series", "anime", "asian_drama"]:
        items = feed.get(category, [])
        items = [x for x in items if x.get("subject_type") != 1 and x.get("type") != "Movie"]
        total = len(items)
        start = (page - 1) * per_page
        end = start + per_page
        return {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": end < total,
            "category": category,
            "items": items[start:end]
        }

    cache_key = f"tv:{page}:{per_page}:{sort}:{category}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    if page == 1 and category == "all":
        res = {
            "page": 1,
            "per_page": per_page,
            "total": 5000,
            "has_more": True,
            "category": category,
            "items": curated_series[:per_page]
        }
        app_cache.set(cache_key, res, ttl=300)
        return res

    items = []
    try:
        url = f"{API_BASE}/subject/filter"
        payload = {
            "tabId": 5,
            "page": str(page),
            "perPage": str(per_page * 2)
        }
        resp = engine.session.post(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=12)
        raw = resp.json().get("data", {}).get("items") or []
        for s in raw:
            if s.get("subjectType") == 6 or is_adult_content(s):
                continue
            if s.get("subjectType") == 1:
                continue
            if not s.get("title"):
                continue
            sid = str(s.get("subjectId"))
            clean_title = re.sub(r'\[.*?\]|\(.*?\)', '', s.get("title") or '').strip()
            clean_key = clean_title.lower()
            if sid not in seen and clean_key not in seen:
                seen.add(sid)
                seen.add(clean_key)
                cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                items.append({
                    "title": clean_title,
                    "raw_title": s.get("title"),
                    "subject_id": sid,
                    "subject_type": 2,
                    "detail_path": s.get("detailPath"),
                    "cover": cover_url,
                    "rating": s.get("imdbRatingValue") or "N/A",
                    "genre": s.get("genre") or "TV Series",
                    "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                    "type": "TV Series"
                })
            if len(items) >= per_page:
                break
    except Exception:
        pass

    if len(items) < per_page:
        start_idx = (page - 1) * per_page
        for extra in curated_series[start_idx:start_idx + per_page]:
            if not any(x["subject_id"] == extra["subject_id"] for x in items):
                items.append(extra)
            if len(items) >= per_page:
                break

    res = {
        "page": page,
        "per_page": per_page,
        "total": 5000,
        "has_more": True,
        "category": category,
        "items": items[:per_page]
    }
    app_cache.set(cache_key, res, ttl=300)
    return res

@app.get("/home")
def get_home():
    cache_key = "feed:raw_home"
    cached = app_cache.get(cache_key)
    if cached:
        return cached
    url = f"{API_BASE}/home?host=moviebox.ph"
    try:
        resp = engine.session.get(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://moviebox.ph/"}, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            app_cache.set(cache_key, data, ttl=300)
            return data
        return {"data": {}, "status": "error", "code": resp.status_code}
    except Exception as e:
        return {"data": {}, "status": "error", "message": str(e)}

@app.get("/api/ads/config")
def get_ads_config():
    """Returns the master ad monetization config for web and mobile apps."""
    config_path = os.path.join(os.path.dirname(__file__), "ad_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            pass
    return {
        "enabled": True,
        "test_mode": True,
        "monetag": {
            "enabled": True,
            "zone_id": "",
            "direct_link": "",
            "preroll_enabled": True,
            "preroll_duration_seconds": 5,
            "preroll_cooldown_seconds": 300,
            "exit_interstitial_enabled": True,
            "exit_cooldown_seconds": 600
        },
        "adsterra": {
            "enabled": True,
            "social_bar_enabled": True,
            "social_bar_script_url": "",
            "native_banner_enabled": True,
            "banner_key": ""
        },
        "admob": {
            "enabled": True,
            "app_id": "ca-app-pub-3940256099942544~3347511713",
            "banner_unit_id": "ca-app-pub-3940256099942544/6300978111",
            "interstitial_unit_id": "ca-app-pub-3940256099942544/1033173712",
            "interstitial_frequency": 4
        }
    }

@app.post("/api/ads/config")
async def update_ads_config(request: Request):
    """Allows updating ad monetization configuration dynamically."""
    try:
        new_config = await request.json()
        config_path = os.path.join(os.path.dirname(__file__), "ad_config.json")
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(new_config, f, indent=2)
        return {"status": "success", "config": new_config}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ads/vast", response_class=HTMLResponse)
async def get_ads_vast(request: Request):
    """Returns a self-hosted VAST 2.0 XML tag for in-stream video pre-roll ads.
    Compatible with Google IMA SDK and all VAST-capable players."""
    config_path = os.path.join(os.path.dirname(__file__), "ad_config.json")
    ad_cfg = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                ad_cfg = json.load(f)
        except Exception:
            pass

    preroll = ad_cfg.get("video_preroll", {})
    video_url = preroll.get("video_ad_url", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4")
    sponsor_url = preroll.get("sponsor_url", "https://asiafilm.org/4/c59f31c3db10b336a8c574304c2e9b41")
    sponsor_name = preroll.get("sponsor_name", "MovieVerse Cinema Partner")
    skip_offset = preroll.get("skip_delay_seconds", 5)
    duration = preroll.get("duration_seconds", 15)

    # Format duration as HH:MM:SS for VAST
    h = duration // 3600
    m = (duration % 3600) // 60
    s = duration % 60
    dur_str = f"{h:02d}:{m:02d}:{s:02d}"
    skip_str = f"00:00:{skip_offset:02d}"

    # Impression tracking pixel (we log internally)
    base_url = str(request.base_url).rstrip("/")
    tracking_url = f"{base_url}/api/ads/vast/track?event=impression"
    start_url = f"{base_url}/api/ads/vast/track?event=start"
    complete_url = f"{base_url}/api/ads/vast/track?event=complete"
    skip_url = f"{base_url}/api/ads/vast/track?event=skip"
    click_url = f"{base_url}/api/ads/vast/track?event=click"

    vast_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<VAST version="2.0">
  <Ad id="movieverse-preroll-1">
    <InLine>
      <AdSystem>MovieVerse Ad Server 1.0</AdSystem>
      <AdTitle>{sponsor_name} - Pre-Roll Ad</AdTitle>
      <Description>Sponsored content before your movie. Skip after {skip_offset} seconds.</Description>
      <Error>{base_url}/api/ads/vast/track?event=error&amp;code=[ERRORCODE]</Error>
      <Impression id="imp1"><![CDATA[{tracking_url}]]></Impression>
      <Creatives>
        <Creative id="cr1" sequence="1">
          <Linear skipoffset="{skip_str}">
            <Duration>{dur_str}</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[{start_url}]]></Tracking>
              <Tracking event="skip"><![CDATA[{skip_url}]]></Tracking>
              <Tracking event="complete"><![CDATA[{complete_url}]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[{base_url}/api/ads/vast/track?event=firstQuartile]]></Tracking>
              <Tracking event="midpoint"><![CDATA[{base_url}/api/ads/vast/track?event=midpoint]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[{base_url}/api/ads/vast/track?event=thirdQuartile]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough id="ct1"><![CDATA[{sponsor_url}]]></ClickThrough>
              <ClickTracking id="ctr1"><![CDATA[{click_url}]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile id="mf1" delivery="progressive" type="video/mp4" bitrate="500" width="1280" height="720">
                <![CDATA[{video_url}]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>"""
    return HTMLResponse(content=vast_xml, media_type="application/xml")


@app.get("/api/ads/vast/track")
async def track_vast_event(event: str = "impression", code: str = ""):
    """Receives VAST tracking pixel pings from the IMA SDK. Logs events server-side."""
    print(f"[VAST] Event: {event}" + (f" code={code}" if code else ""), flush=True)
    # Return a 1x1 transparent GIF pixel
    pixel = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
    return Response(content=pixel, media_type="image/gif")


@app.get("/api/ads/banner", response_class=HTMLResponse)
def get_ads_banner_html():
    """Serves real Monetag & Adsterra ad scripts inside a mobile-optimized banner iframe/webview."""
    config_path = os.path.join(os.path.dirname(__file__), "ad_config.json")
    ad_cfg = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                ad_cfg = json.load(f)
        except Exception:
            pass

    zone_id = ad_cfg.get("monetag", {}).get("zone_id", "306845")
    monetag_script = ad_cfg.get("monetag", {}).get("script_url", "https://quge5.com/88/tag.min.js")
    adsterra_script = ad_cfg.get("adsterra", {}).get("social_bar_script_url", "")
    direct_link = ad_cfg.get("adsterra", {}).get("direct_link") or ad_cfg.get("monetag", {}).get("direct_link", "https://uplcm.com/4/12213398")

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: #0f172a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .ad-card {{
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: linear-gradient(135deg, rgba(229,9,20,0.12), rgba(15,23,42,0.9));
      border: 1px solid rgba(229,9,20,0.3);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }}
    .ad-left {{
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
    }}
    .badge-row {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .ad-badge {{
      background: #E50914;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }}
    .ad-tagline {{
      font-size: 11px;
      color: #94a3b8;
    }}
    .ad-title {{
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .ad-cta {{
      background: #E50914;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;
      margin-left: 10px;
    }}
  </style>
  <!-- Adsterra Social Bar Script -->
  <script data-cfasync="false" src="{adsterra_script}"></script>
  <!-- Monetag MultiTag Script -->
  <script src="{monetag_script}" data-zone="{zone_id}" async data-cfasync="false"></script>
  <script>
    // When Monetag or Adsterra injects dynamic ad overlay, hide fallback text to prevent visual clash
    try {
      var obs = new MutationObserver(function() {
        var dyn = document.querySelectorAll('div[class*="zone-"], div[id*="zone-"], div[class*="inpage"], iframe, div[style*="z-index"]');
        if (dyn.length > 0) {
          var card = document.getElementById('adCardLink');
          if (card) { card.style.background = 'transparent'; card.style.border = 'none'; }
          var left = document.getElementById('adLeftContent');
          if (left) left.style.display = 'none';
          var cta = document.getElementById('adCtaBtn');
          if (cta) cta.style.display = 'none';
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch(e) {}
  </script>
</head>
<body>
  <a href="{direct_link}" target="_blank" rel="noopener" class="ad-card" id="adCardLink">
    <div class="ad-left" id="adLeftContent">
      <div class="badge-row">
        <span class="ad-badge">SPONSORED</span>
        <span class="ad-tagline">MovieVerse Cloud Partner</span>
      </div>
      <span class="ad-title">Ultra HD Streaming & Fast Cloud Node</span>
    </div>
    <span class="ad-cta" id="adCtaBtn">Explore ↗</span>
  </a>
</body>
</html>"""
    return HTMLResponse(content=html)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
