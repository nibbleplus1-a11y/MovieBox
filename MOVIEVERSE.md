# MovieVerse — Master Ecosystem Architecture, Deployment, Secrets & Models Documentation

> **AI INGESTION & DEVELOPER DIRECTIVE:**
> This document is the comprehensive, authoritative single-source-of-truth for the **MovieVerse** (formerly known as *CineScope* / *MovieBox*) streaming ecosystem. It contains every architectural component, API endpoint, HMAC signing algorithm, secret key, data schema, cloud fallback server, GitHub Actions CI/CD deployment pipeline, Oracle Cloud VPS infrastructure configuration, and mobile/web client detail from top to bottom. Any AI agent or developer reading this document will possess 100% operational context to debug, extend, maintain, and deploy the entire platform without external references.

---

## 1. Executive Summary & Brand Identity

* **Platform Name**: MovieVerse (formerly CineScope / MovieBox)
* **Primary Production Domain**: [https://movieverse.click](https://movieverse.click)
* **Production Server IP**: `137.23.40.164` (Oracle Cloud Infrastructure, Ubuntu 22.04 LTS)
* **Repository**: `nibbleplus1-a11y/MovieBox` (Branch: `main`)
* **Core Functionality**:
  1. High-throughput FastAPI streaming backend reverse-engineering MovieBox Mobile BFF APIs.
  2. Proprietary HMAC-MD5 request signing, TLS/JA3 device impersonation (Pixel 8 / Android 14), and CloudFront signed policy resolution.
  3. Resilient multi-tier streaming failover: Direct 1080p MP4 CDN streams → 6 Cloud Embed Fallback Servers (AutoEmbed, MultiEmbed, VidSrc Pro, VidSrc Mirror, SmashyStream, 2Embed Cinema).
  4. Global catalog search with Cinemeta Stremio fallback for geo-blocked environments.
  5. Responsive Cinema Web App (Vanilla JS + Plyr HTML5 Player + PWA + Adsterra/Monetag monetization).
  6. CineScope Standalone Android App (React Native / Expo 51 + Native WebView + In-App Auto-Update Engine).

---

## 2. All Secrets, Keys, Tokens & Credentials

### 2.1 Backend Administration & Deployment Secrets
| Secret Name | Value | Purpose / Location |
|---|---|---|
| `DEPLOY_SECRET` | `moviebox_deploy_2026` | Authenticates all administrative endpoints: `/api/admin/deploy`, `/api/admin/set-version`, `/api/admin/upload-apk`, `/api/admin/journal`, `/api/admin/debug-upstream`, `/api/admin/setup-ssl`. Configured in environment variables & GitHub Actions Secrets. |
| `SERVER_URL` | `https://movieverse.click` | Root URL for GitHub Actions deployment and automated APK artifact delivery. (Fallback: `http://137.23.40.164`). |
| `ORACLE_SSH_USER` | `ubuntu` | Default administrative Linux user on Oracle Cloud VM. |
| `DEPLOY_PATH` | `/home/ubuntu/MovieBox` | Working directory of backend service on the Oracle Cloud VPS. |

### 2.2 Reverse-Engineered MovieBox Upstream HMAC Keys
The upstream MovieBox Android BFF uses dual-layered base64-encoded secret keys to verify request authenticity via `x-tr-signature`.

```python
SECRET_KEY_DEFAULT_B64 = "NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw=="
SECRET_KEY_ALT_B64     = "WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ=="
```

#### Key Decoding Mechanism:
1. First Base64 decode produces an intermediate string (e.g. `76iRl07s0xcN9jqmEWAt79EBJZu...`).
2. Second Base64 decode yields the raw binary key used for `hmac.new(key, canonical_bytes, hashlib.md5)`.

### 2.3 Upstream Client Tokens & Headers Generation
* **Modern Android User Agent**:
  `com.community.mbox.in/50020130 (Linux; U; Android 14; en_IN; Pixel 8; Build/UD1A.230803.041; Cronet/145.0.7582.0)`
* **Desktop Browser User Agent**:
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`
* **Default Long-Lived Web Token**:
  `DEFAULT_WEB_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjU0MjU2MTE3OTA0MDExMjgyNjQsImF0cCI6MywiZXh0IjoiMTc5NTM2NjA1MCIsImV4cCI6MTgwMzE0MjA1MCwiaWF0IjoxNzk1MzY1NzUwfQ.-3citGwVXCQ2QoETzv1wh6A0c_SfTlXGFPxdT-m4aOE"`
* **Client Token (`x-client-token`) Calculation**:
  ```python
  def generate_x_client_token(timestamp: int) -> str:
      ts_str = str(timestamp)
      reversed_ts = ts_str[::-1].encode("utf-8")
      return f"{ts_str},{hashlib.md5(reversed_ts).hexdigest()}"
  ```
* **Request Signature (`x-tr-signature`) Canonical String**:
  ```text
  METHOD (uppercase)
  ACCEPT header
  CONTENT-TYPE header
  BODY_LENGTH (or empty string if no body)
  TIMESTAMP (Unix epoch in milliseconds)
  MD5(BODY_BYTES[:102400]) (or empty string if no body)
  CANONICAL_URL (path + sorted query parameters)
  ```
  Format: `{timestamp}|2|{base64(hmac_md5_digest)}`
* **Client Info (`x-client-info`) JSON**:
  ```json
  {
    "package_name": "com.community.mbox.in",
    "version_name": "4.0.03.0920.03",
    "version_code": 50020130,
    "os": "android",
    "os_version": "14",
    "device_id": "<random_16_byte_hex>",
    "install_store": "official",
    "gaid": "1b2212c1-dadf-43c3-a0c8-bd6ce48ae22d",
    "brand": "Google",
    "model": "Pixel 8",
    "system_language": "en",
    "net": "NETWORK_WIFI",
    "region": "IN",
    "timezone": "Asia/Calcutta",
    "sp_code": ""
  }
  ```

### 2.4 Ad Network & Monetization Configuration (`ad_config.json`)
```json
{
  "enabled": true,
  "test_mode": false,
  "monetag": {
    "enabled": true,
    "zone_id": "306845",
    "script_url": "https://quge5.com/88/tag.min.js",
    "direct_link": "https://uplcm.com/4/12213398",
    "preroll_enabled": true,
    "preroll_duration_seconds": 5,
    "preroll_cooldown_seconds": 180,
    "exit_interstitial_enabled": true,
    "exit_cooldown_seconds": 300
  },
  "adsterra": {
    "enabled": true,
    "social_bar_enabled": true,
    "social_bar_script_url": "https://bancadeltempoidea.org/14/864b2583dd6f8b32bbfd87b7b4af65c8",
    "direct_link": "https://asiafilm.org/4/c59f31c3db10b336a8c574304c2e9b41",
    "native_banner_enabled": true,
    "banner_key": ""
  },
  "service_worker_push": {
    "domain": "3nbf4.com",
    "zone_id": 12207544,
    "sw_path": "/sw.js"
  },
  "download_gate": {
    "enabled": true,
    "delay_seconds": 5,
    "sponsor_url": "https://uplcm.com/4/12213398",
    "headline": "Free 1080p Download Unlocked by Sponsor"
  }
}
```

---

## 3. System Architecture & Upstream Endpoints

### 3.1 Network Architecture Diagram
```
                     ┌──────────────────────────────────────────────┐
                     │          Global User Traffic                 │
                     │  (Web Browser / PWA / Android Native App)    │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │         Nginx Reverse Proxy & SSL            │
                     │             movieverse.click                 │
                     │            (Port 80 -> 443 HTTPS)            │
                     └──────────────────────┬───────────────────────┘
                                            │
                       ┌────────────────────┴───────────────────┐
                       │ (Proxy Pass 127.0.0.1:8000)             │
                       ▼                                        ▼
    ┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
    │  FastAPI Application Core (api.py)   │  │ Static Assets & Direct APK Hosting │
    │  • SimpleCache (In-memory TTL)       │  │ • /download/app -> MovieVerse.apk  │
    │  • ThreadPoolExecutor (_bg_executor) │  │ • /sw.js, /manifest.json           │
    │  • Curl CFFI (TLS JA3 Bypass)        │  │ • Plyr Cinema Web UI (app.js)      │
    └──────────────────┬───────────────────┘  └────────────────────────────────────┘
                       │
       ┌───────────────┼────────────────────────┐
       ▼               ▼                        ▼
┌──────────────┐ ┌───────────────┐ ┌────────────────────────────────────────┐
│ Native MBox  │ │ Cinemeta      │ │ 6 Cloud Fallback Video Embed Servers   │
│ Upstream BFF │ │ Stremio API   │ │ 1. VidSrc Pro   2. AutoEmbed           │
│ api3/api     │ │ (Geo-Fallback)│ │ 3. MultiEmbed   4. VidSrc Mirror       │
│ .aoneroom.com│ │ v3-cinemeta   │ │ 5. SmashyStream 6. 2Embed Cinema       │
└──────────────┘ └───────────────┘ └────────────────────────────────────────┘
```

### 3.2 Upstream Host Cluster
1. **Native MovieBox Mobile BFF**:
   * Primary: `https://api3.aoneroom.com`
   * Alternate 1: `https://api.aoneroom.com`
   * Alternate 2: `https://apig.inmoviebox.com`
   * Alternate 3: `https://api-in.inmoviebox.com`
2. **Native MovieBox Web BFF**:
   * `https://h5-api.aoneroom.com/wefeed-h5api-bff`
3. **Cinemeta Stremio Metadata Provider**:
   * `https://v3-cinemeta.strem.io/meta/{type}/{imdb_id}.json`
   * `https://v3-cinemeta.strem.io/catalog/{type}/top/search={query}.json`
4. **Online Subtitle Repositories**:
   * OpenSubtitles REST API (`https://api.opensubtitles.com/api/v1/subtitles`)
   * Subsource Scraper Engine

### 3.3 The 6 Cloud Fallback Video Servers
When native MovieBox direct streams are restricted, geo-blocked, or DASH/MPD only, MovieVerse automatically resolves the title's IMDb ID (`tt*`) and generates stream URLs for 6 resilient cloud fallback servers:

| Priority | Server Name | Movie URL Pattern | TV Show URL Pattern |
|---|---|---|---|
| **Server 1** | **VidSrc Pro** | `https://vidsrc.pro/embed/movie/{imdb_id}` | `https://vidsrc.pro/embed/tv/{imdb_id}/{se}/{ep}` |
| **Server 2** | **AutoEmbed** | `https://autoembed.co/movie/imdb/{imdb_id}` | `https://autoembed.co/tv/imdb/{imdb_id}-{se}-{ep}` |
| **Server 3** | **MultiEmbed** | `https://multiembed.mov/?video_id={imdb_id}` | `https://multiembed.mov/?video_id={imdb_id}&s={se}&e={ep}` |
| **Server 4** | **VidSrc Mirror** | `https://vidsrc.to/embed/movie/{imdb_id}` | `https://vidsrc.to/embed/tv/{imdb_id}/{se}/{ep}` |
| **Server 5** | **SmashyStream** | `https://player.smashystream.com/movie/{imdb_id}` | `https://player.smashystream.com/tv/{imdb_id}?s={se}&e={ep}` |
| **Server 6** | **2Embed Cinema** | `https://www.2embed.cc/embed/{imdb_id}` | `https://www.2embed.cc/embedtv/{imdb_id}&s={se}&e={ep}` |

---

## 4. Current Data Models & Schemas

### 4.1 Content Item & Feed Card Model (`MovieCard`)
Returned by `/api/feed/home-curated`, `/api/hero-trending`, `/movies`, `/tv-series`, and `/search`:
```typescript
interface MovieCard {
  id: string;                     // Numeric MovieBox ID or IMDb tt ID (e.g. "5074096615720375064" or "tt1375666")
  subject_id: string;             // Canonical ID for stream and detail requests
  title: string;                  // Display title (e.g. "Inception")
  type: "Movie" | "TV Series";    // Strictly validated content classification
  cover: string;                  // High-resolution vertical poster URL
  backdrop?: string;              // High-resolution landscape banner URL
  rating: number | string;        // IMDb / Upstream rating (e.g. 8.8)
  release_date: string;           // Year or release timestamp (e.g. "2010")
  duration?: string;              // Runtime formatted (e.g. "148 min")
  genre?: string[];               // Categorical tags (e.g. ["Action", "Sci-Fi"])
  description?: string;           // Synopsis / overview
  is_coming_soon?: boolean;       // True if content has not yet premiered
  imdb_id?: string;               // Normalized IMDb ID (e.g. "tt1375666")
}
```

### 4.2 Detailed Subject Information (`TitleDetail`)
Returned by `/detail/{subject_id}`:
```typescript
interface TitleDetail {
  id: string;
  subject_id: string;
  title: string;
  type: "Movie" | "TV Series";
  description: string;
  cover: string;
  backdrop: string;
  rating: string;
  release_date: string;
  duration: string;
  director: string;
  writers: string;
  cast: Array<{ name: string; avatar?: string; character?: string }>;
  genres: string[];
  imdb_id?: string;
  audio_languages: string[];     // Available multi-dub audio tracks (e.g. ["Hindi", "English", "Tamil"])
  seasons?: number;              // Total seasons count for TV series
  is_coming_soon: boolean;
  trailer_url?: string;
}
```

### 4.3 Streaming Link Response (`StreamResponse`)
Returned by `/api/stream/{subject_id}`:
```typescript
interface StreamResponse {
  subject_id: string;
  title: string;
  type: "Movie" | "TV Series";
  imdb_id?: string;
  season?: number;
  episode?: number;
  is_coming_soon: boolean;
  streams: DirectStream[];        // Direct MP4 CDN streams with valid cookies
  fallback_servers: FallbackServer[]; // Cloud embed servers when direct CDN streams are unavailable
  captions?: CaptionItem[];       // Authenticated SRT/VTT subtitle files
}

interface DirectStream {
  id: string;
  name: string;                   // Server name (e.g. "Server 1 - 1080p Ultra HD")
  resolution: string;             // "1080p" | "720p" | "480p" | "360p"
  url: string;                    // Fully resolved direct playable MP4 URL
  format: "mp4" | "m3u8";
  size?: string;                  // File size (e.g. "2.1 GB")
  audio_track?: string;           // Audio dub tag (e.g. "Hindi Dub", "Original")
  headers?: Record<string, string>; // Cookies & Referer headers required for playback
}

interface FallbackServer {
  id: string;                     // "server_1", "server_2", etc.
  name: string;                   // Display name (e.g. "Server 2: AutoEmbed")
  url: string;                    // Iframe embed URL
  quality: string;                // "1080p Cloud"
  priority: number;
}
```

### 4.4 Season & Episode Model (`EpisodesResponse`)
Returned by `/episodes/{subject_id}`:
```typescript
interface EpisodesResponse {
  subject_id: string;
  total_seasons: number;
  seasons: SeasonItem[];
}

interface SeasonItem {
  season_number: number;
  title: string;                  // e.g. "Season 1"
  episode_count: number;
  episodes: EpisodeItem[];
}

interface EpisodeItem {
  episode_number: number;
  title: string;                  // e.g. "Winter Is Coming"
  description?: string;
  thumbnail?: string;
  duration?: string;
  has_stream: boolean;
}
```

### 4.5 Subtitle Search Model (`OnlineSubtitlesResponse`)
Returned by `/api/subtitles/online`:
```typescript
interface OnlineSubtitlesResponse {
  title: string;
  subtitles: SubtitleItem[];
}

interface SubtitleItem {
  id: string;
  language: string;               // e.g. "English", "Spanish", "Arabic"
  code: string;                   // ISO 639-1/2 code (e.g. "eng", "spa")
  filename: string;
  downloads: string | number;
  rating: string | number;
  download_url: string;           // Original upstream download URL
  proxy_url: string;              // CORS-free local proxy URL (/api/proxy/online-caption?url=...)
}
```

### 4.6 App Version & Auto-Update Model (`AppVersionResponse`)
Returned by `/api/app-version`:
```typescript
interface AppVersionResponse {
  version: string;                // Semantic version (e.g. "1.4.5")
  version_code: number;           // Android versionCode (e.g. 29)
  download_url: string;           // GitHub CDN release APK download URL
  cdn_download_url: string;       // Fast global CDN URL
  fallback_url: string;           // VPS hosted fallback URL (https://movieverse.click/cinescope.apk)
  changelog: string;              // User-facing markdown / emoji update notes
  force_update: boolean;          // True blocks app usage until updated
}
```

---

## 5. Primary Backend API Route Catalog

All routes defined in `api.py`:

| Method | Route Path | Auth / Secret | Caching | Description |
|---|---|---|---|---|
| `GET` | `/` | None | None | Serves Cinema Web App UI (`static/index.html`). |
| `GET` | `/api/health` | None | None | Instant liveness check returning `{"status": "ok", "app": "MovieVerse"}`. |
| `GET` | `/api/app-version` | None | In-memory | Serves version metadata for in-app updates. |
| `POST` | `/api/admin/set-version` | `DEPLOY_SECRET` | None | Updates live app version metadata (`app_version.json`). |
| `POST` | `/api/admin/upload-apk` | `DEPLOY_SECRET` | None | Direct binary upload saving APK to `static/movieverse.apk` & `cinescope.apk`. |
| `POST` | `/api/admin/deploy` | `DEPLOY_SECRET` | Clears all | Git fetch, reset `--hard origin/main`, pip install, restarts systemd service. |
| `GET` | `/api/admin/journal` | `DEPLOY_SECRET` | None | Returns live `journalctl -u moviebox -n {lines}` log stream. |
| `GET` | `/api/admin/debug-upstream` | `DEPLOY_SECRET` | None | Diagnostic probe testing token, curl_cffi, and upstream connectivity. |
| `POST` | `/api/admin/setup-ssl` | `DEPLOY_SECRET` | None | Executes `setup-ssl.sh` with Let's Encrypt Certbot. |
| `GET` | `/api/feed/home-curated` | None | 600s TTL | Curated home shelves: Trending, Cinema, Hollywood, Bollywood, Series, Anime. |
| `GET` | `/api/hero-trending` | None | 600s TTL | Top 10 high-resolution hero backdrop items for main banner slider. |
| `GET` | `/detail/{subject_id}` | None | 3600s TTL | Full title metadata, director, cast, IMDb rating, audio dub list, coming soon status. |
| `GET` | `/api/stream/{subject_id}` | None | 1800s TTL | Resolves 1080p direct MP4 streams or generates 6 Cloud Fallback Embeds (`se` & `ep` for series). |
| `GET` | `/episodes/{subject_id}` | None | 3600s TTL | Returns all seasons, episodes, thumbnails, and descriptions for TV series. |
| `GET` | `/search` | None | 300s TTL | Multi-source search (Native MovieBox → Cinemeta Stremio fallback for geo-blocked VPS). |
| `GET` | `/movies` | None | 600s TTL | Filtered catalog containing verified movie releases only. |
| `GET` | `/tv-series` | None | 600s TTL | Filtered catalog containing verified television series releases only. |
| `GET` | `/api/subtitles/online` | None | 3600s TTL | Multi-source online subtitle search (OpenSubtitles & Subsource). |
| `GET` | `/api/proxy/stream` | None | None | Proxies video streams with Range headers, Referer injection, and chunk streaming. |
| `GET` | `/api/proxy/caption` | None | 86400s TTL | Proxies SRT/VTT captions with CORS headers (`Access-Control-Allow-Origin: *`). |
| `GET` | `/api/proxy/online-caption`| None | 86400s TTL | Proxies gzip-compressed OpenSubtitles caption files decompressed on-the-fly. |
| `GET` | `/download/app` | None | None | Direct download redirect for latest `MovieVerse.apk`. |
| `GET` | `/sw.js` | None | None | Service worker script for PWA & push notifications. |

---

## 6. GitHub Actions CI/CD & Deployment Workflows

The repository contains 3 dedicated GitHub Actions workflows in `.github/workflows/`:

### 6.1 Automatic VPS Deployment (`.github/workflows/deploy.yml`)
* **Trigger**: Push to `main` branch.
* **Runner**: `ubuntu-latest`.
* **Execution**:
  Executes an authenticated HTTP POST request to the Oracle Cloud VPS deploy endpoint:
  ```bash
  curl -sSf -X POST -m 60 "https://movieverse.click/api/admin/deploy?secret=moviebox_deploy_2026"
  ```
* **Server Action**: The VPS executes `git fetch origin main`, `git reset --hard origin/main`, `pip install -r requirements.txt`, flushes internal caches, and restarts the `moviebox` systemd service cleanly.

### 6.2 Standalone Android APK Build & Release (`.github/workflows/build-cinescope-apk.yml`)
* **Trigger**: Push to `cinescope/**`, `api.py`, or manual `workflow_dispatch`.
* **Environment**: Node.js 22 (LTS), Java 17 (Temurin), Android SDK 35.
* **Build Steps**:
  1. Installs npm dependencies in `cinescope/`.
  2. Ensures valid Android release keystore exists (`debug.keystore`).
  3. Executes Gradle compilation: `./gradlew :app:assembleRelease --stacktrace --no-daemon`.
  4. Automatically publishes GitHub Release tagged `v{version}` with `MovieVerse.apk`.
  5. Deploys the built APK directly to the Oracle Cloud Server:
     ```bash
     curl -X POST --data-binary "@MovieVerse.apk" "https://movieverse.click/api/admin/upload-apk?secret=moviebox_deploy_2026"
     ```
  6. Updates live version metadata via `/api/admin/set-version`.

### 6.3 Buildozer Debug APK Builder (`.github/workflows/build-android.yml`)
* **Trigger**: Push to `android_app/**` or manual `workflow_dispatch`.
* **Environment**: Ubuntu 22.04, Python 3.11, Buildozer, Cython.
* **Build Steps**: Compiles legacy Kivy/Python WebView wrapper APK and uploads as GitHub Actions artifact.

---

## 7. Oracle Cloud VPS Server Setup & Runbook

### 7.1 Server Specifications
* **IP Address**: `137.23.40.164`
* **Operating System**: Ubuntu 22.04 LTS x86_64
* **User**: `ubuntu`
* **Codebase Path**: `/home/ubuntu/MovieBox`
* **Python Environment**: `/home/ubuntu/MovieBox/venv` (Python 3.10+)

### 7.2 Systemd Service Configuration
Service file: `/etc/systemd/system/moviebox.service`
```ini
[Unit]
Description=MovieBox Streaming Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/MovieBox
ExecStart=/home/ubuntu/MovieBox/venv/bin/python -m uvicorn api:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 7.3 Nginx Reverse Proxy Configuration
Config file: `/etc/nginx/sites-available/default`
```nginx
server {
    server_name movieverse.click www.movieverse.click;
    client_max_body_size 100M;

    # High-throughput streaming proxy (buffering disabled for instant video start)
    location /api/proxy/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # Standard API and static web application
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/movieverse.click/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/movieverse.click/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name movieverse.click www.movieverse.click;
    return 301 https://$host$request_uri;
}
```

### 7.4 Common VPS Commands
```bash
# Check service status
sudo systemctl status moviebox

# Restart service manually
sudo systemctl restart moviebox

# Tail live application logs
journalctl -u moviebox -f

# Verify Nginx configuration and reload
sudo nginx -t && sudo systemctl reload nginx

# Check listening ports
sudo ss -tulpn | grep -E '80|443|8000'
```

---

## 8. Web & Mobile Client Architectures

### 8.1 Cinema Web Application (`static/`)
* **HTML Structure (`index.html`)**: Semantic cinema layout with Hero Carousel, Continue Watching shelf, Curated Shelves (Trending, Movies, TV Series, Anime), Search Modal, Detail Drawer, and Plyr Video Player container.
* **Core Logic (`app.js`)**:
  * **Video Engine**: Plyr HTML5 player with multi-audio dub switching, resolution selector (1080p/720p/480p), and custom server selector modal (Server 1 Direct → Server 2-6 Cloud Embeds).
  * **Subtitle Engine**: On-the-fly subtitle fetcher via `/api/subtitles/online` with WebVTT track injection and text styling.
  * **State & Resume**: `localStorage` persistence (`moviebox_continue`) tracking exact season, episode, and playback timestamp (seconds).
  * **Monetization**: Adsterra Social Bar (`bancadeltempoidea.org`), Monetag MultiTag (`quge5.com`), and sponsored download countdown gate.

### 8.2 CineScope React Native Mobile Client (`cinescope/`)
* **Framework**: React Native 0.74 / Expo 51, React Navigation 6 (Stack + Bottom Tabs).
* **Key Components**:
  * `PlayerWebView.tsx`: Fullscreen HTML5 video viewport embedded in native Android WebView with landscape auto-rotation, gesture scrubbers, and screen lock mode.
  * `PlayerBottomSheet.tsx`: Responsive modal bottom sheet for Audio Dubs, Video Quality, Subtitles (with live online search), and Season/Episode selection.
  * `WatchProgressService.ts`: `AsyncStorage`-backed history engine (`@cinescope_watch_progress`) saving position every 4 seconds.
  * `UpdateModal.tsx` & `updateService.ts`: In-app auto-updater comparing local `versionCode` against `/api/app-version`, providing one-click background download and native APK installation intent (`application/vnd.android.package-archive`).

---

## 9. Critical Edge Cases, Bug Solutions & Historical Fixes

### 9.1 VPS Geo-Blocking & Cinemeta Fallback (`tt*` ID Routing)
* **Problem**: Upstream MovieBox servers block European/US datacenter IPs (like Oracle Cloud), causing search queries to fail.
* **Solution**: Search queries automatically fall back to Cinemeta Stremio API. Results return IMDb IDs (`tt*`).
* **Critical Fix in `api.py`**:
  * Engine's `get_details()` natively rejected `tt*` IDs with 400 errors (as upstream expects numeric IDs).
  * In `_get_details_with_card_fallback`, added automatic Cinemeta metadata resolution when `subject_id.startswith("tt")`.
  * Stream resolver detects `subject_id.startswith("tt")` and immediately generates the 6 Cloud Fallback Embed Servers, skipping costly upstream round-trips.

### 9.2 Fullscreen Episodes Sheet Collapsing in Mobile
* **Problem**: When users opened the episode selector in landscape mode, the bottom sheet header appeared but the episode list was collapsed to 0 height.
* **Cause**: Yoga layout engine in React Native collapsed `flex: 1` containers inside unbounded parents.
* **Solution**: Explicitly set dynamic sheet height in `PlayerBottomSheet.tsx`:
  `height = isFullscreen ? Math.min(windowHeight * 0.90, 390) : Math.min(windowHeight * 0.72, 540)`.

### 9.3 Content Classification Accuracy (Movie vs TV Series)
* **Problem**: Upstream frequently omitted `subjectType` or returned `None`, causing Hollywood movies to show "TV Series" badges and season tabs.
* **Solution**: Built `classify_content_type()` in `api.py` with title regex patterns (`Season \d+`, `S\d+E\d+`) and episode list heuristics, properly tagging cinema items as `"Movie"`.

### 9.4 Character Encoding Glitches ("Â" Bug)
* **Problem**: Corrupted Latin1/Windows-1252 strings appeared in UI (e.g. `Play S1 Â· E1`, `â˜... 8.2`).
* **Solution**: Sanitized all strings across `api.py`, `app.js`, and `DetailScreen.tsx` to strictly output clean UTF-8 Unicode symbols (`·`, `★`, `▼`, `▲`).

### 9.5 Subtitle CORS & Gzip Compression
* **Problem**: OpenSubtitles `.srt.gz` files were blocked by browser CORS policy or failed to parse due to gzip compression.
* **Solution**: Added `/api/proxy/online-caption?url={encoded}` endpoint which downloads the remote subtitle, decompresses gzip archives in-memory, converts encoding to UTF-8, and serves plain text with `Access-Control-Allow-Origin: *`.

---

## 10. Summary Checklist for Any Future AI Agent
1. **To Deploy Code Changes**: Commit and push to `origin/main`. GitHub Actions will trigger `POST /api/admin/deploy?secret=moviebox_deploy_2026`.
2. **To Build New Mobile APK**: Update version in `cinescope/app.json`, `static/app_version.json`, and push. GitHub Actions will compile, publish a GitHub release, and upload the APK to the VPS.
3. **To Check VPS Logs**: Run `GET https://movieverse.click/api/admin/journal?secret=moviebox_deploy_2026&lines=100`.
4. **To Stream Content**: Use `/api/stream/{id}`. If `id` starts with `tt`, 6 fallback embed servers are returned; if numeric, native 1080p CDN MP4 streams are returned with fallback servers as backups.
5. **To Search**: Use `/search?q={query}`. Works globally with native + Cinemeta fallback.
