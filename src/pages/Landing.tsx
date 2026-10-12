import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/AuthProvider';
import { LandingCatalog } from '../components/LandingCatalog';
import './landing.css';
export function Landing() {
  const { session, loading } = useAuth();
  const [catalogOpen, setCatalogOpen] = useState(false);
  return (
    <IonPage>
      <IonContent>
        <div className="gourmet landing-modern">
          <header className="g-header">
            <Link to="/" aria-label="Estouros de Delícias, início">
              <Brand />
            </Link>
            <nav aria-label="Menu principal">
              <a className="g-nav-flavors" href="#sabores">
                Nossos sabores
              </a>
              {!loading && (
                <Link className="g-management" to={session ? '/demo/dashboard' : '/entrar'}>
                  {session ? 'Gestão de projetos ↗' : 'Entrar ↗'}
                </Link>
              )}
              <button
                type="button"
                className="g-button compact"
                onClick={() => setCatalogOpen(true)}
                aria-haspopup="dialog"
              >
                Fazer meu pedido <span aria-hidden="true">↗</span>
              </button>
            </nav>
          </header>
          <main>
            <section className="g-hero">
              <div className="g-hero-copy">
                <p className="g-kicker">
                  <span /> PIPOCA GOURMET, FELICIDADE DE VERDADE
                </p>
                <h1>
                  Pequena no tamanho.
                  <br />
                  Gigante na
                  <br />
                  <span>delícia</span>
                  <i aria-hidden="true">!</i>
                </h1>
                <p className="g-lead">
                  Tem dias que pedem um carinho. Outros, um presente. E todos eles combinam com uma
                  pipoca gourmet feita com amor.
                </p>
                <div className="g-actions">
                  <a className="g-button" href="#sabores">
                    Encontre seu sabor <span aria-hidden="true">↓</span>
                  </a>
                  <span className="g-handwritten">Difícil é escolher um só ♡</span>
                </div>
                <div className="g-hero-details">
                  <span>50 g · 100 g · 150 g</span>
                  <span className="g-dot" />
                  <span>Pedidos pelo WhatsApp</span>
                </div>
              </div>
              <div className="g-photo-stage">
                <span className="g-orbit" aria-hidden="true" />
                <span className="g-spark s-one" aria-hidden="true">
                  ✳
                </span>
                <span className="g-spark s-two" aria-hidden="true">
                  ✦
                </span>
                <div className="g-photo-frame g-photo-gift landing-hero-frame">
                  <img
                    src="/images/pipocas-hero-960.webp"
                    srcSet="/images/pipocas-hero-480.webp 480w, /images/pipocas-hero-960.webp 960w"
                    sizes="(max-width: 700px) 90vw, (max-width: 1200px) 45vw, 540px"
                    alt="Composição ilustrativa de dois cones de pipoca gourmet com laços roxos sobre um pedestal rosa"
                    fetchPriority="high"
                    width="960"
                    height="1280"
                  />
                </div>
                <p className="landing-image-caption">
                  Composição ilustrativa criada com IA a partir dos nossos produtos.
                </p>
                <div className="g-love-stamp">
                  feito com
                  <br />
                  <strong>amor</strong>
                  <span aria-hidden="true">♥</span>
                </div>
                <div className="g-photo-note">
                  <span aria-hidden="true">♡</span>
                  <div>
                    Um laço, um carinho.<small>Uma delícia em cada pacotinho.</small>
                  </div>
                </div>
              </div>
            </section>
            <div className="g-ribbon" aria-hidden="true">
              <div>
                PIPOCA + CARINHO <b>✳</b> UM ESTOURO DE SABOR <b>✳</b> ESCOLHA SEU FAVORITO <b>✳</b>{' '}
                PIPOCA + CARINHO <b>✳</b> UM ESTOURO DE SABOR
              </div>
            </div>
            <section id="sabores" className="g-flavors g-catalog-invite">
              <div>
                <p className="g-kicker">13 SABORES. MUITAS POSSIBILIDADES.</p>
                <h2>
                  Qual vai ser o seu
                  <br />
                  <span>estouro de hoje?</span>
                </h2>
                <p className="g-catalog-description">
                  Dos clássicos aos seus novos favoritos. Busque seu sabor, salve os favoritos e
                  monte uma seleção do seu jeito. Depois, é só conversar com a gente pelo WhatsApp.
                </p>
                <button
                  type="button"
                  className="g-button"
                  onClick={() => setCatalogOpen(true)}
                  aria-haspopup="dialog"
                >
                  Explorar e montar meu pedido <span aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="g-catalog-preview" aria-hidden="true">
                <div className="g-mini-flavor vanilla">
                  <span>♡</span>
                  <strong>Ninho</strong>
                </div>
                <div className="g-mini-flavor berry">
                  <span>♥</span>
                  <strong>Morango</strong>
                </div>
                <div className="g-mini-flavor cookie">
                  <span>✦</span>
                  <strong>Oreo</strong>
                </div>
                <span className="g-catalog-count">+10 sabores para descobrir</span>
              </div>
            </section>
            <LandingCatalog isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} />
            <section className="g-moments">
              <div>
                <p className="g-kicker">NÃO É SÓ SOBRE PIPOCA</p>
                <h2>
                  É sobre deixar
                  <br />o momento <span>mais doce.</span>
                </h2>
                <p>
                  Uma pausa no dia, uma sessão de filme ou um carinho para alguém especial. Escolha
                  os sabores e fale com a gente para combinar seu pedido.
                </p>
                <button
                  type="button"
                  className="g-button"
                  onClick={() => setCatalogOpen(true)}
                  aria-haspopup="dialog"
                >
                  Vamos adoçar esse dia? ↗
                </button>
              </div>
              <div className="g-moment-stack">
                {[
                  ['01', 'Para a sua pausa', 'Seu sabor favorito e um tempinho só seu.'],
                  ['02', 'Para compartilhar', 'Filme, conversa e uma boa companhia.'],
                  ['03', 'Para presentear', 'Um pacotinho de carinho para surpreender.'],
                ].map(([number, title, text]) => (
                  <article key={number}>
                    <span>{number}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                    <b aria-hidden="true">✧</b>
                  </article>
                ))}
              </div>
            </section>
            <section className="landing-faq" aria-labelledby="faq-title">
              <div>
                <p className="g-kicker">ANTES DO PRIMEIRO ESTOURO</p>
                <h2 id="faq-title">
                  Pode perguntar.
                  <br />
                  <span>A gente te ajuda.</span>
                </h2>
                <p>Da escolha do sabor aos detalhes da entrega, combinamos tudo com você.</p>
              </div>
              <div className="landing-faq-list">
                {[
                  [
                    'Como faço meu pedido?',
                    'Abra o catálogo, escolha sabores, tamanhos e quantidades. Sua seleção vira uma mensagem no WhatsApp, onde confirmamos disponibilidade e valor final. O envio da mensagem não confirma a compra.',
                  ],
                  [
                    'Quais tamanhos posso escolher?',
                    'As embalagens do cardápio são de 50 g, 100 g e 150 g. Você pode combinar tamanhos diferentes na mesma seleção.',
                  ],
                  [
                    'Como funcionam entrega e pagamento?',
                    'Consulte pelo WhatsApp as opções para seu endereço, o frete, o prazo e as formas de pagamento antes de confirmar o pedido. O subtotal do catálogo não inclui entrega.',
                  ],
                  [
                    'Posso pedir para presente? E sobre alergênicos?',
                    'Fale com a gente sobre a ocasião e as opções de apresentação. Se você tem alergias ou restrições alimentares, consulte os ingredientes e as condições de preparo antes de pedir.',
                  ],
                ].map(([question, answer]) => (
                  <details key={question}>
                    <summary>
                      {question}
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>
            <section className="g-contact">
              <span className="g-contact-star" aria-hidden="true">
                ✳
              </span>
              <p className="g-kicker">BATEU AQUELA VONTADE?</p>
              <h2>
                Seu próximo momento
                <br />
                delicioso começa com um <em>oi.</em>
              </h2>
              <button
                type="button"
                className="g-button yellow"
                onClick={() => setCatalogOpen(true)}
                aria-haspopup="dialog"
              >
                Montar meu pedido ↗
              </button>
              <p className="landing-order-guidance">
                Escolha seus sabores e finalize pelo WhatsApp.
              </p>
              <p className="g-contact-phone">(31) 98427-7738</p>
            </section>
          </main>
          <footer className="g-footer">
            <Brand />
            <p>Feito com amor em cada estouro.</p>
            <div>
              <Link to="/entrar">Entrar</Link>
              <Link to="/criar-conta">Acesso por convite</Link>
              <Link to={session ? '/demo/dashboard' : '/entrar'}>Acessar a gestão ↗</Link>
            </div>
          </footer>
        </div>
      </IonContent>
    </IonPage>
  );
}
