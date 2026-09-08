// Test-only synthetic symbols. No writer library, photographs or production encoder.
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const R = L.map((s) => [...s].map((b) => b === '0' ? '1' : '0').join(''))
const G = R.map((s) => [...s].reverse().join(''))
const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']
const upceParity = ['GGGLLL','GGLGLL','GGLLGL','GGLLLG','GLGGLL','GLLGGL','GLLLGG','GLGLGL','GLGLLG','GLLGLG']
export function barcodeBits(code: string, format: string): string {
  const digit = (n: string, table: string[]) => table[Number(n)]
  if (format === 'UPCA') return barcodeBits(`0${code}`, 'EAN13')
  if (format === 'EAN13') return '101' + [...code.slice(1,7)].map((n,i) => digit(n, parity[Number(code[0])][i] === 'L' ? L : G)).join('') + '01010' + [...code.slice(7)].map((n) => digit(n,R)).join('') + '101'
  if (format === 'EAN8') return '101' + [...code.slice(0,4)].map((n) => digit(n,L)).join('') + '01010' + [...code.slice(4)].map((n) => digit(n,R)).join('') + '101'
  if (format === 'UPCE') return '101' + [...code.slice(1,7)].map((n,i) => digit(n, (upceParity[Number(code[7])][i] === 'L') !== (code[0] === '1') ? L : G)).join('') + '010101'
  throw new Error('Unsupported test format')
}
export function barcodePixels(code: string, format: string): ImageData {
  const bits = '000000000000' + barcodeBits(code, format) + '000000000000'
  const width = bits.length * 3, height = 180
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 20; y < height - 20; y++) for (let x = 0; x < width; x++) {
    if (bits[Math.floor(x / 3)] === '1') {
      const offset = (y * width + x) * 4
      data[offset] = data[offset + 1] = data[offset + 2] = 0
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}
