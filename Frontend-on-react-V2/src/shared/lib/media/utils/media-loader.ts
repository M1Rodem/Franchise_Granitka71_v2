import { httpClient } from '@/shared/api/http-client'

const cache = new Map<string, string>()

export async function loadMedia(url: string): Promise<string | null> {

  if (cache.has(url)) {
    return cache.get(url)!
  }

  try {

    const res = await httpClient.get(url, {
      responseType: 'blob'
    })

    const blobUrl = URL.createObjectURL(res.data)

    cache.set(url, blobUrl)

    return blobUrl

  } catch {

    cache.delete(url)

    return null
  }
}

export function clearMediaCache() {

  cache.forEach((blob) => {
    URL.revokeObjectURL(blob)
  })

  cache.clear()
}