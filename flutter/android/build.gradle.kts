allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

// The iframe remains the playback source when Android hides the Flutter activity.
subprojects {
    if (name == "webview_flutter_android") {
        afterEvaluate {
            tasks.withType<JavaCompile>().configureEach {
                if (name == "compileDebugJavaWithJavac" || name == "compileReleaseJavaWithJavac") {
                    val mediaWebViewSource = rootProject.file("patches/webview_flutter_android/WebViewProxyApi.java")
                    inputs.file(mediaWebViewSource)
                    doFirst {
                        val upstreamSources = source.filter { it.name != "WebViewProxyApi.java" }
                        setSource(files(upstreamSources, mediaWebViewSource))
                    }
                }
            }
        }
    }
}
