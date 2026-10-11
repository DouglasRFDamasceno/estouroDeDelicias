import { useState } from 'react';
import { logoutCurrentSession } from '../services/logout';
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true); setFailed(false);
    try { await logoutCurrentSession(); }
    catch { setFailed(true); setBusy(false); }
  }
  return <div className="management-logout"><button type="button" onClick={logout} disabled={busy} className="management-logout-button">{busy ? 'Saindo…' : 'Sair'}</button>{failed && <p role="alert">Não foi possível encerrar a sessão. Confira a conexão e tente novamente.</p>}</div>;
}
