import type { User as FirebaseUser } from 'firebase/auth';
import type { FieldValue, Timestamp } from 'firebase/firestore';

// ══════════════════════════════════════════
// Firebase / Firestore Data Models
// ══════════════════════════════════════════

export type UserRole = 'admin' | 'user';
export type AccessType = 'public' | 'free' | 'draft';
export type PlanId = 'trial' | 'basic' | 'standard' | 'premium';
export type TtsProvider = 'google' | 'openai';

export interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  customerId: string | null;
  subscriptionStatus?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface CustomerData {
  id: string;
  name?: string;
  plan: PlanId;
  trialStartedAt?: Timestamp | FieldValue;
  trialExpiresAt?: Timestamp | null;
  aiGenerationCount?: number;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface Classroom {
  id: string;
  name: string;
  description?: string;
  accessType: AccessType;
  order: number;
  parentClassroomId: string | null;
  depth: number;
  childCount: number;
  contentCount: number;
  isActive: boolean;
  freeEpisodeCount?: number;
  createdBy?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface Content {
  id: string;
  title: string;
  description?: string;
  order: number;
  classroomId: string;
  htmlContent?: string;
  htmlFileId?: string;
  htmlUrl?: string;
  mp3FileId?: string;
  mp3Url?: string;
  youtubeUrl?: string;
  duration?: number;
  episodeNumber?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  contentUpdatedAt?: Timestamp | FieldValue;
}

export interface WatchHistoryEntry {
  watchedAt: Date;
  lastWatchedAt: Date;
  source?: 'local' | 'firestore';
}

export interface WatchHistoryMap {
  [contentId: string]: WatchHistoryEntry;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  contentId: string;
  title?: string;
  questions: QuizQuestion[];
  passingScore: number;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface QuizResult {
  id?: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  answers: Record<number, number>;
  completedAt?: Timestamp | FieldValue;
}

export interface DashboardStats {
  classroomCount: number;
  contentCount: number;
  userCount: number;
}

export interface UserProgress {
  watchedCount: number;
  totalCount: number;
  progressPercent: number;
}

export interface CustomerProgress {
  [userId: string]: UserProgress;
}

export interface CustomerSettings {
  claudeApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  ttsProvider?: TtsProvider;
  googleTtsApiKey?: string;
  updatedAt?: Timestamp | FieldValue;
}

// ══════════════════════════════════════════
// Drive API Types
// ══════════════════════════════════════════

export interface DriveUploadResult {
  fileId: string;
  url: string;
  downloadUrl: string;
}

export interface FileUploadResult {
  path: string;
  url: string;
  fileId: string;
}

// ══════════════════════════════════════════
// RAG API Types
// ══════════════════════════════════════════

export interface RagSource {
  chapter: string;
  title: string;
  score: number;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}

// ══════════════════════════════════════════
// Stripe API Types
// ══════════════════════════════════════════

export interface StripeSessionResult {
  url: string;
}

// ══════════════════════════════════════════
// Auth Context Types
// ══════════════════════════════════════════

export interface AuthContextValue {
  user: FirebaseUser | null;
  userData: UserData | null;
  customerData: CustomerData | null;
  customerId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
}

export interface UseAuthReturn extends AuthContextValue {
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// ══════════════════════════════════════════
// Component Prop Types
// ══════════════════════════════════════════

export interface LayoutProps {
  children: React.ReactNode;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export interface ChatPanelProps {
  classroomId: string;
  classroomName?: string;
}

export interface QuizPanelProps {
  contentId: string;
  customerId: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
  isError?: boolean;
}

// ══════════════════════════════════════════
// Plan Types
// ══════════════════════════════════════════

export interface PlanInfo {
  name: string;
  price: string;
  classrooms: number;
  users: number;
  contents: number;
  aiGenerations: number;
  badge: string;
}

export type PlansMap = Record<PlanId, PlanInfo>;

// ══════════════════════════════════════════
// Content Uploader Types
// ══════════════════════════════════════════

export interface FilePair {
  id: string;
  html: File | null;
  mp3: File | null;
  title: string;
  order: number;
}

export interface UploadProgress {
  current: number;
  total: number;
  percent: number;
}

// ══════════════════════════════════════════
// Viewer / Audio Types
// ══════════════════════════════════════════

export interface AudioPlayerRef {
  togglePlay: () => void;
  isPlaying: () => boolean;
  isReady: () => boolean;
  getPlaybackRate: () => number;
  cyclePlaybackRate: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (time: number) => void;
  skip: (seconds: number) => void;
}

export interface ContentNavigation {
  contents: Content[];
  currentIndex: number;
  totalContents: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevContent: Content | null;
  nextContent: Content | null;
  onPrev: () => void;
  onNext: () => void;
  onNavigate: (id: string) => void;
}

export interface HeaderInfo {
  title: string;
  progress: string | null;
  onBack: () => void;
  backLabel: string;
}

export interface SlideInfo {
  current: number;
  total: number;
}

// ══════════════════════════════════════════
// Progress Tracker Types
// ══════════════════════════════════════════

export interface ClassroomProgress {
  watched: number;
  total: number;
  percent: number;
}

export interface UserProgressMatrix {
  user: UserData;
  classroomProgress: Record<string, ClassroomProgress>;
  totalWatched: number;
  totalContents: number;
  totalPercent: number;
}

// ══════════════════════════════════════════
// Utility Types
// ══════════════════════════════════════════

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

export interface ContentBadge {
  label: string;
  bg: string;
  text: string;
}

export interface DriveDeleteResults {
  success: number;
  failed: number;
  failedIds: string[];
}
