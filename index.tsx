
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeMsal } from './services/authService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Initialize MSAL BEFORE React renders.
// handleRedirectPromise() processes the auth response (if returning from Azure AD redirect).
initializeMsal().then(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch((err) => {
  console.error('MSAL init failed:', err);
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
