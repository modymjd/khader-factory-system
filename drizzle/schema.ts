import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// --- Users & Authentication ---

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  passwordHash: text("password_hash").notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  roleId: int("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  loginMethod: varchar("loginMethod", { length: 64 }),
});

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 128 }).primaryKey(),
  userId: int("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- RBAC ---

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  resource: varchar("resource", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  description: text("description"),
});

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("role_id").notNull().references(() => roles.id),
  permissionId: int("permission_id").notNull().references(() => permissions.id),
});

// --- Employees ---

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id),
  fullName: varchar("full_name", { length: 128 }).notNull(),
  jobTitle: varchar("job_title", { length: 128 }),
  department: varchar("department", { length: 128 }),
  monthlySalary: decimal("monthly_salary", { precision: 12, scale: 2 }),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0.00"),
  annualLeaveBalance: int("annual_leave_balance").default(0),
  hireDate: timestamp("hire_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// --- Salary & Financials ---

export const salaryTransactions = mysqlTable("salary_transactions", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id),
  month: varchar("month", { length: 7 }).notNull(), // e.g., "2025-01"
  baseSalary: decimal("base_salary", { precision: 12, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0.00"),
  bonuses: decimal("bonuses", { precision: 12, scale: 2 }).default("0.00"),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid"]).default("pending").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id),
  type: mysqlEnum("type", ["annual", "sick", "unpaid", "emergency"]).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: int("days").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reason: text("reason"),
  approvedBy: int("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Products & Inventory ---

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  category: varchar("category", { length: 128 }),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  stockQuantity: int("stock_quantity").default(0).notNull(),
  productImage: text("product_image"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// --- Orders ---

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("order_number", { length: 64 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 128 }),
  customerPhone: varchar("customer_phone", { length: 32 }),
  customerId: int("customer_id"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]).default("pending").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["unpaid", "partial", "paid"]).default("unpaid").notNull(),
  notes: text("notes"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull().references(() => orders.id),
  productId: int("product_id").notNull().references(() => products.id),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
});

// --- Attendance ---

export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id),
  date: timestamp("date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  checkInMethod: varchar("check_in_method", { length: 32 }),
  checkOutMethod: varchar("check_out_method", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employeeQRCodes = mysqlTable("employee_qr_codes", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull().references(() => employees.id),
  qrCode: text("qr_code").notNull(),
  qrCodeValue: varchar("qr_code_value", { length: 256 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Audit Logs ---

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actor: int("actor").notNull().references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  resource: varchar("resource", { length: 64 }).notNull(),
  resourceId: int("resource_id"),
  changes: json("changes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  status: varchar("status", { length: 32 }).default("success"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SalaryTransaction = typeof salaryTransactions.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
