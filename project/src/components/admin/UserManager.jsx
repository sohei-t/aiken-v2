import { useState, useEffect } from 'react';
import { User, ShieldCheck, Search, Loader2, AlertCircle, CheckCircle, UserPlus, Trash2, X, Eye, EyeOff, Mail, Copy, Check, Crown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerUsers, updateUserRole, deleteUser, createUserByAdmin } from '../../services/firebase';

const APP_URL = window.location.origin;

const AddUserModal = ({ onClose, onUserCreated, customerId }) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [createdResult, setCreatedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const buildLoginInfo = (userEmail, userPassword, userName) => {
    return [
      `ログインURL: ${APP_URL}/login`,
      `メールアドレス: ${userEmail}`,
      `初期パスワード: ${userPassword}`,
      userName ? `表示名: ${userName}` : '',
    ].filter(Boolean).join('\n');
  };

  const buildEmailBody = (userEmail, userPassword, userName) => {
    const greeting = userName ? `${userName} 様` : `${userEmail} 様`;
    return [
      `${greeting}`,
      '',
      'AIKEN のアカウントが作成されました。',
      '以下の情報でログインしてください。',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      `ログインURL: ${APP_URL}/login`,
      `メールアドレス: ${userEmail}`,
      `初期パスワード: ${userPassword}`,
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '【初回ログインの手順】',
      '1. 上記URLにアクセス',
      '2. メールアドレスと初期パスワードを入力してログイン',
      '3. セキュリティのため、ログイン後にパスワードの変更を推奨します',
      '',
      '※ このメールに心当たりがない場合は、お手数ですが破棄してください。',
    ].join('\n');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    if (password && password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const actualPassword = password || generateRandomPassword();
      const newUser = await createUserByAdmin(email, actualPassword, displayName, customerId);
      onUserCreated(newUser);
      setCreatedResult({ email, password: actualPassword, displayName });
    } catch (err) {
      console.error('Failed to create user:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています');
      } else if (err.code === 'auth/invalid-email') {
        setError('メールアドレスの形式が正しくありません');
      } else {
        setError('ユーザーの作成に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    const text = buildLoginInfo(createdResult.email, createdResult.password, createdResult.displayName);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('【AIKEN】アカウント作成のお知らせ');
    const body = encodeURIComponent(buildEmailBody(createdResult.email, createdResult.password, createdResult.displayName));
    window.open(`mailto:${createdResult.email}?subject=${subject}&body=${body}`, '_blank');
  };

  if (createdResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">ユーザーを追加しました</h3>
              <p className="text-sm text-gray-500">ログイン情報をユーザーにお知らせください</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm text-gray-900">
              {createdResult.displayName && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans">表示名</span>
                  <span>{createdResult.displayName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 font-sans">メール</span>
                <span>{createdResult.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-sans">パスワード</span>
                <span>{createdResult.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-sans">ログインURL</span>
                <span className="text-blue-600 break-all">{APP_URL}/login</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendEmail}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                メールで通知
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              「メールで通知」をクリックするとメールアプリが開きます。ログイン情報が自動入力されます。
            </p>
          </div>

          <div className="p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">ユーザー追加</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ユーザー名"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                placeholder="未入力で自動生成"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">空欄の場合、ランダムなパスワードが自動生成されます</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !email}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {saving ? '作成中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManager = () => {
  const { user: currentUser, customerId } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    if (!customerId) return;
    try {
      const usersData = await getCustomerUsers(customerId);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setMessage({ type: 'error', text: 'データの取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
      setMessage({ type: 'success', text: 'ロールを更新しました' });
    } catch (err) {
      console.error('Failed to update role:', err);
      setMessage({ type: 'error', text: 'ロールの更新に失敗しました' });
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`「${userName}」を削除しますか？\nFirestoreのユーザーデータが削除されます。`)) return;
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setMessage({ type: 'success', text: `${userName} を削除しました` });
    } catch (err) {
      console.error('Failed to delete user:', err);
      setMessage({ type: 'error', text: 'ユーザーの削除に失敗しました' });
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Search + Add */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ユーザーを検索..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <UserPlus className="w-5 h-5" />
          ユーザー追加
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">ユーザーが見つかりません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.role === 'admin' ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{user.displayName || 'No Name'}</h3>
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                          <Crown className="w-3 h-3" />管理者
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.id === currentUser?.uid}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="user">一般ユーザー</option>
                    <option value="admin">管理者</option>
                  </select>
                  {user.id !== currentUser?.uid && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.displayName || user.email)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="ユーザーを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          customerId={customerId}
          onClose={() => setShowAddModal(false)}
          onUserCreated={(newUser) => {
            setUsers(prev => [...prev, newUser]);
            setMessage({ type: 'success', text: `${newUser.displayName || newUser.email} を追加しました` });
          }}
        />
      )}
    </div>
  );
};

export default UserManager;
