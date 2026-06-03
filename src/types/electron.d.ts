interface ExternalEditor {
  name: string
  execPath: string
}

interface Window {
  electronAPI: {
    platform: string
    saveFile(
      filename: string,
      base64: string,
    ): Promise<{ success: boolean; error?: string }>
    autosaveProject(
      filename: string,
      json: string,
    ): Promise<{ success: boolean; filePath?: string; error?: string }>
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
    appendExportLog(line: string): Promise<void>
    clearExportLog(): Promise<void>
    getFileSize(filePath: string): Promise<{ size: number }>
  }
}
