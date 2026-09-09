# Rajify media WebView lifecycle

This is `WebViewProxyApi.java` from Flutter `webview_flutter_android` 4.14.1,
under the accompanying BSD license. The only change is the
`WebViewPlatformView.onWindowVisibilityChanged` override. Rajify uses one media
WebView and an Android foreground media service; hiding the activity must not
suspend that player. Flutter controls whether its picture is shown. Explicit
pause, stop, audio-focus handling and controller disposal remain intact.

The root Android Gradle script substitutes this source for the upstream Java
file during debug/release compilation. No Pub cache file is modified. Review
and rebase this patch when upgrading webview_flutter_android.
