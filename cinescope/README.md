# 🎬 CineScope — React Native (Expo) Mobile App

Lightweight mobile client designed specifically for low-spec laptops:
- **Zero heavy compilation on your PC**: Expo runs via lightweight Node.js
- **Instant testing on phone**: Scan a QR code using the free **Expo Go** app
- **Free Cloud APK Building**: EAS Cloud builds APKs on Expo servers without using your laptop RAM

---

## ⚡ Quick Start — Test on Your Phone Right Now (2 Minutes)

### Step 1: Install Expo Go on your Android Phone
Download **Expo Go** from the Google Play Store (it's free).

### Step 2: Start the Dev Server on your Laptop
In your terminal, navigate to `cinescope` and start Expo:
```bash
cd cinescope
npx expo start
```

### Step 3: Scan the QR Code
- Open **Expo Go** on your phone (make sure your phone is on the same Wi-Fi as your laptop).
- Tap **Scan QR code** and point your camera at the QR code in your terminal.
- The app loads on your phone in seconds!

> **Note**: In Expo Go, you can go to **Settings** screen, tap **Change** next to Content Source, and enter your live Railway server URL or any URL you want to test!

---

## 📦 Build a Standalone APK (Without Android Studio)

Expo provides free cloud builds, so your laptop never gets slow or hot:

### 1. Install EAS CLI (once)
```bash
npm install -g eas-cli
```

### 2. Log in or create a free Expo account
```bash
eas login
```

### 3. Build the APK in the Cloud
```bash
eas build -p android --profile preview
```
- Select your default options when prompted.
- Expo builds the `.apk` on their cloud servers (takes ~5-10 min).
- When done, you get a direct download link and QR code to install the APK on any Android phone!

---

## 🚀 Play Store Production Build (.aab)

When you are ready to upload to Google Play Console:
```bash
eas build -p android --profile production
```
This generates an Android App Bundle (`.aab`) ready for Google Play upload.

---

## ⚙️ Configuration (`config.ts`)

- `APP_URL`: Initial URL shown during Play Store review (defaults to `https://www.themoviedb.org`).
- `REMOTE_CONFIG_URL`: Optional remote JSON link to dynamically point the app to your backend after approval without re-submitting.
- `ADMOB_BANNER_ID` & `ADMOB_INTERSTITIAL_ID`: Pre-configured with official Google AdMob test IDs. Replace with your approved AdMob IDs when ready.
