type Row=Record<string,unknown>;

// The owner requested a fresh displayed purchase-total baseline while preserving
// every historical purchase, medicine record and current stock quantity.
export const purchaseTotalBaseline='2026-11-03 15:45:17';

export function purchasesAfterTotalBaseline(rows:Row[]){
 return rows.filter(row=>String(row.created_at||'')>purchaseTotalBaseline);
}
