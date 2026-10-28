# Proguard rules for CineScope

# Keep WebView JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Firebase Remote Config
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep AdMob
-keep class com.google.android.gms.ads.** { *; }

# General Android
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Kotlin
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
