import { all, get, nowIso, run, upsert } from '@/lib/db';
import { newId } from '@/lib/device';
import { getTenantId, requireTenantId } from '@/lib/tenant';
import type { Expense, ExpenseSource } from '@/lib/types';
import { requestSync } from '@/features/sync/syncEngine';

export const EXPENSE_CATEGORIES = ['general', 'stock', 'rent', 'salary', 'utilities', 'maintenance', 'marketing', 'transport', 'income', 'other'] as const;
const tenant = () => getTenantId() ?? '';

export interface ExpenseInput {
  id?: string;
  title: string;
  amount: number;
  category: string;
  occurred_at: string;
  note?: string | null;
  source?: ExpenseSource;
  stock_purchase_id?: string | null;
}

export function saveExpense(input: ExpenseInput, sync = true): Expense {
  const adminId = requireTenantId();
  const now = nowIso();
  const existing = input.id ? get<Expense>('SELECT * FROM expenses WHERE id = ?', [input.id]) : null;
  const row: Expense = {
    id: input.id ?? newId(),
    admin_id: adminId,
    title: input.title.trim(),
    amount: Math.round(input.amount * 100) / 100,
    category: input.category,
    occurred_at: input.occurred_at,
    note: input.note?.trim() || null,
    source: input.source ?? existing?.source ?? 'manual',
    stock_purchase_id: input.stock_purchase_id ?? existing?.stock_purchase_id ?? null,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  upsert('expenses', { ...row, is_dirty: 1 });
  if (sync) requestSync();
  return row;
}

export function deleteExpense(id: string) {
  const now = nowIso();
  run('UPDATE expenses SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [now, now, id]);
  requestSync();
}

export function getExpense(id: string): Expense | null {
  return get<Expense>('SELECT * FROM expenses WHERE id = ? AND admin_id = ?', [id, tenant()]);
}

export interface ExpenseFilter {
  from: Date;
  to: Date;
  category?: string | null;
  search?: string;
}

function whereFor(f: ExpenseFilter) {
  const clauses = ['admin_id = ?', 'deleted_at IS NULL', 'occurred_at >= ?', 'occurred_at < ?'];
  const params: (string | number)[] = [tenant(), f.from.toISOString(), f.to.toISOString()];
  if (f.category) {
    clauses.push('category = ?');
    params.push(f.category);
  }
  if (f.search?.trim()) {
    clauses.push('(title LIKE ? OR note LIKE ?)');
    const q = `%${f.search.trim()}%`;
    params.push(q, q);
  }
  return { where: clauses.join(' AND '), params };
}

export function listExpenses(f: ExpenseFilter, limit = 1000): Expense[] {
  const { where, params } = whereFor(f);
  return all<Expense>(`SELECT * FROM expenses WHERE ${where} ORDER BY occurred_at DESC LIMIT ?`, [...params, limit]);
}

export interface ExpenseSummary {
  inflow: number;
  outflow: number;
  net: number;
  count: number;
  byCategory: { category: string; total: number }[];
  byDay: { day: string; inflow: number; outflow: number }[];
}

export function expenseSummary(f: ExpenseFilter): ExpenseSummary {
  const { where, params } = whereFor(f);
  const totals = get<{ inflow: number | null; outflow: number | null; count: number }>(
    `SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
            SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow, COUNT(*) AS count
     FROM expenses WHERE ${where}`,
    params
  );
  const byCategory = all<{ category: string; total: number }>(
    `SELECT category, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS total FROM expenses WHERE ${where} GROUP BY category HAVING total > 0 ORDER BY total DESC`,
    params
  );
  const byDay = all<{ day: string; inflow: number; outflow: number }>(
    `SELECT substr(occurred_at, 1, 10) AS day,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow,
            SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow
     FROM expenses WHERE ${where} GROUP BY day ORDER BY day`,
    params
  );
  const inflow = totals?.inflow ?? 0;
  const outflow = totals?.outflow ?? 0;
  return { inflow, outflow, net: inflow - outflow, count: totals?.count ?? 0, byCategory, byDay };
}

export function expenseTotalsBetween(from: Date, to: Date) {
  const r = get<{ outflow: number | null; inflow: number | null }>(
    `SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow
     FROM expenses WHERE admin_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?`,
    [tenant(), from.toISOString(), to.toISOString()]
  );
  return { outflow: r?.outflow ?? 0, inflow: r?.inflow ?? 0 };
}
