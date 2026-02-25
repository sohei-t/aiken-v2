import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import TopPage from './pages/TopPage';
import LoginPage from './pages/LoginPage';
import AccountPage from './pages/AccountPage';
import ClassroomPage from './pages/ClassroomPage';
import ViewerPage from './pages/ViewerPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboard from './components/admin/AdminDashboard';
import ClassroomManager from './components/admin/ClassroomManager';
import UserManager from './components/admin/UserManager';
import ProgressTracker from './components/admin/ProgressTracker';
import ApiSettings from './components/admin/ApiSettings';
import PlanUsage from './components/admin/PlanUsage';
import ContentUploader from './components/content/ContentUploader';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<TopPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Account - Protected */}
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />

          {/* Dashboard - Protected (AIKEN v2) */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

          {/* Classroom Routes */}
          <Route path="/classroom/:classroomId" element={<ClassroomPage />} />
          <Route path="/viewer/:contentId" element={<ViewerPage />} />

          {/* Admin Routes - Protected */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="classrooms" element={<ClassroomManager />} />
            <Route path="classrooms/:classroomId/upload" element={<ContentUploader />} />
            <Route path="users" element={<UserManager />} />
            <Route path="progress" element={<ProgressTracker />} />
            <Route path="settings" element={<ApiSettings />} />
            <Route path="plan" element={<PlanUsage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
