import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Users, Settings, Loader2 } from 'lucide-react';
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">管理者ダッシュボード</h1>
          <p className="mt-2 text-gray-600">教室、コンテンツ、ユーザーを管理します</p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex gap-4 -mb-px">
            <Link
              to="/admin/classrooms"
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                isActive('/admin/classrooms')
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600 hover:border-gray-300'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              教室管理
            </Link>
            <Link
              to="/admin/users"
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                isActive('/admin/users')
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5" />
              ユーザー管理
            </Link>
          </nav>
        </div>

        {/* Content */}
        <Outlet />
      </div>
    </Layout>
  );
};

export default AdminPage;
