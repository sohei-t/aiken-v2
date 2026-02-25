import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Clock, Lock, Upload, Loader2, AlertCircle, Trash2, Calendar, CheckCircle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Home, FolderOpen, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getClassroom, getContents, hasClassroomAccess, deleteContent, getWatchHistory, getClassroomHierarchy, getChildClassrooms } from '../services/firebase';
import Layout from '../components/layout/Layout';
import type { Classroom, Content, WatchHistoryEntry, WatchHistoryMap, ContentBadge } from '../types';

const ITEMS_PER_PAGE = 10;

// Pagination component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = memo(({ currentPage, totalPages, totalItems, onPageChange }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  // Generate page numbers to display
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-600">
        {startItem}-{endItem} / {totalItems}件
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="前のページ"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
            >
              {page}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="次のページ"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// Compact list item for content
const getBadge = (content: Content): ContentBadge | null => {
  const now = new Date();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const createdAtTs = content.createdAt as { toDate?: () => Date } | undefined;
  const createdAt = createdAtTs?.toDate?.()
    || (content.createdAt ? new Date(content.createdAt as unknown as string) : null);
  if (createdAt && (now.getTime() - createdAt.getTime()) < THREE_DAYS) {
    return { label: 'NEW!', bg: 'bg-red-100', text: 'text-red-600' };
  }
  const contentUpdatedAtTs = content.contentUpdatedAt as { toDate?: () => Date } | undefined;
  const contentUpdatedAt = contentUpdatedAtTs?.toDate?.()
    || (content.contentUpdatedAt ? new Date(content.contentUpdatedAt as unknown as string) : null);
  if (contentUpdatedAt && (now.getTime() - contentUpdatedAt.getTime()) < SEVEN_DAYS) {
    return { label: 'Updated', bg: 'bg-blue-100', text: 'text-blue-600' };
  }
  return null;
};

interface ContentListItemProps {
  content: Content;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  watchedInfo?: WatchHistoryEntry;
  isLocked: boolean;
  customerId: string | null;
}

const ContentListItem: React.FC<ContentListItemProps> = memo(({ content, isAdmin, onDelete, watchedInfo, isLocked, customerId }) => {
  const [deleting, setDeleting] = useState<boolean>(false);
  const badge = getBadge(content);

  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: unknown): string => {
    if (!timestamp) return '-';
    const ts = timestamp as { toDate?: () => Date };
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatWatchedDate = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(`「${content.title}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      return;
    }

    setDeleting(true);
    try {
      await deleteContent(customerId!, content.id);
      onDelete(content.id);
    } catch (err) {
      console.error('Failed to delete content:', err);
      alert('削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const Wrapper = isLocked
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="group block bg-white border-b border-gray-100 last:border-b-0 opacity-60">
          {children}
        </div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Link
          to={`/viewer/${content.id}`}
          className="group block bg-white hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors"
        >
          {children}
        </Link>
      );

  const statusIcon = isLocked
    ? { bg: 'bg-amber-100', icon: <Lock className="w-4 h-4 text-amber-600" />, bgMobile: 'bg-amber-100', iconMobile: <Lock className="w-5 h-5 text-amber-600" /> }
    : watchedInfo
      ? { bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4 text-green-600" />, bgMobile: 'bg-green-100', iconMobile: <CheckCircle className="w-5 h-5 text-green-600" /> }
      : { bg: 'bg-indigo-100', icon: <Play className="w-4 h-4 text-indigo-600" />, bgMobile: 'bg-indigo-100', iconMobile: <Play className="w-5 h-5 text-indigo-600" /> };

  return (
    <Wrapper>
      {/* Desktop: Table Row */}
      <div className="hidden sm:flex items-center px-4 py-3 gap-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusIcon.bg}`}>
          {statusIcon.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {content.episodeNumber && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono font-semibold bg-indigo-100 text-indigo-700 rounded">
                {content.episodeNumber}
              </span>
            )}
            <h3 className={`font-medium truncate ${isLocked ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-600'}`}>
              {content.title}
            </h3>
            {badge && (
              <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-bold ${badge.bg} ${badge.text} rounded-full`}>
                {badge.label}
              </span>
            )}
            {isLocked && (
              <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                有料
              </span>
            )}
          </div>
          {content.description ? (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {content.description}
            </p>
          ) : watchedInfo && !isLocked ? (
            <p className="text-xs text-green-600 mt-0.5">
              視聴済み（{formatWatchedDate(watchedInfo.lastWatchedAt)}）
            </p>
          ) : null}
        </div>
        <div className="w-20 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatDuration(content.duration)}
        </div>
        <div className="w-28 text-sm text-gray-500">
          {formatDate(content.createdAt)}
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="削除"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Mobile: Compact Card */}
      <div className="sm:hidden flex items-center px-3 py-3 gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusIcon.bgMobile}`}>
          {statusIcon.iconMobile}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {content.episodeNumber && (
              <span className="flex-shrink-0 px-1 py-0.5 text-[10px] font-mono font-semibold bg-indigo-100 text-indigo-700 rounded">
                {content.episodeNumber}
              </span>
            )}
            <h3 className={`font-medium truncate text-sm ${isLocked ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-600'}`}>
              {content.title}
            </h3>
            {badge && (
              <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text} rounded-full`}>
                {badge.label}
              </span>
            )}
            {isLocked && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                有料
              </span>
            )}
          </div>
          {content.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {content.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            {watchedInfo && !isLocked ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {formatWatchedDate(watchedInfo.lastWatchedAt)}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(content.duration)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(content.createdAt)}
            </span>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="削除"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </Wrapper>
  );
});

ContentListItem.displayName = 'ContentListItem';

// Format total duration (hours and minutes)
const formatTotalDuration = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '-';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes > 0 ? `${minutes}分` : ''}`;
  }
  return `${minutes}分`;
};

// Breadcrumb component
interface BreadcrumbProps {
  hierarchy: { id: string; name: string }[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = memo(({ hierarchy }) => {
  if (!hierarchy || hierarchy.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm mb-4 flex-wrap">
      <Link
        to="/"
        className="flex items-center gap-1 text-white/70 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>ホーム</span>
      </Link>
      {hierarchy.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-white/50" />
          {index === hierarchy.length - 1 ? (
            <span className="text-white font-medium">{item.name}</span>
          ) : (
            <Link
              to={`/classroom/${item.id}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              {item.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
});

Breadcrumb.displayName = 'Breadcrumb';

// Child classroom item
const ChildClassroomItem: React.FC<{ classroom: Classroom }> = memo(({ classroom }) => {
  return (
    <Link
      to={`/classroom/${classroom.id}`}
      className="group flex items-center gap-3 p-3 bg-white hover:bg-indigo-50 border border-gray-200 rounded-lg transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
        <FolderOpen className="w-5 h-5 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 group-hover:text-indigo-600 truncate">
          {classroom.name}
        </h4>
        <p className="text-xs text-gray-500">
          {classroom.contentCount || 0} コンテンツ
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
    </Link>
  );
});

ChildClassroomItem.displayName = 'ChildClassroomItem';

type SortColumn = 'order' | 'title' | 'duration' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const ClassroomPage: React.FC = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const _navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, customerId, user, loading: authLoading } = useAuth();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryMap>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<SortColumn>('order');
  const [sortOrder, setSortOrder] = useState<SortDirection>('asc');
  const [hierarchy, setHierarchy] = useState<{ id: string; name: string }[]>([]);
  const [childClassrooms, setChildClassrooms] = useState<Classroom[]>([]);

  // Sort handler
  const handleSort = useCallback((column: SortColumn): void => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortBy]);

  // Calculate total duration from all contents
  const totalDuration = contents.reduce((sum, content) => sum + (content.duration || 0), 0);

  // Sort and pagination calculations
  const sortedContents = useMemo(() => {
    const sorted = [...contents].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'order':
          aVal = a.order ?? 999;
          bVal = b.order ?? 999;
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        case 'title':
          aVal = a.title || '';
          bVal = b.title || '';
          return sortOrder === 'asc'
            ? aVal.localeCompare(bVal, 'ja')
            : bVal.localeCompare(aVal, 'ja');
        case 'duration':
          aVal = a.duration || 0;
          bVal = b.duration || 0;
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        case 'createdAt': {
          const aTime = (a.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() || 0;
          const bTime = (b.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() || 0;
          return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [contents, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedContents.length / ITEMS_PER_PAGE);
  const paginatedContents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedContents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedContents, currentPage]);

  // Reset to page 1 when contents change
  useEffect(() => {
    setCurrentPage(1);
  }, [contents.length]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        // Get classroom info
        const classroomData = await getClassroom(customerId, classroomId!);
        if (!classroomData) {
          setError('教室が見つかりません');
          setLoading(false);
          return;
        }
        setClassroom(classroomData);

        // Get hierarchy for breadcrumb (non-critical: don't block page on failure)
        try {
          const hierarchyData = await getClassroomHierarchy(customerId, classroomId!);
          setHierarchy(hierarchyData);
        } catch (e) {
          console.warn('Failed to fetch hierarchy:', e);
          setHierarchy([classroomData]);
        }

        // Check access
        const access = await hasClassroomAccess(customerId, user?.uid, classroomId!, isAdmin);
        setHasAccess(access);

        if (access) {
          const contentsData = await getContents(customerId, classroomId!);
          setContents(contentsData);

          // Get child classrooms (non-critical: may fail for unauthenticated users
          // if there are private child classrooms due to Firestore security rules)
          try {
            const children = await getChildClassrooms(customerId, classroomId!, isAdmin);
            setChildClassrooms(children);
          } catch (e) {
            console.warn('Failed to fetch child classrooms:', e);
            setChildClassrooms([]);
          }

          // Fetch watch history
          if (contentsData.length > 0) {
            const contentIds = contentsData.map(c => c.id);
            const history = await getWatchHistory(user?.uid, contentIds);
            setWatchHistory(history);
          }
        }
      } catch (err) {
        console.error('Failed to fetch classroom:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchData();
    }
  }, [classroomId, isAuthenticated, isAdmin, user, authLoading]);

  // Refresh watch history when navigating back to this page
  // Use contentIds string to avoid reference comparison issues
  const contentIdsKey = useMemo(() => contents.map(c => c.id).join(','), [contents]);

  useEffect(() => {
    const refreshWatchHistory = async (): Promise<void> => {
      if (contents.length > 0 && hasAccess) {
        try {
          const contentIds = contents.map(c => c.id);
          const history = await getWatchHistory(user?.uid, contentIds);
          setWatchHistory(history);
        } catch (e) {
          console.warn('Failed to refresh watch history:', e);
        }
      }
    };

    refreshWatchHistory();
  }, [location.key, contentIdsKey, hasAccess, user?.uid]);

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
            <p className="mt-4 text-gray-700 font-medium">{error}</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
              ホームに戻る
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Lock className="w-16 h-16 text-amber-400 mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-gray-900">{classroom!.name}</h2>
            <p className="mt-2 text-gray-600">この教室は現在非公開です</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
              ホームに戻る
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Classroom Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Breadcrumb */}
          <Breadcrumb hierarchy={hierarchy} />

          {/* Back button - shows parent if exists, otherwise home */}
          {classroom!.parentClassroomId ? (
            <Link
              to={`/classroom/${classroom!.parentClassroomId}`}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white px-4 py-2 rounded-lg transition-colors mb-6 backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              親教室に戻る
            </Link>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white px-4 py-2 rounded-lg transition-colors mb-6 backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              教室一覧に戻る
            </Link>
          )}
          <h1 className="text-3xl font-bold">{classroom!.name}</h1>
          {classroom!.description && (
            <p className="mt-3 text-indigo-100 max-w-3xl">{classroom!.description}</p>
          )}
          {/* Content stats */}
          <div className="mt-4 flex items-center gap-4 text-indigo-200 text-sm flex-wrap">
            {contents.length > 0 && (
              <>
                <span className="flex items-center gap-1.5">
                  <Play className="w-4 h-4" />
                  {contents.length}本
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatTotalDuration(totalDuration)}
                </span>
              </>
            )}
            {childClassrooms.length > 0 && (
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" />
                {childClassrooms.length} 子教室
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Child Classrooms Section */}
      {childClassrooms.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">子教室</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {childClassrooms.map((child) => (
              <ChildClassroomItem key={child.id} classroom={child} />
            ))}
          </div>
        </div>
      )}

      {/* Contents List */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${childClassrooms.length > 0 ? 'py-6' : 'py-12'}`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">コンテンツ一覧</h2>
          {isAdmin && (
            <Link
              to={`/admin/classrooms/${classroomId}/upload`}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">コンテンツ追加</span>
            </Link>
          )}
        </div>

        {contents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Play className="w-16 h-16 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">コンテンツがありません</p>
            {isAdmin && (
              <Link
                to={`/admin/classrooms/${classroomId}/upload`}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                最初のコンテンツを追加
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Table Header - Desktop only (sortable) */}
              <div className="hidden sm:flex items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider gap-4">
                <button
                  onClick={() => handleSort('order')}
                  className="w-8 flex items-center justify-center hover:text-gray-700 transition-colors"
                  title="公開順でソート"
                >
                  #
                  {sortBy === 'order' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSort('title')}
                  className="flex-1 flex items-center gap-1 hover:text-gray-700 transition-colors text-left"
                >
                  タイトル
                  {sortBy === 'title' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSort('duration')}
                  className="w-20 flex items-center justify-center gap-1 hover:text-gray-700 transition-colors"
                >
                  時間
                  {sortBy === 'duration' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSort('createdAt')}
                  className="w-28 flex items-center gap-1 hover:text-gray-700 transition-colors"
                >
                  作成日
                  {sortBy === 'createdAt' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                {isAdmin && <div className="w-8"></div>}
              </div>
              {/* Content List */}
              <div>
                {paginatedContents.map((content) => {
                  return (
                    <ContentListItem
                      key={content.id}
                      content={content}
                      isAdmin={isAdmin}
                      onDelete={(id) => setContents(prev => prev.filter(c => c.id !== id))}
                      watchedInfo={watchHistory[content.id]}
                      isLocked={false}
                      customerId={customerId}
                    />
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={contents.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ClassroomPage;
