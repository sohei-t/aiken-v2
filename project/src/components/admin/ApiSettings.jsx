import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerSettings, updateCustomerSettings } from '../../services/firebase';
import { Loader2, Key, Eye, EyeOff, CheckCircle, AlertCircle, Save } from 'lucide-react';

const ApiKeyInput = ({ label, description, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  const masked = value ? value.slice(0, 8) + '...' + value.slice(-4) : '';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

const ApiSettings = () => {
  const { customerId } = useAuth();
  const [settings, setSettings] = useState({
    claudeApiKey: '',
    openaiApiKey: '',
    geminiApiKey: '',
    ttsProvider: 'google',
    googleTtsApiKey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!customerId) return;

    const fetchSettings = async () => {
      try {
        const data = await getCustomerSettings(customerId);
        setSettings(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [customerId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateCustomerSettings(customerId, settings);
      setMessage({ type: 'success', text: '設定を保存しました' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: '設定の保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
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
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Info banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Key className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">AI API キーについて</p>
            <p className="text-xs text-blue-700 mt-1">
              AIコンテンツ生成やクイズ自動作成に使用するAPIキーを設定してください。
              APIキーは暗号化されて保存されます。利用料金はお客様のAPIアカウントに直接請求されます。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Content Generation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AIコンテンツ生成</h2>
          <div className="space-y-4">
            <ApiKeyInput
              label="Claude API Key (Anthropic)"
              description="コンテンツ生成・クイズ生成に使用"
              value={settings.claudeApiKey}
              onChange={(v) => setSettings(prev => ({ ...prev, claudeApiKey: v }))}
              placeholder="sk-ant-..."
            />
            <ApiKeyInput
              label="OpenAI API Key"
              description="GPT-4o でのコンテンツ生成に使用（オプション）"
              value={settings.openaiApiKey}
              onChange={(v) => setSettings(prev => ({ ...prev, openaiApiKey: v }))}
              placeholder="sk-..."
            />
            <ApiKeyInput
              label="Gemini API Key (Google)"
              description="Gemini でのコンテンツ生成に使用（オプション）"
              value={settings.geminiApiKey}
              onChange={(v) => setSettings(prev => ({ ...prev, geminiApiKey: v }))}
              placeholder="AIza..."
            />
          </div>
        </div>

        {/* TTS Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">音声合成 (TTS)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TTSプロバイダー</label>
              <select
                value={settings.ttsProvider}
                onChange={(e) => setSettings(prev => ({ ...prev, ttsProvider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="google">Google Cloud TTS</option>
                <option value="openai">OpenAI TTS</option>
              </select>
            </div>
            {settings.ttsProvider === 'google' && (
              <ApiKeyInput
                label="Google Cloud TTS API Key"
                description="テキスト読み上げに使用"
                value={settings.googleTtsApiKey}
                onChange={(v) => setSettings(prev => ({ ...prev, googleTtsApiKey: v }))}
                placeholder="AIza..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
};

export default ApiSettings;
