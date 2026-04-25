import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerWebMcpTools } from './webmcp';

void registerWebMcpTools();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
