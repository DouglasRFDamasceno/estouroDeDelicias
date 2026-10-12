import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';

export function CreateProduct({
  busy,
  error,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement);
  useEffect(() => {
    const modal = dialog.current;
    const returnFocus = opener.current;
    modal?.showModal();
    return () => {
      modal?.close();
      requestAnimationFrame(() => {
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
      });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="sale-dialog customer-dialog form-dialog"
      aria-labelledby="create-product-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={onSubmit}>
        <div className="form-heading">
          <h2 id="create-product-title">Novo produto</h2>
          <button
            type="button"
            className="form-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar formulário de produto"
            title="Fechar"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <fieldset disabled={busy}>
          <label htmlFor="product-name">
            Nome do produto
            <input
              id="product-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Ex.: Brownie de chocolate"
              autoFocus
            />
          </label>
          <label htmlFor="product-category">
            Categoria
            <input
              id="product-category"
              name="category"
              required
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Doces"
            />
          </label>
          <label htmlFor="product-presentation">
            Apresentação / unidade de venda
            <input
              id="product-presentation"
              name="presentation"
              required
              maxLength={80}
              placeholder="Ex.: Unidade, caixa com 6 ou 100 g"
            />
          </label>
          <label htmlFor="product-price">
            Preço de venda (R$)
            <input
              id="product-price"
              name="price"
              required
              inputMode="decimal"
              maxLength={10}
              placeholder="16,00"
              aria-describedby="product-price-help"
            />
          </label>
          <p id="product-price-help" className="fine">
            Use vírgula para centavos, sem separador de milhares.
          </p>
          <label htmlFor="product-weight">
            Peso líquido (g)
            <input
              id="product-weight"
              name="weight"
              inputMode="decimal"
              placeholder="Ex.: 50, 100 ou 150"
              aria-describedby="product-weight-help"
            />
          </label>
          <p id="product-weight-help" className="fine">
            Peso da pipoca sem a embalagem, usado no cálculo automático da receita.
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="sale-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar produto'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
