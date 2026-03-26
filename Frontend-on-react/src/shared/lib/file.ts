export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()
  a.remove()

  URL.revokeObjectURL(url)
}

export function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')

  // не ревокаем сразу — вкладка может не успеть загрузиться
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function handleBlobResponse(blob: Blob): Promise<Blob> {
  const contentType = blob.type

  if (contentType.includes('application/json')) {
    const text = await blob.text()
    const json = JSON.parse(text)

    throw new Error(json.error || 'Ошибка при загрузке файла')
  }

  return blob
}