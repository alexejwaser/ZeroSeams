import type { Platform, FrameRatio } from '@/types/project'
import React from 'react'

export interface PlatformShellProps {
  ratio: FrameRatio
  currentFrame: number
  totalFrames: number
  onFrameChange: (n: number) => void
  frameDisplayWidth: number
  frameDisplayHeight: number
  children: React.ReactNode
  profile?: { name: string; verified?: boolean }
}

const SHELL_REGISTRY: Partial<Record<Platform, React.FC<PlatformShellProps>>> = {}

export function registerShell(platform: Platform, component: React.FC<PlatformShellProps>): void {
  SHELL_REGISTRY[platform] = component
}

export function getShell(platform: Platform): React.FC<PlatformShellProps> | null {
  return SHELL_REGISTRY[platform] ?? null
}
