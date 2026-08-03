// Shared Zustand stores — coordinate between agents before editing.
// Import types only from @/types; never import from canvas/, ui/, or ai/.
export { useSaveStatusStore, trackSave, type SaveStatus } from './useSaveStatusStore'
export { useExportStore } from './useExportStore'
export { useSwatchStore, type SwatchScope } from './useSwatchStore'
