import { useId } from 'react';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonPage,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/AuthProvider';
import { Dashboard } from '../components/Dashboard';
import { Costs } from '../components/Costs';
import { Customers } from '../components/Customers';
import { Sales } from '../components/Sales';
import { Products } from '../components/Products';
import { LogoutButton } from '../components/LogoutButton';
import { ManagementRefresh } from '../components/ManagementRefresh';
const sections = [
  ['dashboard', 'Visão geral', '◫'],
  ['produtos', 'Produtos', '◇'],
  ['custos', 'Custos e despesas', '↘'],
  ['clientes', 'Clientes', '♧'],
  ['vendas', 'Vendas', '↗'],
];
export function Demo() {
  const contentId = `management-${useId().replace(/:/g, '')}`;
  const { session, identity, identityLoading, refreshIdentity } = useAuth();
  const firstName = identity?.firstName;

  const { section = 'dashboard' } = useParams();
  const location = useLocation();
  const title = sections.find(([key]) => key === section)?.[1];
  return (
    <IonPage className="management-shell">
      <IonSplitPane contentId={contentId} when="lg">
        <IonMenu contentId={contentId} type="overlay">
          <IonHeader>
            <IonToolbar>
              <div className="menu-brand">
                <Brand />
              </div>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div className="workspace">
              <span className="workspace-avatar">
                {firstName ? firstName.slice(0, 2).toUpperCase() : 'ED'}
              </span>
              <div>
                {firstName ||
                  (session ? (
                    identityLoading ? (
                      <span role="status" aria-label="Carregando nome">
                        …
                      </span>
                    ) : (
                      <button type="button" onClick={refreshIdentity}>
                        Recarregar nome
                      </button>
                    )
                  ) : (
                    'Visitante'
                  ))}
                <small>{session ? 'Seu espaço de gestão' : 'Acesso à gestão'}</small>
              </div>
            </div>
            <p className="nav-caption">GERENCIAMENTO</p>
            <IonList lines="none">
              {sections.map(([key, label, icon]) => (
                <IonMenuToggle key={key} autoHide={false}>
                  <IonItem
                    routerLink={`/demo/${key}`}
                    routerDirection="root"
                    className={section === key ? 'active' : ''}
                    aria-current={section === key ? 'page' : undefined}
                  >
                    <span slot="start" className="nav-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <IonLabel>{label}</IonLabel>
                  </IonItem>
                </IonMenuToggle>
              ))}
            </IonList>
            <div className="sidebar-note">
              <span aria-hidden="true">✳</span>
              <h3>Um passo de cada vez.</h3>
              <p>Organize suas delícias, acompanhe cada conquista e faça novas ideias crescerem.</p>
              <Link to="/">← Voltar ao site</Link>
            </div>
          </IonContent>
        </IonMenu>
        <div id={contentId} className="ion-page">
          <IonHeader className="ion-no-border">
            <IonToolbar className="management-toolbar">
              <IonButtons slot="start">
                <IonMenuButton
                  className="management-section-menu"
                  aria-label={`Abrir menu — ${title ?? 'Página não encontrada'}`}
                >
                  <span aria-hidden="true">☰</span>
                  <span className="management-section-menu-label" aria-hidden="true">
                    {title ?? 'Página não encontrada'}
                  </span>
                </IonMenuButton>
              </IonButtons>
              <IonTitle className="management-desktop-title">
                {title ?? 'Página não encontrada'}
              </IonTitle>
              <div slot="end" className="management-top-actions">
                {session && <LogoutButton />}
                {session && (
                  <Link
                    to={`/conta?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
                    className="management-profile-link"
                  >
                    Meu perfil
                  </Link>
                )}
                <Link to="/" className="management-site-link">
                  Voltar ao site <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </IonToolbar>
          </IonHeader>
          <ManagementRefresh>
            <div className="demo-content">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ESTOURO DE DELÍCIAS</p>
                  <h1>
                    {section === 'dashboard'
                      ? 'Seu negócio, em perspectiva.'
                      : (title ?? 'Este endereço não existe.')}
                  </h1>
                  <p>
                    {section === 'dashboard'
                      ? 'Vendas, recebimentos e custos consultados nos registros do seu negócio.'
                      : section === 'produtos'
                        ? 'Organize seus produtos e cadastre novas delícias.'
                        : section === 'vendas'
                          ? 'Registre suas vendas e acompanhe os recebimentos.'
                          : section === 'clientes'
                            ? 'Cuide de cada cliente e facilite suas próximas vendas.'
                            : section === 'custos'
                              ? 'Conheça o custo de cada receita, ingrediente por ingrediente.'
                              : 'Este endereço não corresponde a uma seção da gestão. Escolha uma opção no menu.'}
                  </p>
                </div>
              </div>
              {section === 'dashboard' ? (
                <Dashboard />
              ) : section === 'produtos' ? (
                <Products />
              ) : section === 'custos' ? (
                <Costs />
              ) : section === 'clientes' ? (
                <Customers />
              ) : section === 'vendas' ? (
                <Sales />
              ) : (
                <section className="panel">
                  <p>Escolha uma seção no menu.</p>
                  <Link to="/demo/dashboard">Ir à visão geral</Link>
                </section>
              )}
              <p className="demo-footer">Gestão integrada · Conexão com a internet necessária</p>
            </div>
          </ManagementRefresh>
        </div>
      </IonSplitPane>
    </IonPage>
  );
}
