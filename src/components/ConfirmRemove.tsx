import { useEffect, useRef, useState } from 'react';
export function ConfirmRemove({ description, remove, onClose, onRemoved }: { description: string; remove: () => Promise<void>; onClose: () => void; onRemoved: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null), saving = useRef(false), active = useRef(true);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 useEffect(() => { active.current = true; dialog.current?.showModal(); return () => { active.current = false; }; }, []);
 async function confirm() {
  if (saving.current) return; saving.current = true; setBusy(true); setError('');
  try { await remove(); if (active.current) onRemoved(); }
  catch (issue) { if (active.current) setError(issue && typeof issue === 'object' && 'code' in issue && (issue.code === '23503' || issue.code === '23001') ? 'Este registro está sendo usado. Remova seu vínculo nas receitas antes de excluir.' : 'Não foi possível confirmar a remoção. O registro pode ter sido alterado ou removido. Feche e atualize a lista antes de tentar novamente.'); }
  finally { saving.current = false; if (active.current) setBusy(false); }
 }
 return <dialog ref={dialog} className="sale-dialog customer-dialog" aria-labelledby="confirm-remove-title" onCancel={e => { if (saving.current) e.preventDefault(); else onClose(); }}><h2 id="confirm-remove-title">Remover registro?</h2><p>{description}</p><p>Essa ação não pode ser desfeita.</p>{error && <p role="alert">{error}</p>}<div className="sale-actions"><button type="button" autoFocus disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="sale-primary" disabled={busy} onClick={confirm}>{busy ? 'Removendo…' : 'Confirmar remoção'}</button></div></dialog>;
}
