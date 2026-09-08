import { Bluetooth, Headphones, RefreshCw, Users } from 'lucide-react'
import { useAudioSharing } from '../../stores/audioSharingStore.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'

export function AudioSharingSection() {
  const share = useAudioSharing()
  const { currentTrack } = usePlayer()
  return (
    <section className="settings-card audio-sharing-card" aria-labelledby="audio-sharing-title">
      <header className="settings-card-header">
        <div className="settings-card-icon"><Headphones /></div>
        <div>
          <h2 id="audio-sharing-title">Bluetooth & shared listening</h2>
          <p>One song. Your earbuds. Your friends.</p>
        </div>
        <span className={`sharing-badge ${share.active ? 'is-active' : ''}`}>{share.active ? 'Sharing on' : 'Windows desktop'}</span>
      </header>
      <div className="settings-card-body">
        <div className="sharing-intro">
          <Users aria-hidden="true" />
          <p>Connect two pairs of earbuds and share one earbud with each friend. Four people can hear the same song.</p>
        </div>
        {!share.supported ? (
          <div className="sharing-notice">
            <strong>Open Rajify for Windows to share with multiple outputs.</strong>
            <p>In the browser, connect your earbuds through your device’s Bluetooth settings. Music follows your system audio output.</p>
          </div>
        ) : (
          <>
            <ol className="sharing-steps">
              <li>Pair and connect each pair of earbuds in Windows Bluetooth settings.</li>
              <li>Refresh the list and select the outputs you want to use.</li>
              <li>Choose a song, then start sharing.</li>
            </ol>
            <div className="sharing-actions">
              <button className="secondary-button" onClick={share.openBluetooth}><Bluetooth /> Connect Bluetooth</button>
              <button className="secondary-button" onClick={share.refresh} disabled={share.busy}>
                <RefreshCw className={share.busy ? 'spin' : ''} /> Refresh devices
              </button>
            </div>
            <p className="sharing-hint">Windows handles pairing. This list shows available audio outputs, including wired headphones and speakers.</p>
            {share.scanned && !share.devices.length && <p className="sharing-notice">No audio outputs found. Connect your earbuds in Windows, then refresh.</p>}
            {share.devices.length > 0 && (
              <fieldset className="sharing-devices">
                <legend>Audio outputs · {share.outputs.length} selected</legend>
                {share.devices.map(device => {
                  const output = share.outputs.find(output => output.deviceId === device.deviceId)
                  return (
                    <div className={`sharing-device ${output ? 'is-selected' : ''}`} key={device.deviceId}>
                      <label className="sharing-device-choice">
                        <input type="checkbox" checked={Boolean(output)} onChange={() => share.selectDevice(device.deviceId)}
                          disabled={share.active || share.busy || (!output && share.outputs.length >= 8)} />
                        <Headphones aria-hidden="true" /><span>{device.label}</span>
                      </label>
                      {output && <div className="sharing-device-controls">
                        <label>Volume <span>{Math.round(output.volume * 100)}%</span>
                          <input aria-label={`Volume for ${device.label}`} type="range" min="0" max="1" step="0.01"
                            value={output.volume} disabled={share.busy}
                            onChange={event => share.adjustOutput(device.deviceId, { volume: Number(event.target.value) })} />
                        </label>
                        <label>Extra delay <span>{output.delayMs} ms</span>
                          <input aria-label={`Extra delay for ${device.label}`} type="range" min="0" max="500" step="10"
                            value={output.delayMs} disabled={share.busy}
                            onChange={event => share.adjustOutput(device.deviceId, { delayMs: Number(event.target.value) })} />
                        </label>
                      </div>}
                    </div>
                  )
                })}
              </fieldset>
            )}
            <label className="sharing-mono">
              <input type="checkbox" checked={share.mono} disabled={share.busy} onChange={event => share.setMono(event.target.checked)} />
              <span><strong>One earbud each (mono audio)</strong><small>Hear both sides of the song in every earbud.</small></span>
            </label>
            <p className="sharing-hint">If one pair sounds ahead, add extra delay to that pair. Bluetooth timing can vary; exact synchronization is not guaranteed. Stop sharing before changing devices.</p>
            {share.error && <p className="sharing-error" role="alert">{share.error}</p>}
            <div className="sharing-footer">
              <p role="status">{share.active ? `Sending this song to ${share.outputs.length} ${share.outputs.length === 1 ? 'output' : 'outputs'}.`
                : !currentTrack ? 'Choose a song before starting.'
                  : !share.outputs.length ? 'Select at least one audio output.' : 'Ready to share. Keep your earbuds nearby.'}</p>
              {share.active ? (
                <button className="secondary-button" onClick={share.stop} disabled={share.busy}>Stop sharing</button>
              ) : (
                <button className="primary-button" onClick={share.start} disabled={share.busy || !currentTrack || !share.outputs.length}>
                  <Users />{share.busy ? 'Please wait…' : 'Start sharing'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export function AudioSharingBanner({ onSettings }) {
  const share = useAudioSharing()
  if (!share.active) return null
  return <div className="sharing-banner" role="status">
    <Headphones aria-hidden="true" />
    <button onClick={onSettings}>Sharing with {share.outputs.length} {share.outputs.length === 1 ? 'output' : 'outputs'}{share.mono ? ' · Mono' : ''}</button>
    <button onClick={share.stop} disabled={share.busy}>Stop sharing</button>
  </div>
}
