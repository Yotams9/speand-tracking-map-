export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024
export interface ReceiptImageInfo { mime: 'image/png' | 'image/jpeg'; width: number; height: number }
const dimensions = (mime: ReceiptImageInfo['mime'], width: number, height: number): ReceiptImageInfo => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 || width > 6000 || height > 6000 || width * height > 12_000_000) throw new Error('image-size')
  return { mime, width, height }
}
// Inspect dimensions before browser decoding to bound decompression work.
export function receiptImageHeader(bytes: Uint8Array, mime: string): ReceiptImageInfo {
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES) throw new Error('image-size')
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (mime === 'image/png' && bytes.length >= 33 && [137,80,78,71,13,10,26,10].every((x, i) => bytes[i] === x) && v.getUint32(8) === 13 && v.getUint32(12) === 0x49484452) return dimensions(mime, v.getUint32(16), v.getUint32(20))
  if (mime === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) break
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 218 || marker === 217) break
      if (marker === 1 || marker >= 208 && marker <= 215) continue
      if (offset + 2 > bytes.length) break
      const length = v.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if ([192,193,194].includes(marker) && length >= 8) return dimensions(mime, v.getUint16(offset + 5), v.getUint16(offset + 3))
      offset += length
    }
  }
  throw new Error('image-format')
}
export async function inspectReceiptImage(file: File, signal: AbortSignal): Promise<ReceiptImageInfo> {
  if (!file.size || file.size > MAX_RECEIPT_BYTES) throw new Error('image-size')
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('image-format')
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    if (signal.aborted) throw new Error('cancelled')
    const info = receiptImageHeader(bytes, file.type)
    const bitmap = await createImageBitmap(file)
    try {
      if (signal.aborted) throw new Error('cancelled')
      // EXIF orientation can swap dimensions; it never changes financial facts.
      if (!((bitmap.width === info.width && bitmap.height === info.height) || (bitmap.width === info.height && bitmap.height === info.width))) throw new Error('image-format')
      return info
    } finally { bitmap.close() }
  } finally { bytes.fill(0) }
}
