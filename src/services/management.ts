import { requireSupabase } from './supabase';
export async function removeRecord(table: 'customers' | 'sales', id: string, revision: number) {
 const result = await requireSupabase().from(table).delete().eq('id', id).eq('revision', revision).select('id').abortSignal(AbortSignal.timeout(15000)).single();
 if (result.error || result.data?.id !== id) throw result.error ?? Error('Registro alterado');
}
