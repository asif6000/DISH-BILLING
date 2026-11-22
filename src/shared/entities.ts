// Entity registry: drives generic CRUD (main) and tables/forms (renderer)
export type FieldType = 'text' | 'number' | 'money' | 'textarea' | 'select' | 'date' | 'ref' | 'checkbox' | 'month'

export interface SelectOption { value: string; label: string; labelBn: string }

export interface FieldDef {
  name: string
  label: string
  labelBn: string
  type: FieldType
  options?: SelectOption[]
  refEntity?: string
  required?: boolean
  min?: number
  max?: number
  hideInTable?: boolean
  hideInForm?: boolean
  defaultValue?: string | number
}

export interface EntityDef {
  key: string
  table: string
  label: string
  labelBn: string
  fields: FieldDef[]
  searchFields: string[]
  defaultSort?: string
}

const STATUS: SelectOption[] = [
  { value: 'active', label: 'Active', labelBn: 'সক্রিয়' },
  { value: 'inactive', label: 'Inactive', labelBn: 'নিষ্ক্রিয়' }
]

const PRIORITY: SelectOption[] = [
  { value: 'low', label: 'Low', labelBn: 'কম' },
  { value: 'normal', label: 'Normal', labelBn: 'স্বাভাবিক' },
  { value: 'high', label: 'High', labelBn: 'উচ্চ' },
  { value: 'urgent', label: 'Urgent', labelBn: 'অতি জরুরি' }
]

export const ENTITIES: Record<string, EntityDef> = {
  zones: {
    key: 'zones', table: 'zones', label: 'Zone', labelBn: 'জোন',
    searchFields: ['name', 'description'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Zone Name', labelBn: 'জোনের নাম', type: 'text', required: true },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', hideInTable: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  areas: {
    key: 'areas', table: 'areas', label: 'Area', labelBn: 'এলাকা',
    searchFields: ['name'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Area Name', labelBn: 'এলাকার নাম', type: 'text', required: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  sub_areas: {
    key: 'sub_areas', table: 'sub_areas', label: 'Sub Area', labelBn: 'সাব-এলাকা',
    searchFields: ['name'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Sub Area Name', labelBn: 'সাব-এলাকার নাম', type: 'text', required: true },
      { name: 'area_id', label: 'Area', labelBn: 'এলাকা', type: 'ref', refEntity: 'areas', required: true },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', hideInTable: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  roads: {
    key: 'roads', table: 'roads', label: 'Road', labelBn: 'রোড',
    searchFields: ['name'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Road Name', labelBn: 'রোডের নাম', type: 'text', required: true },
      { name: 'sub_area_id', label: 'Sub Area', labelBn: 'সাব-এলাকা', type: 'ref', refEntity: 'sub_areas', required: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  packages: {
    key: 'packages', table: 'packages', label: 'Package', labelBn: 'প্যাকেজ',
    searchFields: ['name', 'code'],
    defaultSort: 'price',
    fields: [
      { name: 'name', label: 'Package Name', labelBn: 'প্যাকেজের নাম', type: 'text', required: true },
      { name: 'code', label: 'Code', labelBn: 'কোড', type: 'text' },
      { name: 'price', label: 'Monthly Price', labelBn: 'মাসিক মূল্য', type: 'money', required: true, min: 0 },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', defaultValue: 'standard',
        options: [
          { value: 'basic', label: 'Basic', labelBn: 'বেসিক' },
          { value: 'standard', label: 'Standard', labelBn: 'স্ট্যান্ডার্ড' },
          { value: 'premium', label: 'Premium', labelBn: 'প্রিমিয়াম' },
          { value: 'hd', label: 'HD', labelBn: 'এইচডি' },
          { value: 'special', label: 'Special', labelBn: 'স্পেশাল' },
          { value: 'free', label: 'Free', labelBn: 'ফ্রি' }
        ]
      },
      { name: 'channels', label: 'Channels', labelBn: 'চ্যানেল সংখ্যা', type: 'number', min: 0 },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', hideInTable: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  staff: {
    key: 'staff', table: 'staff', label: 'Staff', labelBn: 'কর্মী',
    searchFields: ['name', 'mobile', 'designation'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Full Name', labelBn: 'পূর্ণ নাম', type: 'text', required: true },
      {
        name: 'designation', label: 'Designation', labelBn: 'পদবি', type: 'select', required: true, defaultValue: 'technician',
        options: [
          { value: 'manager', label: 'Manager', labelBn: 'ম্যানেজার' },
          { value: 'technician', label: 'Technician', labelBn: 'টেকনিশিয়ান' },
          { value: 'collector', label: 'Collector', labelBn: 'কালেক্টর' },
          { value: 'other', label: 'Other', labelBn: 'অন্যান্য' }
        ]
      },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text', required: true },
      { name: 'nid', label: 'NID', labelBn: 'এনআইডি', type: 'text', hideInTable: true },
      { name: 'address', label: 'Address', labelBn: 'ঠিকানা', type: 'textarea', hideInTable: true },
      { name: 'join_date', label: 'Join Date', labelBn: 'যোগদানের তারিখ', type: 'date' },
      { name: 'salary', label: 'Monthly Salary', labelBn: 'মাসিক বেতন', type: 'money', min: 0 },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  attendance: {
    key: 'attendance', table: 'attendance', label: 'Attendance', labelBn: 'হাজিরা',
    searchFields: ['note'],
    defaultSort: 'date desc',
    fields: [
      { name: 'staff_id', label: 'Staff', labelBn: 'কর্মী', type: 'ref', refEntity: 'staff', required: true },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', required: true, defaultValue: 'present',
        options: [
          { value: 'present', label: 'Present', labelBn: 'উপস্থিত' },
          { value: 'absent', label: 'Absent', labelBn: 'অনুপস্থিত' },
          { value: 'leave', label: 'Leave', labelBn: 'ছুটি' },
          { value: 'half_day', label: 'Half Day', labelBn: 'অর্ধদিবস' }
        ]
      },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' }
    ]
  },
  leaves: {
    key: 'leaves', table: 'leaves', label: 'Leave', labelBn: 'ছুটি',
    searchFields: ['reason'],
    defaultSort: 'from_date desc',
    fields: [
      { name: 'staff_id', label: 'Staff', labelBn: 'কর্মী', type: 'ref', refEntity: 'staff', required: true },
      { name: 'from_date', label: 'From', labelBn: 'শুরু', type: 'date', required: true },
      { name: 'to_date', label: 'To', labelBn: 'শেষ', type: 'date', required: true },
      { name: 'reason', label: 'Reason', labelBn: 'কারণ', type: 'textarea', required: true },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'approved',
        options: [
          { value: 'pending', label: 'Pending', labelBn: 'অপেক্ষমাণ' },
          { value: 'approved', label: 'Approved', labelBn: 'অনুমোদিত' },
          { value: 'rejected', label: 'Rejected', labelBn: 'প্রত্যাখ্যাত' }
        ]
      }
    ]
  },
  salaries: {
    key: 'salaries', table: 'salaries', label: 'Salary', labelBn: 'বেতন',
    searchFields: ['month'],
    defaultSort: 'month desc',
    fields: [
      { name: 'staff_id', label: 'Staff', labelBn: 'কর্মী', type: 'ref', refEntity: 'staff', required: true },
      { name: 'month', label: 'Month', labelBn: 'মাস', type: 'month', required: true },
      { name: 'basic', label: 'Basic', labelBn: 'মূল বেতন', type: 'money', required: true, min: 0 },
      { name: 'bonus', label: 'Bonus', labelBn: 'বোনাস', type: 'money', defaultValue: 0, min: 0 },
      { name: 'commission', label: 'Commission', labelBn: 'কমিশন', type: 'money', defaultValue: 0, min: 0 },
      { name: 'deduction', label: 'Deduction', labelBn: 'কাটা', type: 'money', defaultValue: 0, min: 0 },
      { name: 'paid_date', label: 'Paid Date', labelBn: 'পরিশোধ তারিখ', type: 'date' },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'unpaid',
        options: [
          { value: 'unpaid', label: 'Unpaid', labelBn: 'অপরিশোধিত' },
          { value: 'paid', label: 'Paid', labelBn: 'পরিশোধিত' }
        ]
      }
    ]
  },
  collectors: {
    key: 'collectors', table: 'collectors', label: 'Collector', labelBn: 'কালেক্টর',
    searchFields: [],
    defaultSort: 'id',
    fields: [
      { name: 'staff_id', label: 'Staff', labelBn: 'কর্মী', type: 'ref', refEntity: 'staff', required: true },
      { name: 'target_amount', label: 'Monthly Target', labelBn: 'মাসিক টার্গেট', type: 'money', min: 0 },
      { name: 'commission_rate', label: 'Commission %', labelBn: 'কমিশন %', type: 'number', min: 0, max: 100 },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  cash_deposits: {
    key: 'cash_deposits', table: 'cash_deposits', label: 'Cash Deposit', labelBn: 'নগদ জমা',
    searchFields: ['note'],
    defaultSort: 'date desc',
    fields: [
      { name: 'collector_id', label: 'Collector', labelBn: 'কালেক্টর', type: 'ref', refEntity: 'collectors', required: true },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      { name: 'amount', label: 'Amount', labelBn: 'পরিমাণ', type: 'money', required: true, min: 1 },
      {
        name: 'method', label: 'Method', labelBn: 'মাধ্যম', type: 'select', defaultValue: 'cash',
        options: [
          { value: 'cash', label: 'Cash', labelBn: 'নগদ' },
          { value: 'bank', label: 'Bank', labelBn: 'ব্যাংক' },
          { value: 'bkash', label: 'bKash', labelBn: 'বিকাশ' },
          { value: 'nagad', label: 'Nagad', labelBn: 'নগদ' }
        ]
      },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' }
    ]
  },
  resellers: {
    key: 'resellers', table: 'resellers', label: 'Reseller', labelBn: 'রিসেলার',
    searchFields: ['name', 'mobile', 'company'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Reseller Name', labelBn: 'রিসেলারের নাম', type: 'text', required: true },
      { name: 'company', label: 'Company', labelBn: 'প্রতিষ্ঠান', type: 'text' },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text', required: true },
      { name: 'address', label: 'Address', labelBn: 'ঠিকানা', type: 'textarea', hideInTable: true },
      { name: 'commission_rate', label: 'Commission %', labelBn: 'কমিশন %', type: 'number', min: 0, max: 100 },
      { name: 'wallet_balance', label: 'Wallet Balance', labelBn: 'ওয়ালেট ব্যালেন্স', type: 'money', defaultValue: 0, hideInForm: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  complaints: {
    key: 'complaints', table: 'complaints', label: 'Complaint', labelBn: 'অভিযোগ',
    searchFields: ['description', 'note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'customer_id', label: 'Customer', labelBn: 'গ্রাহক', type: 'ref', refEntity: 'customers', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'no_signal',
        options: [
          { value: 'no_signal', label: 'No Signal', labelBn: 'সিগন্যাল নেই' },
          { value: 'cable_problem', label: 'Cable Problem', labelBn: 'কেবল সমস্যা' },
          { value: 'picture_problem', label: 'Picture Problem', labelBn: 'ছবির সমস্যা' },
          { value: 'sound_problem', label: 'Sound Problem', labelBn: 'শব্দের সমস্যা' },
          { value: 'channel_problem', label: 'Channel Problem', labelBn: 'চ্যানেল সমস্যা' },
          { value: 'stb_problem', label: 'Set-Top Box Problem', labelBn: 'সেট-টপ বক্স সমস্যা' },
          { value: 'other', label: 'Other', labelBn: 'অন্যান্য' }
        ]
      },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', required: true },
      { name: 'priority', label: 'Priority', labelBn: 'অগ্রাধিকার', type: 'select', options: PRIORITY, defaultValue: 'normal' },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'pending',
        options: [
          { value: 'pending', label: 'Pending', labelBn: 'অপেক্ষমাণ' },
          { value: 'assigned', label: 'Assigned', labelBn: 'নির্ধারিত' },
          { value: 'resolved', label: 'Resolved', labelBn: 'সমাধান' },
          { value: 'closed', label: 'Closed', labelBn: 'বন্ধ' }
        ]
      },
      { name: 'technician_id', label: 'Technician', labelBn: 'টেকনিশিয়ান', type: 'ref', refEntity: 'staff' },
      { name: 'assigned_date', label: 'Assigned Date', labelBn: 'নির্ধারিত তারিখ', type: 'date' },
      { name: 'resolved_date', label: 'Resolved Date', labelBn: 'সমাধানের তারিখ', type: 'date' },
      { name: 'feedback', label: 'Feedback', labelBn: 'মতামত', type: 'textarea', hideInTable: true },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea', hideInTable: true }
    ]
  },
  products: {
    key: 'products', table: 'products', label: 'Product', labelBn: 'পণ্য',
    searchFields: ['name', 'sku'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Product Name', labelBn: 'পণ্যের নাম', type: 'text', required: true },
      { name: 'sku', label: 'SKU', labelBn: 'এসকেইউ', type: 'text' },
      {
        name: 'category', label: 'Category', labelBn: 'বিভাগ', type: 'select', required: true, defaultValue: 'cable',
        options: [
          { value: 'cable', label: 'Cable', labelBn: 'কেবল' },
          { value: 'fiber_cable', label: 'Fiber Cable', labelBn: 'ফাইবার কেবল' },
          { value: 'stb', label: 'Set-Top Box', labelBn: 'সেট-টপ বক্স' },
          { value: 'remote', label: 'Remote Control', labelBn: 'রিমোট কন্ট্রোল' },
          { value: 'amplifier', label: 'Amplifier', labelBn: 'অ্যামপ্লিফায়ার' },
          { value: 'splitter', label: 'Splitter', labelBn: 'স্প্লিটার' },
          { value: 'connector', label: 'Connector', labelBn: 'কানেক্টর' },
          { value: 'adapter', label: 'Adapter', labelBn: 'অ্যাডাপ্টার' },
          { value: 'other', label: 'Other', labelBn: 'অন্যান্য' }
        ]
      },
      { name: 'unit', label: 'Unit', labelBn: 'একক', type: 'text', defaultValue: 'pcs' },
      { name: 'purchase_price', label: 'Purchase Price', labelBn: 'ক্রয়মূল্য', type: 'money', min: 0 },
      { name: 'sale_price', label: 'Sale Price', labelBn: 'বিক্রয়মূল্য', type: 'money', min: 0 },
      { name: 'stock', label: 'Stock', labelBn: 'স্টক', type: 'number', defaultValue: 0, min: 0 },
      { name: 'min_stock', label: 'Min Stock Alert', labelBn: 'সর্বনিম্ন স্টক', type: 'number', defaultValue: 5, min: 0 },
      { name: 'warranty_months', label: 'Warranty (months)', labelBn: 'ওয়ারেন্টি (মাস)', type: 'number', min: 0, hideInTable: true },
      { name: 'supplier_id', label: 'Supplier', labelBn: 'সরবরাহকারী', type: 'ref', refEntity: 'suppliers' },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  suppliers: {
    key: 'suppliers', table: 'suppliers', label: 'Supplier', labelBn: 'সরবরাহকারী',
    searchFields: ['name', 'mobile', 'contact'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Supplier Name', labelBn: 'সরবরাহকারীর নাম', type: 'text', required: true },
      { name: 'contact', label: 'Contact Person', labelBn: 'যোগাযোগ', type: 'text' },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text' },
      { name: 'address', label: 'Address', labelBn: 'ঠিকানা', type: 'textarea', hideInTable: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  stock_movements: {
    key: 'stock_movements', table: 'stock_movements', label: 'Stock Movement', labelBn: 'স্টক চালান',
    searchFields: ['reason', 'ref'],
    defaultSort: 'id desc',
    fields: [
      { name: 'product_id', label: 'Product', labelBn: 'পণ্য', type: 'ref', refEntity: 'products', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'in',
        options: [
          { value: 'in', label: 'Stock In', labelBn: 'স্টক ইন' },
          { value: 'out', label: 'Stock Out', labelBn: 'স্টক আউট' },
          { value: 'adjust', label: 'Adjustment', labelBn: 'সমন্বয়' }
        ]
      },
      { name: 'qty', label: 'Quantity', labelBn: 'পরিমাণ', type: 'number', required: true, min: 1 },
      { name: 'reason', label: 'Reason', labelBn: 'কারণ', type: 'text' },
      { name: 'ref', label: 'Reference', labelBn: 'রেফারেন্স', type: 'text' },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true }
    ]
  },
  network_devices: {
    key: 'network_devices', table: 'network_devices', label: 'Network Device', labelBn: 'নেটওয়ার্ক ডিভাইস',
    searchFields: ['name', 'code', 'location'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Name', labelBn: 'নাম', type: 'text', required: true },
      { name: 'code', label: 'Code', labelBn: 'কোড', type: 'text' },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'main_line',
        options: [
          { value: 'main_line', label: 'Main Line', labelBn: 'মেইন লাইন' },
          { value: 'distribution_box', label: 'Distribution Box', labelBn: 'ডিস্ট্রিবিউশন বক্স' },
          { value: 'fiber_node', label: 'Fiber Node', labelBn: 'ফাইবার নোড' },
          { value: 'splitter', label: 'Splitter', labelBn: 'স্প্লিটার' },
          { value: 'amplifier', label: 'Amplifier', labelBn: 'অ্যামপ্লিফায়ার' },
          { value: 'cable_route', label: 'Cable Route', labelBn: 'কেবল রুট' },
          { value: 'connection_point', label: 'Connection Point', labelBn: 'কানেকশন পয়েন্ট' }
        ]
      },
      { name: 'area_id', label: 'Area', labelBn: 'এলাকা', type: 'ref', refEntity: 'areas' },
      { name: 'location', label: 'Location', labelBn: 'অবস্থান', type: 'text' },
      { name: 'capacity', label: 'Capacity', labelBn: 'ক্ষমতা', type: 'number', min: 0 },
      { name: 'parent_id', label: 'Connected To', labelBn: 'সংযুক্ত', type: 'ref', refEntity: 'network_devices', hideInTable: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  network_faults: {
    key: 'network_faults', table: 'network_faults', label: 'Network Fault', labelBn: 'নেটওয়ার্ক ত্রুটি',
    searchFields: ['description'],
    defaultSort: 'id desc',
    fields: [
      { name: 'device_id', label: 'Device', labelBn: 'ডিভাইস', type: 'ref', refEntity: 'network_devices' },
      { name: 'area_id', label: 'Area', labelBn: 'এলাকা', type: 'ref', refEntity: 'areas' },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', required: true },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'open',
        options: [
          { value: 'open', label: 'Open', labelBn: 'খোলা' },
          { value: 'fixed', label: 'Fixed', labelBn: 'ঠিক হয়েছে' }
        ]
      },
      { name: 'resolved_date', label: 'Resolved Date', labelBn: 'সমাধানের তারিখ', type: 'date' }
    ]
  },
  branches: {
    key: 'branches', table: 'branches', label: 'Branch', labelBn: 'ব্রাঞ্চ',
    searchFields: ['name', 'code', 'address'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Branch Name', labelBn: 'ব্রাঞ্চের নাম', type: 'text', required: true },
      { name: 'code', label: 'Code', labelBn: 'কোড', type: 'text' },
      { name: 'address', label: 'Address', labelBn: 'ঠিকানা', type: 'textarea', hideInTable: true },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text' },
      { name: 'manager_id', label: 'Manager', labelBn: 'ম্যানেজার', type: 'ref', refEntity: 'staff' },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  leads: {
    key: 'leads', table: 'leads', label: 'Lead', labelBn: 'লিড',
    searchFields: ['name', 'mobile', 'note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'name', label: 'Name', labelBn: 'নাম', type: 'text', required: true },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text', required: true },
      { name: 'address', label: 'Address', labelBn: 'ঠিকানা', type: 'textarea' },
      {
        name: 'source', label: 'Source', labelBn: 'উৎস', type: 'select', defaultValue: 'walk_in',
        options: [
          { value: 'walk_in', label: 'Walk-in', labelBn: 'সরাসরি' },
          { value: 'referral', label: 'Referral', labelBn: 'রেফারেল' },
          { value: 'campaign', label: 'Campaign', labelBn: 'প্রচারণা' },
          { value: 'phone', label: 'Phone', labelBn: 'ফোন' },
          { value: 'other', label: 'Other', labelBn: 'অন্যান্য' }
        ]
      },
      { name: 'interest', label: 'Interest', labelBn: 'আগ্রহ', type: 'ref', refEntity: 'packages' },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'new',
        options: [
          { value: 'new', label: 'New', labelBn: 'নতুন' },
          { value: 'contacted', label: 'Contacted', labelBn: 'যোগাযোগ হয়েছে' },
          { value: 'interested', label: 'Interested', labelBn: 'আগ্রহী' },
          { value: 'converted', label: 'Converted', labelBn: 'রূপান্তরিত' },
          { value: 'lost', label: 'Lost', labelBn: 'বাতিল' }
        ]
      },
      { name: 'followup_date', label: 'Follow-up Date', labelBn: 'ফলোআপ তারিখ', type: 'date' },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea', hideInTable: true }
    ]
  },
  followups: {
    key: 'followups', table: 'followups', label: 'Follow-up', labelBn: 'ফলোআপ',
    searchFields: ['note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'lead_id', label: 'Lead', labelBn: 'লিড', type: 'ref', refEntity: 'leads', required: true },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea', required: true },
      { name: 'next_date', label: 'Next Follow-up', labelBn: 'পরবর্তী ফলোআপ', type: 'date' },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'done',
        options: [
          { value: 'done', label: 'Done', labelBn: 'সম্পন্ন' },
          { value: 'scheduled', label: 'Scheduled', labelBn: 'নির্ধারিত' }
        ]
      }
    ]
  },
  sms_templates: {
    key: 'sms_templates', table: 'sms_templates', label: 'Message Template', labelBn: 'মেসেজ টেমপ্লেট',
    searchFields: ['name', 'content'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Template Name', labelBn: 'টেমপ্লেটের নাম', type: 'text', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'due_reminder',
        options: [
          { value: 'due_reminder', label: 'Due Reminder', labelBn: 'বকেয়া রিমাইন্ডার' },
          { value: 'payment_confirm', label: 'Payment Confirmation', labelBn: 'পেমেন্ট নিশ্চিতকরণ' },
          { value: 'marketing', label: 'Marketing', labelBn: 'মার্কেটিং' },
          { value: 'invoice', label: 'Invoice', labelBn: 'ইনভয়েস' },
          { value: 'other', label: 'Other', labelBn: 'অন্যান্য' }
        ]
      },
      { name: 'content', label: 'Content', labelBn: 'বিষয়বস্তু', type: 'textarea', required: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  messages: {
    key: 'messages', table: 'messages', label: 'Message', labelBn: 'মেসেজ',
    searchFields: ['mobile', 'text'],
    defaultSort: 'id desc',
    fields: [
      { name: 'customer_id', label: 'Customer', labelBn: 'গ্রাহক', type: 'ref', refEntity: 'customers' },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text', required: true },
      {
        name: 'channel', label: 'Channel', labelBn: 'মাধ্যম', type: 'select', required: true, defaultValue: 'sms',
        options: [
          { value: 'sms', label: 'SMS', labelBn: 'এসএমএস' },
          { value: 'whatsapp', label: 'WhatsApp', labelBn: 'হোয়াটসঅ্যাপ' }
        ]
      },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'individual',
        options: [
          { value: 'individual', label: 'Individual', labelBn: 'একক' },
          { value: 'due_reminder', label: 'Due Reminder', labelBn: 'বকেয়া রিমাইন্ডার' },
          { value: 'payment_confirm', label: 'Payment Confirmation', labelBn: 'পেমেন্ট নিশ্চিতকরণ' },
          { value: 'marketing', label: 'Marketing', labelBn: 'মার্কেটিং' },
          { value: 'invoice', label: 'Invoice', labelBn: 'ইনভয়েস' }
        ]
      },
      { name: 'text', label: 'Message', labelBn: 'মেসেজ', type: 'textarea', required: true },
      {
        name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', defaultValue: 'draft',
        options: [
          { value: 'draft', label: 'Draft', labelBn: 'খসড়া' },
          { value: 'queued', label: 'Queued', labelBn: 'অপেক্ষমাণ' },
          { value: 'sent', label: 'Sent', labelBn: 'প্রেরিত' },
          { value: 'failed', label: 'Failed', labelBn: 'ব্যর্থ' }
        ]
      },
      { name: 'sent_at', label: 'Sent At', labelBn: 'প্রেরণের সময়', type: 'date' }
    ]
  },
  accounts: {
    key: 'accounts', table: 'accounts', label: 'Account', labelBn: 'হিসাব',
    searchFields: ['name', 'account_no', 'bank_name'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Account Name', labelBn: 'হিসাবের নাম', type: 'text', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'cash',
        options: [
          { value: 'cash', label: 'Cash', labelBn: 'নগদ' },
          { value: 'bank', label: 'Bank', labelBn: 'ব্যাংক' },
          { value: 'mobile', label: 'Mobile Banking', labelBn: 'মোবাইল ব্যাংকিং' }
        ]
      },
      { name: 'bank_name', label: 'Bank Name', labelBn: 'ব্যাংকের নাম', type: 'text' },
      { name: 'account_no', label: 'Account No', labelBn: 'হিসাব নম্বর', type: 'text' },
      { name: 'opening_balance', label: 'Opening Balance', labelBn: 'প্রারম্ভিক ব্যালেন্স', type: 'money', defaultValue: 0 },
      { name: 'balance', label: 'Current Balance', labelBn: 'বর্তমান ব্যালেন্স', type: 'money', defaultValue: 0, hideInForm: true },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  expense_categories: {
    key: 'expense_categories', table: 'expense_categories', label: 'Category', labelBn: 'খাত',
    searchFields: ['name'],
    defaultSort: 'name',
    fields: [
      { name: 'name', label: 'Category Name', labelBn: 'খাতের নাম', type: 'text', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'expense',
        options: [
          { value: 'expense', label: 'Expense', labelBn: 'খরচ' },
          { value: 'income', label: 'Income', labelBn: 'আয়' }
        ]
      },
      { name: 'status', label: 'Status', labelBn: 'স্থিতি', type: 'select', options: STATUS, defaultValue: 'active' }
    ]
  },
  transactions: {
    key: 'transactions', table: 'transactions', label: 'Transaction', labelBn: 'লেনদেন',
    searchFields: ['description', 'ref'],
    defaultSort: 'id desc',
    fields: [
      { name: 'account_id', label: 'Account', labelBn: 'হিসাব', type: 'ref', refEntity: 'accounts', required: true },
      {
        name: 'type', label: 'Type', labelBn: 'ধরন', type: 'select', required: true, defaultValue: 'expense',
        options: [
          { value: 'income', label: 'Income', labelBn: 'আয়' },
          { value: 'expense', label: 'Expense', labelBn: 'খরচ' }
        ]
      },
      { name: 'category_id', label: 'Category', labelBn: 'খাত', type: 'ref', refEntity: 'expense_categories' },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      { name: 'amount', label: 'Amount', labelBn: 'পরিমাণ', type: 'money', required: true, min: 1 },
      { name: 'description', label: 'Description', labelBn: 'বিবরণ', type: 'textarea', required: true },
      { name: 'ref', label: 'Reference', labelBn: 'রেফারেন্স', type: 'text', hideInForm: true }
    ]
  },
  account_transfers: {
    key: 'account_transfers', table: 'account_transfers', label: 'Account Transfer', labelBn: 'হিসাব স্থানান্তর',
    searchFields: ['note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'from_account_id', label: 'From Account', labelBn: 'থেকে হিসাব', type: 'ref', refEntity: 'accounts', required: true },
      { name: 'to_account_id', label: 'To Account', labelBn: 'প্রতি হিসাব', type: 'ref', refEntity: 'accounts', required: true },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true },
      { name: 'amount', label: 'Amount', labelBn: 'পরিমাণ', type: 'money', required: true, min: 1 },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' }
    ]
  },
  discounts: {
    key: 'discounts', table: 'discounts', label: 'Discount', labelBn: 'ছাড়',
    searchFields: ['reason'],
    defaultSort: 'id desc',
    fields: [
      { name: 'customer_id', label: 'Customer', labelBn: 'গ্রাহক', type: 'ref', refEntity: 'customers', required: true },
      { name: 'month', label: 'Month', labelBn: 'মাস', type: 'month' },
      { name: 'amount', label: 'Amount', labelBn: 'পরিমাণ', type: 'money', required: true, min: 1 },
      { name: 'reason', label: 'Reason', labelBn: 'কারণ', type: 'textarea', required: true },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true }
    ]
  },
  customer_documents: {
    key: 'customer_documents', table: 'customer_documents', label: 'Document', labelBn: 'ডকুমেন্ট',
    searchFields: ['title', 'file_name'],
    defaultSort: 'id desc',
    fields: [
      { name: 'customer_id', label: 'Customer', labelBn: 'গ্রাহক', type: 'ref', refEntity: 'customers', required: true },
      { name: 'title', label: 'Title', labelBn: 'শিরোনাম', type: 'text', required: true },
      { name: 'file_name', label: 'File', labelBn: 'ফাইল', type: 'text' },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' },
      { name: 'date', label: 'Date', labelBn: 'তারিখ', type: 'date', required: true }
    ]
  },
  pppoe_users: {
    key: 'pppoe_users', table: 'pppoe_users', label: 'PPPoE User', labelBn: 'পিপিপোইউ ইউজার',
    searchFields: ['username', 'mobile'],
    defaultSort: 'id desc',
    fields: [
      { name: 'username', label: 'Username', labelBn: 'ইউজারনেম', type: 'text', required: true },
      { name: 'password', label: 'Password', labelBn: 'পাসওয়ার্ড', type: 'text' },
      { name: 'customer_id', label: 'Customer', labelBn: 'গ্রাহক', type: 'ref', refEntity: 'customers' },
      { name: 'mobile', label: 'Mobile', labelBn: 'মোবাইল', type: 'text' },
      {
        name: 'status', label: 'Status', labelBn: 'স্ট্যাটাস', type: 'select', defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active', labelBn: 'এক্টিভ' },
          { value: 'inactive', label: 'Inactive', labelBn: 'ইনএক্টিভ' }
        ]
      },
      { name: 'notes', label: 'Notes', labelBn: 'নোট', type: 'textarea' }
    ]
  },
  message_requests: {
    key: 'message_requests', table: 'message_requests', label: 'Message Request', labelBn: 'মেসেজ রিকোয়েস্ট',
    searchFields: ['note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'reseller_id', label: 'Reseller', labelBn: 'রিসেলার', type: 'ref', refEntity: 'resellers', required: true },
      { name: 'quantity', label: 'Quantity (SMS)', labelBn: 'পরিমাণ (SMS)', type: 'number', required: true, defaultValue: 0 },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' },
      {
        name: 'status', label: 'Status', labelBn: 'স্ট্যাটাস', type: 'select', defaultValue: 'pending',
        options: [
          { value: 'pending', label: 'Pending', labelBn: 'অপেক্ষমাণ' },
          { value: 'approved', label: 'Approved', labelBn: 'অ্যাপ্রুভড' },
          { value: 'delivered', label: 'Delivered', labelBn: 'ডেলিভারড' },
          { value: 'rejected', label: 'Rejected', labelBn: 'বাতিল' }
        ]
      }
    ]
  },
  payment_withdraws: {
    key: 'payment_withdraws', table: 'payment_withdraws', label: 'Payment Withdraw', labelBn: 'পেমেন্ট উইথড্র',
    searchFields: ['note'],
    defaultSort: 'id desc',
    fields: [
      { name: 'reseller_id', label: 'Reseller', labelBn: 'রিসেলার', type: 'ref', refEntity: 'resellers', required: true },
      { name: 'amount', label: 'Amount', labelBn: 'পরিমাণ', type: 'number', required: true, defaultValue: 0 },
      {
        name: 'method', label: 'Method', labelBn: 'মাধ্যম', type: 'select', defaultValue: 'bkash',
        options: [
          { value: 'bkash', label: 'bKash', labelBn: 'বিকাশ' },
          { value: 'nagad', label: 'Nagad', labelBn: 'নগদ' },
          { value: 'cash', label: 'Cash', labelBn: 'ক্যাশ' }
        ]
      },
      { name: 'note', label: 'Note', labelBn: 'নোট', type: 'textarea' },
      {
        name: 'status', label: 'Status', labelBn: 'স্ট্যাটাস', type: 'select', defaultValue: 'pending',
        options: [
          { value: 'pending', label: 'Pending', labelBn: 'অপেক্ষমাণ' },
          { value: 'paid', label: 'Paid', labelBn: 'পরিশোধিত' },
          { value: 'rejected', label: 'Rejected', labelBn: 'বাতিল' }
        ]
      }
    ]
  }
}

// Entities managed by the generic CRUD IPC (customers, purchases etc. have bespoke handlers)
export const GENERIC_ENTITY_KEYS = Object.keys(ENTITIES).filter(
  (k) => !['transactions', 'customer_documents'].includes(k)
)
