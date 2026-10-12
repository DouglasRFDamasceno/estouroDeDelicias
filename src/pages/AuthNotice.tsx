import { IonContent, IonPage } from '@ionic/react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from '../components/Brand';
export function AuthNotice({ notFound = false }: { notFound?: boolean }) {
  const location = useLocation();
  return (
    <IonPage>
      <IonContent>
        <main className="notice">
          <Link to="/">
            <Brand />
          </Link>
          <p className="eyebrow">ESTOUROS DE DELÍCIAS</p>
          <h1>
            {notFound
              ? 'Página não encontrada'
              : location.pathname === '/criar-conta'
                ? 'Criar conta'
                : 'Entrar'}
          </h1>
          <p>
            {notFound
              ? 'Este endereço não está disponível.'
              : 'Entre com sua conta para acessar a gestão. Novos acessos são concedidos por convite.'}
          </p>
          <p>A gestão requer uma conta autorizada. Você pode conhecer nossos sabores no site.</p>
          <Link className="button" to="/entrar">
            Acessar a gestão ↗
          </Link>
          <Link className="text-link" to="/">
            Voltar ao início
          </Link>
        </main>
      </IonContent>
    </IonPage>
  );
}
