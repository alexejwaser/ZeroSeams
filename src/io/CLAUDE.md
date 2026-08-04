# Zero Seams — `src/io/`

Project file lifecycle and save feedback.

**File lifecycle** (`src/io/projectFile.ts` + `src/io/fileManager.ts`):
- `projectFile.ts` is the ONLY place a `.zeroseams` payload is built or applied. It replaced three hand-maintained copies (Toolbar, useKeyboardShortcuts, useAutosave) whose `version` values had already drifted. New fields go there, never in a caller
- `fileManager.ts` is the ONLY place create/open/save/saveAs/saveCopy behaviour lives. UI (TitleBar buttons, ⌘-shortcuts, native menu) all route into it — three copies of "save, then maybe set the path" is what this replaced
- `applyProject` is the only place a *loaded* document sets `documentReady`. `createNew` sets it only after the write lands
- `saveCopy` must never move `currentFilePath` or `lastFile` — it's a copy, not a Save As
- `rememberLastFile(path)` on every save that lands a path, not just on open. Writing it only in the open path is why a ⌘S-created file wasn't restored after a restart
- `buildNewProject(spec)` is pure and store-free ON PURPOSE: `createNew` writes the file BEFORE resetting the canvas, so a refused write (name collision) leaves the open document intact. Reset-then-write would destroy a document to report an error
- Autosave (`useAutosave`) returns early unless `documentReady && currentFilePath`, and never creates a file. The `autosave-project` IPC channel was deleted, not just unused — it was the only path that could write a project file without consent
- Autosave compares a content signature (objects/objectOrder/frames/frameCount/frame dims/ratio/platform/backgroundColor) before firing. The canvas store also emits on selection and tool changes; treating those as edits marked the doc dirty and rewrote the file when nothing had changed
- OS `open-file` fires BEFORE `ready` on macOS — the handler is registered at module scope and queues the path for the renderer to pull after mount
- The close guard uses the **async** `dialog.showMessageBox`. `showMessageBoxSync` freezes the entire main event loop — no IPC, no timers, no signal servicing
- E2E scripts must shut Electron down via `scripts/terminateElectron.mjs`, never a bare `proc.kill()`. Electron's browser process services POSIX signals itself (a `process.on('SIGTERM')` in main **never runs**), so SIGTERM arrives as a window close, the guard sees a dirty document, and the app parks on the prompt still holding its `--remote-debugging-port`. The next run then fails with "DevTools port timeout", which looks like a broken test rather than a stale process

**Save feedback:**
- Every manual save path (⌘S, ⌘⇧S, Save menu, Save a Copy) must go through `trackSave()` from `@/store` — it drives the SaveStatusPill (saving spinner → saved/error), clears `dirty`, and treats Electron's `{success:false}` dialog-cancel as idle, not saved
- `dirty` in useSaveStatusStore: armed on a real content change (useAutosave subscription), cleared on save success; rendered as the accent dot next to the title
