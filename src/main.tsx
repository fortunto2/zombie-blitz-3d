import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Устанавливаем фон body в черный для лучшего отображения Canvas
document.body.style.backgroundColor = '#000000';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
 
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 