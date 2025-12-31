import React from 'react';
import { createRoot } from 'react-dom/client';
// Importing the Supabase client triggers env validation at startup
import './data/supabaseClient';
import App from './app/App';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
