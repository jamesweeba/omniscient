/**
 * Shrinks a photo in the browser before upload (phone photos are often 3–6 MB; this makes
 * them a few hundred KB, which matters on mobile data). Returns a JPEG.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser can’t process photos. Please try another browser.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t process that photo. Please try another.'))),
      'image/jpeg',
      quality,
    ),
  )
}

/** "IMG_2041.HEIC" → "IMG_2041.jpg", for a photo converted to JPEG. */
export const asJpegName = (fileName: string) => `${fileName.replace(/\.[^.]+$/, '') || 'photo'}.jpg`
