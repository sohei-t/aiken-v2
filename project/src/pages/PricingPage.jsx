import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2, CheckCircle, Crown, FlaskConical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { testSubscribe } from '../services/firebase';
// TODO: Stripe本番接続時に以下を有効化
// import { createCheckoutSession } from '../services/stripeApi';
import Layout from '../components/layout/Layout';

const PricingPage = () => {
  const { user, isAuthenticated, isSubscriber, isAdmin, loading: authLoading, refreshUserData } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const autoSubscribeTriggered = useRef(false);

  // 登録完了検出（URL param）
  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      setShowSuccess(true);
      refreshUserData();
    }
  }, [searchParams, refreshUserData]);

  // 自動サブスク登録: ログイン後に auto_subscribe=true で戻ってきた場合
  useEffect(() => {
    if (
      searchParams.get('auto_subscribe') === 'true' &&
      isAuthenticated &&
      user &&
      !isSubscriber &&
      !isAdmin &&
      !authLoading &&
      !autoSubscribeTriggered.current
    ) {
      autoSubscribeTriggered.current = true;
      // URLパラメータをクリア
      setSearchParams({}, { replace: true });
      // 自動登録を実行
      (async () => {
        setCheckoutLoading(true);
        setError(null);
        try {
          await testSubscribe(user.uid);
          await refreshUserData();
          setShowSuccess(true);
        } catch (err) {
          console.error('Auto-subscribe failed:', err);
          setError('自動登録に失敗しました。下のボタンから再度お試しください。');
        } finally {
          setCheckoutLoading(false);
        }
      })();
    }
  }, [searchParams, isAuthenticated, user, isSubscriber, isAdmin, authLoading, setSearchParams, refreshUserData]);

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      // テストモード: Stripe を介さず直接 Firestore に書き込み
      await testSubscribe(user.uid);
      await refreshUserData();
      setShowSuccess(true);

      // TODO: Stripe本番接続時は以下に差し替え
      // const { url } = await createCheckoutSession();
      // if (url) window.location.href = url;
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('登録に失敗しました。しばらく経ってからお試しください。');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const features = [
    'HTMLスライド教材が見放題',
    '音声解説（MP3）が聴き放題',
    '全教室のコンテンツにアクセス',
    'いつでもキャンセル可能',
  ];

  return (
    <Layout>
      <div className="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* テストモード表示 */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-medium">テストモード:</span> 決済なしで登録できます。Stripe連携後は実際の決済フローに切り替わります。
            </p>
          </div>

          {/* 成功メッセージ */}
          {showSuccess && (
            <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-green-900">PRO会員に登録しました!</h3>
                <p className="text-sm text-green-700 mt-1">
                  すべてのコンテンツにアクセスできるようになりました。学習を始めましょう!
                </p>
                <Link to="/" className="text-sm text-green-600 hover:text-green-700 font-medium mt-2 inline-block">
                  教室一覧へ
                </Link>
              </div>
            </div>
          )}

          {/* ヘッダー */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              料金プラン
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              月額¥500で、すべてのHTMLスライド教材と音声解説にアクセスできます
            </p>
          </div>

          {/* 料金カード */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-500 overflow-hidden">
              {/* バッジ */}
              <div className="bg-indigo-500 text-white text-center py-2 text-sm font-medium">
                おすすめプラン
              </div>

              <div className="p-8">
                {/* プラン名 */}
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-6 h-6 text-indigo-500" />
                  <h2 className="text-xl font-bold text-gray-900">PRO会員</h2>
                </div>

                {/* 価格 */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">¥500</span>
                    <span className="text-gray-500">/月</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">税込み</p>
                </div>

                {/* 特徴リスト */}
                <ul className="space-y-3 mb-8">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-indigo-600" />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA ボタン */}
                {error && (
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                )}

                {authLoading || checkoutLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    {checkoutLoading && <span className="ml-2 text-sm text-gray-500">登録処理中...</span>}
                  </div>
                ) : isAdmin ? (
                  <div className="text-center py-3">
                    <span className="text-sm text-gray-500">管理者は全コンテンツにアクセス可能です</span>
                  </div>
                ) : isSubscriber ? (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg mb-3">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">登録済み</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      <Link to="/account" className="text-indigo-600 hover:text-indigo-700 font-medium">
                        アカウント設定
                      </Link>
                      でサブスクリプションを管理できます
                    </p>
                  </div>
                ) : isAuthenticated ? (
                  <button
                    onClick={handleSubscribe}
                    disabled={checkoutLoading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    PRO会員に登録（テスト）
                  </button>
                ) : (
                  <Link
                    to="/login"
                    state={{ from: { pathname: '/pricing?auto_subscribe=true' } }}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    PRO会員に登録
                  </Link>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="mt-8 text-center text-sm text-gray-500">
              <Link to="/" className="text-indigo-600 hover:text-indigo-700">
                教室一覧を見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PricingPage;
