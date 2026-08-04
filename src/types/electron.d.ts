interface ExternalEditor {
  name: string
  execPath: string
}

/** Structural mirror of `Swatch` in ./canvas.ts. This file is a *global*
 *  declaration file — adding an `import` would turn it into a module and the
 *  `Window` augmentation would stop applying. Same reason ExternalEditor is
 *  duplicated above. Structurally identical, so the two are assignable. */
interface SwatchDTO {
  id: string
  color: string
  name?: string
}

interface Window {
  electronAPI: {
    platform: string
    /** Absolute path of a File from a drop or paste. Synchronous — File.path was
     *  removed in Electron 32 and the object does not survive an await. Returns
     *  '' for a File the OS has no path for (e.g. a clipboard bitmap). */
    getPathForFile(file: File): string
    saveFile(
      filename: string,
      base64: string,
    ): Promise<{ success: boolean; error?: string }>
    /** Writes <folderPath>/<filename>.zeroseams. Refuses to overwrite an
     *  existing file — resolves { success:false, error } instead. */
    createProjectFile(
      folderPath: string,
      filename: string,
      json: string,
    ): Promise<{ success: boolean; filePath?: string; error?: string }>
    getDefaultProjectDir(): Promise<{ folderPath: string }>
    /** Mirror the dirty flag into main, which owns the close guard. */
    setDirtyState(dirty: boolean): void
    /** Tell main the save it asked for is done and the window may close. */
    confirmClose(): Promise<{ success: boolean }>
    /** A path the OS handed the app before the renderer mounted, or null. */
    takePendingOpenFile(): Promise<{ filePath: string | null }>
    onMenuAction(cb: (action: string) => void): () => void
    onOpenFilePath(cb: (filePath: string) => void): () => void
    openProject(): Promise<{ success: boolean; json?: string; filePath?: string; error?: string }>
    listRecentProjects(): Promise<{
      files: Array<{ name: string; path: string; modifiedAt: string }>
    }>
    saveProjectAs(
      json: string,
    ): Promise<{ success: boolean; filePath?: string; error?: string }>
    saveProject(
      filePath: string,
      json: string,
    ): Promise<{ success: boolean; error?: string }>
    saveProjectCopy(json: string): Promise<{ success: boolean; filePath?: string; error?: string }>
    getSystemFonts(): Promise<string[]>
    getGlobalSwatches(): Promise<SwatchDTO[]>
    setGlobalSwatches(swatches: SwatchDTO[]): Promise<{ success: boolean; error?: string }>
    getExternalEditor(): Promise<ExternalEditor | null>
    setExternalEditor(): Promise<ExternalEditor | null>
    editInExternalApp(
      objectId: string,
      base64: string,
      mimeType: string,
      projectFilePath: string | null,
    ): Promise<{ success: boolean; error?: string }>
    stopExternalEdit(objectId: string): Promise<{ success: boolean }>
    onExternalImageChanged(
      cb: (data: { objectId: string; base64: string }) => void,
    ): () => void
    saveVideoFile(filename: string, base64: string): Promise<{ success: boolean; error?: string }>
    resolveVideoPath(relativeFilePath: string, projectFilePath: string): Promise<{ filePath: string }>
    makeRelativePath(fromDir: string, toPath: string): Promise<{ relativePath: string }>
    openVideoFile(): Promise<{ canceled: boolean; filePath?: string }>
    openImageFile(): Promise<{ canceled: boolean; data?: string }>
    appendExportLog(line: string): Promise<void>
    clearExportLog(): Promise<void>
    getFileSize(filePath: string): Promise<{ size: number }>
    showFolderDialog(options?: { title?: string; defaultPath?: string }): Promise<{ folderPath?: string; cancelled: boolean }>
    writeFileToFolder(folderPath: string, filename: string, base64: string): Promise<{ success: boolean; error?: string }>
    loadFileAtPath(filePath: string): Promise<{ success: boolean; json?: string; filePath?: string }>
  }
}
