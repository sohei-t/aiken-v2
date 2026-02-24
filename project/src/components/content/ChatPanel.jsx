import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronDown, BookOpen, ExternalLink, Key } from 'lucide-react';
import { askQuestion } from '../../services/ragApi';

const ChatPanel = ({ classroomId, classroomName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ragApiKey') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    if (!apiKey) {
      setShowApiKeyInput(true);
      return;
    }

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await askQuestion(classroomId, question, { apiKey });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySave = () => {
    localStorage.setItem('ragApiKey', apiKey);
    setShowApiKeyInput(false);
  };

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9998] w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="AI質問アシスタント"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[9997] md:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Chat panel */}
      <div className="fixed z-[9998] md:bottom-6 md:right-6 md:w-[400px] md:h-[500px] md:rounded-2xl bottom-0 left-0 right-0 h-[50vh] md:left-auto bg-white shadow-2xl flex flex-col overflow-hidden md:border border-gray-200 rounded-t-2xl md:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <div>
              <h3 className="font-semibold text-sm">AI質問アシスタント</h3>
              <p className="text-xs text-indigo-200 truncate max-w-[200px]">{classroomName}</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key input */}
        {showApiKeyInput && (
          <div className="p-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                <Key className="w-3 h-3" />
                Gemini APIキーを入力してください
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 hover:underline"
              >
                APIキーの取得方法
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-amber-700 mb-2">
              Google AI Studioで無料のAPIキーを作成し、下記に貼り付けてください。キーはお使いのブラウザにのみ保存されます。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleApiKeySave}
                disabled={!apiKey}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">この講座の内容について</p>
              <p className="text-sm">質問してみましょう</p>
              {!apiKey && (
                <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-800">
                    利用にはGemini APIキーが必要です。
                    <button
                      onClick={() => setShowApiKeyInput(true)}
                      className="text-indigo-600 hover:underline ml-1 font-medium"
                    >
                      APIキーを設定する
                    </button>
                  </p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {['この講座の概要を教えて', 'APIとは何ですか？'].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="block w-full text-left px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.isError
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200/50">
                    <p className="text-xs text-gray-500 mb-1">出典:</p>
                    {msg.sources.map((src, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        {src.chapter} - {src.title} (関連度: {src.score})
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="質問を入力..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-sm bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white border border-transparent focus:border-indigo-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ChatPanel;
