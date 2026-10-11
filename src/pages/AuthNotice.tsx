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
          <p className="eyebrow">ETAPA 1 · ESTRUTURA E INTERFACE</p>
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
              : 'O login ainda não está integrado. Cadastro, confirmação de e-mail e recuperação de senha serão implementados com Supabase Auth na próxima etapa.'}
          </p>
          <p>A demonstração é pública, usa dados fictícios e não salva informações.</p>
          <Link className="button" to="/demo/dashboard">
            Explorar demonstração ↗
          </Link>
          <Link className="text-link" to="/">
            Voltar ao início
          </Link>
        </main>
      </IonContent>
    </IonPage>
  );
}
