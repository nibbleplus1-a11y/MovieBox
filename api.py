from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
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
from urllib.parse import urlsplit

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
    title="CineScope 1080p Cinema API",
    description="REST API for CineScope with 1080p Stream & Subtitle Extraction",
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

class SimpleCache:
    def __init__(self, maxsize: int = 500, default_ttl: int = 600):
        self.maxsize = maxsize
        self.default_ttl = default_ttl
        self.cache = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            val, exp = self.cache[key]
            if time.time() < exp:
                return val
            del self.cache[key]
        return None

    def set(self, key: str, val: Any, ttl: Optional[int] = None) -> None:
        if ttl is None:
            ttl = self.default_ttl
        if len(self.cache) >= self.maxsize:
            self.cache.popitem(last=False)
        self.cache[key] = (val, time.time() + ttl)

    def delete(self, key: str) -> None:
        self.cache.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        keys = [k for k in self.cache if k.startswith(prefix)]
        for k in keys:
            del self.cache[k]

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
        for item in raw_items:
            sub = item.get("subject", item)
            # Enforce clean family-friendly results: strictly exclude pornographic/adult content
            if is_adult_content(sub):
                continue

            rel_date = sub.get("releaseDate") or ""
            is_cs = False
            if rel_date:
                try:
                    from datetime import date
                    if date.fromisoformat(rel_date[:10]) > date.today():
                        is_cs = True
                except Exception:
                    pass

            results.append({
                "subject_id": str(sub.get("subjectId")),
                "title": sub.get("title"),
                "type": "Movie" if sub.get("subjectType") == 1 else "Series",
                "subject_type": sub.get("subjectType"),
                "release_date": rel_date,
                "coming_soon": is_cs,
                "imdb_rating": sub.get("imdbRatingValue"),
                "genre": sub.get("genre"),
                "cover": sub.get("cover", {}).get("url") if isinstance(sub.get("cover"), dict) else None,
                "detail_path": sub.get("detailPath"),
                "language": sub.get("language")
            })
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
        for d in dubs:
            if d.get("subject_id") and d["subject_id"] != main_id:
                app_cache.set(f"dub_parent:{d['subject_id']}", main_id, ttl=7200)

        # If this item itself is a dub with no child dubs, look up parent's dubs
        if not dubs:
            parent_id = app_cache.get(f"dub_parent:{subject_id}")
            if parent_id and parent_id != subject_id:
                try:
                    p_details = self.get_details(parent_id)
                    dubs = p_details.get("dubs", [])
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
                from datetime import date
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
            "title": data.get("title"),
            "subject_type": data.get("subjectType"),
            "type": "Movie" if data.get("subjectType") == 1 else "Series",
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
                try:
                    details = self.get_details(subject_id)
                    detail_path = details.get("detail_path", "") or ""
                    # If this subject has no detail_path (e.g. English/Tamil dubs of Interstellar),
                    # find any sibling dub that DOES have a detail_path and use that slug.
                    if not detail_path:
                        for dub in details.get("dubs", []):
                            dub_sid = str(dub.get("subject_id") or "")
                            if not dub_sid or dub_sid == subject_id:
                                continue
                            try:
                                dub_details = self.get_details(dub_sid)
                                dub_path = dub_details.get("detail_path", "") or ""
                                if dub_path:
                                    detail_path = dub_path
                                    break
                            except Exception:
                                continue
                except Exception:
                    detail_path = ""
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
            app_cache.set(cache_key, streams, ttl=600)
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
            "asian_drama": []
        }

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
            if "trending now" in title or ("trending" in title and "punjabi" not in title):
                target_key = "trending"
            elif "cinema" in title:
                target_key = "cinema"
            elif "hollywood" in title:
                target_key = "hollywood"
            elif "bollywood" in title:
                target_key = "bollywood"
            elif "south indian" in title:
                target_key = "south_indian"
            elif "top series" in title or "western tv" in title:
                target_key = "series"
            elif "anime" in title:
                target_key = "anime"
            elif "asian drama" in title or "indian drama" in title:
                target_key = "asian_drama"

            if target_key:
                for s in subs:
                    if s.get("subjectType") == 6 or is_adult_content(s):
                        continue
                    cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                    item = {
                        "title": s.get("title"),
                        "subject_id": str(s.get("subjectId")),
                        "subject_type": s.get("subjectType"),
                        "detail_path": s.get("detailPath"),
                        "cover": cover_url,
                        "rating": s.get("imdbRatingValue") or "N/A",
                        "genre": s.get("genre"),
                        "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                        "type": "Movie" if s.get("subjectType") == 1 else "TV Series"
                    }
                    if not any(x["subject_id"] == item["subject_id"] for x in feed[target_key]):
                        feed[target_key].append(item)

        # Fallback backfill: if any movie shelf has fewer than 6 items, backfill from /subject/filter
        fallback_needed = any(len(feed[k]) < 6 for k in ["trending", "cinema", "hollywood", "bollywood", "south_indian"])
        if fallback_needed:
            try:
                filter_url = f"{API_BASE}/subject/filter"
                payload = {
                    "tabId": 2,
                    "filter": {"sort": "RECOMMEND", "genre": "ALL", "country": "ALL", "year": "ALL", "language": "ALL"},
                    "page": 1,
                    "perPage": 36
                }
                f_resp = self.session.post(filter_url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=8)
                if f_resp.status_code == 200:
                    raw_items = f_resp.json().get("data", {}).get("items") or []
                    for s in raw_items:
                        if s.get("subjectType") == 6 or is_adult_content(s):
                            continue
                        cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                        item = {
                            "title": s.get("title"),
                            "subject_id": str(s.get("subjectId")),
                            "subject_type": s.get("subjectType"),
                            "detail_path": s.get("detailPath"),
                            "cover": cover_url,
                            "rating": s.get("imdbRatingValue") or "N/A",
                            "genre": s.get("genre"),
                            "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else "2026",
                            "type": "Movie" if s.get("subjectType") == 1 else "TV Series"
                        }
                        for k in ["trending", "cinema", "hollywood"]:
                            if len(feed[k]) < 12 and not any(x["subject_id"] == item["subject_id"] for x in feed[k]):
                                feed[k].append(item)
            except Exception:
                pass

        total_items = sum(len(v) for v in feed.values())
        if total_items >= 20:
            app_cache.set(cache_key, feed, ttl=1800)
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
        limits = httpx.Limits(max_keepalive_connections=120, max_connections=350, keepalive_expiry=60.0)
        _STREAM_PROXY_CLIENT = httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True)
    return _STREAM_PROXY_CLIENT

_WORKING_REFERERS: Dict[str, str] = {}

@app.api_route("/api/proxy/stream", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_stream(request: Request, url: str = Query(...), referer: Optional[str] = None, download: bool = False, filename: Optional[str] = None, subject_id: Optional[str] = None):
    if request.method == "OPTIONS":
        return Response(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400"
        })

    from urllib.parse import urlparse
    url_domain = urlparse(url).netloc

    # Smart candidate referers to prevent 429 rate-limiting from hakunaymatata CDN
    candidate_refs = []
    # Prioritize previously successful referer for this domain
    if url_domain in _WORKING_REFERERS:
        candidate_refs.append(_WORKING_REFERERS[url_domain])

    if referer and "aoneroom.com" not in referer:
        candidate_refs.append(referer)
    if "hakunaymatata.com" in url:
        candidate_refs.extend(["https://123moviesfree.club/", "https://movieboxonline.net/", "https://moviebox.ph/"])
    else:
        candidate_refs.extend(["https://movieboxonline.net/", "https://api3.aoneroom.com/"])

    seen_refs = set()
    unique_refs = []
    for cr in candidate_refs:
        if cr not in seen_refs:
            seen_refs.add(cr)
            unique_refs.append(cr)

    range_header = request.headers.get("range", "bytes=0-")
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
            "Range": range_header,
        }
        try:
            req = client.build_request("GET", url, headers=headers)
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
            async for chunk in resp.aiter_bytes(chunk_size=524288):
                yield chunk
        except Exception:
            pass
        finally:
            try:
                await resp.aclose()
            except Exception:
                pass

    return StreamingResponse(content_iterator(), status_code=resp.status_code, headers=response_headers)

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

    if "WEBVTT" not in content[:20]:
        converted = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", content)
        content = "WEBVTT\n\n" + converted

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

    if not content.strip().startswith("WEBVTT"):
        converted = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", content)
        content = "WEBVTT\n\n" + converted

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

@app.get("/detail/{subject_id}")
def get_detail(subject_id: str):
    if not subject_id or subject_id == "None":
        raise HTTPException(status_code=400, detail="Invalid subject ID")
    res = engine.get_details(subject_id)
    if not res or not res.get("title") or is_adult_content(res):
        raise HTTPException(status_code=404, detail="Title not found")
    # Mark pre-release titles as "Coming Soon" based on release date only
    release_date = res.get("release_date") or ""
    coming_soon = bool(res.get("coming_soon"))
    if coming_soon and release_date:
        res["coming_soon_date"] = release_date[:10]

    # Only for date-confirmed unreleased movies, verify with a stream probe.
    # If streams ARE available, the title is released even if the date says future.
    if coming_soon and res.get("type") == "Movie":
        try:
            if engine.get_streams(subject_id, season=0, episode=0):
                coming_soon = False  # streams exist → already released
        except Exception:
            pass

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

    cat = "series" if is_series else "movie"
    try:
        url = f"https://v3-cinemeta.strem.io/catalog/{cat}/top/search={urllib.parse.quote(clean_title)}.json"
        r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=6)
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
                "name": "Server 2 (VidSrc Cloud)",
                "id": "vidsrc_me",
                "type": "iframe",
                "url": f"https://vidsrc.me/embed/tv?imdb={clean_id}&season={s}&episode={e}",
            },
            {
                "name": "Server 3 (RiveStream Ultra)",
                "id": "rivestream",
                "type": "iframe",
                "url": f"https://rivestream.live/embed?type=serie&id={clean_id}&season={s}&episode={e}",
            },
            {
                "name": "Server 4 (AutoEmbed Fast)",
                "id": "autoembed",
                "type": "iframe",
                "url": f"https://autoembed.co/tv/imdb/{clean_id}-{s}-{e}",
            },
            {
                "name": "Server 5 (VidSrc VIP Mirror)",
                "id": "vidsrc_pm",
                "type": "iframe",
                "url": f"https://vidsrc.pm/embed/tv?imdb={clean_id}&season={s}&episode={e}",
            },
            {
                "name": "Server 6 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={clean_id}&s={s}&e={e}",
            },
        ]
    else:
        return [
            {
                "name": "Server 2 (VidSrc Cloud)",
                "id": "vidsrc_me",
                "type": "iframe",
                "url": f"https://vidsrc.me/embed/movie?imdb={clean_id}",
            },
            {
                "name": "Server 3 (VidLink Pro)",
                "id": "vidlink",
                "type": "iframe",
                "url": f"https://vidlink.pro/movie/{clean_id}?primaryColor=e50914&secondaryColor=ff4d4f",
            },
            {
                "name": "Server 4 (RiveStream Ultra)",
                "id": "rivestream",
                "type": "iframe",
                "url": f"https://rivestream.live/embed?type=movie&id={clean_id}",
            },
            {
                "name": "Server 5 (AutoEmbed Fast)",
                "id": "autoembed",
                "type": "iframe",
                "url": f"https://autoembed.co/movie/imdb/{clean_id}",
            },
            {
                "name": "Server 6 (VidSrc VIP Mirror)",
                "id": "vidsrc_pm",
                "type": "iframe",
                "url": f"https://vidsrc.pm/embed/movie?imdb={clean_id}",
            },
            {
                "name": "Server 7 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={clean_id}",
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
    imdb_id = await loop.run_in_executor(_bg_executor, lambda: resolve_imdb_id(title, year=year, is_series=is_series))
    if not imdb_id:
        return {"title": title, "imdb_id": None, "servers": []}
    servers = get_backup_servers(imdb_id, is_series=is_series, season=season, episode=episode)
    return {
        "title": title,
        "imdb_id": imdb_id,
        "is_series": is_series,
        "season": season,
        "episode": episode,
        "servers": servers
    }

@app.get("/api/stream/{subject_id}")
async def get_streams(subject_id: str, se: int = 0, ep: int = 0, detail_path: Optional[str] = None, _bust: Optional[str] = None):
    if not subject_id or subject_id == "None":
        raise HTTPException(status_code=400, detail="Invalid subject ID")

    # If cache-bust requested, delete cached streams so we get fresh signed URLs
    if _bust:
        app_cache.delete_prefix(f"streams:{subject_id}:")

    loop = asyncio.get_event_loop()
    # Run blocking stream fetch in thread to not block event loop
    streams = await loop.run_in_executor(_bg_executor, lambda: engine.get_streams(subject_id, season=se, episode=ep, detail_path=detail_path))

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
        details = await loop.run_in_executor(_bg_executor, lambda: engine.get_details(subject_id))
        if is_adult_content(details):
            raise HTTPException(status_code=404, detail="Title not found")
        dubs = details.get("dubs", [])
        title = details.get("title")
        cover = details.get("cover")
        is_coming_soon = bool(details.get("coming_soon") and len(streams) == 0)
        trailer_url = details.get("trailer_url")
        det_type = details.get("type", "")
        det_release = str(details.get("release_date") or "")[:4] or None
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
    if title and not is_coming_soon:
        is_ser = bool(det_type == "Series" or local_se > 0 or local_ep > 0)
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
def get_captions(subject_id: str, se: int = 0, ep: int = 0, stream_id: Optional[str] = None):
    subs = engine.get_subtitles(subject_id, stream_id=stream_id, season=se, episode=ep)
    return {
        "subject_id": subject_id,
        "season": se,
        "episode": ep,
        "count": len(subs),
        "captions": subs
    }

@app.get("/api/subtitles/online")
def search_online_subtitles(title: str = Query(..., min_length=1), imdb_id: Optional[str] = None, se: int = 0, ep: int = 0, lang: Optional[str] = None):
    headers = {"User-Agent": "TemporaryUserAgent"}
    url = None
    if imdb_id:
        num = imdb_id.lower().replace("tt", "").strip()
        if num.isdigit():
            if se > 0 and ep > 0:
                url = f"https://rest.opensubtitles.org/search/episode-{ep}/imdbid-{num}/season-{se}/sublanguageid-all"
            else:
                url = f"https://rest.opensubtitles.org/search/imdbid-{num}/sublanguageid-all"
    if not url:
        safe_q = urllib.parse.quote(title.strip())
        url = f"https://rest.opensubtitles.org/search/query-{safe_q}/sublanguageid-all"

    results = []
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            if isinstance(data, list):
                seen = set()
                for item in data:
                    dl = item.get("SubDownloadLink")
                    if not dl or dl in seen:
                        continue
                    seen.add(dl)
                    lan_name = item.get("LanguageName") or "English"
                    lan_code = item.get("SubLanguageID") or "en"
                    if lang and lang.lower() != "all" and lan_code.lower() != lang.lower() and lang.lower() not in lan_name.lower():
                        continue
                    results.append({
                        "id": str(item.get("IDSubtitleFile") or len(results) + 1),
                        "language": lan_name,
                        "code": lan_code,
                        "filename": item.get("SubFileName") or f"{title}.srt",
                        "downloads": str(item.get("SubDownloadsCnt") or "0"),
                        "rating": str(item.get("SubRating") or "0"),
                        "download_url": dl,
                        "proxy_url": f"/api/proxy/online-caption?url={urllib.parse.quote(dl)}"
                    })
    except Exception:
        pass

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
@app.get("/api/admin/deploy")
async def trigger_server_deploy(secret: Optional[str] = Query(None)):
    if secret != "moviebox_deploy_2026":
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
            # Schedule restart in 1 second so current HTTP response finishes cleanly
            subprocess.Popen(["bash", "-c", "sleep 1 && sudo systemctl restart moviebox"])
            log_lines.append("Service restart scheduled in 1s")
        except Exception as e:
            log_lines.append(f"error: {str(e)}")
        return "\n".join(log_lines)

    loop = asyncio.get_event_loop()
    res = await loop.run_in_executor(_bg_executor, _pull_and_restart)
    app_cache.delete("feed:home_curated")
    return {"status": "success", "message": "Deployed latest GitHub commit", "log": res}


@app.get("/movies")
def get_movies(page: int = 1, per_page: int = 24, sort: str = "RECOMMEND", category: str = "all"):
    feed = engine.get_curated_feed()

    # Category shelf direct access
    if category in ("hollywood", "bollywood", "cinema", "south_indian", "trending"):
        items = feed.get(category, [])
        total = len(items)
        start = (page - 1) * per_page
        end = start + per_page
        return {
            "page": page,
            "per_page": per_page,
            "total": total,
            "category": category,
            "items": items[start:end]
        }

    # Consolidated movies from verified curated shelves (100% genuine cinema, 0 songs)
    curated_movies = []
    seen = set()
    for cat in ["trending", "cinema", "hollywood", "bollywood", "south_indian"]:
        for it in feed.get(cat, []):
            if it["subject_id"] not in seen:
                seen.add(it["subject_id"])
                curated_movies.append(it)

    cache_key = f"movies:{page}:{per_page}:{sort}:{category}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    filtered_items = []
    try:
        url = f"{API_BASE}/subject/filter"
        payload = {
            "tabId": 2,
            "filter": {"sort": sort, "genre": "ALL", "country": "ALL", "year": "ALL", "language": "ALL"},
            "page": page,
            "perPage": per_page * 2
        }
        resp = engine.session.post(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=12)
        raw = resp.json().get("data", {}).get("items") or []
        for s in raw:
            # strictly exclude clips, songs, and adult content
            if s.get("subjectType") == 6 or is_adult_content(s):
                continue
            if not s.get("title"):
                continue
            sid = str(s.get("subjectId"))
            if sid not in seen:
                seen.add(sid)
                cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                filtered_items.append({
                    "title": s.get("title"),
                    "subject_id": sid,
                    "subject_type": s.get("subjectType"),
                    "detail_path": s.get("detailPath"),
                    "cover": cover_url,
                    "rating": s.get("imdbRatingValue"),
                    "genre": s.get("genre"),
                    "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else None,
                    "type": "Movie" if s.get("subjectType") == 1 else "TV Series"
                })
    except Exception:
        pass

    all_items = curated_movies + filtered_items
    start = (page - 1) * per_page
    end = start + per_page
    res = {
        "page": page,
        "per_page": per_page,
        "total": len(all_items),
        "category": category,
        "items": all_items[start:end]
    }
    app_cache.set(cache_key, res, ttl=300)
    return res

@app.get("/tv-series")
def get_tv_series(page: int = 1, per_page: int = 24, sort: str = "RECOMMEND", category: str = "all"):
    feed = engine.get_curated_feed()
    curated_series = []
    seen = set()
    for cat in ["series", "anime", "asian_drama"]:
        for it in feed.get(cat, []):
            if it["subject_id"] not in seen:
                seen.add(it["subject_id"])
                curated_series.append(it)

    cache_key = f"tv:{page}:{per_page}:{sort}:{category}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    filtered_items = []
    try:
        url = f"{API_BASE}/subject/filter"
        payload = {
            "tabId": 5,
            "filter": {"sort": sort, "genre": "ALL", "country": "ALL", "year": "ALL", "language": "ALL"},
            "page": page,
            "perPage": per_page * 2
        }
        resp = engine.session.post(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, json=payload, timeout=12)
        raw = resp.json().get("data", {}).get("items") or []
        for s in raw:
            # strictly exclude clips, songs, and adult content
            if s.get("subjectType") == 6 or is_adult_content(s):
                continue
            if not s.get("title"):
                continue
            sid = str(s.get("subjectId"))
            if sid not in seen:
                seen.add(sid)
                cover_url = s.get("cover", {}).get("url") if isinstance(s.get("cover"), dict) else None
                filtered_items.append({
                    "title": s.get("title"),
                    "subject_id": sid,
                    "subject_type": s.get("subjectType"),
                    "detail_path": s.get("detailPath"),
                    "cover": cover_url,
                    "rating": s.get("imdbRatingValue"),
                    "genre": s.get("genre"),
                    "year": s.get("releaseDate", "")[:4] if s.get("releaseDate") else None,
                    "type": "TV Series"
                })
    except Exception:
        pass

    all_items = curated_series + filtered_items
    start = (page - 1) * per_page
    end = start + per_page
    res = {
        "page": page,
        "per_page": per_page,
        "total": len(all_items),
        "category": category,
        "items": all_items[start:end]
    }
    app_cache.set(cache_key, res, ttl=300)
    return res

@app.get("/home")
def get_home():
    url = f"{API_BASE}/home?host=moviebox.ph"
    resp = engine.session.get(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://moviebox.ph/"}, timeout=20)
    return resp.json()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
