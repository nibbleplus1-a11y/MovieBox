# CineScope / MovieBox Cinema — Master Architecture & Project Handbook

> **Notice for Future AI Agents & Developers:**
> This document is the single source of truth for the CineScope platform. If a user pastes or references this handbook in a new chat, read this entire document first before modifying any code. It contains the complete architectural blueprint, history of fixes, active features, and monetization plan.

---

## 1. System Overview & Architecture

CineScope is a dual-platform video streaming ecosystem providing fast 1080p video streaming, multi-language audio dubbing, multilingual subtitles (native + OpenSubtitles search), and offline download capabilities.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CINESCOPE ECOSYSTEM                           │
├──────────────────────────────────┬─────────────────────────────────────┤
│        Web Frontend (SPA)        │         Mobile App (React Native)   │
│  • Vanilla HTML5 + CSS + Modern  │  • React Native 0.76 (Expo 52)      │
│    ES6 JavaScript (static/)      │  • TypeScript (cinescope/)          │
│  • Plyr.js + HLS.js video engine │  • WebView HTML5 player sandbox     │
│  • Infinite scroll & pagination  │  • Android standalone APK build     │
├──────────────────────────────────┴─────────────────────────────────────┤
│                          Backend API (FastAPI)                         │
│  • Python 3.10+ (api.py) with curl_cffi / httpx                        │
│  • Direct MP4 & DASH CDN extraction from MovieBox upstream             │
│  • Stream proxying, CORS bypass, range headers, caching                │
│  • Multi-language dub resolver & auto-caption sync                      │
│  • Dynamic ad monetization config endpoint (/api/ads/config)           │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Workspace Directories
- `api.py`: FastAPI server handling feed curation, stream extraction, subtitle parsing, search, and dynamic ad configuration.
- `static/`: Web frontend (`index.html`, `app.js`, `style.css`).
- `cinescope/`: React Native mobile application source:
  - `cinescope/screens/HomeScreen.tsx`: Main home feed with Hero spotlight, Continue Watching shelf, and category filtering.
  - `cinescope/screens/PlayerScreen.tsx`: Cinema player container managing full-screen mode, bottom sheets, and dashboard.
  - `cinescope/components/player/PlayerDashboard.tsx`: Quick-action buttons (Quality, Audio Dub, Subtitles, Speed, Server, Episodes) in a 2x3 grid.
  - `cinescope/services/watchProgress.ts`: Local progress tracking (`@cinescope_watch_progress`).
  - `cinescope/hooks/usePlayerState.ts`: Player state management, seek handling, and progress persistence.
- `moviebox_android/`: Native Android wrapper/export project for Gradle builds.
- `.github/workflows/build-android.yml`: GitHub Actions automated APK compilation workflow.

---

## 2. Recent Bug Fixes & Improvements

### Issue 1: Vertical Text in Mobile Player Quick Action Buttons
- **Problem**: When all 6 quick-action buttons (Quality, Audio Dub, Subtitles, Speed, Server, Episodes) were displayed on mobile in full screen, each item had `flex: 1` inside a horizontal row with `flexDirection: 'column'` on child texts, causing button titles to squash horizontally and wrap letters vertically.
- **Fix**: Redesigned `PlayerDashboard.tsx` quick actions into a structured 2-row × 3-column responsive grid (`styles.compactSettingsContainer`). Each action tile maintains guaranteed minimum width (`minWidth: '30%'`), displaying the icon and label with horizontal space, completely eliminating vertical text squishing.

### Issue 2: Duplicate English and Hindi Series Entries on Feed
- **Problem**: Upstream feeds return both `Title` and `Title [Hindi Dub]` / `Title (Hindi)` as separate items, resulting in shelves displaying duplicates of the same show.
- **Fix**: Implemented regex title normalization in `api.py` (`_LANG_STRIP_RE`) that strips language markers (e.g. `[Hindi]`, `[English]`, `(Dual Audio)`) to compute a canonical base title. The feed generator checks both subject ID and canonical base title + release year to ensure only one master version appears per shelf.

### Issue 3: Continue Watching Missing on Mobile Home Screen
- **Problem**: While the web app had `renderContinueWatching()`, the mobile app lacked a visible "Continue Watching" shelf on `HomeScreen.tsx`.
- **Fix**: Integrated `WatchProgressService.getAll()` into `HomeScreen.tsx` using `useFocusEffect()`. A dedicated "Continue Watching" shelf is now rendered right beneath the Hero Spotlight, featuring:
  - Saved poster image
  - Play overlay circle
  - Season/Episode badge (`S3 E1`) for TV series
  - Dynamic red progress bar (`cwProgressFill`)
  - One-tap resume directly into `PlayerScreen` with `initialSeek` timestamp and season/episode index.

### Issue 4: TV Series Tagged as Movies (e.g., Breaking Bad)
- **Problem**:
  1. In `api.py`, `classify_content_type` relied solely on `subject_type == 2` or titles containing "Season \d+". Upstream APIs frequently return iconic TV series with missing or default `subject_type == 1`, misclassifying them as movies.
  2. In `static/app.js`, `loadHomeFeed` was iterating over shelves and forcibly passing `{ ...item, type: s.type }`, which overwrote any series in `trendingRow` with `type: 'Movie'`.
- **Fix**:
  1. Updated `classify_content_type` in `api.py` with an extensive database of known flagship series (`breaking bad`, `better call saul`, `game of thrones`, `the mentalist`, etc.) and regex series pattern checks.
  2. Updated `static/app.js` and `createMediaCardHtml` so that `item.type` is dynamically resolved and never overwritten by shelf defaults.

### Issue 5: Anime Section Single Monolithic Shelf
- **Problem**: 40+ anime items were lumped into a single generic shelf, mixing anime feature films (e.g., *Your Name*, *Suzume*) with multi-season series, making TV catalogs appear sparse.
- **Fix**:
  1. Updated `api.py` to populate separate `anime_series` and `anime_movies` categories.
  2. Fixed a filter bug where `stype == 1` was previously excluded from the anime feed.
  3. Split the Anime section in `static/index.html` into two dedicated rows:
     - 🌸 **Top Anime Series** (`animeSeriesRow`)
     - 🎬 **Iconic Anime Movies** (`animeMoviesRow`)
  4. Updated mobile `HomeScreen.tsx` category filters to display separate shelves for Anime Movies and Anime Series.

### Issue 6: Web Version Infinite Scrolling & Pagination
- **Problem**: Users requested distinct pages and smooth pagination when scrolling down catalogs.
- **Fix**: Verified and connected the dual pagination architecture in `static/app.js`:
  - Numbered page navigation (`changeMoviesPage`, `changeSeriesPage`) for explicit page jumps.
  - IntersectionObserver (`setupCatalogInfiniteScroll`) targeting `#moviesInfiniteSentinel` and `#seriesInfiniteSentinel` for seamless auto-loading upon scrolling to the bottom.

---

## 3. Non-Subscription Ad Monetization Plan

Since the platform does not use premium accounts or paywalls, 100% of revenue is generated through ad networks. Below is the battle-tested monetization strategy designed specifically for streaming platforms to maximize eCPM without destroying user experience.

### A. Recommended Ad Networks
1. **Monetag** (formerly PropellerAds):
   - Best for: Web & Mobile Web streaming.
   - Recommended Ad Formats:
     - **Vignette Banner / Exit Interstitial**: High eCPM ($2.50 – $6.00).
     - **In-Page Push / Social Bar**: Non-intrusive bottom notification bar ($1.20 – $3.50 eCPM).
     - **Direct Link / SmartLink**: For the Download Gate.
2. **Adsterra**:
   - Best for: Pop-under / Direct link monetization and Social Bar.
   - High acceptance rate for video streaming traffic.
3. **Google AdMob (Mobile App Only)**:
   - Best for: Standalone Android APK (`cinescope`).
   - Formats: Adaptive Banner on Home bottom, Interstitial on player exit, Rewarded Video for Downloads.

---

### B. High-Converting Ad Placements

| Placement Location | Platform | Format | User Impact | Conversion / eCPM |
| :--- | :--- | :--- | :--- | :--- |
| **1. Download Movie Gate** *(User Idea)* | Web + Mobile | **5-Second Countdown / Rewarded Ad** | Low (Expected) | **Highest ($5.00 - $12.00 eCPM)** |
| **2. Player Pre-Roll** | Web + Mobile | 5-Second Video / Skip Ad | Low | High ($3.50 - $7.00 eCPM) |
| **3. Player Exit Interstitial** | Web + Mobile | Interstitial card | Very Low | Medium ($2.00 - $4.00 eCPM) |
| **4. Floating Social Bar** | Web | Non-intrusive bottom-right pill | Minimal | Consistent passive income |
| **5. Catalog Native Banners** | Web + Mobile | Native feed card (1 in every 12 items) | Very Low | Steady impressions |

---

### C. Deep Dive: "Download Movie" Monetization Flow (User Proposed)

The user's idea of showing an ad when downloading a movie is **industry best-practice**. Users downloading a 1GB–3GB movie expect a short delay, making them 90%+ compliant with ad viewing.

#### How It Works:
1. User clicks **"Download 1080p"** in the Player or Details modal.
2. A sleek modal appears:
   ```
   ┌──────────────────────────────────────────────────┐
   │          Preparing High-Speed Download           │
   │  🎬 "Breaking Bad - S03E01 (1080p).mp4"          │
   ├──────────────────────────────────────────────────┤
   │  [ SPONSORED BANNER / REWARDED AD HERE ]         │
   │                                                  │
   │  Generating secure download link in 5s...        │
   │  [ ██████████████░░░░ ] 3s                       │
   ├──────────────────────────────────────────────────┤
   │  [ Start Direct Download ] (Enabled when 0s)    │
   └──────────────────────────────────────────────────┘
   ```
3. Once the 5-second countdown finishes or the user clicks "Start Direct Download":
   - The ad impression is registered.
   - The direct stream download is triggered automatically via `/api/proxy/stream?download=true`.

---

### D. Ad Monetization Backend Endpoint

The API includes `/api/ads/config` (GET & POST) to remotely toggle ad providers without rebuilding the mobile APK or editing source code:
```json
{
  "enabled": true,
  "test_mode": false,
  "monetag": {
    "enabled": true,
    "direct_link": "https://your-monetag-direct-link.com",
    "preroll_enabled": true,
    "download_gate_enabled": true,
    "download_countdown_seconds": 5
  },
  "adsterra": {
    "enabled": true,
    "social_bar_enabled": true
  },
  "admob": {
    "enabled": true,
    "banner_unit_id": "ca-app-pub-...",
    "interstitial_unit_id": "ca-app-pub-..."
  }
}
```

---

## 4. Instructions for Future AI Assistants

When picking up a task on this repository:
1. **Always verify backend endpoints**: Run `python -c "import api"` before committing Python changes.
2. **Preserve multi-dub and subtitle logic**: Do not remove `find_stream_links_web`, `extract_audio_dubs`, or OpenSubtitles token caching in `api.py`.
3. **Respect responsive grid constraints in mobile**: In `cinescope/components/player/PlayerDashboard.tsx`, maintain the 2x3 grid layout (`compactSettingsContainer`) so full-screen playback on small mobile viewports never truncates button labels.
4. **Cache Invalidation**: Feed responses are cached in memory for 180–300 seconds via `app_cache`. Use `_bust=timestamp` if immediate feed verification is required.
