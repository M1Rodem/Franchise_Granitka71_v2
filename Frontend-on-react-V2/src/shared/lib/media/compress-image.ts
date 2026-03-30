export async function compressImage(file: File): Promise<File> {
  const imageBitmap = await createImageBitmap(file)

  const maxWidth = 1920
  const maxHeight = 1920

  let { width, height } = imageBitmap

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas error')

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(
      (b) => resolve(b!),
      'image/jpeg',
      0.75
    )
  )

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
    type: 'image/jpeg',
  })
}