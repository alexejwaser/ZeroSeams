/**
 * Shut a spawned Electron down and actually wait for it to be gone.
 *
 * Plain `proc.kill()` is not enough since the unsaved-changes close guard
 * landed: Electron's browser process services POSIX signals itself (Node's
 * `process.on('SIGTERM')` in main never runs), so SIGTERM reaches the window as
 * a close, the guard sees a dirty document, and the app sits on the
 * unsaved-changes prompt forever — still holding its --remote-debugging-port.
 * Every suite run then orphaned an Electron that made the NEXT run fail with
 * "DevTools port timeout", which reads as a broken test rather than a stale
 * process. Escalate to SIGKILL instead of leaving that landmine.
 */
export async function terminateElectron(proc, { graceMs = 2000 } = {}) {
  if (proc.exitCode !== null || proc.signalCode !== null) return

  const exited = new Promise((resolve) => { proc.once('exit', resolve) })
  proc.kill('SIGTERM')

  const timedOut = Symbol('timeout')
  const raced = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(timedOut), graceMs)),
  ])
  if (raced !== timedOut) return

  proc.kill('SIGKILL')
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
}
