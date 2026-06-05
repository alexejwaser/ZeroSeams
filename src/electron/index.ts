import { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } from 'electron'
import { join, dirname, basename, extname, relative } from 'path'
import { writeFile, readFile, readdir, stat, mkdir } from 'fs/promises'
import { createReadStream } from 'fs'
import { homedir, tmpdir } from 'os'
import { spawn } from 'child_process'
import chokidar from 'chokidar'

function getZeroSeamsDir(): string {
  return join(homedir(), 'Documents', 'ZeroSeams')
}

function getPreferencesPath(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

function getRecentFilesPath(): string {
  return join(app.getPath('userData'), 'recentFiles.json')
}

async function addRecentFile(filePath: string): Promise<void> {
  let list: string[] = []
  try {
    const raw = await readFile(getRecentFilesPath(), 'utf-8')
    list = JSON.parse(raw) as string[]
  } catch { /* first run or corrupt — start fresh */ }
  list = [filePath, ...list.filter((p) => p !== filePath)].slice(0, 30)
  await writeFile(getRecentFilesPath(), JSON.stringify(list), 'utf-8').catch(() => {})
}

interface Preferences {
  defaultExternalEditor?: ExternalEditor | null
}

interface ExternalEditor {
  name: string
  execPath: string
}

async function readPreferences(): Promise<Preferences> {
  try {
    const raw = await readFile(getPreferencesPath(), 'utf-8')
    return JSON.parse(raw) as Preferences
  } catch {
    return {}
  }
}

async function writePreferences(prefs: Preferences): Promise<void> {
  await writeFile(getPreferencesPath(), JSON.stringify(prefs, null, 2), 'utf-8')
}

const watchers = new Map<string, chokidar.FSWatcher>()
const tempFiles = new Map<string, string>()

let mainWindow: BrowserWindow | null = null

// Must run synchronously before app.ready so Chromium treats zeroseams-media:
// as a standard secure scheme — required for <video> src to load via our handler.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'zeroseams-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow = win
  win.on('closed', () => { mainWindow = null })
}

ipcMain.handle(
  'save-file',
  async (_event, { filename, base64 }: { filename: string; base64: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: join(app.getPath('downloads'), filename),
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'cancelled' }
    try {
      await writeFile(filePath, Buffer.from(base64, 'base64'))
      console.log(`[main] saved → ${filePath}`)
      return { success: true }
    } catch (error) {
      console.error(`[main] save-file error:`, error)
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle(
  'autosave-project',
  async (_event, { filename, json }: { filename: string; json: string }) => {
    const dir = getZeroSeamsDir()
    try {
      await mkdir(dir, { recursive: true })
      const filePath = join(dir, `${filename}.zeroseams`)
      await writeFile(filePath, json, 'utf-8')
      void addRecentFile(filePath)
      console.log(`[main] autosaved → ${filePath}`)
      return { success: true, filePath }
    } catch (error) {
      console.error(`[main] autosave-project error:`, error)
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle('open-project', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Zero Seams Project', extensions: ['zeroseams'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { success: false }
  try {
    const json = await readFile(filePaths[0], 'utf-8')
    void addRecentFile(filePaths[0])
    return { success: true, json, filePath: filePaths[0] }
  } catch (error) {
    console.error(`[main] open-project error:`, error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('open-video-file', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { canceled: true }
  return { canceled: false, filePath: filePaths[0] }
})

ipcMain.handle('open-image-file', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { canceled: true }
  const filePath = filePaths[0]
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic',
  }
  const mime = mimeMap[ext] ?? 'image/jpeg'
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const buf = require('fs').readFileSync(filePath) as Buffer
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
  return { canceled: false, data: dataUrl }
})

ipcMain.handle(
  'save-project-as',
  async (_event, { json }: { json: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: join(getZeroSeamsDir(), 'untitled.zeroseams'),
      filters: [{ name: 'Zero Seams Project', extensions: ['zeroseams'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'cancelled' }
    try {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, json, 'utf-8')
      void addRecentFile(filePath)
      return { success: true, filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle('save-project-copy', async (_e, { json }: { json: string }) => {
  try {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: join(getZeroSeamsDir(), 'untitled copy.zeroseams'),
      filters: [{ name: 'Zero Seams Project', extensions: ['zeroseams'] }],
    })
    if (canceled || !filePath) return { success: false }
    await writeFile(filePath, json, 'utf-8')
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle(
  'save-project',
  async (_event, { filePath, json }: { filePath: string; json: string }) => {
    try {
      await writeFile(filePath, json, 'utf-8')
      void addRecentFile(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle('get-system-fonts', async () => {
  return app.getSystemFonts()
})

ipcMain.handle('list-recent-projects', async () => {
  let paths: string[] = []
  try {
    const raw = await readFile(getRecentFilesPath(), 'utf-8')
    paths = JSON.parse(raw) as string[]
  } catch { return { files: [] } }

  const files = (
    await Promise.all(
      paths.map(async (filePath) => {
        try {
          const stats = await stat(filePath)
          return { name: basename(filePath), path: filePath, modifiedAt: stats.mtime.toISOString() }
        } catch {
          return null
        }
      }),
    )
  ).filter((f): f is NonNullable<typeof f> => f !== null)

  return { files }
})

ipcMain.handle('get-external-editor', async () => {
  const prefs = await readPreferences()
  return prefs.defaultExternalEditor ?? null
})

ipcMain.handle('set-external-editor', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const filters =
    process.platform === 'darwin'
      ? [{ name: 'Applications', extensions: ['app'] }]
      : process.platform === 'win32'
        ? [{ name: 'Executables', extensions: ['exe'] }]
        : []
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose External Editor',
    properties: ['openFile'],
    filters,
  })
  if (canceled || filePaths.length === 0) return null
  const execPath = filePaths[0]
  const name = basename(execPath, extname(execPath))
  const editor: ExternalEditor = { name, execPath }
  const prefs = await readPreferences()
  await writePreferences({ ...prefs, defaultExternalEditor: editor })
  return editor
})

ipcMain.handle(
  'edit-in-external-app',
  async (
    _event,
    {
      objectId,
      base64,
      projectFilePath,
    }: { objectId: string; base64: string; mimeType: string; projectFilePath: string | null },
  ) => {
    // Stop any existing watcher for this object
    const existing = watchers.get(objectId)
    if (existing) {
      await existing.close()
      watchers.delete(objectId)
    }

    // Determine file location — stable per objectId so the same file is reused on repeat edits
    let tempPath: string
    if (projectFilePath) {
      const editDir = join(dirname(projectFilePath), 'externally-edited')
      await mkdir(editDir, { recursive: true })
      tempPath = join(editDir, `${objectId}.png`)
    } else {
      tempPath = join(tmpdir(), `zeroseams-${objectId}.png`)
    }

    await writeFile(tempPath, Buffer.from(base64, 'base64'))
    tempFiles.set(objectId, tempPath)

    const prefs = await readPreferences()
    const editor = prefs.defaultExternalEditor

    if (editor) {
      if (process.platform === 'darwin') {
        spawn('open', ['-a', editor.execPath, tempPath])
      } else {
        spawn(editor.execPath, [tempPath])
      }
    } else {
      await shell.openPath(tempPath)
    }

    const watcher = chokidar.watch(tempPath, {
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    })
    watcher.on('change', () => {
      void (async () => {
        try {
          const buf = await readFile(tempPath)
          const newBase64 = buf.toString('base64')
          mainWindow?.webContents.send('external-image-changed', { objectId, base64: newBase64 })
        } catch (err) {
          console.error('[main] error reading changed file:', err)
        }
      })()
    })
    watchers.set(objectId, watcher)

    return { success: true }
  },
)

ipcMain.handle(
  'save-video-file',
  async (_event, { filename, base64 }: { filename: string; base64: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: join(app.getPath('downloads'), filename),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    })
    if (canceled || !filePath) return { success: false, error: 'cancelled' }
    try {
      await writeFile(filePath, Buffer.from(base64, 'base64'))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle(
  'resolve-video-path',
  async (_event, { relativeFilePath, projectFilePath }: { relativeFilePath: string; projectFilePath: string }) => {
    return { filePath: join(dirname(projectFilePath), relativeFilePath) }
  },
)

ipcMain.handle(
  'make-relative-path',
  async (_event, { fromDir, toPath }: { fromDir: string; toPath: string }) => {
    return { relativePath: relative(fromDir, toPath) }
  },
)

const EXPORT_LOG = '/tmp/zeroseams-export.log'
ipcMain.handle('append-export-log', async (_event, { line }: { line: string }) => {
  console.log('[export-log]', line)
  await writeFile(EXPORT_LOG, line + '\n', { flag: 'a' })
})
ipcMain.handle('clear-export-log', async () => {
  console.log('[export-log] --- new export ---')
  await writeFile(EXPORT_LOG, '--- new export ---\n')
})

ipcMain.handle('get-file-size', async (_event, { filePath }: { filePath: string }) => {
  try {
    const { size } = await stat(filePath)
    return { size }
  } catch {
    return { size: 0 }
  }
})

ipcMain.handle('stop-external-edit', async (_event, { objectId }: { objectId: string }) => {
  const watcher = watchers.get(objectId)
  if (watcher) {
    await watcher.close()
    watchers.delete(objectId)
  }
  tempFiles.delete(objectId)
  return { success: true }
})

app.whenReady().then(() => {
  // Serve local video files via zeroseams-media:///absolute/path.
  // Needed because the renderer loads from http://localhost in dev mode, and
  // Chromium blocks file:// media requests as cross-origin from http://.
  // <video> requires Range request support for seeking — net.fetch('file://')
  // doesn't expose that, so we implement it manually with createReadStream.
  const MEDIA_MIME: Record<string, string> = {
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4',
    webm: 'video/webm', ogg: 'video/ogg',
  }
  protocol.handle('zeroseams-media', async (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    const ext = pathname.split('.').pop()?.toLowerCase() ?? ''
    const mime = MEDIA_MIME[ext] ?? 'video/mp4'

    let fileSize: number
    try {
      fileSize = (await stat(pathname)).size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const rangeHeader = request.headers.get('range')
    const start = rangeHeader ? parseInt(rangeHeader.replace(/bytes=(\d+)-.*/, '$1'), 10) : 0
    const endRaw = rangeHeader ? rangeHeader.replace(/bytes=\d+-(\d*)/, '$1') : ''
    const end = endRaw ? parseInt(endRaw, 10) : fileSize - 1

    const nodeStream = createReadStream(pathname, { start, end })
    const body = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) =>
          controller.enqueue(chunk instanceof Buffer ? chunk : Buffer.from(chunk as string)),
        )
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
      cancel() { nodeStream.destroy() },
    })

    const corpHeaders = {
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    }

    if (rangeHeader) {
      return new Response(body, {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
          ...corpHeaders,
        },
      })
    }
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        ...corpHeaders,
      },
    })
  })
  // Inject COOP/COEP headers so SharedArrayBuffer is available for FFmpeg WASM.
  // Without these, ffmpeg.load() hangs silently in Chromium.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    })
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
