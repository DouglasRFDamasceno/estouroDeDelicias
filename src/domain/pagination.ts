export const pageSizes = [10, 25, 50] as const;
export function pageRange(page: number, pageSize: number) {
  if (!Number.isSafeInteger(page) || page < 1 || !pageSizes.includes(pageSize as typeof pageSizes[number])) throw new Error('Paginação inválida.');
  const from = (page - 1) * pageSize;
  if (!Number.isSafeInteger(from + pageSize)) throw new Error('Paginação inválida.');
  return { from, to: from + pageSize - 1 };
}
export function totalPages(total: number, pageSize: number) { return Math.max(1, Math.ceil(total / pageSize)); }
