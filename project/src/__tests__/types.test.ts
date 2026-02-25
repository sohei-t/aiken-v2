import { describe, it, expect } from 'vitest';
import type {
  UserData, CustomerData, Classroom, Content, WatchHistoryEntry, WatchHistoryMap,
  QuizQuestion, Quiz, QuizResult, DashboardStats, UserProgress, CustomerProgress,
  CustomerSettings, AuthContextValue, ChatPanelProps, QuizPanelProps, ChatMessage,
  PlanInfo, PlansMap, FilePair, UploadProgress, AudioPlayerRef, ContentNavigation,
  HeaderInfo, SlideInfo, ClassroomProgress, UserProgressMatrix, StatusMessage,
  ContentBadge, DriveDeleteResults, UserRole, AccessType, PlanId, TtsProvider,
} from '../types';

describe('Type Definitions', () => {
  it('should define UserRole union type correctly', () => {
    const admin: UserRole = 'admin';
    const user: UserRole = 'user';
    expect(admin).toBe('admin');
    expect(user).toBe('user');
  });

  it('should define AccessType union type correctly', () => {
    const pub: AccessType = 'public';
    const free: AccessType = 'free';
    const draft: AccessType = 'draft';
    expect(pub).toBe('public');
    expect(free).toBe('free');
    expect(draft).toBe('draft');
  });

  it('should define PlanId union type correctly', () => {
    const plans: PlanId[] = ['trial', 'basic', 'standard', 'premium'];
    expect(plans).toHaveLength(4);
  });

  it('should define TtsProvider union type correctly', () => {
    const google: TtsProvider = 'google';
    const openai: TtsProvider = 'openai';
    expect(google).toBe('google');
    expect(openai).toBe('openai');
  });

  it('should create a valid UserData object', () => {
    const userData: UserData = {
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'user',
      customerId: 'customer-1',
    };
    expect(userData.id).toBe('user-1');
    expect(userData.role).toBe('user');
  });

  it('should create a valid Classroom object', () => {
    const classroom: Classroom = {
      id: 'classroom-1',
      name: 'TypeScript入門',
      accessType: 'public',
      order: 0,
      parentClassroomId: null,
      depth: 0,
      childCount: 0,
      contentCount: 5,
      isActive: true,
    };
    expect(classroom.name).toBe('TypeScript入門');
    expect(classroom.isActive).toBe(true);
  });

  it('should create a valid Content object', () => {
    const content: Content = {
      id: 'content-1',
      title: '第1話: 基礎',
      order: 0,
      classroomId: 'classroom-1',
      isActive: true,
    };
    expect(content.title).toBe('第1話: 基礎');
    expect(content.classroomId).toBe('classroom-1');
  });

  it('should create a valid WatchHistoryMap', () => {
    const entry: WatchHistoryEntry = {
      watchedAt: new Date('2024-01-01'),
      lastWatchedAt: new Date('2024-01-15'),
      source: 'firestore',
    };
    const map: WatchHistoryMap = {
      'content-1': entry,
    };
    expect(map['content-1'].source).toBe('firestore');
  });

  it('should create a valid Quiz object', () => {
    const question: QuizQuestion = {
      question: 'What is TypeScript?',
      options: ['A language', 'A framework', 'A library', 'A tool'],
      correctIndex: 0,
      explanation: 'TypeScript is a programming language',
    };
    const quiz: Quiz = {
      id: 'quiz-1',
      contentId: 'content-1',
      questions: [question],
      passingScore: 80,
    };
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0].correctIndex).toBe(0);
  });

  it('should create a valid QuizResult object', () => {
    const result: QuizResult = {
      score: 85,
      correctCount: 17,
      totalQuestions: 20,
      passed: true,
      answers: { 0: 1, 1: 2, 2: 0 },
    };
    expect(result.passed).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should create a valid DashboardStats object', () => {
    const stats: DashboardStats = {
      classroomCount: 5,
      contentCount: 50,
      userCount: 100,
    };
    expect(stats.classroomCount).toBe(5);
  });

  it('should create a valid ChatMessage object', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: 'Hello!',
      sources: [{ chapter: 'Ch 1', title: 'Intro', score: 0.95 }],
    };
    expect(msg.role).toBe('assistant');
    expect(msg.sources).toHaveLength(1);
  });

  it('should create a valid PlanInfo and PlansMap', () => {
    const plan: PlanInfo = {
      name: 'Basic',
      price: '¥1,000',
      classrooms: 5,
      users: 10,
      contents: 50,
      aiGenerations: 100,
      badge: 'bg-blue-100',
    };
    const plans: PlansMap = {
      trial: plan,
      basic: plan,
      standard: plan,
      premium: plan,
    };
    expect(plans.basic.name).toBe('Basic');
  });

  it('should create a valid FilePair object', () => {
    const pair: FilePair = {
      id: 'pair-1',
      html: null,
      mp3: null,
      title: 'Lesson 1',
      order: 0,
    };
    expect(pair.title).toBe('Lesson 1');
  });

  it('should create a valid UploadProgress object', () => {
    const progress: UploadProgress = {
      current: 5,
      total: 10,
      percent: 50,
    };
    expect(progress.percent).toBe(50);
  });

  it('should create a valid SlideInfo object', () => {
    const info: SlideInfo = {
      current: 3,
      total: 10,
    };
    expect(info.current).toBe(3);
    expect(info.total).toBe(10);
  });

  it('should create a valid ClassroomProgress object', () => {
    const progress: ClassroomProgress = {
      watched: 8,
      total: 10,
      percent: 80,
    };
    expect(progress.percent).toBe(80);
  });

  it('should create a valid UserProgressMatrix', () => {
    const matrix: UserProgressMatrix = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        role: 'user',
        customerId: 'c1',
      },
      classroomProgress: {
        'classroom-1': { watched: 5, total: 10, percent: 50 },
      },
      totalWatched: 5,
      totalContents: 10,
      totalPercent: 50,
    };
    expect(matrix.totalPercent).toBe(50);
  });

  it('should create a valid StatusMessage object', () => {
    const success: StatusMessage = { type: 'success', text: 'Done!' };
    const error: StatusMessage = { type: 'error', text: 'Failed!' };
    expect(success.type).toBe('success');
    expect(error.type).toBe('error');
  });

  it('should create a valid ContentBadge object', () => {
    const badge: ContentBadge = {
      label: 'NEW!',
      bg: 'bg-red-100',
      text: 'text-red-600',
    };
    expect(badge.label).toBe('NEW!');
  });

  it('should create a valid DriveDeleteResults object', () => {
    const results: DriveDeleteResults = {
      success: 8,
      failed: 2,
      failedIds: ['id-1', 'id-2'],
    };
    expect(results.success).toBe(8);
    expect(results.failedIds).toHaveLength(2);
  });

  it('should create valid CustomerSettings with optional fields', () => {
    const settings: CustomerSettings = {
      ttsProvider: 'google',
    };
    expect(settings.claudeApiKey).toBeUndefined();
    expect(settings.ttsProvider).toBe('google');
  });

  it('should create a valid ContentNavigation object', () => {
    const content1: Content = { id: '1', title: 'A', order: 0, classroomId: 'c1', isActive: true };
    const content2: Content = { id: '2', title: 'B', order: 1, classroomId: 'c1', isActive: true };
    const nav: ContentNavigation = {
      contents: [content1, content2],
      currentIndex: 0,
      totalContents: 2,
      hasPrev: false,
      hasNext: true,
      prevContent: null,
      nextContent: content2,
      onPrev: () => {},
      onNext: () => {},
      onNavigate: () => {},
    };
    expect(nav.hasNext).toBe(true);
    expect(nav.hasPrev).toBe(false);
  });

  it('should create a valid HeaderInfo object', () => {
    const header: HeaderInfo = {
      title: 'Lesson 1',
      progress: '1 / 10',
      onBack: () => {},
      backLabel: '教室に戻る',
    };
    expect(header.title).toBe('Lesson 1');
    expect(header.progress).toBe('1 / 10');
  });
});
