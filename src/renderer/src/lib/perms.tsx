import React, { createContext, useContext } from 'react'
import { hasModuleAccess, hasPermission } from '@shared/permissions'
import { UserInfo } from '@shared/types'

// Provides the logged-in user to every page so buttons and saves can be gated
// with the SAME rule the backend enforces (src/shared/permissions.ts).
const UserCtx = createContext<UserInfo | null>(null)

export function PermProvider({ user, children }: { user: UserInfo | null; children: React.ReactNode }) {
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>
}

export function useUser(): UserInfo | null {
  return useContext(UserCtx)
}

// can('customers') → any access to the module (view or better)
// can('customers', 'edit') → module key, granular 'customers.edit', or 'all'
// permission_mode 'open' allows everything (mirrors backend behaviour)
export function useCan(): (module: string, action?: string) => boolean {
  const user = useContext(UserCtx)
  const perms = (user?.permissions as unknown as string[]) || []
  const openMode = user?.permissionMode === 'open'
  return (module: string, action?: string) => {
    if (openMode) return true
    if (action) return hasPermission(perms, module, action)
    return hasModuleAccess(perms, module)
  }
}

export function useIsSuper(): boolean {
  const user = useContext(UserCtx)
  return !!user && ((user.permissions as unknown as string[]) || []).includes('all')
}
