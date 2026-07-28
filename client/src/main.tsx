import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { primeConfig } from './ui/prime/config';
import './ui/prime/theme.css';
import App from './App';
import { registerWebMcpTools } from './webmcp';

void registerWebMcpTools();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrimeReactProvider value={primeConfig}>
      <App />
    </PrimeReactProvider>
  </React.StrictMode>,
);
