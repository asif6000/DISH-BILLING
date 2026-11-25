// ============================================================================
// SMS WALLET + GATEWAY IPC (main process only)
//
// Data model is user-scoped and lives in the INSTALLATION database:
//   sms_wallets       one row per user_id (SMS count, never money)
//   sms_transactions  immutable ledger: purchase / usage / refund / adjustment
//   sms_messages      one row per send attempt with provider status
//   sms_purchases     package purchase requests + verification (no auto credit)
//   sms_packages      real package catalogue (created by the Super Admin)
//
// The SMS balance is deliberately separate from accounts.balance /
// transactions (BDT financial ledger). No SMS operation touches money tables.
//
// Every credit/debit is one atomic SQLite transaction with a UNIQUE
// idempotency_key, so a duplicated payment callback or send request can never
// credit/debit twice. All reads/writes are filtered by the session user id;
// only SUPER_ADMIN admin endpoints may read other users' wallets.
// ============================================================================
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getPrimaryDb, logActivity } from '../db'
import { requireAuth, isSuper, Session } from './auth'
import { hasPermission } from '../../shared/permissions'
import {
  SMS_PROVIDERS, SmsGatewayConfig, SmsProvider,
  sendViaGateway, sendBulkViaGateway, fetchGatewayBalance, fetchDeliveryReport, SmsDeliveryReport,
  countSmsSegments, normalizeRecipient, smsEncoding,
  envConfig, isGatewayConfigured, configError, isHttpUrl, viaEdge,
  BULKSMSBD_DEFAULT_BALANCE, BULKSMSBD_DEFAULT_DLR
} from '../sms/gateway'

const SMS_METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'cash']
const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'failed']

type Conn = ReturnType<typeof getPrimaryDb>
const db = (): Conn => getPrimaryDb()

function assertSuper(s: Session, action: string): void {
  if (!isSuper(s)) throw new Error(`PERMISSION_DENIED:sms.${action}`)
}

function canSendSms(s: Session): boolean {
  // The wallet is personal (session user id only), but sending is role-gated.
  if (!s?.userId) return false
  return isSuper(s) || hasPermission(s.permissions, 'sms', 'send') || hasPermission(s.permissions, 'messaging', 'send')
}

function ensureWallet(conn: Conn, userId: number): any {
  conn.prepare('INSERT OR IGNORE INTO sms_wallets (user_id, balance) VALUES (?, 0)').run(userId)
  return conn.prepare('SELECT * FROM sms_wallets WHERE user_id = ?').get(userId) as any
}

function walletView(row: any, userId: number, lowThreshold = 20) {
  const balance = Number(row?.balance || 0)
  const threshold = Math.max(0, Number(lowThreshold) || 0)
  return {
    userId,
    balance,
    totalPurchased: Number(row?.total_purchased || 0),
    totalUsed: Number(row?.total_used || 0),
    totalRefunded: Number(row?.total_refunded || 0),
    lowThreshold: threshold,
    lowBalance: balance <= threshold,
    updatedAt: row?.updated_at || null
  }
}

// "submitted" is the 202 state (accepted by the gateway, delivery not proven).
// It is deliberately separate from "delivered" and "failed".
function messageStatusCounts(conn: Conn, userId?: number) {
  const where = userId ? 'WHERE user_id = ?' : ''
  const args = userId ? [userId] : []
  const rows = conn.prepare(`SELECT status, COUNT(*) AS c FROM sms_messages ${where} GROUP BY status`).all(...args) as any[]
  const counts: Record<string, number> = { pending: 0, submitted: 0, delivered: 0, failed: 0, total: 0 }
  for (const r of rows) {
    const n = Number(r.c || 0)
    const status = String(r.status || '')
    if (status === 'sent') counts.submitted += n
    else if (counts[status] !== undefined) counts[status] += n
    counts.total += n
  }
  return counts
}

function loadConfig(): SmsGatewayConfig {
  const row = db().prepare('SELECT * FROM sms_gateway_config WHERE id = 1').get() as any
  const env = envConfig()
  const dbProvider = row?.provider && (SMS_PROVIDERS as readonly string[]).includes(String(row.provider))
    ? String(row.provider) as SmsProvider
    : 'generic'
  const provider = env.provider || dbProvider
  return {
    provider,
    gatewayUrl: env.gatewayUrl || String(row?.gateway_url || ''),
    balanceUrl: env.balanceUrl || String(row?.balance_url || '') || (provider === 'bulksmsbd' ? BULKSMSBD_DEFAULT_BALANCE : ''),
    dlrUrl: env.dlrUrl || String(row?.dlr_url || '') || (provider === 'bulksmsbd' ? BULKSMSBD_DEFAULT_DLR : ''),
    senderId: env.senderId || String(row?.sender_id || ''),
    apiKey: env.apiKey,
    apiSecret: env.apiSecret,
    enabled: env.enabled !== undefined ? env.enabled : !!Number(row?.enabled || 0),
    refundOnFailed: env.refundOnFailed !== undefined ? env.refundOnFailed : !!Number(row?.refund_on_failed ?? 1),
    lowBalanceThreshold: env.lowBalanceThreshold !== undefined ? env.lowBalanceThreshold : Number(row?.low_balance_threshold ?? 20),
    timeoutMs: env.timeoutMs,
    edgeUrl: env.edgeUrl || '',
    edgeToken: env.edgeToken,
    env: {
      provider: !!env.provider,
      gatewayUrl: !!env.gatewayUrl,
      balanceUrl: !!env.balanceUrl,
      dlrUrl: !!env.dlrUrl,
      senderId: !!env.senderId,
      enabled: env.enabled !== undefined,
      refundOnFailed: env.refundOnFailed !== undefined,
      lowBalanceThreshold: env.lowBalanceThreshold !== undefined,
      edgeUrl: !!env.edgeUrl,
      edgeToken: !!env.edgeToken
    }
  }
}

// NEVER include apiKey / apiSecret here. Only boolean status is exposed.
function publicConfig(cfg: SmsGatewayConfig) {
  return {
    provider: cfg.provider,
    gatewayUrl: cfg.gatewayUrl,
    balanceUrl: cfg.balanceUrl,
    dlrUrl: cfg.dlrUrl,
    senderId: cfg.senderId,
    enabled: cfg.enabled,
    refundOnFailed: cfg.refundOnFailed,
    lowBalanceThreshold: cfg.lowBalanceThreshold,
    apiKeyConfigured: !!cfg.apiKey,
    apiSecretConfigured: !!cfg.apiSecret,
    senderIdConfigured: !!(cfg.senderId || viaEdge(cfg)),
    viaEdge: viaEdge(cfg),
    edgeConfigured: !!cfg.edgeUrl,
    edgeUrl: cfg.edgeUrl || '',
    configured: isGatewayConfigured(cfg),
    error: configError(cfg) || null,
    env: cfg.env,
    providers: [...SMS_PROVIDERS]
  }
}

function pageParams(params: any) {
  const page = Math.max(1, Number(params?.page) || 1)
  const pageSize = Math.min(200, Math.max(5, Number(params?.pageSize) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function purchaseRow(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    packageId: row.package_id == null ? null : Number(row.package_id),
    packageName: row.package_name,
    smsCount: Number(row.sms_count),
    amount: Number(row.amount),
    method: row.method,
    trxId: row.trx_id,
    status: row.status,
    note: row.note || null,
    createdAt: row.created_at,
    verifiedAt: row.verified_at || null
  }
}

function providerPurchaseRow(row: any) {
  return {
    id: Number(row.id),
    provider: row.provider,
    smsCount: Number(row.sms_count),
    amount: Number(row.amount || 0),
    method: row.method,
    trxId: row.trx_id,
    note: row.note || null,
    purchasedBy: row.purchased_by == null ? null : Number(row.purchased_by),
    purchasedByName: row.purchased_by_name || null,
    createdAt: row.created_at
  }
}

function messageRow(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    recipient: row.recipient,
    message: row.message,
    smsCount: Number(row.sms_count),
    provider: row.provider || null,
    providerMessageId: row.provider_message_id || null,
    requestId: row.request_id || null,
    gatewayResponse: row.gateway_response || null,
    status: row.status,
    error: row.error || null,
    attempts: Number(row.attempts || 0),
    deliveryAttempts: Number(row.delivery_attempts || 0),
    deliveryCheckedAt: row.delivery_checked_at || null,
    refunded: !!Number(row.refunded || 0),
    createdAt: row.created_at,
    sentAt: row.sent_at || null,
    deliveredAt: row.delivered_at || null
  }
}

function txRow(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: row.username ?? null,
    fullName: row.full_name ?? null,
    type: row.type,
    smsCount: Number(row.sms_count),
    balanceAfter: Number(row.balance_after),
    amount: Number(row.amount || 0),
    reference: row.reference || null,
    note: row.note || null,
    createdAt: row.created_at
  }
}

// ---------------------------------------------------------------------------
// Refund (failed sends) — idempotent by sms_refund:<messageId>.
// The wallet update, refund ledger row and message flag are ONE transaction.
// ---------------------------------------------------------------------------
function applyRefundInTx(conn: Conn, messageId: number, reason: string, actorId: number | null): { smsCount: number; userId: number } | null {
  const msg = conn.prepare('SELECT * FROM sms_messages WHERE id = ?').get(messageId) as any
  if (!msg) throw new Error('SMS_MESSAGE_NOT_FOUND')
  if (Number(msg.refunded || 0) === 1) return null
  if (msg.status !== 'failed') throw new Error('ONLY_FAILED_SMS_CAN_BE_REFUNDED')
  const smsCount = Number(msg.sms_count)
  const userId = Number(msg.user_id)
  const wallet = ensureWallet(conn, userId)
  const newBalance = Number(wallet.balance) + smsCount
  conn.prepare(`UPDATE sms_wallets SET balance = ?, total_refunded = total_refunded + ?, updated_at = datetime('now')
    WHERE user_id = ?`).run(newBalance, smsCount, userId)
  conn.prepare("UPDATE sms_messages SET refunded = 1, updated_at = datetime('now') WHERE id = ?").run(messageId)
  conn.prepare(`INSERT INTO sms_transactions
    (user_id, type, sms_count, balance_after, amount, reference, idempotency_key, note, created_by)
    VALUES (?, 'refund', ?, ?, 0, ?, ?, ?, ?)`)
    .run(userId, smsCount, newBalance, `sms_message:${messageId}`,
      `sms_refund:${messageId}`, String(reason || 'failed').slice(0, 200), actorId)
  return { smsCount, userId }
}

function auditRefund(conn: Conn, messageId: number, info: { smsCount: number; userId: number }, reason: string, actorId: number | null): void {
  try {
    const actor = actorId ? conn.prepare('SELECT username FROM users WHERE id = ?').get(actorId) as any : null
    logActivity(actorId, actor?.username || null, 'sms_refunded', 'sms',
      `#${messageId} +${info.smsCount} SMS user=${info.userId} reason=${String(reason || 'failed').slice(0, 120)}`)
  } catch { /* audit failure must not undo a committed refund */ }
}

export function refundFailedMessage(messageId: number, reason: string, actorId: number | null = null): boolean {
  const conn = db()
  conn.exec('BEGIN IMMEDIATE')
  let info: { smsCount: number; userId: number } | null = null
  try {
    info = applyRefundInTx(conn, messageId, reason, actorId)
    conn.exec('COMMIT')
  } catch (err) {
    try { conn.exec('ROLLBACK') } catch { /* already rolled back */ }
    throw err
  }
  if (!info) return false
  auditRefund(conn, messageId, info, reason, actorId)
  return true
}

// Final states are sticky: a delivered SMS can never be downgraded and an
// already-failed/refunded SMS can never be turned back into a free delivered
// SMS. Delivery reports and manual admin overrides both pass through here.
function markStatus(
  messageId: number,
  status: string,
  providerMessageId: string | null,
  error: string | null,
  refundOnFailed: boolean,
  actorId: number | null,
  opts: { gatewayResponse?: string | null; requestId?: string | null; deliveryCheck?: boolean } = {}
): any {
  if (!MESSAGE_STATUSES.includes(status)) throw new Error('INVALID_SMS_STATUS')
  const conn = db()
  const deliveryFlag = opts.deliveryCheck ? 1 : 0
  let row: any = null
  let refundInfo: { smsCount: number; userId: number } | null = null
  conn.exec('BEGIN IMMEDIATE')
  try {
    const current = conn.prepare('SELECT status, refunded FROM sms_messages WHERE id = ?').get(messageId) as any
    if (!current) throw new Error('SMS_MESSAGE_NOT_FOUND')
    const currentStatus = String(current.status || 'pending')
    if (currentStatus === 'delivered' && status !== 'delivered') throw new Error('SMS_ALREADY_DELIVERED')
    if (currentStatus === 'failed' && status !== 'failed') throw new Error('SMS_ALREADY_FAILED')
    if (Number(current.refunded || 0) === 1 && status !== 'failed') throw new Error('SMS_ALREADY_REFUNDED')
    conn.prepare(`UPDATE sms_messages SET status = ?, provider_message_id = COALESCE(?, provider_message_id),
        error = ?, gateway_response = COALESCE(?, gateway_response),
        request_id = COALESCE(?, request_id),
        delivery_checked_at = CASE WHEN ? = 1 THEN datetime('now') ELSE delivery_checked_at END,
        delivery_attempts = delivery_attempts + ?,
        attempts = attempts + 1, updated_at = datetime('now'),
        sent_at = CASE WHEN ? IN ('sent','delivered') THEN COALESCE(sent_at, datetime('now')) ELSE sent_at END,
        delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, datetime('now')) ELSE delivered_at END
      WHERE id = ?`).run(
      status, providerMessageId, error,
      opts.gatewayResponse ? String(opts.gatewayResponse).slice(0, 2000) : null,
      opts.requestId || null, deliveryFlag, deliveryFlag,
      status, status, messageId
    )
    if (status === 'failed' && refundOnFailed) {
      refundInfo = applyRefundInTx(conn, messageId, 'provider_status_failed', actorId)
    }
    row = conn.prepare('SELECT * FROM sms_messages WHERE id = ?').get(messageId)
    conn.exec('COMMIT')
  } catch (err) {
    try { conn.exec('ROLLBACK') } catch { /* already rolled back */ }
    throw err
  }
  if (refundInfo) auditRefund(conn, messageId, refundInfo, 'provider_status_failed', actorId)
  return row
}

// A delivery report can only move pending/sent messages to a final state. It
// never downgrades a delivered message, and never reverses an already-failed
// (and possibly refunded) message.
function applyDeliveryReport(message: any, report: SmsDeliveryReport, actorId: number, refundOnFailed: boolean): any {
  const current = String(message.status || 'pending')
  let next = report.status
  if (current === 'delivered') next = 'delivered'
  else if (current === 'failed') next = 'failed'
  else if (current === 'sent' && (next === 'pending' || next === 'sent')) next = 'sent'
  const error = next === 'failed' ? `provider_delivery:${report.providerStatus || 'failed'}`.slice(0, 200) : null
  return markStatus(Number(message.id), next, null, error, refundOnFailed, actorId,
    { gatewayResponse: report.raw, deliveryCheck: true })
}

// Provider balance preflight. The provider balance is the SHARED gateway
// credit, not a user wallet. A monetary balance only needs to be positive; an
// SMS-count balance must cover this message's billable parts.
// If the balance endpoint itself is unavailable we do not block the send (the
// provider's send response remains authoritative and failures are refunded),
// but a real "insufficient" answer always blocks before any wallet debit.
async function preflightProviderBalance(s: Session, cfg: SmsGatewayConfig, segments: number): Promise<void> {
  if (!cfg.balanceUrl) return
  try {
    const bal = await fetchGatewayBalance(cfg)
    const insufficient = bal.unit === 'sms' ? bal.balance < segments : bal.balance <= 0
    if (insufficient) {
      try {
        logActivity(s.userId, s.username, 'sms_provider_balance_insufficient', 'sms',
          `provider=${cfg.provider} balance=${bal.balance}${bal.unit === 'sms' ? ' SMS' : ' BDT'} required=${segments}`)
      } catch { /* audit is best effort */ }
      throw Object.assign(new Error('SMS_PROVIDER_BALANCE_INSUFFICIENT'), {
        code: 'SMS_PROVIDER_BALANCE_INSUFFICIENT', providerBalance: bal.balance, unit: bal.unit, required: segments
      })
    }
  } catch (err: any) {
    if (err?.code === 'SMS_PROVIDER_BALANCE_INSUFFICIENT') throw err
    // A monitoring endpoint outage must not take the whole SMS feature down.
    try {
      logActivity(s.userId, s.username, 'sms_provider_balance_check_failed', 'sms',
        String(err?.message || err).slice(0, 200))
    } catch { /* audit is best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Send flow. The user-wallet debit and message-row creation are ONE atomic
// transaction; the provider HTTP call happens after the commit, and a provider
// failure is refunded atomically according to the configured policy.
// ---------------------------------------------------------------------------
export async function sendSmsForSession(
  s: Session,
  rawRecipient: string,
  rawMessage: string,
  idempotencyKey: string
): Promise<any> {
  if (!canSendSms(s)) throw new Error('PERMISSION_DENIED:sms.send')
  const recipient = normalizeRecipient(rawRecipient)
  const message = String(rawMessage ?? '')
  if (!message.trim()) throw new Error('SMS_MESSAGE_EMPTY')
  if (message.length > 2000) throw new Error('SMS_MESSAGE_TOO_LONG')
  const segments = countSmsSegments(message)
  if (segments <= 0) throw new Error('SMS_MESSAGE_EMPTY')
  const key = String(idempotencyKey || '').slice(0, 160)
  if (!key) throw new Error('IDEMPOTENCY_KEY_REQUIRED')

  const cfg = loadConfig()
  const cfgErr = configError(cfg)
  // Configuration problems must never debit the wallet.
  if (cfgErr) throw new Error(cfgErr)

  const conn = db()
  // Cheap read before any network call: a duplicate must never trigger a
  // second provider request, and an empty wallet must never be "preflighted".
  const preExisting = conn.prepare('SELECT * FROM sms_messages WHERE idempotency_key = ?').get(key) as any
  if (preExisting) {
    if (Number(preExisting.user_id) !== Number(s.userId)) throw new Error('IDEMPOTENCY_CONFLICT')
    const wallet = ensureWallet(conn, s.userId)
    const view = walletView(wallet, s.userId, cfg.lowBalanceThreshold)
    return {
      duplicate: true, message: messageRow(preExisting), messageId: Number(preExisting.id),
      requestId: preExisting.request_id || null,
      balanceAfter: view.balance, lowBalance: view.lowBalance, lowThreshold: view.lowThreshold,
      wallet: view
    }
  }
  const preWallet = ensureWallet(conn, s.userId)
  const preBalance = Number(preWallet.balance)
  if (preBalance < segments) {
    throw Object.assign(new Error('SMS_BALANCE_INSUFFICIENT'), { balance: preBalance, required: segments })
  }
  await preflightProviderBalance(s, cfg, segments)

  const requestId = `SMS-${randomUUID()}`
  let messageId = 0
  conn.exec('BEGIN IMMEDIATE')
  try {
    const existing = conn.prepare('SELECT * FROM sms_messages WHERE idempotency_key = ?').get(key) as any
    if (existing) {
      if (Number(existing.user_id) !== Number(s.userId)) throw new Error('IDEMPOTENCY_CONFLICT')
      const wallet = ensureWallet(conn, s.userId)
      const view = walletView(wallet, s.userId, cfg.lowBalanceThreshold)
      conn.exec('COMMIT')
      return {
        duplicate: true, message: messageRow(existing), messageId: Number(existing.id),
        requestId: existing.request_id || null,
        balanceAfter: view.balance, lowBalance: view.lowBalance, lowThreshold: view.lowThreshold,
        wallet: view
      }
    }
    const wallet = ensureWallet(conn, s.userId)
    const balance = Number(wallet.balance)
    if (balance < segments) {
      throw Object.assign(new Error('SMS_BALANCE_INSUFFICIENT'), { balance, required: segments })
    }
    const ins = conn.prepare(`INSERT INTO sms_messages
      (user_id, recipient, message, sms_count, provider, status, idempotency_key, request_id, created_by)
      VALUES (?,?,?,?,?,'pending',?,?,?)`)
      .run(s.userId, recipient, message, segments, cfg.provider, key, requestId, s.userId)
    messageId = Number(ins.lastInsertRowid)
    const newBalance = balance - segments
    conn.prepare(`UPDATE sms_wallets SET balance = ?, total_used = total_used + ?, updated_at = datetime('now')
      WHERE user_id = ?`).run(newBalance, segments, s.userId)
    const tx = conn.prepare(`INSERT INTO sms_transactions
      (user_id, type, sms_count, balance_after, amount, reference, idempotency_key, note, created_by)
      VALUES (?, 'usage', ?, ?, 0, ?, ?, ?, ?)`)
      .run(s.userId, -segments, newBalance, `sms_message:${messageId}`, `sms_usage:${messageId}`,
        `${segments} SMS`, s.userId)
    conn.prepare('UPDATE sms_messages SET wallet_txn_id = ? WHERE id = ?').run(Number(tx.lastInsertRowid), messageId)
    conn.exec('COMMIT')
  } catch (err) {
    try { conn.exec('ROLLBACK') } catch { /* already committed */ }
    throw err
  }

  let result: any
  try {
    result = await sendViaGateway(cfg, recipient, message, requestId)
  } catch (err: any) {
    const reason = String(err?.message || err).slice(0, 300)
    const updated = markStatus(messageId, 'failed', null, reason, cfg.refundOnFailed, s.userId,
      { gatewayResponse: reason, requestId })
    const wallet = ensureWallet(conn, s.userId)
    logActivity(s.userId, s.username, 'sms_failed', 'sms', `#${messageId} ${segments} segment(s) → ${recipient}: ${reason}`)
    return {
      duplicate: false, messageId, requestId, status: 'failed', smsCount: segments,
      error: reason, refunded: !!Number(updated?.refunded || 0),
      balanceAfter: Number(wallet.balance), lowBalance: Number(wallet.balance) <= cfg.lowBalanceThreshold,
      lowThreshold: cfg.lowBalanceThreshold,
      wallet: walletView(wallet, s.userId, cfg.lowBalanceThreshold)
    }
  }

  // The provider accepted the message. A local status-write failure must NOT
  // be treated as a provider failure (that would refund an SMS that was sent).
  try {
    const updated = markStatus(messageId, result.status, result.providerMessageId, null, cfg.refundOnFailed, s.userId,
      { gatewayResponse: result.raw, requestId: result.requestId })
    const wallet = ensureWallet(conn, s.userId)
    logActivity(s.userId, s.username, 'sms_sent', 'sms', `#${messageId} ${segments} segment(s) → ${recipient}`)
    return {
      duplicate: false, messageId, requestId: result.requestId, status: updated.status, smsCount: segments,
      providerMessageId: updated.provider_message_id || null, refunded: !!Number(updated.refunded || 0),
      encoding: result.encoding, gatewayResponse: result.raw,
      balanceAfter: Number(wallet.balance), lowBalance: Number(wallet.balance) <= cfg.lowBalanceThreshold,
      lowThreshold: cfg.lowBalanceThreshold,
      wallet: walletView(wallet, s.userId, cfg.lowBalanceThreshold)
    }
  } catch (dbErr: any) {
    const wallet = ensureWallet(conn, s.userId)
    logActivity(s.userId, s.username, 'sms_sent', 'sms',
      `#${messageId} ${segments} segment(s) → ${recipient} (provider accepted; local status update pending)`)
    logActivity(s.userId, s.username, 'sms_status_update_failed', 'sms',
      `#${messageId} provider accepted but local status update failed: ${String(dbErr?.message || dbErr).slice(0, 160)}`)
    return {
      duplicate: false, messageId, requestId, status: 'sent', smsCount: segments,
      providerMessageId: result.providerMessageId || null, refunded: false,
      encoding: result.encoding, gatewayResponse: result.raw,
      balanceAfter: Number(wallet.balance), lowBalance: Number(wallet.balance) <= cfg.lowBalanceThreshold,
      lowThreshold: cfg.lowBalanceThreshold,
      wallet: walletView(wallet, s.userId, cfg.lowBalanceThreshold),
      warning: 'STATUS_UPDATE_FAILED'
    }
  }
}

// Personalized bulk send: one provider batch request, one message row per
// recipient, one atomic wallet debit for the total billable parts. If the
// provider rejects the batch, every row is failed/refunded under the same
// policy as a single send.
export async function sendBulkForSession(
  s: Session,
  rawMessages: any[],
  clientRequestId: string
): Promise<any> {
  if (!canSendSms(s)) throw new Error('PERMISSION_DENIED:sms.send')
  const batchKey = String(clientRequestId || '').trim().slice(0, 120)
  if (!batchKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED')
  if (!Array.isArray(rawMessages) || !rawMessages.length) throw new Error('INVALID_BULK_MESSAGES')
  if (rawMessages.length > 100) throw new Error('BULK_LIMIT_EXCEEDED')
  const items = rawMessages.map((m, index) => {
    const recipient = normalizeRecipient(String(m?.recipient ?? m?.to ?? ''))
    const message = String(m?.message ?? '')
    if (!message.trim()) throw new Error('SMS_MESSAGE_EMPTY')
    if (message.length > 2000) throw new Error('SMS_MESSAGE_TOO_LONG')
    const segments = countSmsSegments(message)
    if (segments <= 0) throw new Error('SMS_MESSAGE_EMPTY')
    return { recipient, message, segments, index, key: `sms_bulk:${s.userId}:${batchKey}:${index}` }
  })
  const totalSegments = items.reduce((n, m) => n + m.segments, 0)
  const cfg = loadConfig()
  const cfgErr = configError(cfg)
  if (cfgErr) throw new Error(cfgErr)

  const conn = db()
  const prefix = `sms_bulk:${s.userId}:${batchKey}:%`
  const existingRows = conn.prepare('SELECT * FROM sms_messages WHERE user_id = ? AND idempotency_key LIKE ? ORDER BY id').all(s.userId, prefix) as any[]
  if (existingRows.length) {
    const wallet = ensureWallet(conn, s.userId)
    const view = walletView(wallet, s.userId, cfg.lowBalanceThreshold)
    return {
      duplicate: true, messages: existingRows.map(messageRow),
      totalSms: existingRows.reduce((n, r) => n + Number(r.sms_count || 0), 0),
      balanceAfter: view.balance, lowBalance: view.lowBalance, lowThreshold: view.lowThreshold, wallet: view
    }
  }
  const preWallet = ensureWallet(conn, s.userId)
  const preBalance = Number(preWallet.balance)
  if (preBalance < totalSegments) {
    throw Object.assign(new Error('SMS_BALANCE_INSUFFICIENT'), { balance: preBalance, required: totalSegments })
  }
  await preflightProviderBalance(s, cfg, totalSegments)

  const batchId = `SMSB-${randomUUID()}`
  const messageIds: number[] = []
  conn.exec('BEGIN IMMEDIATE')
  try {
    const again = conn.prepare('SELECT * FROM sms_messages WHERE user_id = ? AND idempotency_key LIKE ? ORDER BY id').all(s.userId, prefix) as any[]
    if (again.length) {
      const wallet = ensureWallet(conn, s.userId)
      const view = walletView(wallet, s.userId, cfg.lowBalanceThreshold)
      conn.exec('COMMIT')
      return {
        duplicate: true, messages: again.map(messageRow),
        totalSms: again.reduce((n, r) => n + Number(r.sms_count || 0), 0),
        balanceAfter: view.balance, lowBalance: view.lowBalance, lowThreshold: view.lowThreshold, wallet: view
      }
    }
    const wallet = ensureWallet(conn, s.userId)
    const balance = Number(wallet.balance)
    if (balance < totalSegments) throw Object.assign(new Error('SMS_BALANCE_INSUFFICIENT'), { balance, required: totalSegments })
    let running = balance
    const insMsg = conn.prepare(`INSERT INTO sms_messages
      (user_id, recipient, message, sms_count, provider, status, idempotency_key, request_id, created_by)
      VALUES (?,?,?,?,?,'pending',?,?,?)`)
    const insTx = conn.prepare(`INSERT INTO sms_transactions
      (user_id, type, sms_count, balance_after, amount, reference, idempotency_key, note, created_by)
      VALUES (?, 'usage', ?, ?, 0, ?, ?, ?, ?)`)
    for (const item of items) {
      const ins = insMsg.run(s.userId, item.recipient, item.message, item.segments, cfg.provider, item.key, `${batchId}:${item.index}`, s.userId)
      const id = Number(ins.lastInsertRowid)
      messageIds.push(id)
      running -= item.segments
      const tx = insTx.run(s.userId, -item.segments, running, `sms_message:${id}`, `sms_usage:${id}`, `${item.segments} SMS`, s.userId)
      conn.prepare('UPDATE sms_messages SET wallet_txn_id = ? WHERE id = ?').run(Number(tx.lastInsertRowid), id)
    }
    conn.prepare(`UPDATE sms_wallets SET balance = ?, total_used = total_used + ?, updated_at = datetime('now')
      WHERE user_id = ?`).run(running, totalSegments, s.userId)
    conn.exec('COMMIT')
  } catch (err) {
    try { conn.exec('ROLLBACK') } catch { /* already rolled back */ }
    throw err
  }

  let result: any
  try {
    result = await sendBulkViaGateway(cfg, items.map((i) => ({ to: i.recipient, message: i.message })), batchId)
  } catch (err: any) {
    const reason = String(err?.message || err).slice(0, 300)
    for (const id of messageIds) {
      try { markStatus(id, 'failed', null, reason, cfg.refundOnFailed, s.userId, { gatewayResponse: reason, requestId: batchId }) } catch { /* already final */ }
    }
    const wallet = ensureWallet(conn, s.userId)
    logActivity(s.userId, s.username, 'sms_bulk_failed', 'sms', `batch=${batchId} recipients=${items.length} parts=${totalSegments}: ${reason}`)
    return {
      duplicate: false, batchId, status: 'failed', totalSms: totalSegments, count: items.length,
      error: reason, refunded: cfg.refundOnFailed,
      balanceAfter: Number(wallet.balance), lowBalance: Number(wallet.balance) <= cfg.lowBalanceThreshold,
      lowThreshold: cfg.lowBalanceThreshold,
      messages: messageIds.map((id) => messageRow(conn.prepare('SELECT * FROM sms_messages WHERE id = ?').get(id))),
      wallet: walletView(wallet, s.userId, cfg.lowBalanceThreshold)
    }
  }

  for (const id of messageIds) {
    try {
      markStatus(id, 'sent', result.providerMessageId, null, cfg.refundOnFailed, s.userId,
        { gatewayResponse: result.raw, requestId: batchId })
    } catch { /* provider accepted; local status can be reconciled later */ }
  }
  const wallet = ensureWallet(conn, s.userId)
  logActivity(s.userId, s.username, 'sms_bulk_sent', 'sms', `batch=${batchId} recipients=${items.length} parts=${totalSegments}`)
  return {
    duplicate: false, batchId, status: 'sent', totalSms: totalSegments, count: items.length,
    providerMessageId: result.providerMessageId || null,
    encoding: items.every((i) => smsEncoding(i.message) === 'text') ? 'text' : 'unicode',
    gatewayResponse: result.raw,
    balanceAfter: Number(wallet.balance), lowBalance: Number(wallet.balance) <= cfg.lowBalanceThreshold,
    lowThreshold: cfg.lowBalanceThreshold,
    messages: messageIds.map((id) => messageRow(conn.prepare('SELECT * FROM sms_messages WHERE id = ?').get(id))),
    wallet: walletView(wallet, s.userId, cfg.lowBalanceThreshold)
  }
}

export function registerSmsIpc(): void {
  // ---- personal wallet / catalogue / history ---------------------------------
  ipcMain.handle('sms:wallet', (e) => {
    const s = requireAuth(e)
    const conn = db()
    const cfg = loadConfig()
    const row = ensureWallet(conn, s.userId)
    return {
      ...walletView(row, s.userId, cfg.lowBalanceThreshold),
      statusCounts: messageStatusCounts(conn, s.userId),
      gatewayConfigured: isGatewayConfigured(cfg)
    }
  })

  ipcMain.handle('sms:packages', (e) => {
    requireAuth(e)
    return db().prepare("SELECT id, name, sms_count, price, description FROM sms_packages WHERE status = 'active' ORDER BY price, sms_count, id").all()
  })

  ipcMain.handle('sms:transactions', (e, params: any = {}) => {
    const s = requireAuth(e)
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const type = String(params?.type || '')
    const where = ['user_id = ?']
    const args: any[] = [s.userId]
    if (type) { where.push('type = ?'); args.push(type) }
    const sqlWhere = where.join(' AND ')
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_transactions WHERE ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT * FROM sms_transactions WHERE ${sqlWhere} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return { rows: rows.map(txRow), total, page, pageSize }
  })

  ipcMain.handle('sms:messages', (e, params: any = {}) => {
    const s = requireAuth(e)
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const where = ['user_id = ?']
    const args: any[] = [s.userId]
    const status = String(params?.status || '')
    if (status && MESSAGE_STATUSES.includes(status)) { where.push('status = ?'); args.push(status) }
    const search = String(params?.search || '').trim()
    if (search) { where.push('(recipient LIKE ? OR message LIKE ?)'); args.push(`%${search}%`, `%${search}%`) }
    const sqlWhere = where.join(' AND ')
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_messages WHERE ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT * FROM sms_messages WHERE ${sqlWhere} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return { rows: rows.map(messageRow), total, page, pageSize }
  })

  ipcMain.handle('sms:purchases', (e, params: any = {}) => {
    const s = requireAuth(e)
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const total = Number((conn.prepare('SELECT COUNT(*) AS c FROM sms_purchases WHERE user_id = ?').get(s.userId) as any).c)
    const rows = conn.prepare('SELECT * FROM sms_purchases WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(s.userId, pageSize, offset) as any[]
    return { rows: rows.map(purchaseRow), total, page, pageSize }
  })

  // ---- buy a package (REQUEST only — credits only after real verification) ----
  ipcMain.handle('sms:createPurchase', (e, input: any) => {
    const s = requireAuth(e)
    const packageId = Number(input?.packageId)
    const method = String(input?.method || '').toLowerCase()
    const trxId = String(input?.trxId || '').trim()
    if (!Number.isInteger(packageId) || packageId <= 0) throw new Error('INVALID_PACKAGE')
    if (!SMS_METHODS.includes(method)) throw new Error('INVALID_PAYMENT_METHOD')
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(trxId)) throw new Error('INVALID_TRX_ID')
    const conn = db()
    conn.exec('BEGIN IMMEDIATE')
    try {
      const pkg = conn.prepare("SELECT * FROM sms_packages WHERE id = ? AND status = 'active'").get(packageId) as any
      if (!pkg) throw new Error('PACKAGE_NOT_FOUND')
      const existing = conn.prepare('SELECT * FROM sms_purchases WHERE method = ? AND trx_id = ?').get(method, trxId) as any
      if (existing) {
        if (Number(existing.user_id) !== Number(s.userId)) throw new Error('TRX_ALREADY_USED')
        conn.exec('COMMIT')
        return { duplicate: true, purchase: purchaseRow(existing) }
      }
      const key = `sms_purchase:${s.userId}:${method}:${trxId}`
      const ins = conn.prepare(`INSERT INTO sms_purchases
        (user_id, package_id, package_name, sms_count, amount, method, trx_id, status, note, idempotency_key)
        VALUES (?,?,?,?,?,?,?, 'pending', ?, ?)`)
        .run(s.userId, pkg.id, pkg.name, pkg.sms_count, pkg.price, method, trxId,
          String(input?.note || '').slice(0, 200) || null, key)
      const row = conn.prepare('SELECT * FROM sms_purchases WHERE id = ?').get(Number(ins.lastInsertRowid)) as any
      conn.exec('COMMIT')
      logActivity(s.userId, s.username, 'sms_purchase_request', 'sms', `#${row.id} ${pkg.name} ${pkg.sms_count} SMS via ${method} trx=${trxId}`)
      return { duplicate: false, purchase: purchaseRow(row) }
    } catch (err) {
      try { conn.exec('ROLLBACK') } catch { /* already committed */ }
      throw err
    }
  })

  // ---- send (own wallet only) ------------------------------------------------
  ipcMain.handle('sms:send', async (e, input: any) => {
    const s = requireAuth(e)
    const clientRequestId = String(input?.clientRequestId || '').trim()
    if (!clientRequestId) throw new Error('IDEMPOTENCY_KEY_REQUIRED')
    const key = `sms_send:${s.userId}:${clientRequestId.slice(0, 120)}`
    return sendSmsForSession(s, input?.recipient, input?.message, key)
  })

  ipcMain.handle('sms:sendBulk', async (e, input: any) => {
    const s = requireAuth(e)
    return sendBulkForSession(s, input?.messages, String(input?.clientRequestId || ''))
  })

  // ---- SUPER ADMIN: every wallet / ledger / message --------------------------
  ipcMain.handle('sms:admin:wallets', (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const search = String(params?.search || '').trim().toLowerCase()
    const where: string[] = []
    const args: any[] = []
    if (search) {
      where.push('(LOWER(u.username) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(COALESCE(u.mobile,\'\')) LIKE ?)')
      args.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM users u ${sqlWhere}`).get(...args) as any).c)
    const cfg = loadConfig()
    const rows = conn.prepare(`SELECT u.id AS user_id, u.username, u.full_name, u.mobile, u.status,
        r.name AS role_name,
        COALESCE(w.balance,0) AS balance, COALESCE(w.total_purchased,0) AS total_purchased,
        COALESCE(w.total_used,0) AS total_used, COALESCE(w.total_refunded,0) AS total_refunded,
        COALESCE(m.pending,0) AS pending_count, COALESCE(m.submitted,0) AS submitted_count,
        COALESCE(m.delivered,0) AS delivered_count, COALESCE(m.failed,0) AS failed_count,
        w.updated_at
      FROM users u LEFT JOIN sms_wallets w ON w.user_id = u.id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN (SELECT user_id,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM sms_messages GROUP BY user_id) m ON m.user_id = u.id
      ${sqlWhere} ORDER BY balance DESC, u.id LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return {
      rows: rows.map((r) => ({
        userId: Number(r.user_id), username: r.username, fullName: r.full_name, mobile: r.mobile,
        status: r.status, roleName: r.role_name,
        balance: Number(r.balance), totalPurchased: Number(r.total_purchased),
        totalUsed: Number(r.total_used), totalRefunded: Number(r.total_refunded),
        statusCounts: {
          pending: Number(r.pending_count), submitted: Number(r.submitted_count),
          delivered: Number(r.delivered_count), failed: Number(r.failed_count),
          total: Number(r.pending_count) + Number(r.submitted_count) + Number(r.delivered_count) + Number(r.failed_count)
        },
        lowThreshold: cfg.lowBalanceThreshold,
        lowBalance: Number(r.balance) <= cfg.lowBalanceThreshold,
        updatedAt: r.updated_at || null
      })),
      total, page, pageSize,
      lowBalanceThreshold: cfg.lowBalanceThreshold
    }
  })

  ipcMain.handle('sms:admin:transactions', (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const where: string[] = []
    const args: any[] = []
    if (params?.userId) { where.push('t.user_id = ?'); args.push(Number(params.userId)) }
    if (params?.type) { where.push('t.type = ?'); args.push(String(params.type)) }
    const search = String(params?.search || '').trim()
    if (search) {
      where.push('(u.username LIKE ? OR u.full_name LIKE ? OR COALESCE(t.reference,\'\') LIKE ? OR COALESCE(t.note,\'\') LIKE ?)')
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_transactions t JOIN users u ON u.id = t.user_id ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT t.*, u.username, u.full_name FROM sms_transactions t
      JOIN users u ON u.id = t.user_id ${sqlWhere} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return { rows: rows.map(txRow), total, page, pageSize }
  })

  ipcMain.handle('sms:admin:messages', (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const where: string[] = []
    const args: any[] = []
    if (params?.userId) { where.push('m.user_id = ?'); args.push(Number(params.userId)) }
    if (params?.status && MESSAGE_STATUSES.includes(String(params.status))) { where.push('m.status = ?'); args.push(String(params.status)) }
    const search = String(params?.search || '').trim()
    if (search) {
      where.push("(u.username LIKE ? OR u.full_name LIKE ? OR m.recipient LIKE ? OR m.message LIKE ? OR COALESCE(m.request_id,'') LIKE ? OR COALESCE(m.provider_message_id,'') LIKE ?)")
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_messages m JOIN users u ON u.id = m.user_id ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT m.*, u.username, u.full_name FROM sms_messages m
      JOIN users u ON u.id = m.user_id ${sqlWhere} ORDER BY m.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return { rows: rows.map(messageRow), total, page, pageSize }
  })

  ipcMain.handle('sms:admin:purchases', (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const where: string[] = []
    const args: any[] = []
    if (params?.status) { where.push('p.status = ?'); args.push(String(params.status)) }
    const search = String(params?.search || '').trim()
    if (search) {
      where.push('(u.username LIKE ? OR u.full_name LIKE ? OR p.trx_id LIKE ? OR p.package_name LIKE ?)')
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_purchases p JOIN users u ON u.id = p.user_id ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT p.*, u.username, u.full_name FROM sms_purchases p
      JOIN users u ON u.id = p.user_id ${sqlWhere} ORDER BY p.id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset) as any[]
    return { rows: rows.map(purchaseRow), total, page, pageSize }
  })

  // ---- provider credit purchases (shared BulkSMSBD account) -----------------
  // This is a real purchase record for the provider's shared balance. It is NOT
  // a user wallet credit; allocation stays an explicit, audited adjustment.
  ipcMain.handle('sms:admin:providerPurchases', (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    const { page, pageSize, offset } = pageParams(params)
    const conn = db()
    const where: string[] = []
    const args: any[] = []
    const search = String(params?.search || '').trim()
    if (search) {
      where.push('(p.trx_id LIKE ? OR p.provider LIKE ? OR COALESCE(p.note,\'\') LIKE ? OR COALESCE(u.username,\'\') LIKE ?)')
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = Number((conn.prepare(`SELECT COUNT(*) AS c FROM sms_provider_purchases p LEFT JOIN users u ON u.id = p.purchased_by ${sqlWhere}`).get(...args) as any).c)
    const rows = conn.prepare(`SELECT p.*, u.username AS purchased_by_name FROM sms_provider_purchases p
      LEFT JOIN users u ON u.id = p.purchased_by ${sqlWhere} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
      .all(...args, pageSize, offset) as any[]
    return { rows: rows.map(providerPurchaseRow), total, page, pageSize }
  })

  ipcMain.handle('sms:admin:providerPurchase', (e, input: any) => {
    const s = requireAuth(e); assertSuper(s, 'providerPurchase')
    const provider = String(input?.provider || 'bulksmsbd')
    if (!(SMS_PROVIDERS as readonly string[]).includes(provider)) throw new Error('INVALID_SMS_PROVIDER')
    const smsCount = Math.trunc(Number(input?.smsCount))
    const amount = Number(input?.amount ?? 0)
    const method = String(input?.method || 'bank').toLowerCase()
    const trxId = String(input?.trxId || '').trim()
    const note = String(input?.note || '').trim().slice(0, 200) || null
    if (!Number.isInteger(smsCount) || smsCount <= 0 || smsCount > 100_000_000) throw new Error('INVALID_SMS_COUNT')
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) throw new Error('INVALID_AMOUNT')
    if (!SMS_METHODS.includes(method) && method !== 'other') throw new Error('INVALID_PAYMENT_METHOD')
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(trxId)) throw new Error('INVALID_TRX_ID')
    const key = `sms_provider_purchase:${provider}:${method}:${trxId}`.slice(0, 160)
    const conn = db()
    conn.exec('BEGIN IMMEDIATE')
    try {
      const existing = conn.prepare('SELECT * FROM sms_provider_purchases WHERE idempotency_key = ?').get(key) as any
      if (existing) {
        conn.exec('COMMIT')
        return { duplicate: true, purchase: providerPurchaseRow(existing) }
      }
      const ins = conn.prepare(`INSERT INTO sms_provider_purchases
        (provider, sms_count, amount, method, trx_id, note, idempotency_key, purchased_by)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(provider, smsCount, amount, method, trxId, note, key, s.userId)
      const row = conn.prepare(`SELECT p.*, u.username AS purchased_by_name FROM sms_provider_purchases p
        LEFT JOIN users u ON u.id = p.purchased_by WHERE p.id = ?`).get(Number(ins.lastInsertRowid)) as any
      conn.exec('COMMIT')
      logActivity(s.userId, s.username, 'sms_provider_purchase_recorded', 'sms',
        `#${row.id} ${provider} +${smsCount} SMS ৳${amount} trx=${trxId}`)
      return { duplicate: false, purchase: providerPurchaseRow(row) }
    } catch (err) {
      try { conn.exec('ROLLBACK') } catch { /* already rolled back */ }
      throw err
    }
  })

  // Approve = credit exactly once. Duplicate callback / double click is safe.
  ipcMain.handle('sms:admin:verifyPurchase', (e, purchaseId: number, action: 'approve' | 'reject', note?: string) => {
    const s = requireAuth(e); assertSuper(s, 'verifyPurchase')
    if (!['approve', 'reject'].includes(action)) throw new Error('INVALID_ACTION')
    const cfg = loadConfig()
    const conn = db()
    conn.exec('BEGIN IMMEDIATE')
    try {
      const p = conn.prepare('SELECT * FROM sms_purchases WHERE id = ?').get(Number(purchaseId)) as any
      if (!p) throw new Error('SMS_PURCHASE_NOT_FOUND')
      if (p.status === 'verified') {
        const wallet = ensureWallet(conn, Number(p.user_id))
        conn.exec('COMMIT')
        return { already: true, wallet: walletView(wallet, Number(p.user_id), cfg.lowBalanceThreshold), purchase: purchaseRow(p) }
      }
      if (p.status !== 'pending') throw new Error('SMS_PURCHASE_ALREADY_' + String(p.status).toUpperCase())
      if (action === 'reject') {
        conn.prepare("UPDATE sms_purchases SET status = 'rejected', verified_by = ?, verified_at = datetime('now'), note = COALESCE(?, note) WHERE id = ?")
          .run(s.userId, note ? String(note).slice(0, 200) : null, p.id)
        const row = conn.prepare('SELECT * FROM sms_purchases WHERE id = ?').get(p.id) as any
        conn.exec('COMMIT')
        logActivity(s.userId, s.username, 'sms_purchase_rejected', 'sms', `#${p.id} ${p.package_name} trx=${p.trx_id}`)
        return { already: false, purchase: purchaseRow(row), credited: 0 }
      }
      // atomic credit + ledger row
      const wallet = ensureWallet(conn, Number(p.user_id))
      const newBalance = Number(wallet.balance) + Number(p.sms_count)
      conn.prepare(`UPDATE sms_wallets SET balance = ?, total_purchased = total_purchased + ?, updated_at = datetime('now')
        WHERE user_id = ?`).run(newBalance, Number(p.sms_count), Number(p.user_id))
      conn.prepare(`UPDATE sms_purchases SET status = 'verified', verified_by = ?, verified_at = datetime('now'), note = COALESCE(?, note)
        WHERE id = ?`).run(s.userId, note ? String(note).slice(0, 200) : null, p.id)
      conn.prepare(`INSERT INTO sms_transactions
        (user_id, type, sms_count, balance_after, amount, reference, idempotency_key, note, created_by)
        VALUES (?, 'purchase', ?, ?, ?, ?, ?, ?, ?)`)
        .run(Number(p.user_id), Number(p.sms_count), newBalance, Number(p.amount),
          `sms_purchase:${p.id}`, `sms_purchase:${p.id}`,
          `${p.package_name} via ${p.method} trx=${p.trx_id}`, s.userId)
      const row = conn.prepare('SELECT * FROM sms_purchases WHERE id = ?').get(p.id) as any
      const finalWallet = conn.prepare('SELECT * FROM sms_wallets WHERE user_id = ?').get(Number(p.user_id)) as any
      conn.exec('COMMIT')
      logActivity(s.userId, s.username, 'sms_purchase_verified', 'sms', `#${p.id} user=${p.user_id} +${p.sms_count} SMS trx=${p.trx_id}`)
      return { already: false, purchase: purchaseRow(row), credited: Number(p.sms_count), wallet: walletView(finalWallet, Number(p.user_id), cfg.lowBalanceThreshold) }
    } catch (err) {
      try { conn.exec('ROLLBACK') } catch { /* already committed */ }
      throw err
    }
  })

  // Super Admin manual adjustment (audited; cannot create a negative balance).
  ipcMain.handle('sms:admin:adjust', (e, userId: number, delta: number, note: string, requestId?: string) => {
    const s = requireAuth(e); assertSuper(s, 'adjust')
    const uid = Number(userId)
    const d = Math.trunc(Number(delta))
    if (!Number.isInteger(uid) || uid <= 0) throw new Error('INVALID_USER')
    if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 100000) throw new Error('INVALID_SMS_DELTA')
    const target = db().prepare('SELECT id, username FROM users WHERE id = ?').get(uid) as any
    if (!target) throw new Error('USER_NOT_FOUND')
    const cfg = loadConfig()
    const key = `sms_adjust:${uid}:${String(requestId || randomUUID()).slice(0, 120)}`
    const conn = db()
    conn.exec('BEGIN IMMEDIATE')
    try {
      const dup = conn.prepare('SELECT * FROM sms_transactions WHERE idempotency_key = ?').get(key) as any
      if (dup) {
        const w = ensureWallet(conn, uid)
        conn.exec('COMMIT')
        return { duplicate: true, wallet: walletView(w, uid, cfg.lowBalanceThreshold), transaction: txRow(dup) }
      }
      const wallet = ensureWallet(conn, uid)
      const newBalance = Number(wallet.balance) + d
      if (newBalance < 0) throw new Error('SMS_BALANCE_CANNOT_BE_NEGATIVE')
      conn.prepare("UPDATE sms_wallets SET balance = ?, updated_at = datetime('now') WHERE user_id = ?").run(newBalance, uid)
      const ins = conn.prepare(`INSERT INTO sms_transactions
        (user_id, type, sms_count, balance_after, amount, reference, idempotency_key, note, created_by)
        VALUES (?, 'adjustment', ?, ?, 0, 'manual', ?, ?, ?)`)
        .run(uid, d, newBalance, key, String(note || '').slice(0, 200) || null, s.userId)
      const row = conn.prepare('SELECT * FROM sms_transactions WHERE id = ?').get(Number(ins.lastInsertRowid)) as any
      conn.exec('COMMIT')
      logActivity(s.userId, s.username, 'sms_balance_adjusted', 'sms', `user=${target.username} delta=${d} note=${note || ''}`)
      return { duplicate: false, wallet: walletView({ ...wallet, balance: newBalance }, uid, cfg.lowBalanceThreshold), transaction: txRow(row) }
    } catch (err) {
      try { conn.exec('ROLLBACK') } catch { /* already committed */ }
      throw err
    }
  })

  // ---- packages --------------------------------------------------------------
  ipcMain.handle('sms:admin:packages', (e) => {
    const s = requireAuth(e); assertSuper(s, 'manage')
    return db().prepare('SELECT * FROM sms_packages ORDER BY status, price, id').all()
  })

  ipcMain.handle('sms:admin:packageSave', (e, data: any) => {
    const s = requireAuth(e); assertSuper(s, 'packageSave')
    const name = String(data?.name || '').trim()
    const smsCount = Math.trunc(Number(data?.smsCount))
    const price = Number(data?.price)
    const description = String(data?.description || '').trim().slice(0, 300) || null
    const status = data?.status === 'inactive' ? 'inactive' : 'active'
    if (!name || name.length > 80) throw new Error('INVALID_PACKAGE_NAME')
    if (!Number.isInteger(smsCount) || smsCount <= 0 || smsCount > 10_000_000) throw new Error('INVALID_SMS_COUNT')
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new Error('INVALID_PRICE')
    const conn = db()
    try {
      if (data?.id) {
        const existing = conn.prepare('SELECT id FROM sms_packages WHERE id = ?').get(Number(data.id)) as any
        if (!existing) throw new Error('PACKAGE_NOT_FOUND')
        conn.prepare(`UPDATE sms_packages SET name = ?, sms_count = ?, price = ?, description = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?`).run(name, smsCount, price, description, status, Number(data.id))
        logActivity(s.userId, s.username, 'sms_package_saved', 'sms', `#${data.id} ${name}`)
        return Number(data.id)
      }
      const ins = conn.prepare(`INSERT INTO sms_packages (name, sms_count, price, description, status)
        VALUES (?,?,?,?,?)`).run(name, smsCount, price, description, status)
      logActivity(s.userId, s.username, 'sms_package_created', 'sms', `${name} ${smsCount} SMS ৳${price}`)
      return Number(ins.lastInsertRowid)
    } catch (err: any) {
      if (/UNIQUE/i.test(String(err?.message || err))) throw new Error('PACKAGE_NAME_EXISTS')
      throw err
    }
  })

  ipcMain.handle('sms:admin:packageDelete', (e, id: number) => {
    const s = requireAuth(e); assertSuper(s, 'packageDelete')
    const row = db().prepare('SELECT * FROM sms_packages WHERE id = ?').get(Number(id)) as any
    if (!row) throw new Error('PACKAGE_NOT_FOUND')
    db().prepare("UPDATE sms_packages SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(Number(id))
    logActivity(s.userId, s.username, 'sms_package_deactivated', 'sms', row.name)
    return true
  })

  // ---- gateway configuration (non-secret) + test -----------------------------
  ipcMain.handle('sms:admin:config', (e) => {
    const s = requireAuth(e); assertSuper(s, 'config')
    return publicConfig(loadConfig())
  })

  ipcMain.handle('sms:admin:configSet', (e, data: any) => {
    const s = requireAuth(e); assertSuper(s, 'config')
    const provider = String(data?.provider || 'generic')
    if (!(SMS_PROVIDERS as readonly string[]).includes(provider)) throw new Error('INVALID_SMS_PROVIDER')
    const currentCfg = loadConfig()
    const url = String(data?.gatewayUrl || '').trim()
    const balanceUrl = (data?.balanceUrl === undefined ? currentCfg.balanceUrl : String(data.balanceUrl || '')).trim()
    const dlrUrl = (data?.dlrUrl === undefined ? currentCfg.dlrUrl : String(data.dlrUrl || '')).trim()
    const senderId = String(data?.senderId || '').trim()
    const thresholdInput = data?.lowBalanceThreshold
    const lowThreshold = (thresholdInput === undefined || thresholdInput === null || thresholdInput === '')
      ? currentCfg.lowBalanceThreshold
      : Math.trunc(Number(thresholdInput))
    if (url && !isHttpUrl(url)) throw new Error('INVALID_GATEWAY_URL')
    if (balanceUrl && !isHttpUrl(balanceUrl)) throw new Error('INVALID_BALANCE_URL')
    if (dlrUrl && !isHttpUrl(dlrUrl)) throw new Error('INVALID_DLR_URL')
    if (senderId && !/^[A-Za-z0-9 _.-]{1,24}$/.test(senderId)) throw new Error('INVALID_SENDER_ID')
    if (!Number.isFinite(lowThreshold) || lowThreshold < 0 || lowThreshold > 1_000_000) throw new Error('INVALID_LOW_BALANCE_THRESHOLD')
    const enabled = !!data?.enabled
    // With the Supabase Edge Function proxy the provider URL and sender ID live
    // in Supabase secrets, so they are not required in the local config.
    if (enabled && !viaEdge(currentCfg) && (!url || !senderId)) throw new Error('SMS_GATEWAY_URL_SENDER_REQUIRED')
    db().prepare(`UPDATE sms_gateway_config SET provider = ?, gateway_url = ?, balance_url = ?, dlr_url = ?, sender_id = ?,
        enabled = ?, refund_on_failed = ?, low_balance_threshold = ?, updated_at = datetime('now'), updated_by = ? WHERE id = 1`)
      .run(provider, url, balanceUrl, dlrUrl, senderId, enabled ? 1 : 0,
        data?.refundOnFailed === false ? 0 : 1, lowThreshold, s.userId)
    logActivity(s.userId, s.username, 'sms_gateway_config_saved', 'sms',
      `provider=${provider} url=${url} sender=${senderId} enabled=${enabled} low=${lowThreshold}`)
    return publicConfig(loadConfig())
  })

  // Real gateway test (does not debit any wallet). Only the Super Admin can
  // trigger it; the number is normalized and the result is audited.
  ipcMain.handle('sms:admin:testGateway', async (e, recipient: string) => {
    const s = requireAuth(e); assertSuper(s, 'testGateway')
    const cfg = loadConfig()
    const missing = configError({ ...cfg, enabled: true })
    if (missing) throw new Error(missing)
    const to = normalizeRecipient(recipient)
    try {
      const result = await sendViaGateway({ ...cfg, enabled: true }, to, 'AVA Cable Management — SMS gateway test', `TEST-${Date.now()}`)
      logActivity(s.userId, s.username, 'sms_gateway_test_ok', 'sms', `to=${to} provider=${result.provider} id=${result.providerMessageId || '-'}`)
      return { ok: true, provider: result.provider, providerMessageId: result.providerMessageId }
    } catch (err: any) {
      const msg = String(err?.message || err).slice(0, 300)
      logActivity(s.userId, s.username, 'sms_gateway_test_failed', 'sms', `to=${to} ${msg}`)
      throw new Error(msg)
    }
  })

  // BulkSMSBD balance check — separate from every user's SMS wallet.
  ipcMain.handle('sms:admin:gatewayBalance', async (e) => {
    const s = requireAuth(e); assertSuper(s, 'gatewayBalance')
    const cfg = loadConfig()
    const result = await fetchGatewayBalance(cfg)
    logActivity(s.userId, s.username, 'sms_gateway_balance_checked', 'sms',
      `provider=${result.provider} balance=${result.balance}`)
    return result
  })

  // Pull one provider delivery report and apply it atomically. A failed report
  // follows the configured refund policy (idempotent by message id).
  ipcMain.handle('sms:admin:checkDelivery', async (e, messageId: number) => {
    const s = requireAuth(e); assertSuper(s, 'checkDelivery')
    const id = Number(messageId)
    if (!Number.isInteger(id) || id <= 0) throw new Error('INVALID_SMS_MESSAGE')
    const msg = db().prepare('SELECT * FROM sms_messages WHERE id = ?').get(id) as any
    if (!msg) throw new Error('SMS_MESSAGE_NOT_FOUND')
    if (!msg.provider_message_id) throw new Error('SMS_PROVIDER_ID_MISSING')
    const cfg = loadConfig()
    const report = await fetchDeliveryReport(cfg, String(msg.provider_message_id))
    const row = applyDeliveryReport(msg, report, s.userId, cfg.refundOnFailed)
    logActivity(s.userId, s.username, 'sms_delivery_checked', 'sms',
      `#${id} provider=${report.providerStatus || '-'} status=${row?.status} refunded=${row?.refunded ? 1 : 0}`)
    return { ...messageRow(row), deliveryReport: report }
  })

  // Sync delivery reports for recent pending/sent messages.
  ipcMain.handle('sms:admin:syncDelivery', async (e, params: any = {}) => {
    const s = requireAuth(e); assertSuper(s, 'syncDelivery')
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(params?.limit) || 20)))
    const cfg = loadConfig()
    // In Edge mode the DLR endpoint is a Supabase secret, not local config.
    if (!cfg.dlrUrl && !viaEdge(cfg)) throw new Error('SMS_DLR_URL_MISSING')
    const rows = db().prepare(`SELECT * FROM sms_messages
      WHERE provider_message_id IS NOT NULL AND status IN ('pending','sent')
      ORDER BY delivery_attempts ASC, id DESC LIMIT ?`).all(limit) as any[]
    let checked = 0, delivered = 0, failed = 0, pending = 0, errors = 0
    for (const msg of rows) {
      try {
        const report = await fetchDeliveryReport(cfg, String(msg.provider_message_id))
        const updated = applyDeliveryReport(msg, report, s.userId, cfg.refundOnFailed)
        checked++
        if (updated?.status === 'delivered') delivered++
        else if (updated?.status === 'failed') failed++
        else pending++
      } catch {
        errors++ // network/provider error must NOT mark a message failed
      }
    }
    logActivity(s.userId, s.username, 'sms_delivery_synced', 'sms',
      `checked=${checked} delivered=${delivered} failed=${failed} pending=${pending} errors=${errors}`)
    return { checked, delivered, failed, pending, errors }
  })

  // Delivery-report / manual status update (Super Admin only). A failed status
  // applies the configured refund policy once (idempotent).
  ipcMain.handle('sms:admin:updateStatus', (e, messageId: number, status: string) => {
    const s = requireAuth(e); assertSuper(s, 'updateStatus')
    const id = Number(messageId)
    if (!Number.isInteger(id) || id <= 0) throw new Error('INVALID_SMS_MESSAGE')
    if (!MESSAGE_STATUSES.includes(String(status))) throw new Error('INVALID_SMS_STATUS')
    const cfg = loadConfig()
    const row = markStatus(id, String(status), null, null, cfg.refundOnFailed, s.userId, { deliveryCheck: true })
    if (!row) throw new Error('SMS_MESSAGE_NOT_FOUND')
    logActivity(s.userId, s.username, 'sms_status_updated', 'sms', `#${id} → ${status}`)
    return messageRow(row)
  })
}
