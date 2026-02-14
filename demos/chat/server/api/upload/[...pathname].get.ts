import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const { pathname } = event.context.params as { pathname: string }

  return blob.serve(event, pathname)
})
