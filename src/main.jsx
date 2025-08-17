import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TranslationProvider } from './hooks/useTranslation.jsx';
import './index.css';

// Initialize React app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TranslationProvider>
      <App />
    </TranslationProvider>
  </React.StrictMode>
);
