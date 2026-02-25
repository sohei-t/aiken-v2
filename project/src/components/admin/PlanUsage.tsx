import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getDashboardStats } from '../../services/firebase';
import { Loader2, BookOpen, FileText, Users, Sparkles, Crown, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardStats, PlanId, PlanInfo, PlansMap } from '../../types';

const PLANS: PlansMap = {
  trial: { name: 'トライアル', price: '¥0', classrooms: 1, users: 5, contents: 10, aiGenerations: 3, badge: 'bg-gray-100 text-gray-700' },
  basic: { name: 'Basic', price: '¥15,000/月', classrooms: 10, users: 100, contents: 100, aiGenerations: 30, badge: 'bg-blue-100 text-blue-700' },
  standard: { name: 'Standard', price: '¥40,000/月', classrooms: 30, users: 500, contents: 500, aiGenerations: 100, badge: 'bg-purple-100 text-purple-700' },
  premium: { name: 'Premium', price: '¥100,000/月', classrooms: 100, users: 2000, contents: 2000, aiGenerations: -1, badge: 'bg-amber-100 text-amber-700' },
};

interface UsageBarProps {
  label: string;
  icon: LucideIcon;
  current: number;
  limit: number;
  unit?: string;
}

const UsageBar: React.FC<UsageBarProps> = ({ label, icon: Icon, current, limit, unit = '' }) => {
  const isUnlimited = limit === -1;
  const percent = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0);
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className={`text-sm font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-600'}`}>
          {current}{unit} / {isUnlimited ? '無制限' : `${limit}${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};

const PlanUsage: React.FC = () => {
  const { customerId, customerData } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!customerId) return;

    const fetchData = async (): Promise<void> => {
      try {
        const statsData = await getDashboardStats(customerId);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load usage data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  const planId: PlanId = (customerData?.plan as PlanId) || 'trial';
  const plan: PlanInfo = PLANS[planId] || PLANS.trial;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">現在のプラン</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.badge}`}>
                  {plan.name}
                </span>
                <span className="text-sm text-gray-500">{plan.price}</span>
              </div>
            </div>
          </div>
          {planId !== 'premium' && (
            <button className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              アップグレード
            </button>
          )}
        </div>

        {/* Trial info */}
        {planId === 'trial' && customerData?.trialExpiresAt && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            トライアル期間: {new Date((customerData.trialExpiresAt as { seconds: number }).seconds * 1000).toLocaleDateString('ja-JP')} まで
          </div>
        )}
      </div>

      {/* Usage Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用状況</h2>
        <div className="divide-y divide-gray-100">
          <UsageBar icon={BookOpen} label="教室数" current={stats?.classroomCount || 0} limit={plan.classrooms} />
          <UsageBar icon={FileText} label="コンテンツ数" current={stats?.contentCount || 0} limit={plan.contents} />
          <UsageBar icon={Users} label="メンバー数" current={stats?.userCount || 0} limit={plan.users} unit="名" />
          <UsageBar icon={Sparkles} label="AI生成回数" current={customerData?.aiGenerationCount || 0} limit={plan.aiGenerations} unit="回" />
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">プラン比較</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-medium text-gray-500">機能</th>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <th key={id} className={`text-center py-3 px-4 font-medium ${id === planId ? 'text-purple-700 bg-purple-50' : 'text-gray-700'}`}>
                    {p.name}
                    {id === planId && <span className="block text-xs text-purple-500 mt-0.5">現在</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-600">月額料金</td>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <td key={id} className={`text-center py-3 px-4 ${id === planId ? 'bg-purple-50 font-medium' : ''}`}>{p.price}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-600">教室数</td>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <td key={id} className={`text-center py-3 px-4 ${id === planId ? 'bg-purple-50 font-medium' : ''}`}>{p.classrooms}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-600">メンバー数</td>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <td key={id} className={`text-center py-3 px-4 ${id === planId ? 'bg-purple-50 font-medium' : ''}`}>{p.users.toLocaleString()}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-600">コンテンツ数</td>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <td key={id} className={`text-center py-3 px-4 ${id === planId ? 'bg-purple-50 font-medium' : ''}`}>{p.contents.toLocaleString()}</td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 text-gray-600">AI生成</td>
                {(Object.entries(PLANS) as [PlanId, PlanInfo][]).map(([id, p]) => (
                  <td key={id} className={`text-center py-3 px-4 ${id === planId ? 'bg-purple-50 font-medium' : ''}`}>
                    {p.aiGenerations === -1 ? '無制限' : `${p.aiGenerations}回/月`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlanUsage;
