import type { FileWithStatus } from '~~/shared/utils/file'
import { FILE_UPLOAD_CONFIG } from '~~/shared/utils/file'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function useFileUploadLocal() {
  const files = ref<FileWithStatus[]>([])
  const toast = useToast()

  async function addFiles(newFiles: File[]) {
    const filesWithStatus: FileWithStatus[] = newFiles
      .filter((file) => {
        if (file.size > FILE_UPLOAD_CONFIG.maxSizeMB * 1024 * 1024) {
          toast.add({
            title: 'File too large',
            description: `${file.name} exceeds ${FILE_UPLOAD_CONFIG.maxSizeMB}MB limit`,
            icon: 'i-lucide-alert-circle',
            color: 'error'
          })
          return false
        }
        return true
      })
      .map(file => ({
        file,
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        status: 'reading' as const
      }))

    files.value = [...files.value, ...filesWithStatus]

    const readPromises = filesWithStatus.map(async (fileWithStatus) => {
      const index = files.value.findIndex(f => f.id === fileWithStatus.id)
      if (index === -1) return

      try {
        const dataUrl = await readFileAsDataUrl(fileWithStatus.file)
        files.value[index] = {
          ...files.value[index]!,
          status: 'ready',
          dataUrl
        }
      }
      catch (error) {
        const errorMessage = (error as Error).message || 'Failed to read file'
        toast.add({
          title: 'File read failed',
          description: errorMessage,
          icon: 'i-lucide-alert-circle',
          color: 'error'
        })
        files.value[index] = {
          ...files.value[index]!,
          status: 'error',
          error: errorMessage
        }
      }
    })

    await Promise.allSettled(readPromises)
  }

  const { dropzoneRef, isDragging } = useFileUpload({
    accept: FILE_UPLOAD_CONFIG.acceptPattern,
    multiple: true,
    onUpdate: addFiles
  })

  const isReading = computed(() =>
    files.value.some(f => f.status === 'reading')
  )

  const readyFiles = computed(() =>
    files.value
      .filter(f => f.status === 'ready' && f.dataUrl)
      .map(f => ({
        type: 'file' as const,
        mediaType: f.file.type,
        url: f.dataUrl!
      }))
  )

  function removeFile(id: string) {
    const file = files.value.find(f => f.id === id)
    if (!file) return

    URL.revokeObjectURL(file.previewUrl)
    files.value = files.value.filter(f => f.id !== id)
  }

  function clearFiles() {
    if (files.value.length === 0) return
    files.value.forEach(f => URL.revokeObjectURL(f.previewUrl))
    files.value = []
  }

  onUnmounted(() => {
    clearFiles()
  })

  return {
    dropzoneRef,
    isDragging,
    files,
    isReading,
    readyFiles,
    addFiles,
    removeFile,
    clearFiles
  }
}
