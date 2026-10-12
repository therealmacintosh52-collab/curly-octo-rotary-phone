# The JavaScript bridge is reached by name from the page.
-keepclassmembers class com.calitints.clover.CaliCloverBridge { @android.webkit.JavascriptInterface <methods>; }
-keep class com.clover.sdk.** { *; }
