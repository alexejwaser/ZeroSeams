import React from 'react'
import { registerShell } from './registry'
import type { PlatformShellProps } from './registry'

function FacebookShell({ children }: PlatformShellProps): React.ReactElement {
  return <>{children}</>
}

registerShell('facebook', FacebookShell)

export { FacebookShell }
