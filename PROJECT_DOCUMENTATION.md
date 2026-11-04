# CineScope / MovieBox — Master Project Roadmap & Architecture Documentation

> **Notice for Future AI Sessions & Developers:**
> This document is the single source of truth for the MovieBox / CineScope streaming ecosystem. It documents the core architecture, requirements, all past and recent fixes, known bugs and their solutions, API specifications, and roadmap. If starting a new chat or workflow, review this file first to understand the state of the project.

---

## 1. Executive Overview & Purpose

**CineScope (MovieBox)** is a high-performance, full-stack video streaming platform consisting of:
1. **Python FastAPI Backend (`api.py`)**: Reverse-engineered Moviebox BFF client with TLS/JA3 client impersonation, signed CloudFront policy decoder, 1080p MP4 & DASH stream resolvers, multi-server cloud fallbacks, multi-language subtitle extractors, and feed aggregators.
2. **Desktop & Mobile Web Application (`static/` & `index.html`)**: Adaptive cinema web UI with Plyr-powered 1080p streaming, multi-audio dub switching, one-click online subtitle search, Continue Watching shelf with localStorage persistence, and infinite scrolling catalog.
3. **CineScope React Native / Expo Mobile App (`cinescope/`)**: Production-grade mobile streaming client built with Expo 51, TypeScript, React Navigation 6, and custom HTML5 WebView player with landscape auto-rotation, gesture scrubbers, screen locking, subtitle tracks, and `WatchProgressService` for cross-session resume.
4. **Android Native Builds (`moviebox_android/` & `.github/workflows/`)**: Standalone Android app setup with automated GitHub Actions CI/CD compiling signed release APKs and deploying to cloud infrastructure.

---

## 2. System Architecture & Codebase Map

```
Moviebox-API/
├── api.py                          # Primary FastAPI backend & Moviebox scraping/proxy engine
├── main.py                         # ASGI entrypoint
├── requirements.txt                # Python backend dependencies (FastAPI, httpx, curl_cffi, uvicorn)
├── static/                         # Web frontend client
│   ├── app.js                      # Core web client streaming & UI controller
│   ├── index.html                  # Responsive cinema web application
│   └── styles.css                  # Modern dark glassmorphic styling
├── cinescope/                      # React Native / Expo cross-platform mobile app
│   ├── screens/
│   │   ├── HomeScreen.tsx          # Featured hero slider & curated content shelves
│   │   ├── DetailScreen.tsx        # Title details, Resume/Play button, seasons & cast
│   │   ├── PlayerScreen.tsx        # Player container coordinating WebView & bottom sheets
│   │   ├── WatchlistScreen.tsx     # Bookmarked movies & series
│   │   └── SearchScreen.tsx        # Fast autocomplete & global search
│   ├── components/player/
│   │   ├── PlayerWebView.tsx       # Embedded HTML5 video viewport with subtitle track injector
│   │   ├── PlayerControls.tsx      # Fullscreen overlay (scrubber, lock, audio/subs/quality chips)
│   │   ├── PlayerBottomSheet.tsx   # Modal sheet for Audio Dubs, Quality, Subtitles, Episodes
│   │   └── PlayerDashboard.tsx     # Portrait quick tools & similar titles recommendations
│   ├── hooks/
│   │   └── usePlayerState.ts       # Unified player state, timeupdate throttler, and episode advancement
│   └── services/
│       ├── api.ts                  # Mobile HTTP API client
│       ├── watchProgress.ts        # AsyncStorage-backed watch history & resume service
│       └── watchlist.ts            # Saved titles service
├── moviebox_android/               # Standalone Android Gradle project for native APK compilation
├── .github/workflows/              # GitHub Actions CI/CD workflows (APK builds & Oracle Cloud deploy)
└── PROJECT_DOCUMENTATION.md        # This master documentation file
```

---

## 3. Project Requirements & Feature Scope ("What We Want")

### A. Video Playback & Resolvers
- **1080p Direct MP4 Streams**: Extract high-bitrate direct native CDN streams with valid signed cookies. Filter out DASH (.mpd) manifests for native players that lack MPD decoders.
- **Filter Out Interstitial Warnings**: Automatically purge MovieBox warning clips or update notice videos (identified by known hashes like `b164fbfb4347792950bdfbfb563d39d9`).
- **Cloud Fallback Servers**: When direct native CDN streams are unavailable or DASH-only, provide fallback cloud embed servers (Server 2: VidLink Pro, Server 3: AutoEmbed, Server 4: MultiEmbed, Server 5: EmbedSu) with automatic IMDb ID resolution.
- **Audio Dub Switching**: Seamlessly toggle between Hindi, Tamil, Telugu, Spanish, and Original Audio tracks without losing player context.

### B. Subtitles & Closed Captions
- **Single-Click Online Subtitle Search**: In both Web and Mobile, allow searching OpenSubtitles/Subsource online subtitle repositories for any title/season/episode.
- **Official Subtitle Proxy**: Proxy upstream SRT/VTT subtitles via `/api/proxy/caption` to prevent CORS blocking in web browsers and mobile WebViews.
- **Native Player Display**: Inject `<track>` elements with styled `video::cue` overlays so subtitles appear cleanly over video.

### C. Watch Progress & Pinpoint Resume Functionality
- **Cross-Session Resume**: When a user watches a TV series (e.g., The Mentalist Season 3, Episode 4), leaving and returning to the title must display `"Resume S3 · E4"` on the primary play button, NOT `"Play S1 · E1"`.
- **Progress Persistence**:
  - **Web**: Persisted in `localStorage` (`moviebox_continue`) with season, episode, and timestamp.
  - **Mobile**: Persisted in `AsyncStorage` (`@cinescope_watch_progress`) via `WatchProgressService`.
- **Immediate Save**: The moment a user clicks an episode or switches seasons, progress is saved immediately so closing the app or navigating away preserves their choice.

### D. Fullscreen & Mobile Player UX
- **Fullscreen Landscape Controls Parity**: Mobile fullscreen landscape must feature the same options as Web: Audio Dubs, Video Quality, Subtitles (with online search), Playback Speed, Streaming Servers, and Episodes.
- **Responsive Episodes Bottom Sheet**: In landscape mode (where screen height is limited to ~360–400px), bottom sheets must maintain an explicit, scaled height (`height: 88%` / `380px`) so inner `ScrollView` components never collapse to 0 height.
- **Screen Lock Mode**: Lock button in mobile controls preventing accidental touches while watching.

### E. Content Classification & Tagging Accuracy
- **Zero Misclassified Tags**:
  - Movies must never receive "Series", "TV Series", or season selector tabs.
  - Series must never be tagged as "Movie".
- **Intelligent Fallback Classifier**: When upstream MovieBox data has `subjectType: None` or missing, use intelligent regex heuristics on titles (e.g. `Season \d+`, `S01`) and episode endpoint checks rather than blindly defaulting to Series.

### F. Visual Polish & Clean Typography
- **Pristine Encoding**: Absolutely no UTF-8 character corruption (`Â·`, `â˜...`, `â–¾`). All middle dots, stars, and arrows must use clean Unicode (`·`, `★`, `▼`).
- **Modern Cinema Aesthetics**: Clean glassmorphic dark palette (`#080A0F`, `#12141C`, `#FF2E55`), smooth animations, and high contrast typography.

---

## 4. Key Fixes & Implementation Log ("What We Did")

### 1. Fix Episodes Bottom Sheet Collapsing in Fullscreen (`cinescope/components/player/PlayerBottomSheet.tsx`)
- **Problem**: When users tapped "Episodes" in fullscreen landscape on mobile, the modal displayed the header "TV Show Episodes" but the area below was completely blank and unscrollable (as shown in user screenshot `media_1793794103626.png`).
- **Root Cause**: The container had `maxHeight: '72%'` without a definite `height`. The child had `style={{ flex: 1 }}`. Under React Native's Yoga layout engine, a `flex: 1` child inside an unconstrained parent collapses to height 0.
- **Fix**: Sized `styles.bottomSheet` dynamically based on screen orientation (`sheetHeight = isFullscreen ? Math.min(windowHeight * 0.90, 390) : Math.min(windowHeight * 0.72, 540)`). Added `nestedScrollEnabled={true}` and fallback to `seasonsData[0].episodes` if season lookup failed.

### 2. Implement Mobile Subtitle Engine & Online Subtitle Search (`cinescope/`)
- **Problem**: In web player, users had one-click online subtitle search, but mobile had zero subtitle support in fullscreen.
- **Fix**:
  1. Updated `cinescope/services/api.ts` with `captions()`, `onlineSubtitles()`, and `proxyCaptionUrl()`.
  2. Updated `cinescope/components/player/PlayerWebView.tsx` with `video::cue` styling and `window.setSubtitleTrack(url, label)`.
  3. Added `subtitles` bottom sheet in `PlayerBottomSheet.tsx` featuring "Search Online Subtitles" with loading spinner and list of official + auto-matched subtitles.
  4. Added `Subs` quick chip to `PlayerControls.tsx` (top right) and `PlayerDashboard.tsx`.

### 3. Implement Watch Progress & Resume Engine (`cinescope/` & `static/app.js`)
- **Problem**: When a user watched Season 3 of Mentalist and returned to the detail screen, it showed "Play S1 · E1" instead of resuming.
- **Root Causes**:
  - In Mobile: No watch progress service existed. `selectedSeason` defaulted to 1, and the play button hardcoded `E1`.
  - In Web: `getLastWatchedProgress` had buggy logic (`if (activeMediaMeta.type === 'Movie') { item.season = 0; }`) that wiped saved season/episode data!
- **Fixes Applied**:
  - **Mobile**: Built `cinescope/services/watchProgress.ts` with `AsyncStorage` and in-memory cache.
  - **DetailScreen.tsx**: Integrated `WatchProgressService.get(id)` and `useFocusEffect` to dynamically show `"Resume S3 · E4"` or `"Resume (42m)"`.
  - **usePlayerState.ts**: Throttled auto-saving progress every 4-5 seconds and immediately on pause/ended/episode switch. Added `initialSeek` support.
  - **static/app.js**: Removed season-wiping bug from `getLastWatchedProgress` and added immediate progress saving in `playDetailEpisode`.

### 4. Fix Character Encoding Glitches ("Â" Bug)
- **Problem**: Corrupted characters appeared across the app (`Play S1 Â· E1`, `2008 Â· Series`, `â˜... 8.2`, `Read More â–¾`).
- **Fix**: Replaced all corrupted windows-1252 / latin1 sequences with pristine Unicode characters (`·`, `★`, `▼`, `▲`) in `DetailScreen.tsx`.

### 5. Fix Content Classification (Movies Tagged as Series & Vice-Versa)
- **Problem**: Movies in Hollywood, Cinema, and Trending shelves were given "TV Series" badges and season tags in web and mobile.
- **Root Cause**: `api.py` had hardcoded lines: `"type": "Movie" if s.get("subjectType") == 1 else "TV Series"`. Whenever upstream returned `subjectType: None` or missing, it defaulted to `"TV Series"`.
- **Fix**: Added `classify_content_type(subject_type, title, upstream_type)` in `api.py` with intelligent regex heuristics, defaulting to `"Movie"` for unclassified cinema items, and applied across `get_curated_feed()`, `get_details()`, `search()`, and catalog filters.

---

## 5. Primary Backend API Reference (`api.py`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/stream/{subject_id}` | `GET` | Resolves 1080p direct MP4 CDN streams, signed cookies, and fallback iframe servers (`se` and `ep` query params for series) |
| `/episodes/{subject_id}` | `GET` | Returns season breakdowns, episode lists, and resolutions for a TV series |
| `/detail/{subject_id}` | `GET` | Full title metadata, director, cast, IMDb rating, audio dub list, coming soon status |
| `/api/stream/{subject_id}/captions`| `GET` | Fetches authenticated official captions for movie or episode |
| `/api/subtitles/online` | `GET` | Single-click online subtitle search across OpenSubtitles/Subsource via title & season/ep |
| `/api/proxy/stream` | `GET/HEAD` | Proxies video streams with required Referer and Range request support |
| `/api/proxy/caption` | `GET` | Proxies SRT/VTT caption files with CORS headers for native Web and WebView players |
| `/api/feed/home-curated` | `GET` | Returns curated shelves (Trending, Cinema, Hollywood, Bollywood, Series, Anime) |
| `/movies` | `GET` | Paginated catalog strictly containing verified movies |
| `/tv-series` | `GET` | Paginated catalog strictly containing verified TV series |
| `/search?q={query}` | `GET` | Searches titles with deduplication, coming soon badges, and canonical title normalization |

---

## 6. How to Build & Run

### A. Run Backend Locally
```bash
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### B. Run Web Application
Open `http://localhost:8000` in any web browser.

### C. Run CineScope Mobile App (Expo)
```bash
cd cinescope
npx expo start
```

### D. Compile Android APKs via GitHub Actions
GitHub Actions workflow automatically builds release APKs on push or manual trigger:
- **MovieBox Native APK**: `.github/workflows/build-apk.yml`
- **CineScope Expo APK**: `.github/workflows/build-cinescope-apk.yml`
- **Oracle Cloud Deploy**: `.github/workflows/deploy.yml`
- Download compiled APKs from the GitHub Actions Artifacts or direct `/download/app` endpoint.
