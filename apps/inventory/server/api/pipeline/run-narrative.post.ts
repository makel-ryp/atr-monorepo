import { spawn } from 'node:child_process'

export default defineEventHandler(() => {
  const child = spawn('python', ['pipeline/run_pipeline.py', '--narrative-only'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
    env: { ...process.env },
  })
  child.unref()
  return { started: true, pid: child.pid }
})
