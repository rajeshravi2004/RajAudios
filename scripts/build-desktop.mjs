import { build, Platform } from 'electron-builder'
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The renderer is already bundled by Vite; Electron uses only built-in modules.
// Stage runtime files so build tools and web dependencies are not shipped.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const staging = await mkdtemp(join(tmpdir(), 'rajify-desktop-'))
if (dirname(resolve(staging)) !== resolve(tmpdir()) || !staging.startsWith(join(tmpdir(), 'rajify-desktop-'))) {
  throw new Error('Unexpected temporary build directory')
}
try {
  await cp(join(root, 'dist'), join(staging, 'dist'), { recursive: true })
  await cp(join(root, 'electron'), join(staging, 'electron'), { recursive: true })
  const runtime = { name: metadata.name, version: metadata.version, type: 'module', main: metadata.main,
    description: 'Rajify music discovery and playlists', author: 'Rajify' }
  await writeFile(join(staging, 'package.json'), JSON.stringify(runtime, null, 2))
  await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget(['nsis']),
    publish: 'never',
    config: { ...metadata.build,
      extraFiles: [],
      directories: { app: staging, output: join(root, 'release') },
      win: { ...metadata.build.win, icon: join(root, 'public', 'icon.png') },
      npmRebuild: false,
    },
  })
} finally {
  await rm(staging, { recursive: true, force: true })
}
