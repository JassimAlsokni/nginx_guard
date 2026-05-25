import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'

import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import AttackSimulator from '@/pages/AttackSimulator'
import SecurityHeaders from '@/pages/SecurityHeaders'
import SSLTLSGuide from '@/pages/SSLTLSGuide'
import ConfigGenerator from '@/pages/ConfigGenerator'
import NginxDocs from '@/pages/NginxDocs'
import CommandTests from '@/pages/CommandTests'
import Logs from '@/pages/Logs'

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attack-simulator" element={<AttackSimulator />} />
            <Route path="/security-headers" element={<SecurityHeaders />} />
            <Route path="/ssl-tls-guide" element={<SSLTLSGuide />} />
            <Route path="/config-generator" element={<ConfigGenerator />} />
            <Route path="/nginx-docs" element={<NginxDocs />} />
            <Route path="/command-tests" element={<CommandTests />} />
            <Route path="/logs" element={<Logs />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
