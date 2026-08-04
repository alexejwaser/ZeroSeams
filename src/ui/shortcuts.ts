// Single source of truth for keyboard shortcuts. The ShortcutOverlay renders
// this table; Tooltip `shortcut=` props should quote the same strings so the
// two can't drift. Handlers live in src/canvas/useKeyboardShortcuts.ts.

export interface ShortcutEntry {
  keys: string
  label: string
}

export interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    entries: [
      { keys: 'V', label: 'Select' },
      { keys: 'T', label: 'Text' },
      { keys: 'R', label: 'Shape' },
      { keys: 'P', label: 'Pen' },
      { keys: 'G', label: 'Guideline' },
      { keys: 'X / Tab', label: 'Flip guideline orientation (while placing)' },
    ],
  },
  {
    title: 'Canvas',
    entries: [
      { keys: 'S', label: 'Toggle snapping' },
      { keys: 'F', label: 'Frame settings' },
      { keys: '\\ (hold)', label: 'Compare without adjustments' },
      { keys: '⌘ +', label: 'Zoom in' },
      { keys: '⌘ −', label: 'Zoom out' },
      { keys: '⌘ 0', label: 'Reset zoom & pan' },
      { keys: '⌘ →', label: 'Add frame' },
      { keys: '⌘ ←', label: 'Remove frame' },
      { keys: 'Esc', label: 'Deselect / cancel' },
    ],
  },
  {
    title: 'Objects',
    entries: [
      { keys: '⌘ A', label: 'Select all' },
      { keys: '⌘ D', label: 'Duplicate' },
      { keys: '⌘ C', label: 'Copy' },
      { keys: '⌘ X', label: 'Cut' },
      { keys: '⌘ V', label: 'Paste (objects, image or video)' },
      { keys: '⌘ L', label: 'Lock / unlock' },
      { keys: '⌫', label: 'Delete' },
      { keys: 'Arrows', label: 'Nudge 1 px (⇧ for 10 px)' },
      { keys: '⌘ ]', label: 'Bring forward' },
      { keys: '⌘ [', label: 'Send backward' },
      { keys: '⌘ ⇧ ]', label: 'Bring to front' },
      { keys: '⌘ ⇧ [', label: 'Send to back' },
    ],
  },
  {
    title: 'File & view',
    entries: [
      { keys: '⌘ N', label: 'New document' },
      { keys: '⌘ O', label: 'Open' },
      { keys: '⌘ S', label: 'Save' },
      { keys: '⌘ ⇧ S', label: 'Save as' },
      { keys: '⌥ ⇧ ⌘ S', label: 'Save a copy' },
      { keys: '⌘ E', label: 'Export' },
      { keys: '⌘ Z', label: 'Undo' },
      { keys: '⌘ ⇧ Z', label: 'Redo' },
      { keys: '⌘ ⇧ P', label: 'Platform preview' },
      { keys: '?', label: 'This cheatsheet' },
    ],
  },
]
