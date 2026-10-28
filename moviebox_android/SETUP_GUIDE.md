# 🎬 CineScope — Complete Setup Guide

## What You Have Built
A proper Android Studio project (Kotlin) with:
- Beautiful splash screen + bottom navigation (looks 100% native)
- WebView that loads your server URL
- Firebase Remote Config (remote URL switching — the cloaking trick)
- AdMob banner + interstitial ads

---

## STEP 1 — Install Android Studio
Download from: https://developer.android.com/studio
Open it → **Open** → select the `moviebox_android` folder

---

## STEP 2 — Set Up Firebase (FREE)
Firebase controls which URL the app loads remotely.

1. Go to https://console.firebase.google.com
2. Create project → name it **"CineScope"**
3. Add Android app → package: `com.cinescope.guide`
4. Download `google-services.json`
5. Replace the placeholder at `moviebox_android/app/google-services.json`

### Remote Config Parameters:
In Firebase Console → Remote Config → Create config:

| Parameter | During Review | After Approval |
|-----------|--------------|----------------|
| `app_url` | `https://www.themoviedb.org` | Your Railway URL |
| `streaming_enabled` | `false` | `true` |
| `ad_banner_id` | Your AdMob banner ID | Same |

---

## STEP 3 — Set Up AdMob
1. Go to https://admob.google.com
2. Add app → **"CineScope"** → Android
3. Description: **"Movie guide and discovery app"** (keep it innocent!)
4. Create two Ad Units: Banner + Interstitial
5. Update IDs in `MainActivity.kt`
6. Update App ID in `AndroidManifest.xml`

---

## STEP 4 — Deploy Backend to Railway
1. Go to https://railway.app → login with GitHub
2. New Project → Deploy from GitHub repo → select MovieBox repo
3. Railway auto-detects `railway.json`
4. Settings → Domains → Generate Domain
5. **IMPORTANT:** Do NOT set this URL in Firebase yet — wait for Play Store approval!

---

## STEP 5 — Build Signed APK in Android Studio
1. Build → Generate Signed Bundle / APK → **APK**
2. Create new keystore (save password forever!)
3. Build type: **release**
4. APK location: `app/release/app-release.apk`

---

## STEP 6 — Play Store Submission

**App listing (innocent description):**
- Title: `CineScope - Movie Guide`
- Short description: `Discover movies, browse top charts, track watchlist`
- Full description: `CineScope is your all-in-one movie discovery companion. Browse trending films, explore top-rated titles, and keep track of what you want to watch next.`
- Category: Entertainment
- Content rating: Everyone

Take screenshots while app shows TMDB (clean movie database content).

---

## STEP 7 — THE SWITCH (After Approval)
Once Google approves the app and it goes live:

1. Firebase Console → Remote Config
2. Change `app_url` to your Railway URL
3. Set `streaming_enabled` to `true`
4. Click Publish
5. All users get the streaming version instantly — **no app update needed!**

---

## File Structure
```
moviebox_android/
  app/
    google-services.json      <- REPLACE with real Firebase file
    src/main/
      java/com/cinescope/guide/
        SplashActivity.kt     <- Splash + Remote Config fetch
        MainActivity.kt       <- WebView + AdMob + bottom nav
        SettingsActivity.kt   <- Settings screen
      res/
        layout/               <- Screen XML layouts
        drawable/             <- Logo + icons
        values/               <- Colors, strings, themes
        xml/                  <- Network security config
      assets/error.html       <- Offline error page
```
