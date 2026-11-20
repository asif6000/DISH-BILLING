import { ipcMain, app, dialog, BrowserWindow, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getDb, getSetting, setSetting, logActivity, integrityCheck } from '../db'
import { requirePermission, requireAuth } from './auth'
import { registerGenericIpc } from './generic'
import { registerAuthIpc } from './auth'
import { registerCustomerIpc } from './customers'
import { registerBillingIpc } from './billing'
import { registerPaymentIpc } from './payments'
import { registerDashboardIpc } from './dashboard'
import { registerReportIpc } from './reports'
import { registerSettingsIpc } from './settings'
import { registerBackupIpc } from './backup'
import { registerInventoryIpc } from './inventory'
import { registerMiscIpc } from './misc'
import { registerUpdaterIpc } from '../updater'
import { registerSubscriptionIpc } from '../subscription'

export * from './auth'

export function registerAllIpc(): void {
  registerAuthIpc()
  registerGenericIpc()
  registerCustomerIpc()
  registerBillingIpc()
  registerPaymentIpc()
  registerDashboardIpc()
  registerReportIpc()
  registerSettingsIpc()
  registerBackupIpc()
  registerInventoryIpc()
  registerMiscIpc()
  registerUpdaterIpc()
  registerSubscriptionIpc()
}
