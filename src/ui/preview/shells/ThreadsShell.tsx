import React from 'react'
import { registerShell } from './registry'
import type { PlatformShellProps } from './registry'

function ThreadsShell({ children }: PlatformShellProps): React.ReactElement {
  return <>{children}</>
}

registerShell('threads', ThreadsShell)

export { ThreadsShell }
