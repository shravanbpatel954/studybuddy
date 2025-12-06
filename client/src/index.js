import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/variables.css';
import './styles/utilities.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/mobile-enhancements.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// 🔥 OPTION 1 FIX: Disable all service workers (prevents API interception on Render)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

reportWebVitals();




