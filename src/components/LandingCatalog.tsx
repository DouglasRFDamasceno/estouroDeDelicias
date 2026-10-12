import { useRef, useState } from 'react';
import { ClearableInput } from './ClearableInput';
import { IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import {
  landingFlavors,
  packageSizes,
  orderMessage,
  orderSubtotal,
} from '../domain/landingCatalog';
import type { LandingOrderItem } from '../domain/landingCatalog';
import { cleanOrderCustomer, validateOrder } from '../domain/publicOrder';
import { submitPublicOrder } from '../services/publicOrders';
import { OrderChallenge } from './OrderChallenge';
import { normalizeSearch } from '../domain/search';
import { money } from '../domain/format';

export function LandingCatalog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const selectionRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState(0);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [items, setItems] = useState<LandingOrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const requireChallenge = import.meta.env.VITE_ORDER_REQUIRE_TURNSTILE === 'true';
  const [challengeToken, setChallengeToken] = useState('');
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [prepared, setPrepared] = useState<{
    fingerprint: string;
    reference: number;
    message: string;
  } | null>(null);
  const submission = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const fingerprint = JSON.stringify({ customer: customerName.trim(), items });
  const currentPrepared = prepared?.fingerprint === fingerprint ? prepared : null;
  async function prepareOrder() {
    if (submitting || (requireChallenge && !challengeToken)) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const order = validateOrder({ customer: customerName, items });
      if (submission.current?.fingerprint !== fingerprint)
        submission.current = { fingerprint, requestId: crypto.randomUUID() };
      const saved = await submitPublicOrder(order, submission.current.requestId, challengeToken);
      setPrepared({
        fingerprint,
        reference: saved.reference,
        message: [
          `Olá! Meu nome é ${order.customer}. Pedido #${saved.reference}.`,
          ...orderMessage(order.items, saved.total_cents).split('\n').slice(1),
        ].join('\n'),
      });
    } catch (issue) {
      setSubmitError(
        issue instanceof Error
          ? issue.message
          : 'Não recebemos a confirmação. Tente novamente com o mesmo pedido.',
      );
    } finally {
      setSubmitting(false);
      setChallengeToken('');
      setChallengeVersion((value) => value + 1);
    }
  }
  const [announcement, setAnnouncement] = useState('');
  const visibleFlavors = landingFlavors.filter(
    (flavor) =>
      normalizeSearch(flavor.name).includes(normalizeSearch(search.trim())) &&
      (!onlyFavorites || favorites.includes(flavor.name)),
  );
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = orderSubtotal(items);

  function add(flavor: string) {
    const grams = packageSizes[size];
    setItems((current) => {
      const existing = current.find((item) => item.flavor === flavor && item.size === grams);
      return existing
        ? current.map((item) =>
            item === existing ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item,
          )
        : [...current, { flavor, size: grams, quantity: 1 }];
    });
    setAnnouncement(`${flavor}, ${grams} gramas: seleção atualizada.`);
  }

  function changeQuantity(target: LandingOrderItem, delta: number) {
    setItems((current) =>
      current
        .map((item) =>
          item.flavor === target.flavor && item.size === target.size
            ? { ...item, quantity: Math.min(99, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <IonModal
      className="g-catalog-modal modern-catalog"
      isOpen={isOpen}
      onDidDismiss={onClose}
      canDismiss={!submitting}
      aria-labelledby="catalog-title"
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle id="catalog-title">Seu próximo estouro de sabor</IonTitle>
          <IonButtons slot="end">
            <button
              type="button"
              className="g-catalog-close"
              onClick={onClose}
              disabled={submitting}
              aria-label="Fechar catálogo"
            >
              ×
            </button>
          </IonButtons>
        </IonToolbar>
        <button
          type="button"
          className="landing-selection-link"
          onClick={() => {
            selectionRef.current?.scrollIntoView({ block: 'start' });
            selectionRef.current?.focus({ preventScroll: true });
          }}
        >
          Minha seleção · {count} {count === 1 ? 'item' : 'itens'} · {money(subtotal)} ↓
        </button>
      </IonHeader>
      <IonContent>
        <div className="landing-catalog-tools">
          <label className="landing-search">
            <span>Encontre seu sabor</span>
            <ClearableInput
              label="Encontre seu sabor"
              type="search"
              placeholder="Experimente “Ninho” ou “Limão”"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={120}
              onClear={() => setSearch('')}
            />
          </label>
          <div className="landing-catalog-filters">
            <div className="g-size-picker" role="group" aria-label="Tamanho da embalagem">
              <div>
                {packageSizes.map((grams, index) => (
                  <button
                    key={grams}
                    type="button"
                    disabled={submitting}
                    aria-pressed={size === index}
                    onClick={() => setSize(index)}
                  >
                    {grams} g
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="landing-favorites-filter"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites((value) => !value)}
            >
              ♡ Favoritos ({favorites.length})
            </button>
          </div>
        </div>
        <div className="landing-shopping-layout">
          <div className="g-catalog-body">
            <p className="landing-result-count" role="status">
              {visibleFlavors.length}{' '}
              {visibleFlavors.length === 1 ? 'sabor encontrado' : 'sabores encontrados'} · preços
              para {packageSizes[size]} g
            </p>
            <div className="g-flavor-grid">
              {visibleFlavors.map((flavor) => (
                <article key={flavor.name} className={`g-flavor ${flavor.color}`}>
                  <div className="g-flavor-art" aria-hidden="true">
                    <span className="g-flavor-symbol">{flavor.symbol}</span>
                    <span className="g-art-label">ESTOUROS DE DELÍCIAS</span>
                    <span className="g-art-word">{flavor.name}</span>
                    <span className="g-art-size">GOURMET · {packageSizes[size]} g</span>
                  </div>
                  <div className="g-flavor-body">
                    <div>
                      <h3>{flavor.name}</h3>
                      <strong>{money(flavor.prices[size])}</strong>
                    </div>
                    <p className="landing-flavor-note">{flavor.note}</p>
                    <div className="landing-flavor-actions">
                      <button
                        type="button"
                        className="landing-add"
                        onClick={() => add(flavor.name)}
                        disabled={
                          submitting ||
                          items.some(
                            (item) =>
                              item.flavor === flavor.name &&
                              item.size === packageSizes[size] &&
                              item.quantity >= 99,
                          )
                        }
                      >
                        Adicionar <span aria-hidden="true">+</span>
                      </button>
                      <button
                        type="button"
                        className="landing-heart"
                        aria-label={`Favoritar ${flavor.name}`}
                        aria-pressed={favorites.includes(flavor.name)}
                        onClick={() =>
                          setFavorites((current) =>
                            current.includes(flavor.name)
                              ? current.filter((name) => name !== flavor.name)
                              : [...current, flavor.name],
                          )
                        }
                      >
                        {favorites.includes(flavor.name) ? '♥' : '♡'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!visibleFlavors.length && (
              <div className="landing-empty">
                <span aria-hidden="true">♡</span>
                <h3>Nenhum sabor por aqui ainda.</h3>
                <p>
                  {onlyFavorites
                    ? 'Marque seus sabores favoritos com o coração ou veja o catálogo completo.'
                    : 'Tente outro nome para encontrar sua próxima delícia.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setOnlyFavorites(false);
                  }}
                >
                  Ver todos os sabores
                </button>
              </div>
            )}
            <p className="g-price-note">
              Preços do cardápio. Confirme disponibilidade e valor final pelo WhatsApp. Os cartões
              são ilustrações gráficas. Sua seleção e favoritos ficam nesta página até recarregar.
            </p>
            <div className="g-menu-link">
              <a
                className="g-underlined"
                href="/images/cardapio-gourmet.jpeg"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir cardápio original ↗
              </a>
            </div>
          </div>
          <aside
            ref={selectionRef}
            tabIndex={-1}
            className="landing-order"
            aria-labelledby="selection-title"
          >
            <p className="g-kicker">UM POUQUINHO DE CADA</p>
            <h2 id="selection-title">
              Sua seleção <span>({count})</span>
            </h2>
            <p className="landing-order-intro">
              Combine sabores e tamanhos. A gente confirma os detalhes na conversa.
            </p>
            {!items.length ? (
              <p className="landing-order-empty">
                Seu próximo favorito está logo ali. Toque em “Adicionar” para começar.
              </p>
            ) : (
              <>
                <ul className="landing-order-items">
                  {items.map((item) => (
                    <li key={`${item.flavor}-${item.size}`}>
                      <div>
                        <strong>{item.flavor}</strong>
                        <small>
                          {item.size} g · {money(orderSubtotal([item]))}
                        </small>
                      </div>
                      <div className="landing-quantity">
                        <button
                          type="button"
                          disabled={submitting}
                          aria-label={`Diminuir quantidade de ${item.flavor}, ${item.size} g`}
                          onClick={() => changeQuantity(item, -1)}
                        >
                          −
                        </button>
                        <span aria-label={`${item.quantity} unidades`}>{item.quantity}</span>
                        <button
                          type="button"
                          disabled={submitting || item.quantity >= 99}
                          aria-label={`Aumentar quantidade de ${item.flavor}, ${item.size} g`}
                          onClick={() => changeQuantity(item, 1)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="landing-subtotal" aria-live="polite">
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <p className="landing-order-disclaimer">
                  Frete não incluído. Esta seleção não reserva produtos nem confirma a compra.
                </p>
                <label className="landing-search">
                  <span>Seu nome</span>
                  <input
                    disabled={submitting}
                    autoComplete="name"
                    maxLength={120}
                    value={customerName}
                    onChange={(event) => setCustomerName(cleanOrderCustomer(event.target.value))}
                    placeholder="Como podemos chamar você?"
                  />
                </label>
                <p className="landing-order-disclaimer">
                  Seu nome e os itens ficam disponíveis para nossa equipe por até 7 dias para
                  confirmar seu pedido. A compra só é confirmada na conversa.
                </p>
                {currentPrepared ? (
                  <>
                    <p role="status">
                      Pedido #{currentPrepared.reference} preparado. Envie a mensagem pelo WhatsApp
                      para combinar os detalhes.
                    </p>
                    <a
                      className="g-button"
                      href={`https://wa.me/5531984277738?text=${encodeURIComponent(currentPrepared.message)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Enviar pelo WhatsApp ↗
                    </a>
                  </>
                ) : (
                  <>
                    {requireChallenge && (
                      <OrderChallenge key={challengeVersion} onToken={setChallengeToken} />
                    )}
                    <button
                      type="button"
                      className="g-button"
                      onClick={prepareOrder}
                      disabled={
                        submitting ||
                        (requireChallenge && !challengeToken) ||
                        customerName.trim().length < 2
                      }
                    >
                      {submitting ? 'Preparando pedido…' : 'Preparar pedido para WhatsApp'}
                    </button>
                  </>
                )}
                {submitError && <p role="alert">{submitError}</p>}
                {!currentPrepared && (
                  <a
                    className="landing-clear"
                    href={`https://wa.me/5531984277738?text=${encodeURIComponent(
                      `${customerName.trim() ? `Meu nome é ${customerName.trim()}.\n` : ''}${orderMessage(items)}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Combinar diretamente pelo WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  className="landing-clear"
                  disabled={submitting}
                  onClick={() => {
                    setItems([]);
                    setAnnouncement('Seleção limpa.');
                  }}
                >
                  Limpar seleção
                </button>
              </>
            )}
            <p className="landing-sr-only" role="status" aria-live="polite">
              {announcement}
            </p>
          </aside>
        </div>
      </IonContent>
    </IonModal>
  );
}
