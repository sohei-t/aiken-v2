import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getQuiz, saveQuizResult, getQuizResult } from '../../services/firebase';
import { Loader2, CheckCircle2, XCircle, Trophy, RotateCcw, ChevronRight } from 'lucide-react';
import type { QuizPanelProps, Quiz, QuizResult, QuizQuestion } from '../../types';

const QuizPanel: React.FC<QuizPanelProps> = ({ contentId, customerId }) => {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [previousResult, setPreviousResult] = useState<QuizResult | null>(null);
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchQuiz = async (): Promise<void> => {
      try {
        const [quizData, prevResult] = await Promise.all([
          getQuiz(customerId!, contentId),
          user ? getQuizResult(user.uid, contentId) : null,
        ]);
        setQuiz(quizData);
        setPreviousResult(prevResult);
      } catch (err) {
        console.error('Failed to load quiz:', err);
      } finally {
        setLoading(false);
      }
    };

    if (customerId && contentId) {
      fetchQuiz();
    }
  }, [customerId, contentId, user]);

  const handleAnswer = (questionIndex: number, optionIndex: number): void => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!quiz || submitted) return;

    const questions: QuizQuestion[] = quiz.questions || [];
    let correctCount = 0;
    questions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctIndex) correctCount++;
    });

    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = score >= (quiz.passingScore || 70);

    const quizResult: QuizResult = {
      score,
      correctCount,
      totalQuestions: questions.length,
      passed,
      answers: selectedAnswers,
    };

    setResult(quizResult);
    setSubmitted(true);

    // Save result
    if (user) {
      try {
        await saveQuizResult(user.uid, contentId, quizResult);
      } catch (err) {
        console.error('Failed to save quiz result:', err);
      }
    }
  };

  const handleRetry = (): void => {
    setSelectedAnswers({});
    setSubmitted(false);
    setResult(null);
    setCurrentQuestion(0);
    setShowExplanation({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!quiz) return null; // No quiz for this content

  const questions: QuizQuestion[] = quiz.questions || [];
  if (questions.length === 0) return null;

  const allAnswered = questions.every((_, i) => selectedAnswers[i] !== undefined);

  // Show result screen
  if (submitted && result) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            result.passed ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            {result.passed ? (
              <Trophy className="w-8 h-8 text-green-600" />
            ) : (
              <RotateCcw className="w-8 h-8 text-amber-600" />
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {result.passed ? '合格!' : '不合格'}
          </h3>
          <p className="text-3xl font-bold mt-2 text-gray-900">{result.score}点</p>
          <p className="text-sm text-gray-500 mt-1">
            {result.correctCount}/{result.totalQuestions}問正解 (合格ライン: {quiz.passingScore || 70}%)
          </p>
        </div>

        {/* Answer review */}
        <div className="space-y-4 mb-6">
          {questions.map((q, i) => {
            const isCorrect = selectedAnswers[i] === q.correctIndex;
            return (
              <div key={i} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">Q{i + 1}. {q.question}</p>
                    {!isCorrect && (
                      <p className="text-xs text-red-600 mt-1">
                        あなたの回答: {q.options[selectedAnswers[i]]} / 正解: {q.options[q.correctIndex]}
                      </p>
                    )}
                    {q.explanation && (
                      <button
                        onClick={() => setShowExplanation(prev => ({ ...prev, [i]: !prev[i] }))}
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                      >
                        {showExplanation[i] ? '解説を閉じる' : '解説を見る'}
                      </button>
                    )}
                    {showExplanation[i] && q.explanation && (
                      <p className="text-xs text-gray-600 mt-1 bg-white/60 rounded p-2">{q.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleRetry}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          もう一度挑戦
        </button>
      </div>
    );
  }

  // Quiz questions UI
  const q = questions[currentQuestion];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">確認テスト</h3>
        <span className="text-sm text-gray-500">
          {currentQuestion + 1} / {questions.length}
        </span>
      </div>

      {/* Previous result banner */}
      {previousResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          previousResult.passed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {previousResult.passed ? <CheckCircle2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          前回の結果: {previousResult.score}点 ({previousResult.passed ? '合格' : '不合格'})
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-100 rounded-full mb-6">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="mb-6">
        <p className="font-medium text-gray-900 mb-4">Q{currentQuestion + 1}. {q.question}</p>
        <div className="space-y-2">
          {q.options.map((option, oi) => (
            <button
              key={oi}
              onClick={() => handleAnswer(currentQuestion, oi)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm ${
                selectedAnswers[currentQuestion] === oi
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          前の問題
        </button>

        {currentQuestion < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            次の問題
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            回答を提出
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQuestion(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === currentQuestion
                ? 'bg-blue-500'
                : selectedAnswers[i] !== undefined
                  ? 'bg-blue-200'
                  : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default QuizPanel;
