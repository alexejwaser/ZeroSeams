import { app, BrowserWindow, ipcMain, dialog, shell, protocol, session, Menu, type MenuItemConstructorOptions } from 'electron'
import { join, dirname, basename, extname, relative } from 'path'
import { writeFile, readFile, stat, mkdir, access } from 'fs/promises'
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

function getGlobalSwatchesPath(): string {
  return join(app.getPath('userData'), 'swatches.json')
}

async function addRecentFile(filePath: string): Promise<void> {
  let list: string[] = []
  try {
    const raw = await readFile(getRecentFilesPath(), 'utf-8')
    list = JSON.parse(raw) as string[]
  } catch { /* first run or corrupt — start fresh */ }
  list = [filePath, ...list.filter((p) => p !== filePath)].slice(0, 30)
  await writeFile(getRecentFilesPath(), JSON.stringify(list), 'utf-8').catch(() => {})
  // File → Open Recent reads the same list; rebuild it here so every path that
  // touches recents (create, open, save) updates the menu without remembering to.
  void refreshAppMenu()
}

interface Preferences {
  defaultExternalEditor?: ExternalEditor | null
  /** Folder the last document was created in — the New Document screen's default. */
  lastProjectDir?: string
}

interface ExternalEditor {
  name: string
  execPath: string
}

/** Mirrors Swatch in src/types/canvas.ts — src/electron is a separate tsconfig
 *  project with no `@/` alias, so the renderer type can't be imported here. */
interface Swatch {
  id: string
  color: string
  name?: string
}

async function readGlobalSwatches(): Promise<Swatch[]> {
  try {
    const raw = await readFile(getGlobalSwatchesPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    // Missing file, truncated write or hand-edited garbage all land here —
    // an empty palette is always a usable answer, a throw is not.
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is Swatch =>
        s != null && typeof s === 'object' &&
        typeof (s as Swatch).id === 'string' &&
        typeof (s as Swatch).color === 'string',
    )
  } catch {
    return []
  }
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

/** Mirror of the renderer's dirty flag, pushed on every change. The close guard
 *  runs in main and can't read a Zustand store. */
let documentDirty = false
/** Set once the user has answered the save prompt, so the second close() call
 *  isn't intercepted again. */
let allowClose = false

/** `.zeroseams` paths that arrived before the renderer could ask for them.
 *  macOS fires `open-file` BEFORE `ready`, so this queue is not optional. */
const pendingOpenFiles: string[] = []

function queueOrSendOpenFile(filePath: string): void {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('open-file-path', filePath)
  } else {
    pendingOpenFiles.push(filePath)
  }
}

/** Send a menu command to the renderer, which routes it into src/io/fileManager.
 *  Menus never re-implement what a button already does. */
function sendMenuAction(action: string): void {
  const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu-action', action)
}

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
  // A fresh window starts with the guard armed again — allowClose survives the
  // window that set it, and a stale `true` disarms the prompt permanently.
  allowClose = false
  documentDirty = false

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

  // Files queued before the renderer existed are *pulled* by it at mount
  // ('take-pending-open-file'), not pushed here: did-finish-load fires before
  // React has registered its listener, so a push at that point is dropped.

  // Close guard: never drop unsaved work silently. The renderer answers a Save
  // choice by invoking 'confirm-close' once its write has finished, which is
  // what makes "Save" actually complete before the window goes away.
  // Deliberately the ASYNC dialog. showMessageBoxSync blocks the whole main
  // event loop, which means no IPC, no timers, and — the reason this bit us —
  // no signal handlers: a SIGTERM arriving while the prompt was up could never
  // be serviced, so the process hung forever holding its debug port.
  win.on('close', (e) => {
    if (allowClose || !documentDirty) return
    e.preventDefault()
    void dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'Save changes before closing?',
      detail: 'Your unsaved changes will be lost otherwise.',
    }).then(({ response }) => {
      if (win.isDestroyed()) return
      if (response === 2) return
      if (response === 1) {
        allowClose = true
        win.close()
        return
      }
      sendMenuAction('save-and-close')
    })
  })
}

// ── Application menu ────────────────────────────────────────────────────────
// Accelerators here are consumed by the menu, so the matching handler in
// useKeyboardShortcuts.ts stops seeing those keys once a menu exists — every
// item below therefore routes to the same renderer action the key did.
function buildAppMenu(recentPaths: string[]): void {
  const isMac = process.platform === 'darwin'
  const item = (label: string, accelerator: string | undefined, action: string): MenuItemConstructorOptions => ({
    label,
    ...(accelerator ? { accelerator } : {}),
    click: () => { sendMenuAction(action) },
  })

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{
          label: app.name,
          submenu: [
            { role: 'about' }, { type: 'separator' },
            { role: 'services' }, { type: 'separator' },
            { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
            { type: 'separator' }, { role: 'quit' },
          ],
        }] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        item('New…', 'CmdOrCtrl+N', 'new'),
        item('Open…', 'CmdOrCtrl+O', 'open'),
        {
          label: 'Open Recent',
          submenu: recentPaths.length === 0
            ? [{ label: 'No recent projects', enabled: false }]
            : recentPaths.slice(0, 10).map((p): MenuItemConstructorOptions => ({
                label: basename(p),
                click: () => { queueOrSendOpenFile(p) },
              })),
        },
        { type: 'separator' },
        item('Save', 'CmdOrCtrl+S', 'save'),
        item('Save As…', 'CmdOrCtrl+Shift+S', 'save-as'),
        item('Save a Copy…', 'Alt+Shift+CmdOrCtrl+S', 'save-copy'),
        { type: 'separator' },
        item('Export…', 'CmdOrCtrl+E', 'export'),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        // Custom, not roles: role:'undo' issues a DOM undo, which knows nothing
        // about the canvas history stack. The renderer falls back to the DOM
        // command when focus is in a text field.
        item('Undo', 'CmdOrCtrl+Z', 'undo'),
        item('Redo', 'CmdOrCtrl+Shift+Z', 'redo'),
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        item('Select All', 'CmdOrCtrl+A', 'select-all'),
      ],
    },
    {
      label: 'View',
      submenu: [
        item('Zoom In', 'CmdOrCtrl+Plus', 'zoom-in'),
        item('Zoom Out', 'CmdOrCtrl+-', 'zoom-out'),
        item('Reset Zoom', 'CmdOrCtrl+0', 'zoom-reset'),
        { type: 'separator' },
        item('Toggle Preview', 'CmdOrCtrl+Shift+P', 'toggle-preview'),
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Rebuild the menu so File → Open Recent reflects recentFiles.json.
 *  A Menu is immutable once built, so the whole thing is rebuilt. */
async function refreshAppMenu(): Promise<void> {
  let paths: string[] = []
  try {
    paths = JSON.parse(await readFile(getRecentFilesPath(), 'utf-8')) as string[]
  } catch { /* first run — no recents */ }
  buildAppMenu(Array.isArray(paths) ? paths : [])
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

// NOTE: there is deliberately no 'autosave-project' handler. It wrote to a
// path the user never chose (~/Documents/ZeroSeams/<name>.zeroseams) and was
// the only way a project file could appear on disk without consent — issue #70.

/**
 * Create the file for a brand-new document. Refuses to overwrite: the New
 * Document screen renders the returned error inline, so a name collision is a
 * correctable mistake rather than a silently destroyed project.
 */
ipcMain.handle(
  'create-project-file',
  async (
    _event,
    { folderPath, filename, json }: { folderPath: string; filename: string; json: string },
  ) => {
    const stem = filename.replace(/\.zeroseams$/i, '')
    if (!stem || /[\\/:*?"<>|]/.test(stem)) {
      return { success: false, error: 'That file name isn’t valid.' }
    }
    const filePath = join(folderPath, `${stem}.zeroseams`)
    try {
      await access(filePath)
      return { success: false, error: `“${stem}.zeroseams” already exists in that folder.` }
    } catch { /* does not exist — the only case we write in */ }
    try {
      await mkdir(folderPath, { recursive: true })
      await writeFile(filePath, json, 'utf-8')
      void addRecentFile(filePath)
      const prefs = await readPreferences()
      await writePreferences({ ...prefs, lastProjectDir: folderPath })
      console.log(`[main] created → ${filePath}`)
      return { success: true, filePath }
    } catch (error) {
      console.error('[main] create-project-file error:', error)
      return { success: false, error: String(error) }
    }
  },
)

ipcMain.handle('get-default-project-dir', async () => {
  const prefs = await readPreferences()
  return { folderPath: prefs.lastProjectDir ?? getZeroSeamsDir() }
})

/** Renderer → main mirror of the dirty flag, for the close guard. */
ipcMain.on('set-dirty-state', (_event, dirty: boolean) => {
  documentDirty = Boolean(dirty)
})

/** The renderer finished the save it was asked for; let the window go. */
ipcMain.handle('confirm-close', () => {
  allowClose = true
  const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
  win?.close()
  return { success: true }
})

/** Pull (and clear) a path handed to us by the OS before the renderer mounted. */
ipcMain.handle('take-pending-open-file', () => {
  return { filePath: pendingOpenFiles.shift() ?? null }
})

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

ipcMain.handle('load-file-at-path', async (_event, filePath: string) => {
  try {
    const json = await readFile(filePath, 'utf-8')
    void addRecentFile(filePath)
    return { success: true, json, filePath }
  } catch (error) {
    console.error(`[main] load-file-at-path error:`, error)
    return { success: false }
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
  // Not part of Electron's stable App API — present only in some builds.
  // The renderer FontPicker falls back to MAC_SYSTEM_FONTS on empty.
  return (app as unknown as { getSystemFonts?: () => string[] }).getSystemFonts?.() ?? []
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

ipcMain.handle('get-global-swatches', async (): Promise<Swatch[]> => {
  return await readGlobalSwatches()
})

ipcMain.handle(
  'set-global-swatches',
  async (_event, { swatches }: { swatches: Swatch[] }): Promise<{ success: boolean; error?: string }> => {
    try {
      await writeFile(getGlobalSwatchesPath(), JSON.stringify(swatches, null, 2), 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('[main] set-global-swatches error:', error)
      return { success: false, error: String(error) }
    }
  },
)

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
  // This dialog is the FIRST thing "Edit Externally" shows when no editor is
  // configured yet, so it has to explain itself — otherwise it reads as a stray
  // "open a file" window and the feature looks broken. defaultPath matters most:
  // landing in the apps folder makes the ask obvious without reading anything.
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose External Editor',
    message: 'Pick the app to open images in — for example Photoshop, Affinity Photo or Pixelmator.',
    buttonLabel: 'Use This Editor',
    defaultPath:
      process.platform === 'darwin' ? '/Applications'
      : process.platform === 'win32' ? process.env.ProgramFiles ?? undefined
      : undefined,
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

ipcMain.handle('show-folder-dialog', async (_event, options?: { title?: string; defaultPath?: string }) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    // Parameterized: the New Document picker must not say "export".
    title: options?.title ?? 'Choose export folder',
    ...(options?.defaultPath ? { defaultPath: options.defaultPath } : {}),
  })
  return { folderPath: result.filePaths[0], cancelled: result.canceled }
})

ipcMain.handle('write-file-to-folder', async (_event, folderPath: string, filename: string, base64: string) => {
  try {
    const filePath = join(folderPath, filename)
    const buffer = Buffer.from(base64, 'base64')
    await writeFile(filePath, buffer)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
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
  void refreshAppMenu()
})

// macOS hands a double-clicked file over here — and does it BEFORE 'ready',
// so this listener has to be registered at module scope, not inside whenReady.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueOrSendOpenFile(filePath)
})

// Windows/Linux pass the path as an argv entry instead.
{
  const fromArgv = process.argv.slice(1).find((a) => a.toLowerCase().endsWith('.zeroseams'))
  if (fromArgv) pendingOpenFiles.push(fromArgv)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
