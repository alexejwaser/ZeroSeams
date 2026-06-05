import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveFile: (filename: string, base64: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-file', { filename, base64 }),
  autosaveProject: (
    filename: string,
    json: string,
  ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('autosave-project', { filename, json }),
  openProject: (): Promise<{ success: boolean; json?: string; error?: string }> =>
    ipcRenderer.invoke('open-project'),
  listRecentProjects: (): Promise<{
    files: Array<{ name: string; path: string; modifiedAt: string }>
  }> => ipcRenderer.invoke('list-recent-projects'),
  saveProjectAs: (json: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-project-as', { json }),
  saveProject: (filePath: string, json: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-project', { filePath, json }),
  saveProjectCopy: (json: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('save-project-copy', { json }),
  getSystemFonts: (): Promise<string[]> =>
    ipcRenderer.invoke('get-system-fonts'),
  getExternalEditor: (): Promise<{ name: string; execPath: string } | null> =>
    ipcRenderer.invoke('get-external-editor'),
  setExternalEditor: (): Promise<{ name: string; execPath: string } | null> =>
    ipcRenderer.invoke('set-external-editor'),
  editInExternalApp: (
    objectId: string,
    base64: string,
    mimeType: string,
    projectFilePath: string | null,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('edit-in-external-app', { objectId, base64, mimeType, projectFilePath }),
  stopExternalEdit: (objectId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('stop-external-edit', { objectId }),
  onExternalImageChanged: (
    cb: (data: { objectId: string; base64: string }) => void,
  ): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { objectId: string; base64: string }) =>
      cb(data)
    ipcRenderer.on('external-image-changed', handler)
    return () => { ipcRenderer.removeListener('external-image-changed', handler) }
  },
  openVideoFile: (): Promise<{ canceled: boolean; filePath?: string }> =>
    ipcRenderer.invoke('open-video-file'),
  openImageFile: (): Promise<{ canceled: boolean; data?: string }> =>
    ipcRenderer.invoke('open-image-file'),
  appendExportLog: (line: string): Promise<void> =>
    ipcRenderer.invoke('append-export-log', { line }),
  clearExportLog: (): Promise<void> =>
    ipcRenderer.invoke('clear-export-log'),
  saveVideoFile: (filename: string, base64: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-video-file', { filename, base64 }),
  resolveVideoPath: (relativeFilePath: string, projectFilePath: string): Promise<{ filePath: string }> =>
    ipcRenderer.invoke('resolve-video-path', { relativeFilePath, projectFilePath }),
  makeRelativePath: (fromDir: string, toPath: string): Promise<{ relativePath: string }> =>
    ipcRenderer.invoke('make-relative-path', { fromDir, toPath }),
  getFileSize: (filePath: string): Promise<{ size: number }> =>
    ipcRenderer.invoke('get-file-size', { filePath }),
})
