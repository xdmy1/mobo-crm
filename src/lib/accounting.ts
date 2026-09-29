// Rapoarte contabile calculate din tranzacții (debit/credit).

import { prisma } from "./db";
import type { AccountType } from "@prisma/client";

export interface AccountBalance {
  id: number;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  /** sold normalizat: pozitiv pe partea „naturală” a contului */
  balance: number;
}

const DEBIT_NORMAL: AccountType[] = ["ASSET", "EXPENSE", "WITHDRAWAL"];

export async function accountBalances(
  from?: Date,
  to?: Date
): Promise<AccountBalance[]> {
  const dateFilter =
    from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.transaction.findMany({ where: dateFilter }),
  ]);

  const map = new Map<number, { debit: number; credit: number }>();
  for (const t of transactions) {
    const d = map.get(t.debitAccountId) ?? { debit: 0, credit: 0 };
    d.debit += t.amount;
    map.set(t.debitAccountId, d);
    const c = map.get(t.creditAccountId) ?? { debit: 0, credit: 0 };
    c.credit += t.amount;
    map.set(t.creditAccountId, c);
  }

  return accounts.map((a) => {
    const { debit, credit } = map.get(a.id) ?? { debit: 0, credit: 0 };
    const balance = DEBIT_NORMAL.includes(a.type)
      ? debit - credit
      : credit - debit;
    return { id: a.id, name: a.name, type: a.type, debit, credit, balance };
  });
}
