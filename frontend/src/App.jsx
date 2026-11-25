import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import { AuthProvider } from './hooks/useFreighter';
import { useDarkMode } from './hooks/useDarkMode';
import FreighterBanner from './components/FreighterBanner';
import DemoBanner from './components/DemoBanner';
import NavBar from './components/NavBar';
import SkipToContent from './components/SkipToContent';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';

const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const IssuerDashboard = lazy(() => import('./pages/IssuerDashboard'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const IssuerOnboarding = lazy(() => import('./pages/IssuerOnboarding'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));

export default function App() {
  const [dark, setDark] = useDarkMode();
  const { pathname } = useLocation();

  return (
    <AuthProvider>
      <SkipToContent />
      <DemoBanner/>
      <NavBar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <FreighterBanner />
      <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
        <ChunkErrorBoundary key={pathname}>
        <Suspense fallback={<p role="status" style={{ textAlign: 'center', padding: '2rem' }}>Loading page…</p>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/issuer" element={<IssuerDashboard />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/apply" element={<IssuerOnboarding />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
        </Routes>
        </Suspense>
        </ChunkErrorBoundary>
      </main>
    </AuthProvider>
  );
}
