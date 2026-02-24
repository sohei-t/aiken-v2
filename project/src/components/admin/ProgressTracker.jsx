import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getClassrooms, getContents, getCustomerUsers, getWatchHistory } from '../../services/firebase';
import { Loader2, BarChart3, Users, BookOpen, Search, ChevronDown, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

const ProgressTracker = () => {
  const { customerId } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [contentsByClassroom, setContentsByClassroom] = useState({});
  const [watchData, setWatchData] = useState({}); // { userId: Set<contentId> }
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUsers, setExpandedUsers] = useState(new Set());

  useEffect(() => {
    if (!customerId) return;

    const fetchData = async () => {
      try {
        const [classroomData, usersData] = await Promise.all([
          getClassrooms(customerId, true),
          getCustomerUsers(customerId),
        ]);

        setClassrooms(classroomData);
        setMembers(usersData.filter(u => u.role !== 'admin'));

        // Fetch contents for each classroom
        const contentsMap = {};
        const allContentIds = [];
        for (const cr of classroomData) {
          const contents = await getContents(customerId, cr.id);
          contentsMap[cr.id] = contents;
          contents.forEach(c => allContentIds.push(c.id));
        }
        setContentsByClassroom(contentsMap);

        // Fetch watch history for each non-admin user
        const watchMap = {};
        for (const user of usersData.filter(u => u.role !== 'admin')) {
          if (allContentIds.length > 0) {
            const history = await getWatchHistory(user.id, allContentIds);
            watchMap[user.id] = new Set(Object.keys(history));
          } else {
            watchMap[user.id] = new Set();
          }
        }
        setWatchData(watchMap);
      } catch (err) {
        console.error('Failed to load progress data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId]);

  // Compute per-user, per-classroom progress
  const progressMatrix = useMemo(() => {
    return members.map(user => {
      const watched = watchData[user.id] || new Set();
      const classroomProgress = {};
      let totalWatched = 0;
      let totalContents = 0;

      classrooms.forEach(cr => {
        const contents = contentsByClassroom[cr.id] || [];
        const watchedInClassroom = contents.filter(c => watched.has(c.id)).length;
        classroomProgress[cr.id] = {
          watched: watchedInClassroom,
          total: contents.length,
          percent: contents.length > 0 ? Math.round((watchedInClassroom / contents.length) * 100) : 0,
        };
        totalWatched += watchedInClassroom;
        totalContents += contents.length;
      });

      return {
        user,
        classroomProgress,
        totalWatched,
        totalContents,
        totalPercent: totalContents > 0 ? Math.round((totalWatched / totalContents) * 100) : 0,
      };
    });
  }, [members, classrooms, contentsByClassroom, watchData]);

  // Filter by classroom and search
  const filteredProgress = useMemo(() => {
    let result = progressMatrix;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.user.displayName?.toLowerCase().includes(q) ||
        p.user.email?.toLowerCase().includes(q)
      );
    }

    // Sort by progress (ascending - show those who need attention first)
    if (selectedClassroom === 'all') {
      result.sort((a, b) => a.totalPercent - b.totalPercent);
    } else {
      result.sort((a, b) =>
        (a.classroomProgress[selectedClassroom]?.percent || 0) - (b.classroomProgress[selectedClassroom]?.percent || 0)
      );
    }

    return result;
  }, [progressMatrix, selectedClassroom, searchQuery]);

  const toggleUser = (userId) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <Users className="w-12 h-12 text-gray-300 mx-auto" />
        <p className="mt-4 text-gray-500">メンバーがいません</p>
        <p className="text-sm text-gray-400 mt-1">ユーザー管理タブからメンバーを追加してください</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">受講者数</p>
            <p className="text-xl font-bold text-gray-900">{members.length}名</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">平均進捗率</p>
            <p className="text-xl font-bold text-gray-900">
              {members.length > 0
                ? Math.round(progressMatrix.reduce((s, p) => s + p.totalPercent, 0) / progressMatrix.length)
                : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">全完了者</p>
            <p className="text-xl font-bold text-gray-900">
              {progressMatrix.filter(p => p.totalPercent === 100).length}名
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メンバーを検索..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white"
          />
        </div>
        <select
          value={selectedClassroom}
          onChange={(e) => setSelectedClassroom(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全教室</option>
          {classrooms.map(cr => (
            <option key={cr.id} value={cr.id}>{cr.name}</option>
          ))}
        </select>
      </div>

      {/* Progress Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredProgress.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">該当するメンバーがいません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProgress.map(({ user, classroomProgress, totalWatched, totalContents, totalPercent }) => {
              const isExpanded = expandedUsers.has(user.id);
              const displayPercent = selectedClassroom === 'all'
                ? totalPercent
                : (classroomProgress[selectedClassroom]?.percent || 0);
              const displayWatched = selectedClassroom === 'all'
                ? totalWatched
                : (classroomProgress[selectedClassroom]?.watched || 0);
              const displayTotal = selectedClassroom === 'all'
                ? totalContents
                : (classroomProgress[selectedClassroom]?.total || 0);

              return (
                <div key={user.id}>
                  <div
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleUser(user.id)}
                  >
                    {/* Expand toggle */}
                    <button className="text-gray-400 flex-shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${
                            displayPercent >= 100 ? 'bg-green-500' : displayPercent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${displayPercent}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium w-10 text-right ${
                        displayPercent >= 100 ? 'text-green-600' : displayPercent >= 50 ? 'text-blue-600' : 'text-amber-600'
                      }`}>
                        {displayPercent}%
                      </span>
                      <span className="text-xs text-gray-500 w-16 text-right hidden sm:block">
                        {displayWatched}/{displayTotal}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: per-classroom breakdown */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 pl-12">
                      {classrooms.length === 0 ? (
                        <p className="text-sm text-gray-500">教室がありません</p>
                      ) : (
                        <div className="space-y-2">
                          {classrooms.map(cr => {
                            const cp = classroomProgress[cr.id] || { watched: 0, total: 0, percent: 0 };
                            return (
                              <div key={cr.id} className="flex items-center gap-3">
                                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{cr.name}</span>
                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className={`h-full rounded-full ${
                                      cp.percent >= 100 ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${cp.percent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                                  {cp.watched}/{cp.total}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;
