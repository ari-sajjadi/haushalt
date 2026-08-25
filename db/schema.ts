import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(), name: text("name").notNull(), createdAt: text("created_at").notNull(),
});
export const households = sqliteTable("households", {
  id: text("id").primaryKey(), name: text("name").notNull(), currency: text("currency").notNull().default("CHF"), locale: text("locale").notNull().default("de-CH"), createdAt: text("created_at").notNull(),
});
export const householdMembers = sqliteTable("household_members", {
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), role: text("role").notNull().default("MEMBER"), joinedAt: text("joined_at").notNull(),
}, table => [uniqueIndex("member_household_user_idx").on(table.householdId, table.userId)]);
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(), householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }), name: text("name").notNull(), icon: text("icon"), color: text("color"), isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
}, table => [uniqueIndex("category_household_name_idx").on(table.householdId, table.name)]);
export const householdSettings = sqliteTable("household_settings", {
  householdId: text("household_id").primaryKey().references(() => households.id, { onDelete: "cascade" }), monthlyIncomeCents: integer("monthly_income_cents").notNull().default(0), monthlyBudgetCents: integer("monthly_budget_cents").notNull().default(0), reminderDays: text("reminder_days").notNull().default("7,3,1"),
});
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(), householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }), categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }), payerId: text("payer_id").notNull().references(() => users.id), title: text("title").notNull(), vendor: text("vendor"), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("CHF"), dueDate: text("due_date").notNull(), paidAt: text("paid_at"), status: text("status").notNull().default("OPEN"), splitMethod: text("split_method").notNull().default("EQUAL"), notes: text("notes"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const expenseSplits = sqliteTable("expense_splits", {
  id: text("id").primaryKey(), expenseId: text("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }), userId: text("user_id").notNull().references(() => users.id), amountCents: integer("amount_cents").notNull(), settledAt: text("settled_at"),
}, table => [uniqueIndex("split_expense_user_idx").on(table.expenseId, table.userId)]);
export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(), sourceExpenseId: text("source_expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }), frequency: text("frequency").notNull(), interval: integer("interval_count").notNull().default(1), nextRunAt: text("next_run_at").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), householdId: text("household_id").notNull(), actorId: text("actor_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), metadata: text("metadata"), createdAt: text("created_at").notNull(),
});
