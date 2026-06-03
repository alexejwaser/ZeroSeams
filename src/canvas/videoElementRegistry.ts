const registry = new Map<string, HTMLVideoElement>()

export function registerVideoElement(id: string, el: HTMLVideoElement): void {
  registry.set(id, el)
}

export function unregisterVideoElement(id: string): void {
  registry.delete(id)
}

export function getVideoElement(id: string): HTMLVideoElement | undefined {
  return registry.get(id)
}

/** Direct access to the registry map — use getVideoElement() when possible. */
export { registry as videoElementRegistry }
