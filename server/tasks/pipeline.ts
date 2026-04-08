import { spawn } from 'node:child_process'

export default defineTask({
  meta: {
    name: 'pipeline',
    description: 'Run the inventory pipeline at 7am UTC',
  },
  async run() {
    const child = spawn('python', ['pipeline/run_pipeline.py'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: { ...process.env },
    })
    child.unref()
    return { result: { started: true, pid: child.pid } }
  },
})
