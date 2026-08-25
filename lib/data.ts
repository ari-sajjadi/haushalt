import { and, asc, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, categories, expenseSplits, expenses, householdMembers, householdSettings, households, recurringExpenses, users } from "@/db/schema";
import { splitEqual } from "@/lib/splits";

const categorySeeds = [
  ["Wohnen", "⌂", "#173d3a"], ["Mobilität", "↗", "#5d8498"], ["Versicherungen", "✚", "#ef8d77"], ["Kommunikation", "⌁", "#8fc9ba"], ["Abos & Software", "◉", "#816f9a"], ["Haushalt & Alltag", "◫", "#e7bd62"], ["Familie & Kinder", "♙", "#d88ca3"], ["Sparen & Vorsorge", "◇", "#6a9d7e"], ["Arbeit & Weiterbildung", "▤", "#6f8fb4"], ["Gesundheit", "＋", "#b76d68"], ["Ferien & Reisen", "✈", "#59a6a6"], ["Steuern", "%", "#8a765d"], ["Sonstiges", "•••", "#9aa5a1"],
] as const;

export type Identity = { email: string; name: string };
export function identityFrom(request: Request): Identity {
  const forwardedEmail = request.headers.get("oai-authenticated-user-email");
  if (!forwardedEmail && process.env.NODE_ENV === "production") throw new Error("AUTH_REQUIRED");
  const email = forwardedEmail || "demo@haushalt.local";
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  let name = email.split("@")[0];
  if (encoded && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") { try { name = decodeURIComponent(encoded); } catch {} }
  return { email: email.toLowerCase(), name };
}

export async function contextFor(identity: Identity) {
  const db = getDb();
  let user = (await db.select().from(users).where(eq(users.email, identity.email)).limit(1))[0];
  if (!user) {
    const now = new Date().toISOString(); const userId = crypto.randomUUID(); const householdId = crypto.randomUUID();
    await db.batch([
      db.insert(users).values({ id: userId, email: identity.email, name: identity.name, createdAt: now }),
      db.insert(households).values({ id: householdId, name: `${identity.name}s Haushalt`, currency: "CHF", locale: "de-CH", createdAt: now }),
      db.insert(householdMembers).values({ householdId, userId, role: "OWNER", joinedAt: now }),
      db.insert(householdSettings).values({ householdId, monthlyIncomeCents: 0, monthlyBudgetCents: 0, reminderDays: "7,3,1" }),
      ...categorySeeds.map(([name, icon, color]) => db.insert(categories).values({ id: crypto.randomUUID(), householdId, name, icon, color, isSystem: true })),
    ]);
    user = { id: userId, email: identity.email, name: identity.name, createdAt: now };
  }
  const membership = (await db.select({ householdId: householdMembers.householdId, role: householdMembers.role, householdName: households.name }).from(householdMembers).innerJoin(households, eq(households.id, householdMembers.householdId)).where(eq(householdMembers.userId, user.id)).limit(1))[0];
  if (!membership) throw new Error("HOUSEHOLD_NOT_FOUND");
  return { db, user, ...membership };
}

export async function dashboard(identity: Identity) {
  const ctx = await contextFor(identity); const today = new Date().toISOString().slice(0, 10);
  await ctx.db.update(expenses).set({ status: "OVERDUE", updatedAt: new Date().toISOString() }).where(and(eq(expenses.householdId, ctx.householdId), eq(expenses.status, "OPEN"), lt(expenses.dueDate, today)));
  const [expenseRows, categoryRows, memberRows, settingsRows] = await Promise.all([
    ctx.db.select({ id: expenses.id, title: expenses.title, vendor: expenses.vendor, amountCents: expenses.amountCents, dueDate: expenses.dueDate, paidAt: expenses.paidAt, status: expenses.status, splitMethod: expenses.splitMethod, notes: expenses.notes, categoryId: expenses.categoryId, category: categories.name, icon: categories.icon, payerId: expenses.payerId, payer: users.name }).from(expenses).leftJoin(categories, eq(categories.id, expenses.categoryId)).innerJoin(users, eq(users.id, expenses.payerId)).where(eq(expenses.householdId, ctx.householdId)).orderBy(asc(expenses.dueDate)),
    ctx.db.select().from(categories).where(eq(categories.householdId, ctx.householdId)).orderBy(asc(categories.name)),
    ctx.db.select({ id: users.id, name: users.name, email: users.email, role: householdMembers.role }).from(householdMembers).innerJoin(users, eq(users.id, householdMembers.userId)).where(eq(householdMembers.householdId, ctx.householdId)),
    ctx.db.select().from(householdSettings).where(eq(householdSettings.householdId, ctx.householdId)).limit(1),
  ]);
  const settings = settingsRows[0]; const currentMonth = today.slice(0, 7);
  const monthExpenses = expenseRows.filter(x => x.dueDate.startsWith(currentMonth));
  const spentCents = monthExpenses.filter(x => x.status !== "CANCELLED").reduce((sum, x) => sum + x.amountCents, 0);
  const openCents = expenseRows.filter(x => x.status === "OPEN" || x.status === "OVERDUE").reduce((sum, x) => sum + x.amountCents, 0);
  return { user: ctx.user, household: { id: ctx.householdId, name: ctx.householdName, role: ctx.role }, settings, categories: categoryRows, members: memberRows, expenses: expenseRows, summary: { incomeCents: settings?.monthlyIncomeCents ?? 0, budgetCents: settings?.monthlyBudgetCents ?? 0, spentCents, openCents, availableCents: (settings?.monthlyIncomeCents ?? 0) - spentCents } };
}

export async function createExpense(identity: Identity, input: { title: string; vendor?: string; amountCents: number; dueDate: string; categoryId?: string; payerId?: string; notes?: string; memberIds?: string[]; recurrence?: string }) {
  const ctx = await contextFor(identity); const now = new Date().toISOString(); const id = crypto.randomUUID();
  const members = await ctx.db.select({ id: householdMembers.userId }).from(householdMembers).where(eq(householdMembers.householdId, ctx.householdId));
  const allowed = new Set(members.map(x => x.id)); const memberIds = (input.memberIds?.length ? input.memberIds : members.map(x => x.id)).filter(x => allowed.has(x));
  if (!memberIds.length) throw new Error("SPLIT_MEMBERS_REQUIRED");
  const splitRows = splitEqual(input.amountCents, memberIds);
  await ctx.db.batch([
    ctx.db.insert(expenses).values({ id, householdId: ctx.householdId, categoryId: input.categoryId || null, payerId: allowed.has(input.payerId || "") ? input.payerId! : ctx.user.id, title: input.title, vendor: input.vendor || null, amountCents: input.amountCents, dueDate: input.dueDate, status: "OPEN", splitMethod: "EQUAL", notes: input.notes || null, createdAt: now, updatedAt: now }),
    ...splitRows.map(split => ctx.db.insert(expenseSplits).values({ id: crypto.randomUUID(), expenseId: id, userId: split.userId, amountCents: split.cents })),
    ctx.db.insert(auditLogs).values({ id: crypto.randomUUID(), householdId: ctx.householdId, actorId: ctx.user.id, action: "EXPENSE_CREATED", entityType: "Expense", entityId: id, metadata: JSON.stringify({ amountCents: input.amountCents }), createdAt: now }),
  ]);
  if (input.recurrence && input.recurrence !== "NONE") { const next = new Date(`${input.dueDate}T12:00:00Z`); if (input.recurrence === "YEARLY") next.setUTCFullYear(next.getUTCFullYear()+1); else next.setUTCMonth(next.getUTCMonth()+(input.recurrence === "QUARTERLY"?3:1)); await ctx.db.insert(recurringExpenses).values({ id: crypto.randomUUID(), sourceExpenseId: id, frequency: input.recurrence, interval: 1, nextRunAt: next.toISOString().slice(0,10), active: true }); }
  return id;
}

export async function updateExpense(identity: Identity, id: string, patch: { status?: string; title?: string; amountCents?: number; dueDate?: string }) {
  const ctx = await contextFor(identity); const existing = (await ctx.db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, ctx.householdId))).limit(1))[0]; if (!existing) throw new Error("NOT_FOUND");
  const status = patch.status || existing.status; await ctx.db.update(expenses).set({ ...patch, status, paidAt: status === "PAID" ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }).where(eq(expenses.id, id));
  await ctx.db.insert(auditLogs).values({ id: crypto.randomUUID(), householdId: ctx.householdId, actorId: ctx.user.id, action: "EXPENSE_UPDATED", entityType: "Expense", entityId: id, metadata: JSON.stringify(patch), createdAt: new Date().toISOString() });
}

export async function deleteExpense(identity: Identity, id: string) { const ctx = await contextFor(identity); await ctx.db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, ctx.householdId))); }
export async function updateSettings(identity: Identity, input: { incomeCents: number; budgetCents: number }) { const ctx = await contextFor(identity); await ctx.db.update(householdSettings).set({ monthlyIncomeCents: input.incomeCents, monthlyBudgetCents: input.budgetCents }).where(eq(householdSettings.householdId, ctx.householdId)); }
export async function addMember(identity: Identity, input: { name: string; email: string }) { const ctx = await contextFor(identity); const now=new Date().toISOString(); let member=(await ctx.db.select().from(users).where(eq(users.email,input.email.toLowerCase())).limit(1))[0]; if(!member){member={id:crypto.randomUUID(),email:input.email.toLowerCase(),name:input.name,createdAt:now};await ctx.db.insert(users).values(member);} await ctx.db.insert(householdMembers).values({householdId:ctx.householdId,userId:member.id,role:"MEMBER",joinedAt:now}).onConflictDoNothing(); }
