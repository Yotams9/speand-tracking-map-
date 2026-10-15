// Reject getters, sparse arrays, inherited values and unknown media/metadata.
export function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false
  const own = Reflect.ownKeys(value)
  return own.length === keys.length && keys.every(k => Object.hasOwn(value, k) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, k)!, 'value')) && own.every(k => typeof k === 'string' && keys.includes(k))
}
export function denseArray(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit || Reflect.ownKeys(value).length !== value.length + 1) return false
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i))!, 'value')) return false
  return true
}
