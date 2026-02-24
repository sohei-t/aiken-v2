import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { BookOpen, Users, LayoutDashboard, BarChart3, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';

const AdminPage = () => {
  const location = useLocation();
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const tabs = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
    { to: '/admin/classrooms', icon: BookOpen, label: '教室管理' },
    { to: '/admin/users', icon: Users, label: 'ユーザー管理' },
    { to: '/admin/progress', icon: BarChart3, label: '進捗管理' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">管理画面</h1>
          <p className="mt-2 text-gray-600">教室、コンテンツ、ユーザーを管理します</p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex gap-4 -mb-px overflow-x-auto">
            {tabs.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  isActive(to)
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-blue-600 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Content */}
        <Outlet />
      </div>
    </Layout>
  );
};

export default AdminPage;
