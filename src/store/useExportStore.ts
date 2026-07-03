import { create } from 'zustand'

interface ExportState {
  exporting: boolean
  exportStatus: string
  cancelRequested: boolean
  setExporting: (v: boolean) => void
  setExportStatus: (s: string) => void
  requestCancel: () => void
  reset: () => void
}

export const useExportStore = create<ExportState>((set) => ({
  exporting: false,
  exportStatus: '',
  cancelRequested: false,
  setExporting: (v) => set({ exporting: v }),
  setExportStatus: (s) => set({ exportStatus: s }),
  requestCancel: () => set({ cancelRequested: true }),
  reset: () => set({ exporting: false, exportStatus: '', cancelRequested: false }),
}))
