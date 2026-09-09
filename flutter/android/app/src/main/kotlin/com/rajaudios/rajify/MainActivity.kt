package com.rajaudios.rajify

import android.content.Intent
import android.provider.Settings
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : AudioServiceActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.rajaudios.rajify/device")
            .setMethodCallHandler { call, result ->
                if (call.method == "moveToBackground") {
                    moveTaskToBack(true)
                    result.success(null)
                } else if (call.method != "openSettings") {
                    result.notImplemented()
                } else {
                    val action = when (call.arguments as? String) {
                        "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                        "sound" -> Settings.ACTION_SOUND_SETTINGS
                        else -> null
                    }
                    if (action == null) {
                        result.error("INVALID_SETTINGS", "Unsupported settings screen", null)
                    } else {
                        try {
                            startActivity(Intent(action))
                            result.success(null)
                        } catch (_: Exception) {
                            result.error("SETTINGS_UNAVAILABLE", "Open Android Settings manually", null)
                        }
                    }
                }
            }
    }
}
