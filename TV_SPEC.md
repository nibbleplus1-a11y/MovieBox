# TASK: Build a NEW, SEPARATE Android TV app (own APK) for my streaming platform

## 0. Hard rules (read first, never break)
- DO NOT modify, refactor, rename or "make TV-friendly" ANYTHING in: 
  /android_app, /moviebox_android, /cinescope, /static, api.py, main.py, 
  requirements.txt, Procfile, railway.json, deploy.sh.
- Create ONE new standalone Android project at /tv_app (own Gradle project, 
  applicationId "com.<myapp>.tv"). It must build and install independently 
  of the mobile apps.
- If you believe a backend or mobile change is needed, STOP and ask me first 
  with the exact change you propose. Do not make it.
- Mobile and TV are different input models (touch vs D-pad focus). 
  Do NOT port mobile screens. Build TV-native UI from scratch.

## 1. Discovery (do this before writing any code)
1. Read PROJECT_DOCUMENTATION.md, CINESCOPE_MASTER_HANDBOOK.md, api.py and main.py.
2. List every API endpoint I can use: home/trending, movies, series, seasons/episodes, 
   search, details, stream sources/servers, subtitles. Include base URL, params, 
   response shape.
3. Inspect /moviebox_android and /android_app only to learn how they call the API 
   (models, auth/headers, server fallback). Read-only.
4. Study /JetStreamCompose (Google's reference): navigation drawer, featured carousel, 
   immersive list, content rows, details screen, search, player, focus handling 
   (BringIntoViewIfChildrenAreFocused, focus restorer, TvLazyRow/TvLazyColumn).
5. Reply with: (a) endpoint map, (b) what you'll reuse from JetStream, 
   (c) your build plan. WAIT for my "go" before coding.

## 2. Tech stack
- Kotlin, Jetpack Compose for TV ONLY: androidx.tv:tv-material, tv-foundation. 
  Never use androidx.compose.material3 widgets (Button, Card, Drawer...). 
  Use the androidx.tv.material3 equivalents.
- Media3 ExoPlayer, Coil for images, Retrofit + OkHttp + kotlinx.serialization, 
  Hilt or manual DI, Navigation Compose, DataStore for local state.
- Manifest: LEANBACK_LAUNCHER intent, uses-feature leanback required=true, 
  touchscreen required=false, 320x180 banner, landscape only, minSdk 23.
- All colors/typography/dimensions live in ONE theme file so I can re-skin quickly. 
  App name, logo and accent color are placeholders in one config file. 
  Do NOT use Netflix/Prime names, logos or artwork.

## 3. Visual & UX target: Netflix / Prime Video TV
Match their LAYOUT, SPACING, MOTION and BEHAVIOR as closely as possible.
Pure black/near-black background (#0B0B0B), white text, one accent color, 
Inter or Roboto type, generous artwork, minimal chrome.

### Home
- Full-bleed hero billboard (top ~55% of screen): backdrop image with left and 
  bottom gradient scrims, large title/logo text, genre · year · rating · duration, 
  2-line synopsis, buttons "Play" (focused by default) and "More Info". 
  Hero auto-advances every ~8s when not focused; pauses while focused.
- Below: horizontal content rows with row titles: Continue Watching (16:9 cards 
  with red/accent progress bar), Top 10 Today (large outlined rank numbers 
  beside 2:3 posters), Trending, New Releases, Movies, TV Shows, genre rows.
- Moving focus onto a card updates the hero backdrop + info (crossfade 300ms) 
  like Prime's immersive list.
- Focused card: scale 1.12, 3dp white border, soft shadow, 150-200ms ease. 
  Show title + metadata under/over the focused card.
- Vertical scroll keeps the focused row aligned in the upper third of the screen.
- Rows load lazily; prefetch images for the next 5 cards.

### Navigation
- Slim left rail of icons (Search, Home, Movies, TV Shows, My List, Settings) 
  that expands with labels when focused (Netflix-style). Reachable by pressing 
  LEFT from the first card of any row. Back from content goes to the rail, 
  Back from the rail on Home exits the app.

### Details screen
- Cinematic backdrop, title, meta, full synopsis, cast line, big Play 
  (Resume if progress exists), My List toggle, then episodes (season picker 
  as a row of chips + episode cards with thumbnail, number, runtime, progress) 
  and "More Like This" row.

### Search
- Left: on-screen keyboard (A-Z grid, space, delete) + voice search button. 
  Right: live results grid (2:3 cards). Empty state shows trending searches.

### Player (one unified player)
- Netflix-style overlay: title top-left, seek bar bottom with elapsed/remaining, 
  buttons: Play/Pause, Back 10s, Forward 10s, Next Episode, Audio & Subtitles, 
  Quality (grouped in ONE menu/panel at the top-right gear, not scattered).
- Controls auto-hide after 4s; any D-pad key shows them. 
  Hold LEFT/RIGHT = accelerating seek. OK = play/pause. Back = hide controls, 
  Back again = exit to details.
- Remember playback position per title and resume automatically. 
  Auto-play next episode with a 5s countdown card.
- ONE player for all servers: try the primary source, auto-detect failure/timeout 
  (>8s buffer or error) and silently switch to the next working server while keeping 
  the same position and the same player UI. Show only a small "Switching source..." toast.
- Keep screen awake, handle audio focus, support HLS and MP4, subtitles (SRT/VTT) 
  with size options.

## 4. "A 4-year-old can use it" rules (non-negotiable acceptance criteria)
- Everything works with ONLY D-pad + OK + Back. No touch, no long-press required.
- Focus is ALWAYS visible and NEVER lost or trapped. Last focused item is 
  remembered per row/screen and restored on Back.
- First launch opens straight to Home with Play focused. No login wall to browse.
- No tiny targets: minimum 48dp, body text >= 20sp, titles >= 28sp, 
  48dp horizontal / 27dp vertical overscan safe area.
- Every error shows a plain message + a focused "Try again" button. 
  Every loading state shows skeleton shimmer cards, never a blank screen.
- Navigation depth max 3 levels (Home -> Details -> Player).
- 60fps while rapidly holding D-pad: use stable keys, remember{} correctly, 
  avoid recomposition storms, apply baseline profile at the end.

## 5. Build process (stop after each step for my test)
1. Scaffold /tv_app + theme + navigation shell + nav rail. Run on Android TV 
   emulator (API 34, 1080p).
2. Data layer connected to my API (read-only), with models and repository.
3. Home (hero + rows + focus behavior).
4. Details + episodes.
5. Player + server auto-fallback + resume.
6. Search.
7. My List, Continue Watching, Settings, polish, error states.
8. Run ./gradlew assembleDebug and tell me the exact APK path.
After each step, give me a short test checklist I can run with only arrow keys, 
Enter and Esc.