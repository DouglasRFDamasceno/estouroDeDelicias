import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { CatalogProduct } from '../domain/catalog';
import { parseProductDraft } from '../domain/catalog';
import { requireSupabase } from '../services/supabase';
export function EditProduct({
  product,
  onClose,
  onSaved,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    saving = useRef(false),
    active = useRef(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => {
      active.current = false;
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    let values;
    try {
      values = parseProductDraft({
        name: String(data.get('name')),
        category: String(data.get('category')),
        presentation: String(data.get('presentation')),
        price: String(data.get('price')),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confira os campos');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await requireSupabase()
        .from('products')
        .update(values)
        .eq('id', product.id)
        .eq('revision', product.revision)
        .select('id')
        .abortSignal(AbortSignal.timeout(15000))
        .single();
      if (result.error || !result.data) throw result.error;
      if (active.current) onSaved();
    } catch {
      if (active.current)
        setError(
          'Não foi possível confirmar a atualização. Confira os campos, sua permissão e se já existe este produto. Feche e atualize a lista para verificar alterações de outra sessão.',
        );
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="sale-dialog customer-dialog"
      aria-labelledby="edit-product-title"
      onCancel={(e) => {
        if (saving.current) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={save}>
        <h2 id="edit-product-title">Editar produto</h2>
        <fieldset disabled={busy}>
          <label>
            Nome do produto
            <input
              name="name"
              defaultValue={product.name}
              required
              minLength={2}
              maxLength={120}
              autoFocus
            />
          </label>
          <label>
            Categoria
            <input
              name="category"
              defaultValue={product.category}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            Apresentação
            <input
              name="presentation"
              defaultValue={product.presentation}
              required
              maxLength={80}
            />
          </label>
          <label>
            Preço de venda (R$)
            <input
              name="price"
              inputMode="decimal"
              defaultValue={(product.price_cents / 100).toFixed(2).replace('.', ',')}
              required
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="sale-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
