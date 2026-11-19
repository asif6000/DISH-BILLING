// Shared types used by main, preload and renderer
export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  dir?: 'asc' | 'desc'
  filters?: Record<string, string | number>
  all?: boolean
}

export interface ListResult {
  rows: Record<string, any>[]
  total: number
  page: number
  pageSize: number
}

export interface UserInfo {
  id: number
  username: string
  fullName: string
  roleId: number
  roleName: string
  permissions: string[]
}

export interface CustomerFilters extends ListParams {
  status?: string
  areaId?: number
  packageId?: number
  dueOnly?: boolean
}

export interface BillRow {
  id: number
  customer_id: number
  customer_code: string
  customer_name: string
  month: string
  amount: number
  discount: number
  late_fee: number
  previous_due: number
  total: number
  paid: number
  status: string
}

export interface PaymentInput {
  customerId: number
  amount: number
  method: string
  reference?: string
  note?: string
  collectorId?: number | null
  resellerId?: number | null
  date?: string
  applyAdvance?: boolean
  billId?: number | null
  type?: 'bill' | 'advance' | 'refund' | 'connection_fee'
}
