/**
 * RAG / AI Question API
 * AIKEN v2: AI質問機能（将来Phase 3で実装）
 */

import type { RagAnswer } from '../types';

export const askQuestion = async (
  _question: string,
  _classroomId: string,
  _apiKey?: string
): Promise<RagAnswer> => {
  // TODO: Phase 3 で Cloud Run AI サービスに接続
  return {
    answer: 'AI質問機能は現在準備中です。Phase 3 で実装予定です。',
    sources: []
  };
};
