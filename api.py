from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    title="MovieBox 1080p API",
    description="REST API for MovieBox with 1080p Stream & Subtitle Extraction",
    version="2.5.0"
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
            "dubs": dubs
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
            season_list.append({
                "season": s.get("se", 1),
                "episode_count": s.get("maxEp", 1),
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

        try:
            url = f"{API_BASE}/home?host=movieboxhd.net"
            resp = self.session.get(url, headers={"User-Agent": WEB_USER_AGENT, "Referer": "https://movieboxhd.net/"}, timeout=12)
            data = resp.json().get("data", {})
            operating = data.get("operatingList", [])

            for op in operating:
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
                        if s.get("subjectType") == 6:  # skip video clips and songs
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
        except Exception:
            pass

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

@app.api_route("/api/proxy/stream", methods=["GET", "HEAD", "OPTIONS"])
async def proxy_stream(request: Request, url: str = Query(...), referer: Optional[str] = None, download: bool = False, filename: Optional[str] = None, subject_id: Optional[str] = None):
    if request.method == "OPTIONS":
        return Response(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400"
        })

    # Smart candidate referers to prevent 429 rate-limiting from hakunaymatata CDN
    candidate_refs = []
    if referer and "aoneroom.com" not in referer:
        candidate_refs.append(referer)
    if "hakunaymatata.com" in url:
        candidate_refs.extend(["https://movieboxonline.net/", "https://123moviesfree.club/", "https://moviebox.ph/"])
    else:
        candidate_refs.extend(["https://movieboxonline.net/", "https://api3.aoneroom.com/"])

    seen_refs = set()
    unique_refs = []
    for cr in candidate_refs:
        if cr not in seen_refs:
            seen_refs.add(cr)
            unique_refs.append(cr)

    range_header = request.headers.get("range", "bytes=0-")
    timeout = httpx.Timeout(connect=15.0, read=None, write=30.0, pool=30.0)
    client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
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
                break
            else:
                await r.aclose()
        except Exception:
            continue

    if resp is None or resp.status_code in (429, 403):
        await client.aclose()
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

    if download:
        safe_fn = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', filename or "MovieBox_Video").strip()
        if not safe_fn.endswith(".mp4"):
            safe_fn += ".mp4"
        response_headers["Content-Disposition"] = f'attachment; filename="{safe_fn}"'
    else:
        # Crucial: explicit inline disposition prevents browsers & download managers from halting playback
        response_headers["Content-Disposition"] = "inline"

    if request.method == "HEAD":
        await resp.aclose()
        await client.aclose()
        return Response(status_code=resp.status_code, headers=response_headers)

    async def content_iterator():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=131072):
                yield chunk
        except Exception:
            pass
        finally:
            try:
                await resp.aclose()
            except Exception:
                pass
            try:
                await client.aclose()
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

@app.get("/search")
def search(q: str = Query(..., min_length=1), page: int = 1, per_page: int = 20):
    safe_per_page = min(max(1, int(per_page or 20)), 20)
    try:
        results = engine.search(q, page=page, per_page=safe_per_page)
        return {"query": q, "page": page, "results": results}
    except Exception:
        return {"query": q, "page": page, "results": []}

@app.get("/search/suggest")
def search_suggest(q: str = Query(..., min_length=1)):
    # Return real subject search matches with genuine posters, types, and valid subject IDs
    real_results = engine.search(q, per_page=8)
    suggestions = []
    seen_ids = set()
    for item in real_results:
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
    if not res or not res.get("title"):
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
    
    if is_series or season > 0 or episode > 0:
        s = max(1, season)
        e = max(1, episode)
        return [
            {
                "name": "Server 2 (VidLink HD)",
                "id": "vidlink",
                "type": "iframe",
                "url": f"https://vidlink.pro/tv/{imdb_id}/{s}/{e}?primaryColor=7c3aed&secondaryColor=a855f7",
            },
            {
                "name": "Server 3 (VidSrc Cloud)",
                "id": "vidsrc_to",
                "type": "iframe",
                "url": f"https://vidsrc.to/embed/tv/{imdb_id}/{s}/{e}",
            },
            {
                "name": "Server 4 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={imdb_id}&s={s}&e={e}",
            },
            {
                "name": "Server 5 (SmashyStream Fast)",
                "id": "smashystream",
                "type": "iframe",
                "url": f"https://embed.smashystream.com/playere.php?imdb={imdb_id}&season={s}&episode={e}",
            },
            {
                "name": "Server 6 (2Embed Mirror)",
                "id": "2embed",
                "type": "iframe",
                "url": f"https://www.2embed.cc/embedtv/{imdb_id}&s={s}&e={e}",
            },
        ]
    else:
        return [
            {
                "name": "Server 2 (VidLink HD)",
                "id": "vidlink",
                "type": "iframe",
                "url": f"https://vidlink.pro/movie/{imdb_id}?primaryColor=7c3aed&secondaryColor=a855f7",
            },
            {
                "name": "Server 3 (VidSrc Cloud)",
                "id": "vidsrc_to",
                "type": "iframe",
                "url": f"https://vidsrc.to/embed/movie/{imdb_id}",
            },
            {
                "name": "Server 4 (MultiEmbed Global)",
                "id": "multiembed",
                "type": "iframe",
                "url": f"https://multiembed.mov/?video_id={imdb_id}",
            },
            {
                "name": "Server 5 (SmashyStream Fast)",
                "id": "smashystream",
                "type": "iframe",
                "url": f"https://embed.smashystream.com/playere.php?imdb={imdb_id}",
            },
            {
                "name": "Server 6 (2Embed Mirror)",
                "id": "2embed",
                "type": "iframe",
                "url": f"https://www.2embed.cc/embed/{imdb_id}",
            },
        ]

@app.get("/api/fallback-sources")
def get_fallback_sources(
    title: str = Query(...),
    year: Optional[str] = Query(None),
    is_series: bool = Query(False),
    season: int = Query(0),
    episode: int = Query(0),
    subject_id: Optional[str] = Query(None)
):
    imdb_id = resolve_imdb_id(title, year=year, is_series=is_series)
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
def get_streams(subject_id: str, se: int = 0, ep: int = 0, detail_path: Optional[str] = None, _bust: Optional[str] = None):
    if not subject_id or subject_id == "None":
        raise HTTPException(status_code=400, detail="Invalid subject ID")

    # If cache-bust requested, delete cached streams so we get fresh signed URLs
    if _bust:
        app_cache.delete_prefix(f"streams:{subject_id}:")

    streams = engine.get_streams(subject_id, season=se, episode=ep, detail_path=detail_path)
    # If se=0 and ep=0 returned no streams, check if this subject is a TV series (Season 1 Episode 1)
    if not streams and se == 0 and ep == 0:
        s1_streams = engine.get_streams(subject_id, season=1, episode=1, detail_path=detail_path)
        if s1_streams:
            streams = s1_streams
            se = 1
            ep = 1

    try:
        details = engine.get_details(subject_id)
        dubs = details.get("dubs", [])
        title = details.get("title")
        cover = details.get("cover")
        # Only mark coming_soon when the detail endpoint itself confirms it (date-based).
        is_coming_soon = bool(details.get("coming_soon") and len(streams) == 0)
        trailer_url = details.get("trailer_url")
    except Exception:
        dubs = []
        title = None
        cover = None
        is_coming_soon = False
        trailer_url = None

    # Resolve backup servers if available
    fallback_servers = []
    imdb_id = None
    if title and not is_coming_soon:
        is_ser = bool((details.get("type") if 'details' in locals() else None) == "Series" or se > 0 or ep > 0)
        yr = str(details.get("release_date") if 'details' in locals() else "")[:4] or None
        imdb_id = resolve_imdb_id(title, year=yr, is_series=is_ser)
        if imdb_id:
            fallback_servers = get_backup_servers(imdb_id, is_series=is_ser, season=se, episode=ep)

    return {
        "subject_id": subject_id,
        "season": se,
        "episode": ep,
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

@app.get("/api/feed/home-curated")
def get_home_curated():
    return engine.get_curated_feed()

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
            # strictly exclude clips, songs, and YouTube mashups (subjectType 6)
            if s.get("subjectType") == 6:
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
            if s.get("subjectType") == 6:
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

@app.get("/admin/clear-cache")
def clear_cache(prefix: Optional[str] = None):
    """Flush all cached data (or a specific prefix) so stale coming_soon / stream entries are refreshed."""
    if prefix:
        app_cache.delete_prefix(prefix)
        return {"cleared": f"prefix:{prefix}"}
    # Full flush
    app_cache.cache.clear()
    return {"cleared": "all"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
