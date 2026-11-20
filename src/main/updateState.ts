// Shared mutable auto-update state.
// Written by the updater, read by auth (to block login until a pending
// update is installed) — a separate module avoids a circular import.
export interface UpdateStatus {
  state: string // idle | checking | available | not-available | downloading | downloaded | error | not-configured | unavailable
  info: any | null
  percent: number
}

export const updateStatus: UpdateStatus = { state: 'idle', info: null, percent: 0 }

// True while an update has been found and is not yet installed — login is blocked during this window.
export function isUpdatePending(): boolean {
  return updateStatus.state === 'available' || updateStatus.state === 'downloading' || updateStatus.state === 'downloaded'
}
