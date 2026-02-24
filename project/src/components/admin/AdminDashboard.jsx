import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { BookOpen, Users, FileText, BarChart3, Loader2, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getCustomerUsers, getCustomerProgress } from '../../services/firebase';

const StatCard = ({ icon: Icon, iconBg, iconColor, label, value, loading }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-300 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { customerId } = useAuth();
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;

    const fetchData = async () => {
      try {
        const [statsData, usersData] = await Promise.all([
          getDashboardStats(customerId),
          getCustomerUsers(customerId),
        ]);
        setStats(statsData);
        setMembers(usersData);

        const progressData = await getCustomerProgress(customerId);
        setProgress(progressData);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  const nonAdminMembers = members.filter(m => m.role !== 'admin');
  const avgProgress = nonAdminMembers.length > 0
    ? Math.round(nonAdminMembers.reduce((sum, m) => sum + (progress[m.id]?.progressPercent || 0), 0) / nonAdminMembers.length)
    : 0;

  return (
    <div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={BookOpen} iconBg="bg-purple-100" iconColor="text-purple-600" label="教室数" value={stats?.classroomCount ?? '-'} loading={loading} />
        <StatCard icon={FileText} iconBg="bg-indigo-100" iconColor="text-indigo-600" label="コンテンツ数" value={stats?.contentCount ?? '-'} loading={loading} />
        <StatCard icon={Users} iconBg="bg-blue-100" iconColor="text-blue-600" label="メンバー数" value={stats?.userCount ?? '-'} loading={loading} />
        <StatCard icon={BarChart3} iconBg="bg-green-100" iconColor="text-green-600" label="平均進捗率" value={loading ? '-' : `${avgProgress}%`} loading={loading} />
      </div>

      {/* Members Progress Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">メンバー進捗</h2>
          <Link
            to="/admin/users"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            ユーザー管理
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">メンバーがいません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3 pr-4">名前</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3 px-4">役割</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3 px-4">進捗</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3 pl-4">視聴数</th>
                </tr>
              </thead>
              <tbody>
                {members.map(user => {
                  const p = progress[user.id] || { watchedCount: 0, totalCount: 0, progressPercent: 0 };
                  return (
                    <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{user.displayName || user.email?.split('@')[0]}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role === 'admin' ? '管理者' : 'メンバー'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${p.progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${p.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{p.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 pl-4 text-sm text-gray-500 text-right">
                        {p.watchedCount}/{p.totalCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/admin/classrooms"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-purple-600" />
            <span className="text-gray-700">教室を管理</span>
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-gray-700">ユーザーを管理</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-gray-700">教室一覧を見る</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
