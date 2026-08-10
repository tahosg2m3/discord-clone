import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');

  return (
    <div className="h-screen bg-gray-900 flex items-center justify-center">
      {mode === 'login' && <LoginForm onSwitchToRegister={() => setMode('register')} onForgotPassword={() => setMode('forgot-password')} />}
      {mode === 'register' && <RegisterForm onSwitchToLogin={() => setMode('login')} />}
      {mode === 'forgot-password' && <ForgotPasswordForm onBackToLogin={() => setMode('login')} />}
    </div>
  );
}
