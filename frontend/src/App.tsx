import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import HCPListPage from './pages/HCPListPage';
import HCPDetailPage from './pages/HCPDetailPage';
import InteractionsPage from './pages/InteractionsPage';
import TasksPage from './pages/TasksPage';
import FieldForcePage from './pages/FieldForcePage';
import AnalyticsPage from './pages/AnalyticsPage';
import CompliancePage from './pages/CompliancePage';
import CampaignsPage from './pages/CampaignsPage';
import CopilotPage from './pages/CopilotPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/hcps" element={<HCPListPage />} />
                <Route path="/hcps/:id" element={<HCPDetailPage />} />
                <Route path="/interactions" element={<InteractionsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/field-force" element={<FieldForcePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/compliance" element={<CompliancePage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
