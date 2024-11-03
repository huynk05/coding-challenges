import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { GameProvider } from './contexts/GameContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>
); 