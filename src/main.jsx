/*
  This is the very first code that runs when the app loads.
  It mounts the React app into the browser, enables client-side routing,
  and loads the global styling used across the whole application.
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './design-system.css';

// BrowserRouter gives every screen access to URL-based navigation.
// React.StrictMode helps detect problems during development by running logic twice.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
