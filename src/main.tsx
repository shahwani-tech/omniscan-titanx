import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './assets/fonts/fonts.css';
import App from './App.tsx';
import './index.css';
import { initGlobalWheelControl } from './utils/wheelControl.ts';

// Initialize context-aware mouse wheel control across the application
initGlobalWheelControl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
