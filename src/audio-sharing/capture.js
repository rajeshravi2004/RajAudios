export async function captureRajifyAudio(handle) {
  // Call directly from a click in the separate output window.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    // A video track is required for tab audio, but we never render it. Limit
    // its size and rate so capturing a large desktop does less video work.
    video: { displaySurface: 'browser', width: { max: 320 }, height: { max: 180 }, frameRate: { max: 1 } },
    audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    selfBrowserSurface: 'exclude', systemAudio: 'exclude', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude',
  })
  try {
    const video = stream.getVideoTracks()[0]
    const isSource = () => {
      const identity = video?.getCaptureHandle?.()
      return identity?.origin === location.origin && identity?.handle === handle
        && video.getSettings().displaySurface === 'browser'
    }
    if (!isSource()) throw new Error('Select the original Rajify music tab in a regular browser window, with Share tab audio enabled. Incognito mode, screens, and other tabs cannot be used.')
    const audio = stream.getAudioTracks()[0]
    if (!audio || audio.readyState !== 'live') throw new Error('No tab audio was shared. Enable Share tab audio and try again.')
    if (audio.getSettings().suppressLocalAudioPlayback !== true) {
      throw new Error('This browser cannot suppress the original audio. Use a supported desktop Chrome or Edge browser.')
    }
    return { stream, video, isSource }
  } catch (error) {
    stream.getTracks().forEach(track => track.stop())
    throw error
  }
}
