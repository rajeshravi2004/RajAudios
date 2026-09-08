import { useState } from 'react'
import { Bluetooth, Check, Headphones, Plus, RefreshCw, Users } from 'lucide-react'
import { useAudioSharing } from '../../stores/audioSharingStore.jsx'
import { usePlayer } from '../../stores/playerStore.jsx'

export function AudioSharingSection() {
  const share = useAudioSharing()
  const { currentTrack, isBuffering } = usePlayer()
  const [pairing, setPairing] = useState(null)
  const windows = /Windows/i.test(navigator.userAgent)
  const canStart = share.supported && !share.busy && !share.active && currentTrack && share.outputs.length > 0
  const connect = number => {
    setPairing(number)
    if (!share.browser) void share.openBluetooth()
  }
  const selectedName = index => share.devices.find(device => device.deviceId === share.outputs[index]?.deviceId)?.label
  return (
    <section className="settings-card audio-sharing-card" aria-labelledby="audio-sharing-title">
      <header className="settings-card-header">
        <div className="settings-card-icon"><Headphones /></div>
        <div>
          <h2 id="audio-sharing-title">Bluetooth & shared listening</h2>
          <p>One song. Your earbuds. Your friends.</p>
        </div>
        <span className={`sharing-badge ${share.active ? 'is-active' : ''}`}>{share.active ? 'Sharing on' : share.browser ? 'Browser audio sharing' : 'Windows desktop'}</span>
      </header>
      <div className="settings-card-body">
        <div className="sharing-intro">
          <Users aria-hidden="true" />
          <p>Connect your earbuds, add your friend’s pair, then play the same song through both.</p>
        </div>
        <div className="sharing-flow">
          <div className={`sharing-step ${share.outputs.length ? 'is-ready' : ''}`}>
            <span className="sharing-step-number">{share.outputs.length ? <Check /> : '1'}</span>
            <h3>Your earbuds</h3>
            <p>{selectedName(0) || 'Pair the first Bluetooth device and select its audio output.'}</p>
            <button className="secondary-button" onClick={() => connect(1)} disabled={share.busy || share.active} aria-expanded={pairing === 1} aria-controls="sharing-pairing">
              <Bluetooth /> Connect Bluetooth
            </button>
          </div>
          <div className={`sharing-step ${share.outputs.length > 1 ? 'is-ready' : ''}`}>
            <span className="sharing-step-number">{share.outputs.length > 1 ? <Check /> : '2'}</span>
            <h3>Add another pair</h3>
            <p>{selectedName(1) || 'Keep the first pair connected, then pair the next device.'}</p>
            <button className="secondary-button" onClick={() => connect(Math.max(2, share.outputs.length + 1))} disabled={share.busy || share.active} aria-expanded={pairing > 1} aria-controls="sharing-pairing">
              <Plus /> Connect next Bluetooth
            </button>
          </div>
          <div className={`sharing-step ${share.active ? 'is-ready' : ''}`}>
            <span className="sharing-step-number">{share.active ? <Check /> : '3'}</span>
            <h3>Listen together</h3>
            <p>{share.active ? `Playing through ${share.outputs.length} selected outputs.` : share.browser ? 'Sync & play opens an audio tab. Click Share Rajify audio there, choose your music tab, and enable Share tab audio.' : 'Choose a song and send it to your selected outputs.'}</p>
            {share.browser && canStart ? <a className="primary-button" href={share.setupUrl} target="_blank" rel="noopener" onClick={share.start}>
              <Users /> Sync & play
            </a> : <button className="primary-button" onClick={share.start} disabled={!canStart}>
              <Users /> {share.starting ? 'Waiting for audio…' : share.active ? 'Sharing on' : 'Sync & play'}
            </button>}
          </div>
        </div>
        {pairing !== null && <div className="sharing-pairing sharing-notice" id="sharing-pairing">
          <strong>Connect {pairing === 1 ? 'your first' : 'your next'} Bluetooth device</strong>
          <ol className="sharing-steps">
            <li>Put {pairing === 1 ? 'your earbuds' : 'the next pair of earbuds'} in pairing mode.</li>
            <li>Open {windows ? 'Windows Settings → Bluetooth & devices → Add device → Bluetooth' : 'your device’s Bluetooth settings'}, choose the earbuds, and wait for Connected.</li>
            <li>Return here, find audio devices, then select {pairing === 1 ? 'your earbuds' : 'the additional output'}. Keep each earlier pair connected.</li>
          </ol>
          <p>Pairing happens in your device settings. Rajify shows the audio outputs your device makes available.</p>
          <div className="sharing-actions">
            {share.browser && windows ? <a className="secondary-button" href="ms-settings:bluetooth"><Bluetooth /> Open Bluetooth settings</a>
              : !share.browser ? <button className="secondary-button" onClick={share.openBluetooth}><Bluetooth /> Open Bluetooth settings</button> : null}
            <button className="secondary-button" onClick={() => setPairing(null)}>Done with pairing</button>
          </div>
        </div>}
        {!share.supported && <div className="sharing-notice">
          <strong>This browser cannot send tab audio to multiple outputs.</strong>
          <p>You can pair earbuds in your device settings. For Sync & play, open Rajify in a supported desktop Chrome or Edge browser, or use Rajify for Windows. Mobile browsers are not supported for this flow.</p>
        </div>}
        {share.supported && (
          <>
            {share.browser && <p className="sharing-hint">Use a regular desktop Chrome or Edge window. Find audio devices asks for audio-device access. If your browser asks for microphone permission, it is used to reveal the output list; the microphone is immediately stopped, never recorded or sent anywhere. Keep the audio tab open while listening.</p>}
            <div className="sharing-actions">
              <button className="secondary-button" onClick={share.refresh} disabled={share.busy || share.active}>
                <RefreshCw className={share.busy ? 'spin' : ''} /> {share.scanned ? 'Refresh devices' : 'Find audio devices'}
              </button>
            </div>
            <p className="sharing-hint">Select a different output for each pair. Wired headphones and speakers may also appear; only your device settings can confirm a Bluetooth connection.</p>
            {share.scanned && !share.devices.length && <p className="sharing-notice">No audio outputs found. Connect your earbuds in your device settings, allow audio-device access, then refresh.</p>}
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
              <p role="status">{share.active && isBuffering ? 'YouTube is buffering the song. Both pairs will resume when it is ready.' : share.starting ? 'Finish setup in the audio tab. Choose the Rajify music tab and enable Share tab audio.' : share.active ? `Sending this song to ${share.outputs.length} ${share.outputs.length === 1 ? 'output' : 'outputs'}.`
                : !currentTrack ? 'Choose a song before starting.'
                  : !share.outputs.length ? 'Select at least one audio output.' : 'Ready to share. Keep your earbuds nearby.'}</p>
              {share.active ? (
                <button className="secondary-button" onClick={share.stop} disabled={share.busy}>Stop sharing</button>
              ) : share.starting && <button className="secondary-button" onClick={share.stop}>Cancel setup</button>}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export function AudioSharingBanner({ onSettings }) {
  const share = useAudioSharing()
  const { isBuffering } = usePlayer()
  if (!share.active) return null
  return <div className="sharing-banner" role="status">
    <Headphones aria-hidden="true" />
    <button onClick={onSettings}>{isBuffering ? 'YouTube is buffering… listening will resume automatically.' : `Sharing with ${share.outputs.length} ${share.outputs.length === 1 ? 'output' : 'outputs'}${share.mono ? ' · Mono' : ''}`}</button>
    <button onClick={share.stop} disabled={share.busy}>Stop sharing</button>
  </div>
}
