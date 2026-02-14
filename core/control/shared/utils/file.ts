export interface FileWithStatus {
  file: File
  id: string
  previewUrl: string
  status: 'reading' | 'ready' | 'error'
  dataUrl?: string
  error?: string
}

export const FILE_UPLOAD_CONFIG = {
  maxSizeMB: 8,
  types: ['image', 'application/pdf', 'text/csv'],
  acceptPattern: 'image/*,application/pdf,.csv,text/csv'
} as const

export function getFileIcon(mimeType: string, fileName?: string): string {
  if (mimeType.startsWith('image/')) return 'i-lucide-image'
  if (mimeType === 'application/pdf') return 'i-lucide-file-text'
  if (mimeType === 'text/csv' || fileName?.endsWith('.csv')) return 'i-lucide-file-spreadsheet'
  return 'i-lucide-file'
}
