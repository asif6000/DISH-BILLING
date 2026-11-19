import type { Api } from '../../../preload/index'

declare global {
  interface Window { api: Api }
}

export const api = (): Api => window.api

export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('SESSION_EXPIRED')) return 'EXPIRED'
  return m.replace(/^.*Error invoking remote method '[^']+': Error: /, '')
}
