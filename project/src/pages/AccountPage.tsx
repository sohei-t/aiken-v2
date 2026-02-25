import { User, Mail, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';

const AccountPage: React.FC = () => {
  const { userData, isAdmin } = useAuth();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">アカウント設定</h1>

        {/* プロフィール */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">プロフィール</h2>
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                <Crown className="w-4 h-4" />
                管理者
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">表示名</p>
                <p className="font-medium text-gray-900">{userData?.displayName || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">メールアドレス</p>
                <p className="font-medium text-gray-900">{userData?.email || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AccountPage;
