import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 && typeof args[0] === 'string' && args[0].startsWith('/api/')) {
    window.location.href = '/login';
  }
  return response;
};

import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Projects from './pages/Projects'
import Payments from './pages/Payments'
import Attachments from './pages/Attachments'
import Settings from './pages/Settings'
import Billing from './pages/Billing'
import Prompts from './pages/Prompts'
import Memory from './pages/Memory'
import Policies from './pages/Policies'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="projects" element={<Projects />} />
          <Route path="payments" element={<Payments />} />
          <Route path="attachments" element={<Attachments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
          <Route path="prompts" element={<Prompts />} />
          <Route path="memory" element={<Memory />} />
          <Route path="policies" element={<Policies />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
