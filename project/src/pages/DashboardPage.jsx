import { Navigate } from 'react-router-dom';

// Redirect /dashboard to /admin/dashboard
const DashboardPage = () => <Navigate to="/admin/dashboard" replace />;

export default DashboardPage;
