import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { GuidedTourModal } from './components/GuidedTourModal';
import { TrustBadge } from './components/ui/Primitives';

import { LandingPage } from './pages/LandingPage';
import { PatientLoginPage } from './pages/PatientLoginPage';
import { PatientRegisterPage } from './pages/PatientRegisterPage';
import { HospitalLoginPage } from './pages/HospitalLoginPage';
import { HospitalRegisterPage } from './pages/HospitalRegisterPage';

import { HospitalDashboard } from './pages/HospitalDashboard';
import { FindPatientsPage } from './pages/FindPatientsPage';
import { DischargeUploadPage } from './pages/DischargeUploadPage';
import { PatientDocumentsPage } from './pages/PatientDocumentsPage';
import { PatientListPage } from './pages/PatientListPage';

import { PatientDashboard } from './pages/PatientDashboard';
import { PatientRequestsPage } from './pages/PatientRequestsPage';

import { EmailActionPage } from './pages/EmailActionPage';
import { EmailStatusPage } from './pages/EmailStatusPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { AccountPage } from './pages/AccountPage';
import { SecondBrainViewer } from './components/SecondBrainViewer';
import { AuditLogViewer } from './components/AuditLogViewer';

// Protected Route Guard for Patient routes
const PatientRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, authLoading } = useAuth();
  if (authLoading) return <div className="p-8 text-center text-mutedText font-mono">Loading session...</div>;
  if (!token || role !== 'patient') return <Navigate to="/patient/login" replace />;
  return <>{children}</>;
};

// Protected Route Guard for Hospital routes
const HospitalRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, authLoading } = useAuth();
  if (authLoading) return <div className="p-8 text-center text-mutedText font-mono">Loading session...</div>;
  if (!token || role === 'patient') return <Navigate to="/hospital/login" replace />;
  return <>{children}</>;
};

const MainRoutes: React.FC = () => {
  const { token, role, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-mintGlow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-mutedText font-mono">Verifying CareBridge Session...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Root Route */}
      <Route
        path="/"
        element={
          !token ? (
            <LandingPage />
          ) : role === 'patient' ? (
            <Navigate to="/patient-portal" replace />
          ) : (
            <Navigate to="/hospital/dashboard" replace />
          )
        }
      />

      {/* Auth Routes */}
      <Route path="/patient/login" element={<PatientLoginPage />} />
      <Route path="/patient/register" element={<PatientRegisterPage />} />
      <Route path="/hospital/login" element={<HospitalLoginPage />} />
      <Route path="/hospital/register" element={<HospitalRegisterPage />} />

      {/* Patient Portal Routes */}
      <Route
        path="/patient-portal"
        element={
          <PatientRoute>
            <PatientDashboard />
          </PatientRoute>
        }
      />
      <Route
        path="/patient/requests"
        element={
          <PatientRoute>
            <PatientRequestsPage />
          </PatientRoute>
        }
      />

      {/* Hospital Portal Routes */}
      <Route
        path="/hospital/dashboard"
        element={
          <HospitalRoute>
            <HospitalDashboard />
          </HospitalRoute>
        }
      />
      <Route
        path="/hospital/find-patients"
        element={
          <HospitalRoute>
            <FindPatientsPage />
          </HospitalRoute>
        }
      />
      <Route
        path="/discharge"
        element={
          <HospitalRoute>
            <DischargeUploadPage />
          </HospitalRoute>
        }
      />
      <Route
        path="/patients/documents"
        element={
          <HospitalRoute>
            <PatientDocumentsPage />
          </HospitalRoute>
        }
      />
      <Route
        path="/reviewer-queue"
        element={<Navigate to="/patients/documents" replace />}
      />
      <Route
        path="/patients"
        element={
          <HospitalRoute>
            <PatientListPage />
          </HospitalRoute>
        }
      />

      {/* Public Action & Utility Routes */}
      <Route path="/email-action/:token" element={<EmailActionPage />} />
      <Route path="/admin/email-status" element={<EmailStatusPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route
        path="/admin/second-brain"
        element={
          <HospitalRoute>
            <SecondBrainViewer />
          </HospitalRoute>
        }
      />
      <Route path="/second-brain" element={<Navigate to="/admin/second-brain" replace />} />
      <Route path="/audit" element={<AuditLogViewer />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const AppContent: React.FC = () => {
  const { token, role } = useAuth();
  const isHospitalDesktop = token && role !== 'patient';

  return (
    <div className="min-h-screen bg-deep bg-mesh-pattern text-textLight flex flex-col font-sans selection:bg-mintGlow/30 transition-colors duration-300">
      <Navbar />
      <main className={`flex-1 transition-all duration-300 ${
        isHospitalDesktop ? 'md:pl-28 lg:pl-72 max-w-[1800px]' : 'max-w-7xl mx-auto'
      } w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8`}>
        <MainRoutes />
      </main>
      <GuidedTourModal />

      {/* Global Trust Footer */}
      <footer className={`bg-surface/80 backdrop-blur-md border-t border-mintGlow/15 py-4 px-6 text-xs text-mutedText transition-all duration-300 ${
        isHospitalDesktop ? 'md:pl-28 lg:pl-72' : ''
      }`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <strong className="text-textLight font-heading font-bold">CareBridge</strong>
            <span className="text-[11px]">| Build to Care Code-a-Thon</span>
          </div>
          <TrustBadge compact />
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <a href="/audit" className="hover:underline text-mintGlow">Audit Logs</a>
            <span className="text-mutedText">Public Data: TN Directory May 2016</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <Router>
            <AppContent />
          </Router>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
