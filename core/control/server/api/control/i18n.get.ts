import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface LocaleFile {
  layer: string
  locale: string
  path: string
  keys: Record<string, string>
}

function flattenKeys(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenKeys(value, fullKey))
    }
    else {
      result[fullKey] = String(value)
    }
  }
  return result
}

export default defineEventHandler(() => {
  const root = getProjectRoot()
  const locales = ['en', 'es', 'fr']

  const layers: { name: string, dir: string }[] = [
    { name: 'core', dir: join(root, 'core/i18n/locales') },
    { name: 'organization', dir: join(root, 'organization/i18n/locales') }
  ]

  const files: LocaleFile[] = []
  const allKeys = new Set<string>()

  for (const layer of layers) {
    for (const locale of locales) {
      const filePath = join(layer.dir, `${locale}.json`)
      if (!existsSync(filePath)) continue

      try {
        const content = JSON.parse(readFileSync(filePath, 'utf-8'))
        const keys = flattenKeys(content)
        files.push({ layer: layer.name, locale, path: filePath, keys })
        for (const key of Object.keys(keys)) allKeys.add(key)
      }
      catch {
        // Skip malformed JSON files
      }
    }
  }

  // Build a table: key -> { en: value, es: value, fr: value, layer: string }
  const translations: Record<string, { layer: string, values: Record<string, string> }> = {}

  for (const key of [...allKeys].sort()) {
    const values: Record<string, string> = {}
    let layer = ''
    for (const file of files) {
      if (key in file.keys) {
        values[file.locale] = file.keys[key]!
        if (!layer) layer = file.layer
      }
    }
    translations[key] = { layer, values }
  }

  return {
    locales,
    layers: layers.map(l => l.name),
    totalKeys: allKeys.size,
    translations
  }
})
