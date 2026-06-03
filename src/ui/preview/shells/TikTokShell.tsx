import React from 'react'
import { registerShell } from './registry'
import type { PlatformShellProps } from './registry'

function TikTokShell({ children }: PlatformShellProps): React.ReactElement {
  return <>{children}</>
}

registerShell('tiktok', TikTokShell)

export { TikTokShell }
