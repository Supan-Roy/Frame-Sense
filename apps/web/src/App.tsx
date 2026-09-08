import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Screenings from './pages/Screenings';
import Findings from './pages/Findings';
import Settings from './pages/Settings';
import ScreeningRoom from './pages/ScreeningRoom';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Screening Room Player - Outside AppShell Sidebar */}
        <Route path="/screening/:token" element={<ScreeningRoom />} />

        {/* Studio Admin Pages - Inside AppShell Sidebar */}
        <Route
          path="/*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/screenings" element={<Screenings />} />
                <Route path="/findings" element={<Findings />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </Router>
  );
}
