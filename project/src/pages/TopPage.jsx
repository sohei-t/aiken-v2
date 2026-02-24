import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Lock, Users, Loader2, Plus, Search, X, CheckCircle2, Clock, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getClassrooms, getContents, getWatchHistory, syncContentCounts } from '../services/firebase';
import Layout from '../components/layout/Layout';

// Format duration (seconds to hours and minutes)
const formatTotalDuration = (seconds) => {
  if (!seconds || seconds === 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes > 0 ? `${minutes}分` : ''}`;
  }
  return `${minutes}分`;
};

const ClassroomListItem = ({ classroom, progress, childCount = 0, isExpanded, onToggle }) => {
  // Prefer actual count from fetched contents over stored contentCount (fixes desynced data)
  const totalContents = progress?.totalCount ?? classroom.contentCount ?? 0;
  const watchedCount = progress?.watchedCount || 0;
  const progressPercent = totalContents > 0 ? Math.round((watchedCount / totalContents) * 100) : 0;
  const isComplete = totalContents > 0 && watchedCount >= totalContents;
  const hasChildren = childCount > 0;

  return (
    <div
      className={`flex items-center gap-4 p-4 bg-white hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
        (classroom.depth || 0) === 2 ? 'pl-12 sm:pl-20 bg-gray-100/30' :
        (classroom.depth || 0) === 1 ? 'pl-8 sm:pl-12 bg-gray-50/30' : ''
      }`}
    >
      {/* Accordion toggle or child indicator */}
      {hasChildren ? (
        <button
          onClick={onToggle}
          className="flex-shrink-0 -ml-2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      ) : (classroom.depth || 0) > 0 ? (
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 -ml-2" />
      ) : (
        <div className="w-4 flex-shrink-0 -ml-2" />
      )}
      {/* Icon */}
      <Link
        to={`/classroom/${classroom.id}`}
        className="group flex items-center gap-4 flex-1 min-w-0"
      >
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center relative ${
          hasChildren
            ? 'bg-gradient-to-br from-purple-100 to-indigo-100'
            : 'bg-gradient-to-br from-blue-100 to-indigo-100'
        }`}>
          {hasChildren ? (
            <FolderOpen className="w-6 h-6 text-purple-500" />
          ) : (
            <BookOpen className="w-6 h-6 text-blue-500" />
          )}
          {isComplete && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
              {classroom.name}
            </h3>
            {classroom.accessType === 'draft' && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <Lock className="w-3 h-3" />
                下書き
              </span>
            )}
            {classroom.accessType === 'free' && (
              <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600">
                無料
              </span>
            )}
            {hasChildren && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {childCount} 子教室
              </span>
            )}
          </div>
          {/* Progress Bar for List View */}
          {totalContents > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-32">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
                {watchedCount}/{totalContents}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Meta */}
      <div className="flex-shrink-0 flex items-center gap-4 text-sm text-gray-500">
        {progress?.totalDuration > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatTotalDuration(progress.totalDuration)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{totalContents}</span>
        </div>
      </div>
    </div>
  );
};

const TopPage = () => {
  const { isAuthenticated, isAdmin, customerId, user, loading: authLoading } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  const syncedRef = useRef(false);

  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const data = await getClassrooms(customerId, isAdmin);
        setClassrooms(data);

        // Admin: auto-repair desynced contentCount in background (once per session)
        if (isAdmin && !syncedRef.current) {
          syncedRef.current = true;
          syncContentCounts(customerId)
            .then(n => {
              if (n > 0) {
                // Re-fetch with corrected counts
                getClassrooms(customerId, true).then(setClassrooms);
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error('Failed to fetch classrooms:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchClassrooms();
    }
  }, [isAuthenticated, isAdmin, customerId, user, authLoading]);

  // Fetch progress data for each classroom
  // Use classrooms.length as dependency to avoid reference comparison issues
  const classroomIds = useMemo(() => classrooms.map(c => c.id).join(','), [classrooms]);

  useEffect(() => {
    const fetchProgressData = async () => {
      if (classrooms.length === 0) return;

      const progress = {};

      // Fetch contents and watch history for each classroom
      for (const classroom of classrooms) {
        try {
          const contents = await getContents(customerId, classroom.id);
          if (contents.length === 0) {
            progress[classroom.id] = { watchedCount: 0, totalCount: 0, totalDuration: 0 };
            continue;
          }

          const contentIds = contents.map(c => c.id);
          const watchHistory = await getWatchHistory(user?.uid || null, contentIds);
          const watchedCount = Object.keys(watchHistory).length;

          // Calculate total duration
          const totalDuration = contents.reduce((sum, content) => sum + (content.duration || 0), 0);

          progress[classroom.id] = {
            watchedCount,
            totalCount: contents.length,
            totalDuration
          };
        } catch (err) {
          console.warn(`Failed to fetch progress for classroom ${classroom.id}:`, err);
          progress[classroom.id] = { watchedCount: 0, totalCount: 0, totalDuration: 0 };
        }
      }

      setProgressData(progress);
    };

    fetchProgressData();
  }, [classroomIds, user?.uid]);

  // Organize classrooms into hierarchy
  // If a child's parent is not in the visible list (e.g. parent is private or deleted),
  // show the child at root level (depth 0) so it remains visible and correctly positioned
  const { rootClassrooms, childClassroomsMap } = useMemo(() => {
    const classroomIds = new Set(classrooms.map(c => c.id));
    const roots = [];
    const childMap = {};
    classrooms.forEach(c => {
      if (!c.parentClassroomId || !classroomIds.has(c.parentClassroomId)) {
        // Root classroom, or parent is not visible → show at root level with depth 0
        roots.push({ ...c, depth: 0 });
      } else {
        if (!childMap[c.parentClassroomId]) {
          childMap[c.parentClassroomId] = [];
        }
        childMap[c.parentClassroomId].push(c);
      }
    });
    // Sort roots and children by order
    roots.sort((a, b) => (a.order || 0) - (b.order || 0));
    Object.keys(childMap).forEach(parentId => {
      childMap[parentId].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    return { rootClassrooms: roots, childClassroomsMap: childMap };
  }, [classrooms]);

  // Filter classrooms by search query
  const filteredClassrooms = useMemo(() => {
    if (!searchQuery.trim()) {
      return classrooms;
    }
    const query = searchQuery.toLowerCase();
    return classrooms.filter(classroom =>
      classroom.name.toLowerCase().includes(query) ||
      (classroom.description && classroom.description.toLowerCase().includes(query))
    );
  }, [classrooms, searchQuery]);

  // Filter root classrooms and build hierarchical filtered list
  const filteredRootClassrooms = useMemo(() => {
    if (!searchQuery.trim()) {
      return rootClassrooms;
    }
    const query = searchQuery.toLowerCase();
    // Include root if it matches OR if any of its children/grandchildren match
    return rootClassrooms.filter(classroom => {
      const rootMatches = classroom.name.toLowerCase().includes(query) ||
        (classroom.description && classroom.description.toLowerCase().includes(query));
      const children = childClassroomsMap[classroom.id] || [];
      const childMatches = children.some(child =>
        child.name.toLowerCase().includes(query) ||
        (child.description && child.description.toLowerCase().includes(query))
      );
      const grandchildMatches = children.some(child => {
        const grandchildren = childClassroomsMap[child.id] || [];
        return grandchildren.some(gc =>
          gc.name.toLowerCase().includes(query) ||
          (gc.description && gc.description.toLowerCase().includes(query))
        );
      });
      return rootMatches || childMatches || grandchildMatches;
    });
  }, [rootClassrooms, childClassroomsMap, searchQuery]);

  // Filter children based on search
  const getFilteredChildren = (parentId) => {
    const children = childClassroomsMap[parentId] || [];
    if (!searchQuery.trim()) {
      return children;
    }
    const query = searchQuery.toLowerCase();
    return children.filter(child =>
      child.name.toLowerCase().includes(query) ||
      (child.description && child.description.toLowerCase().includes(query))
    );
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold">
              スライド学習プラットフォーム
            </h1>
            <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
              HTMLスライドと音声解説で、効率的に学習を進めましょう
            </p>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
              >
                ログインして全ての教室にアクセス
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Classrooms Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with Search and View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900">教室一覧</h2>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="教室を検索..."
                className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Admin Add Button */}
            {isAdmin && (
              <Link
                to="/admin/classrooms"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">教室を追加</span>
              </Link>
            )}
          </div>
        </div>

        {/* Search Result Count */}
        {searchQuery && (
          <div className="mb-4 text-sm text-gray-600">
            「{searchQuery}」の検索結果: {filteredClassrooms.length}件
          </div>
        )}

        {/* Classrooms Display */}
        {filteredRootClassrooms.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">
              {searchQuery
                ? `「${searchQuery}」に一致する教室が見つかりませんでした`
                : isAuthenticated
                  ? '利用可能な教室がありません'
                  : 'ログインすると、より多くの教室にアクセスできます'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
              >
                検索をクリア
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredRootClassrooms.map((classroom) => {
              const filteredChildren = getFilteredChildren(classroom.id);
              const isSearching = !!searchQuery.trim();
              const isRootExpanded = isSearching || expandedIds.has(classroom.id);
              return (
                <div key={classroom.id}>
                  <ClassroomListItem
                    classroom={classroom}
                    progress={progressData[classroom.id]}
                    childCount={classroom.childCount || 0}
                    isExpanded={isRootExpanded}
                    onToggle={() => toggleExpand(classroom.id)}
                  />
                  {/* Render child classrooms (accordion) */}
                  {isRootExpanded && filteredChildren.map((childClassroom) => {
                    const filteredGrandchildren = getFilteredChildren(childClassroom.id);
                    const isChildExpanded = isSearching || expandedIds.has(childClassroom.id);
                    return (
                      <div key={childClassroom.id}>
                        <ClassroomListItem
                          classroom={childClassroom}
                          progress={progressData[childClassroom.id]}
                          childCount={childClassroom.childCount || 0}
                          isExpanded={isChildExpanded}
                          onToggle={() => toggleExpand(childClassroom.id)}
                        />
                        {/* Render grandchild classrooms (accordion) */}
                        {isChildExpanded && filteredGrandchildren.map((grandchild) => (
                          <ClassroomListItem
                            key={grandchild.id}
                            classroom={grandchild}
                            progress={progressData[grandchild.id]}
                            childCount={0}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TopPage;
