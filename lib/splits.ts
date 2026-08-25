export type SplitInput = { userId: string; value?: number };
export type SplitResult = { userId: string; cents: number };

export function splitEqual(totalCents: number, userIds: string[]): SplitResult[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error("INVALID_AMOUNT");
  if (userIds.length === 0 || new Set(userIds).size !== userIds.length) throw new Error("INVALID_MEMBERS");
  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents % userIds.length;
  return [...userIds].sort().map((userId, index) => ({ userId, cents: base + (index < remainder ? 1 : 0) }));
}

export function splitPercentage(totalCents: number, inputs: Required<SplitInput>[]): SplitResult[] {
  const sum = inputs.reduce((acc, item) => acc + item.value, 0);
  if (Math.abs(sum - 100) > 0.0001) throw new Error("PERCENTAGE_MUST_EQUAL_100");
  const raw = inputs.map(item => ({ userId: item.userId, raw: totalCents * item.value / 100 }));
  const result = raw.map(item => ({ userId: item.userId, cents: Math.floor(item.raw) }));
  let remainder = totalCents - result.reduce((acc, item) => acc + item.cents, 0);
  raw.map((item, index) => ({ index, fraction: item.raw - Math.floor(item.raw), userId: item.userId })).sort((a,b) => b.fraction - a.fraction || a.userId.localeCompare(b.userId)).forEach(item => { if (remainder-- > 0) result[item.index].cents++; });
  return result;
}

export function assertSplitTotal(totalCents: number, splits: SplitResult[]) {
  if (splits.some(split => split.cents < 0) || splits.reduce((sum, split) => sum + split.cents, 0) !== totalCents) throw new Error("SPLIT_TOTAL_MISMATCH");
}
