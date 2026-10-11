import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AuthNotice } from './pages/AuthNotice';
import { Login } from './pages/Login';
import { AuthProvider } from './auth/AuthProvider';
import { Register } from './pages/Register';
import { Account } from './pages/Account';
import { AuthCallback } from './pages/AuthCallback';
import { Demo } from './pages/Demo';
export function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route path="/" element={<Landing />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/criar-conta" element={<Register />} />
            <Route path="/conta" element={<Account />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/invite" element={<AuthCallback invitation />} />
            <Route path="/auth/recovery" element={<AuthCallback recovery />} />
            <Route path="/demo/:section" element={<Demo />} />
            <Route path="*" element={<AuthNotice notFound />} />
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}
