import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useFreighter';
import { useDarkMode } from './hooks/useDarkMode';
import FreighterBanner from './components/FreighterBanner';
import DemoBanner from './components/DemoBanner';
import NavBar from './components/NavBar';
import SkipToContent from './components/SkipToContent';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';

const Landing = lazy(() => import('./pages/Landing'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const IssuerDashboard = lazy(() => import('./pages/IssuerDashboard'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const IssuerOnboarding = lazy(() => import('./pages/IssuerOnboarding'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));

const Fallback = () => (
  <div style={{ maxWidth: 500, margin: '4rem auto', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
    Loading…
  </div>
);

export default function App() {
  const [dark, setDark] = useDarkMode();

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [dark]);

  return (
    <AuthProvider>
      <SkipToContent />
      <DemoBanner/>
      <NavBar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <FreighterBanner />
      <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
        <Routes>
          <Route path="/" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><Landing /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/patient" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><PatientDashboard /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/issuer" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><IssuerDashboard /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/verify" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><VerifyPage /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/admin" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><AdminDashboard /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/apply" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><IssuerOnboarding /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="/analytics" element={
            <Suspense fallback={<Fallback />}>
              <ErrorBoundary><AnalyticsDashboard /></ErrorBoundary>
            </Suspense>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
