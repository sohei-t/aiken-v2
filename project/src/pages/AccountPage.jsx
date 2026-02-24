import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Crown, Loader2, FlaskConical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { testUnsubscribe } from '../services/firebase';
// TODO: Stripe本番接続時に以下を有効化
// import { createPortalSession } from '../services/stripeApi';
import Layout from '../components/layout/Layout';

const AccountPage = () => {
  const { user, userData, isSubscriber, isAdmin, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCancelSubscription = async () => {
    if (!window.confirm('PRO会員を解約しますか？')) return;

    setLoading(true);
    setError(null);
    try {
      // テストモード: 直接 Firestore を更新
      await testUnsubscribe(user.uid);
      await refreshUserData();

      // TODO: Stripe本番接続時は以下に差し替え
      // const { url } = await createPortalSession();
      // if (url) window.location.href = url;
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError('解約に失敗しました。しばらく経ってからお試しください。');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (isAdmin) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          <Crown className="w-4 h-4" />
          管理者
        </span>
      );
    }
    if (isSubscriber) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <Crown className="w-4 h-4" />
          PRO会員
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
        無料プラン
      </span>
    );
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">アカウント設定</h1>

        {/* テストモード表示 */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-medium">テストモード:</span> Stripe連携後は、Stripeポータルで管理するようになります。
          </p>
        </div>

        {/* プロフィール */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">プロフィール</h2>
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

        {/* サブスクリプション */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">サブスクリプション</h2>
            {getStatusBadge()}
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          {isAdmin ? (
            <p className="text-sm text-gray-600">
              管理者アカウントはすべてのコンテンツに無制限でアクセスできます。
            </p>
          ) : isSubscriber ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                PRO会員として、すべてのコンテンツにアクセスできます。
              </p>
              <button
                onClick={handleCancelSubscription}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                PRO会員を解約（テスト）
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                現在、無料プランをご利用中です。PRO会員になると、すべてのコンテンツにアクセスできます。
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Crown className="w-4 h-4" />
                PRO会員になる
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AccountPage;
