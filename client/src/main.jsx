// client/src/main.jsx
// ToastProvider wraps the whole app OUTSIDE the router so any page can call
// useToast() without re-mounting the toast container on navigation. §9.4
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/ErrorBoundary'; // Phase 2: catch render errors
import './index.css'; // Tailwind directives

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
