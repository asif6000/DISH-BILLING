import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)

const api = {
  subscription: {
    status: () => invoke('sub:status'),
    activate: (code: string) => invoke('sub:activate', code),
    sendRequest: (d: any) => invoke('sub:sendRequest', d),
    checkRemote: () => invoke('sub:checkRemote'),
    appId: () => invoke('sub:appId')
  },
  auth: {
    login: (u: string, p: string) => invoke('auth:login', u, p),
    logout: () => invoke('auth:logout'),
    check: () => invoke('auth:check'),
    loginHelp: (u: string) => invoke('auth:loginHelp', u),
    ping: () => invoke('auth:ping'),
    changePassword: (o: string, n: string) => invoke('auth:changePassword', o, n),
    onExpired: (cb: () => void) => {
      const listener = () => cb()
      ipcRenderer.on('auth:expired', listener)
      return () => ipcRenderer.removeListener('auth:expired', listener)
    },
    // pushed by the main process when this user's permissions change live
    // (Security → Roles / per-user grants) — no logout/login needed
    onPermissionsUpdated: (cb: () => void) => {
      const listener = () => cb()
      ipcRenderer.on('permissions:updated', listener)
      return () => ipcRenderer.removeListener('permissions:updated', listener)
    }
  },
  users: {
    list: () => invoke('users:list'),
    create: (d: any) => invoke('users:create', d),
    update: (id: number, d: any) => invoke('users:update', id, d),
    delete: (id: number) => invoke('users:delete', id),
    linkCollector: (id: number, collectorId: number | null) => invoke('users:linkCollector', id, collectorId),
    permsGet: (id: number) => invoke('permissions:get', id),
    permsSet: (id: number, grants: any[]) => invoke('permissions:set', id, grants),
    permsAudit: (id: number) => invoke('permissions:audit', id)
  },
  roles: {
    list: () => invoke('roles:list'),
    save: (d: any) => invoke('roles:save', d),
    delete: (id: number, reassignTo?: number) => invoke('roles:delete', id, reassignTo)
  },
  logs: {
    activity: (limit?: number) => invoke('logs:activity', limit),
    logins: (limit?: number) => invoke('logs:logins', limit)
  },
  db: {
    list: (entity: string, params?: any) => invoke('db:list', entity, params),
    get: (entity: string, id: number) => invoke('db:get', entity, id),
    create: (entity: string, data: any) => invoke('db:create', entity, data),
    update: (entity: string, id: number, data: any) => invoke('db:update', entity, id, data),
    delete: (entity: string, id: number) => invoke('db:delete', entity, id),
    reflist: (entity: string) => invoke('db:reflist', entity)
  },
  collector: {
    assignAreas: (id: number, areaIds: number[]) => invoke('collector:assignAreas', id, areaIds),
    getAreas: (id: number) => invoke('collector:getAreas', id)
  },
  customers: {
    list: (params?: any) => invoke('customers:list', params),
    get: (id: number) => invoke('customers:get', id),
    setCollector: (customerIds: number[], collectorId: number | null) => invoke('customers:setCollector', customerIds, collectorId),
    assignmentCounts: () => invoke('customers:assignmentCounts'),
    create: (d: any) => invoke('customers:create', d),
    import: (rows: any[], areaId?: number) => invoke('customers:import', rows, areaId),
    update: (id: number, d: any) => invoke('customers:update', id, d),
    setStatus: (id: number, status: string, note?: string) => invoke('customers:setStatus', id, status, note),
    remove: (id: number) => invoke('customers:delete', id),
    deleteMany: (ids: number[]) => invoke('customers:deleteMany', ids),
    transfer: (id: number, d: any) => invoke('customers:transfer', id, d),
    shift: (id: number, address: string) => invoke('customers:shift', id, address),
    bulkImport: (rows: any[]) => invoke('customers:bulkImport', rows),
    dueList: () => invoke('customers:dueList'),
    connectionsHistory: (params?: any) => invoke('connections:history', params)
  },
  billing: {
    generate: (month: string, areaId?: number, by?: string) => invoke('billing:generate', month, areaId, by),
    list: (params?: any) => invoke('billing:list', params),
    adjust: (id: number, discount: number, lateFee: number, reason: string) => invoke('billing:adjust', id, discount, lateFee, reason),
    cancel: (id: number) => invoke('billing:cancel', id),
    invoice: (id: number) => invoke('billing:invoice', id),
    autoRun: () => invoke('billing:autoRun')
  },
  payments: {
    collect: (input: any) => invoke('payments:collect', input),
    myCollector: () => invoke('payments:myCollector'),
    collectors: () => invoke('payments:collectors'),
    refund: (customerId: number, amount: number, note: string) => invoke('payments:refund', customerId, amount, note),
    useAdvance: (customerId: number) => invoke('payments:useAdvance', customerId),
    list: (params?: any) => invoke('payments:list', params),
    daily: (from: string, to: string) => invoke('payments:daily', from, to),
    methodSummary: (from: string, to: string) => invoke('payments:methodSummary', from, to),
    receipt: (id: number) => invoke('payments:receipt', id)
  },
  renewal: {
    list: (params?: any) => invoke('renewal:list', params),
    renew: (d: any) => invoke('renewal:renew', d)
  },
  userAccounts: {
    sync: () => invoke('accounts:sync'),
    signup: (d: any) => invoke('accounts:signup', d),
    forgot: (username: string) => invoke('accounts:forgot', username),
    checkRemote: () => invoke('accounts:checkRemote'),
    remoteUsers: () => invoke('accounts:remoteUsers'),
    createLocal: (input: any) => invoke('accounts:createLocal', input),
    syncAllRemote: () => invoke('accounts:syncAllRemote')
  },
  // Super Admin → User Management + secure "Login As User" (server-side only)
  impersonation: {
    users: (params?: any) => invoke('impersonation:users', params || {}),
    start: (userId: number) => invoke('impersonation:start', userId),
    stop: () => invoke('impersonation:stop'),
    status: () => invoke('impersonation:status'),
    audit: (limit?: number) => invoke('impersonation:audit', limit),
    refresh: () => invoke('impersonation:refresh'),
    discard: (reason?: string) => invoke('impersonation:discard', reason)
  },
  collectors: {
    quickAdd: (name: string, mobile?: string) => invoke('collectors:quickAdd', name, mobile)
  },
  // Per-user SMS wallet + server-side gateway (secrets stay in the main process)
  sms: {
    wallet: () => invoke('sms:wallet'),
    packages: () => invoke('sms:packages'),
    transactions: (params?: any) => invoke('sms:transactions', params || {}),
    messages: (params?: any) => invoke('sms:messages', params || {}),
    purchases: (params?: any) => invoke('sms:purchases', params || {}),
    createPurchase: (input: any) => invoke('sms:createPurchase', input),
    send: (input: any) => invoke('sms:send', input),
    sendBulk: (input: any) => invoke('sms:sendBulk', input),
    admin: {
      wallets: (params?: any) => invoke('sms:admin:wallets', params || {}),
      transactions: (params?: any) => invoke('sms:admin:transactions', params || {}),
      messages: (params?: any) => invoke('sms:admin:messages', params || {}),
      purchases: (params?: any) => invoke('sms:admin:purchases', params || {}),
      providerPurchases: (params?: any) => invoke('sms:admin:providerPurchases', params || {}),
      providerPurchase: (input: any) => invoke('sms:admin:providerPurchase', input),
      verifyPurchase: (id: number, action: 'approve' | 'reject', note?: string) => invoke('sms:admin:verifyPurchase', id, action, note),
      adjust: (userId: number, delta: number, note: string, requestId?: string) => invoke('sms:admin:adjust', userId, delta, note, requestId),
      packages: () => invoke('sms:admin:packages'),
      packageSave: (data: any) => invoke('sms:admin:packageSave', data),
      packageDelete: (id: number) => invoke('sms:admin:packageDelete', id),
      config: () => invoke('sms:admin:config'),
      configSet: (data: any) => invoke('sms:admin:configSet', data),
      testGateway: (recipient: string) => invoke('sms:admin:testGateway', recipient),
      gatewayBalance: () => invoke('sms:admin:gatewayBalance'),
      checkDelivery: (id: number) => invoke('sms:admin:checkDelivery', id),
      syncDelivery: (params?: any) => invoke('sms:admin:syncDelivery', params || {}),
      updateStatus: (id: number, status: string) => invoke('sms:admin:updateStatus', id, status)
    }
  },
  dashboard: {
    stats: (month: string) => invoke('dashboard:stats', month),
    dailyCollection: (month: string) => invoke('dashboard:dailyCollection', month),
    monthlyRevenue: () => invoke('dashboard:monthlyRevenue'),
    customerGrowth: () => invoke('dashboard:customerGrowth'),
    areaStats: (month: string) => invoke('dashboard:areaStats', month),
    recent: () => invoke('dashboard:recent'),
    collectorStats: (month: string) => invoke('dashboard:collectorStats', month),
    kpiPermissions: (userId: number) => invoke('dashboard:kpiPermissions', userId),
    kpiPermissionsSet: (userId: number, overrides: Record<string, boolean>) => invoke('dashboard:kpiPermissionsSet', userId, overrides)
  },
  reports: {
    areaCollection: (month: string) => invoke('reports:areaCollection', month),
    collector: (from: string, to: string) => invoke('reports:collector', from, to),
    reseller: (month: string) => invoke('reports:reseller', month),
    package: (month: string) => invoke('reports:package', month),
    dueList: (month: string) => invoke('reports:dueList', month),
    billList: (month: string, filters?: any) => invoke('reports:billList', month, filters || {}),
    customerBill: (customerId: number, month: string) => invoke('reports:customerBill', customerId, month),
    profitLoss: (from: string, to: string) => invoke('reports:profitLoss', from, to),
    balanceSheet: () => invoke('reports:balanceSheet'),
    transactions: (type: string, from: string, to: string) => invoke('reports:transactions', type, from, to),
    customerStatement: (id: number) => invoke('reports:customerStatement', id)
  },
  settings: {
    getAll: () => invoke('settings:getAll'),
    set: (k: string, v: string) => invoke('settings:set', k, v),
    setMany: (o: any) => invoke('settings:setMany', o)
  },
  backup: {
    create: (path?: string) => invoke('backup:create', path),
    restore: (path?: string) => invoke('backup:restore', path),
    list: () => invoke('backup:list'),
    integrity: () => invoke('backup:integrity'),
    dir: () => invoke('backup:dir')
  },
  inventory: {
    createPurchase: (d: any) => invoke('purchases:create', d),
    listFull: () => invoke('purchases:listFull'),
    findOrCreateProduct: (d: any) => invoke('products:findOrCreate', d),
    getPurchase: (id: number) => invoke('purchases:get', id),
    stockMove: (d: any) => invoke('stock:move', d)
  },
  resellers: {
    txn: (d: any) => invoke('resellers:txn', d),
    txns: (id: number) => invoke('resellers:txns', id)
  },
  transactions: {
    list: (params?: any) => invoke('transactions:list', params || {}),
    create: (d: any) => invoke('transactions:create', d),
    update: (id: number, d: any) => invoke('transactions:update', id, d),
    delete: (id: number) => invoke('transactions:delete', id),
    mainBalance: () => invoke('accounts:mainBalance')
  },
  companyProfile: {
    get: () => invoke('settings:companyProfile'),
    update: (d: any) => invoke('settings:companyProfileUpdate', d)
  },
  accountTransfers: {
    create: (d: any) => invoke('account_transfers:create', d)
  },
  accounts: {
    cashbook: (from: string, to: string) => invoke('accounts:cashbook', from, to)
  },
  messages: {
    composeDue: (templateId: number, month: string) => invoke('messages:composeDue', templateId, month),
    send: (id: number) => invoke('messages:send', id),
    markSent: (id: number) => invoke('messages:markSent', id)
  },
  automation: {
    runBilling: () => invoke('automation:runBilling'),
    notifyDue: () => invoke('notify:dueCustomers')
  },
  print: {
    preview: (html: string, title?: string) => invoke('print:preview', html, title),
    silent: (html: string, printer?: string) => invoke('print:silent', html, printer),
    savePdf: (html: string, defaultName?: string) => invoke('print:pdf', html, defaultName || 'document.pdf'),
    getPrinters: () => invoke('print:getPrinters')
  },
  app: {
    info: () => invoke('app:info'),
    relaunch: () => invoke('app:relaunch')
  },
  updater: {
    check: () => invoke('updater:check'),
    download: () => invoke('updater:download'),
    install: () => invoke('updater:install'),
    status: () => invoke('updater:status'),
    configure: (url: string, autoCheck: boolean) => invoke('updater:configure', url, autoCheck),
    appVersion: () => invoke('updater:appVersion'),
    onStatus: (cb: (s: any) => void) => {
      const listener = (_: any, s: any) => cb(s)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
