import React, { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';

export default function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  function handleAuthSuccess(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleLogout() {
    setUser(null);
    setAuthView('login');
  }

  // If we have a token + user, go straight to Chat.
  const hasToken = !!localStorage.getItem('token');

  if (user && hasToken) {
    return <Chat user={user} onLogout={handleLogout} />;
  }

  if (authView === 'register') {
    return (
      <Register
        onAuthSuccess={handleAuthSuccess}
        switchToLogin={() => setAuthView('login')}
      />
    );
  }

  return (
    <Login
      onAuthSuccess={handleAuthSuccess}
      switchToRegister={() => setAuthView('register')}
    />
  );
}
