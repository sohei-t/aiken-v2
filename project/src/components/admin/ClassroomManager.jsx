import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Lock, Globe, Upload, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Play, Clock, Calendar, GripVertical, Square, CheckSquare, FolderPlus, CornerDownRight } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../hooks/useAuth';
import { getClassrooms, createClassroom, updateClassroom, deleteClassroom, getContents, deleteContent, updateClassroomOrders, updateContentOrders, deleteClassrooms, deleteContents, getRootClassrooms, cleanupOrphanedClassrooms } from '../../services/firebase';

const ClassroomForm = ({ classroom, onSave, onCancel, parentClassrooms = [], initialParentId = null }) => {
  const [name, setName] = useState(classroom?.name || '');
  const [description, setDescription] = useState(classroom?.description || '');
  const [accessType, setAccessType] = useState(classroom?.accessType || 'draft');
  const [order, setOrder] = useState(classroom?.order || 0);
  const [freeEpisodeCount, setFreeEpisodeCount] = useState(classroom?.freeEpisodeCount ?? 5);
  const [isActive, setIsActive] = useState(classroom?.isActive ?? true);
  const [parentClassroomId, setParentClassroomId] = useState(
    classroom?.parentClassroomId || initialParentId || ''
  );
  const [saving, setSaving] = useState(false);

  // Don't allow changing parent when editing (for simplicity)
  const isEditing = !!classroom;
  const isChild = classroom?.depth > 0 || parentClassroomId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        description,
        accessType,
        order: parseInt(order) || 0,
        freeEpisodeCount: parseInt(freeEpisodeCount) ?? 5,
        isActive
      }, parentClassroomId || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
      {/* Parent Classroom Selection (only for new classrooms) */}
      {!isEditing && parentClassrooms.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">親教室</label>
          <select
            value={parentClassroomId}
            onChange={(e) => setParentClassroomId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            disabled={!!initialParentId}
          >
            <option value="">（なし - ルート教室として作成）</option>
            {parentClassrooms.map(p => (
              <option key={p.id} value={p.id}>
                {(p.depth || 0) > 0 ? `　└ ${p.name}` : p.name}
              </option>
            ))}
          </select>
          {isChild && (
            <p className="mt-1 text-xs text-gray-500">
              この教室は子教室として作成されます
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">教室名 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          placeholder="例: JavaScript入門"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          placeholder="教室の説明を入力"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">アクセス設定</label>
          <select
            value={accessType}
            onChange={(e) => setAccessType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          >
            <option value="public">有料公開（サブスク会員のみ視聴可能）</option>
            <option value="free">無料公開（全ユーザーが視聴可能）</option>
            <option value="draft">下書き（管理者のみ表示）</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">無料公開話数</label>
          <input
            type="number"
            value={freeEpisodeCount}
            onChange={(e) => setFreeEpisodeCount(e.target.value)}
            min={0}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            placeholder="5"
          />
          <p className="mt-1 text-xs text-gray-500">0で全話有料、空欄で5話無料</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">表示順序</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm text-gray-700">
          この教室を有効にする
        </label>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || !name}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {classroom ? '更新' : '作成'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};

// Sortable Content Item
const SortableContentItem = ({ content, isSelected, onSelect, onDelete, deletingId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
      {/* Checkbox */}
      <button
        onClick={() => onSelect(content.id)}
        className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
      >
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-blue-600" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Play className="w-3 h-3 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {content.episodeNumber && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono font-semibold bg-indigo-100 text-indigo-700 rounded">
            {content.episodeNumber}
          </span>
        )}
        <Link to={`/viewer/${content.id}`} className="text-sm font-medium text-gray-700 hover:text-indigo-600 truncate">
          {content.title}
        </Link>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        {formatDuration(content.duration)}
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Calendar className="w-3 h-3" />
        {formatDate(content.createdAt)}
      </div>
      <button
        onClick={() => onDelete(content)}
        disabled={deletingId === content.id}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
        title="削除"
      >
        {deletingId === content.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

// Content list for a classroom with drag-and-drop and bulk delete
const ClassroomContents = ({ classroomId, onMessage, onContentCountChange }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchContents = async () => {
      try {
        const data = await getContents(classroomId);
        setContents(data);
      } catch (err) {
        console.error('Failed to fetch contents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContents();
  }, [classroomId]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = contents.findIndex((c) => c.id === active.id);
    const newIndex = contents.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const oldContents = contents;
    const newContents = arrayMove(contents, oldIndex, newIndex);
    setContents(newContents);

    // Save to Firestore
    try {
      await updateContentOrders(newContents);
      onMessage({ type: 'success', text: 'コンテンツの順序を更新しました' });
    } catch (err) {
      console.error('Failed to update content order:', err);
      onMessage({ type: 'error', text: '順序の更新に失敗しました' });
      setContents(oldContents);
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === contents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contents.map(c => c.id)));
    }
  };

  const handleDelete = async (content) => {
    if (!window.confirm(`「${content.title}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      return;
    }

    setDeletingId(content.id);
    try {
      await deleteContent(content.id);
      setContents(contents.filter(c => c.id !== content.id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(content.id);
        return newSet;
      });
      onMessage({ type: 'success', text: `「${content.title}」を削除しました` });
      onContentCountChange && onContentCountChange(-1);
    } catch (err) {
      console.error('Failed to delete content:', err);
      onMessage({ type: 'error', text: 'コンテンツの削除に失敗しました' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!window.confirm(`${count}件のコンテンツを削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      await deleteContents(Array.from(selectedIds));
      setContents(contents.filter(c => !selectedIds.has(c.id)));
      onMessage({ type: 'success', text: `${count}件のコンテンツを削除しました` });
      onContentCountChange && onContentCountChange(-count);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to bulk delete contents:', err);
      onMessage({ type: 'error', text: '一括削除に失敗しました' });
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        コンテンツがありません
      </div>
    );
  }

  return (
    <div>
      {/* Bulk Actions Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="p-0.5 text-gray-500 hover:text-blue-600 transition-colors"
          >
            {selectedIds.size === contents.length ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <span className="text-xs text-gray-600">
            {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : '全選択'}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {bulkDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            {bulkDeleting ? `${selectedIds.size}件削除中...` : '選択削除'}
          </button>
        )}
      </div>

      {/* Bulk delete overlay */}
      {bulkDeleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">{selectedIds.size}件のコンテンツを削除中...</p>
              <p className="text-sm text-gray-500 mt-1">しばらくお待ちください</p>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={contents.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-gray-100">
            {contents.map((content) => (
              <SortableContentItem
                key={content.id}
                content={content}
                isSelected={selectedIds.has(content.id)}
                onSelect={handleSelect}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

// Sortable Classroom Item
const SortableClassroomItem = ({
  classroom,
  isSelected,
  onSelect,
  isExpanded,
  onToggleExpand,
  setEditingClassroom,
  handleDelete,
  onMessage,
  onContentCountChange,
  onCreateChild,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: classroom.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = (classroom.childCount || 0) > 0;
  const canAddChild = (classroom.depth || 0) < 2;

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
        (classroom.depth || 0) === 2 ? 'pl-20 bg-gray-100/50' :
        (classroom.depth || 0) === 1 ? 'pl-12 bg-gray-50/50' : ''
      }`}>
        <div className="flex items-center gap-4">
          {/* Child indicator */}
          {(classroom.depth || 0) > 0 && (
            <CornerDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          {/* Checkbox */}
          <button
            onClick={() => onSelect(classroom.id)}
            className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          {/* Expand Button */}
          <button
            onClick={onToggleExpand}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          <div className={`p-2 rounded-lg ${
            classroom.accessType === 'free'
              ? 'bg-green-100 text-green-600'
              : classroom.accessType === 'public'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {classroom.accessType === 'draft' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Globe className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{classroom.name}</h3>
              {!classroom.isActive && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  無効
                </span>
              )}
              {hasChildren && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                  {classroom.childCount} 子教室
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {classroom.contentCount || 0} コンテンツ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/classrooms/${classroom.id}/upload`}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="コンテンツ追加"
          >
            <Upload className="w-5 h-5" />
          </Link>
          {/* Add Child Classroom Button (only for root classrooms) */}
          {canAddChild && (
            <button
              onClick={() => onCreateChild(classroom.id)}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="子教室を追加"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setEditingClassroom(classroom)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="編集"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(classroom)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="削除"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Expanded Content List */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-100">
          <ClassroomContents
            classroomId={classroom.id}
            onMessage={onMessage}
            onContentCountChange={(delta) => onContentCountChange(classroom.id, delta)}
          />
        </div>
      )}
    </div>
  );
};

const ClassroomManager = () => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClassroom, setEditingClassroom] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingChildOf, setCreatingChildOf] = useState(null); // Parent ID when creating child
  const [message, setMessage] = useState(null);
  const [expandedClassrooms, setExpandedClassrooms] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchClassrooms = async () => {
    try {
      const data = await getClassrooms(true, user?.uid, true);
      setClassrooms(data);
    } catch (err) {
      console.error('Failed to fetch classrooms:', err);
      setMessage({ type: 'error', text: '教室の取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fix orphaned classrooms (children whose parent was deleted)
    const initAndFetch = async () => {
      try {
        const fixed = await cleanupOrphanedClassrooms();
        if (fixed > 0) {
          console.log(`Auto-fixed ${fixed} orphaned classroom(s)`);
          setMessage({ type: 'success', text: `${fixed}件の孤立した教室を修復しました（ルート教室に移動）` });
        }
      } catch (e) {
        console.warn('Orphan cleanup failed:', e);
      }
      fetchClassrooms();
    };
    initAndFetch();
  }, [user]);

  // Organize classrooms into hierarchy (handling orphans whose parent was deleted)
  const { rootClassrooms, childClassroomsMap, parentClassroomsForForm, flattenedClassroomIds } = React.useMemo(() => {
    const classroomIds = new Set(classrooms.map(c => c.id));
    const roots = [];
    const childMap = {};
    classrooms.forEach(c => {
      if (!c.parentClassroomId || !classroomIds.has(c.parentClassroomId)) {
        roots.push(c);
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
    // Build flattened ID list matching DOM render order (for SortableContext)
    const flatIds = [];
    roots.forEach(root => {
      flatIds.push(root.id);
      (childMap[root.id] || []).forEach(child => {
        flatIds.push(child.id);
        (childMap[child.id] || []).forEach(gc => {
          flatIds.push(gc.id);
        });
      });
    });
    // Parent classrooms for form (depth 0 and 1)
    const parentsForForm = classrooms.filter(c => (c.depth || 0) < 2);
    return { rootClassrooms: roots, childClassroomsMap: childMap, parentClassroomsForForm: parentsForForm, flattenedClassroomIds: flatIds };
  }, [classrooms]);

  const toggleExpandClassroom = (id) => {
    setExpandedClassrooms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine parent level of dragged items
    const activeClassroom = classrooms.find(c => c.id === active.id);
    const overClassroom = classrooms.find(c => c.id === over.id);
    if (!activeClassroom || !overClassroom) return;

    // Only allow reorder within same parent level
    const activeParent = activeClassroom.parentClassroomId || null;
    const overParent = overClassroom.parentClassroomId || null;
    if (activeParent !== overParent) return;

    // Get siblings at this level
    const siblings = activeParent
      ? (childClassroomsMap[activeParent] || [])
      : rootClassrooms;

    const oldIndex = siblings.findIndex(c => c.id === active.id);
    const newIndex = siblings.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSiblings = arrayMove(siblings, oldIndex, newIndex);

    // Update local order property so useMemo sort reflects new order
    const orderMap = {};
    newSiblings.forEach((c, i) => { orderMap[c.id] = i; });

    setClassrooms(prev => prev.map(c =>
      orderMap[c.id] !== undefined ? { ...c, order: orderMap[c.id] } : c
    ));

    // Save to Firestore
    try {
      await updateClassroomOrders(newSiblings);
      setMessage({ type: 'success', text: '教室の順序を更新しました' });
    } catch (err) {
      console.error('Failed to update classroom order:', err);
      setMessage({ type: 'error', text: '順序の更新に失敗しました' });
      fetchClassrooms();
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === classrooms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(classrooms.map(c => c.id)));
    }
  };

  const handleCreate = async (data, parentId) => {
    try {
      await createClassroom(data, user.uid, parentId);
      const isChild = !!parentId;
      setMessage({ type: 'success', text: isChild ? '子教室を作成しました' : '教室を作成しました' });
      setIsCreating(false);
      setCreatingChildOf(null);
      fetchClassrooms();
    } catch (err) {
      console.error('Failed to create classroom:', err);
      setMessage({ type: 'error', text: err.message || '教室の作成に失敗しました' });
    }
  };

  const handleCreateChild = (parentId) => {
    setCreatingChildOf(parentId);
    setIsCreating(true);
    setEditingClassroom(null);
  };

  const handleUpdate = async (data) => {
    try {
      await updateClassroom(editingClassroom.id, data);
      setMessage({ type: 'success', text: '教室を更新しました' });
      setEditingClassroom(null);
      fetchClassrooms();
    } catch (err) {
      console.error('Failed to update classroom:', err);
      setMessage({ type: 'error', text: '教室の更新に失敗しました' });
    }
  };

  const handleDelete = async (classroom) => {
    const hasChildren = (classroom.childCount || 0) > 0;
    const confirmMsg = hasChildren
      ? `「${classroom.name}」と配下の子教室・コンテンツをすべて削除してもよろしいですか？\nこの操作は取り消せません。`
      : `「${classroom.name}」を削除してもよろしいですか？\nこの操作は取り消せません。`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteClassroom(classroom.id);
      setMessage({ type: 'success', text: '教室を削除しました' });
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(classroom.id);
        return newSet;
      });
      fetchClassrooms();
    } catch (err) {
      console.error('Failed to delete classroom:', err);
      setMessage({ type: 'error', text: err.message || '教室の削除に失敗しました' });
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!window.confirm(`${count}件の教室を削除してもよろしいですか？\n教室内のコンテンツも削除されます。\nこの操作は取り消せません。`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      await deleteClassrooms(Array.from(selectedIds));
      setMessage({ type: 'success', text: `${count}件の教室を削除しました` });
      setSelectedIds(new Set());
      fetchClassrooms();
    } catch (err) {
      console.error('Failed to bulk delete classrooms:', err);
      setMessage({ type: 'error', text: '一括削除に失敗しました' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleContentCountChange = (classroomId, delta) => {
    setClassrooms(prev => prev.map(c => {
      if (c.id === classroomId) {
        return { ...c, contentCount: Math.max(0, (c.contentCount || 0) + delta) };
      }
      return c;
    }));
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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

      {/* Create/Edit Form */}
      {(isCreating || editingClassroom) && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingClassroom
              ? '教室を編集'
              : creatingChildOf
                ? `子教室を作成 (親: ${classrooms.find(p => p.id === creatingChildOf)?.name || ''})`
                : '新しい教室を作成'
            }
          </h2>
          <ClassroomForm
            classroom={editingClassroom}
            onSave={editingClassroom ? handleUpdate : handleCreate}
            onCancel={() => { setIsCreating(false); setEditingClassroom(null); setCreatingChildOf(null); }}
            parentClassrooms={parentClassroomsForForm}
            initialParentId={creatingChildOf}
          />
        </div>
      )}

      {/* Header */}
      {!isCreating && !editingClassroom && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">教室一覧 ({classrooms.length})</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            教室を追加
          </button>
        </div>
      )}

      {/* Bulk delete overlay for classrooms */}
      {bulkDeleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">{selectedIds.size}件の教室を削除中...</p>
              <p className="text-sm text-gray-500 mt-1">しばらくお待ちください</p>
            </div>
          </div>
        </div>
      )}

      {/* Classrooms List */}
      {!isCreating && !editingClassroom && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {classrooms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">教室がありません</p>
            </div>
          ) : (
            <>
              {/* Bulk Actions Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="p-0.5 text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    {selectedIds.size === classrooms.length ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : '全選択'}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    ドラッグで並び替え可能
                  </span>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-1 px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    選択削除
                  </button>
                )}
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={flattenedClassroomIds} strategy={verticalListSortingStrategy}>
                  <div className="divide-y divide-gray-200">
                    {rootClassrooms.map((classroom) => (
                      <React.Fragment key={classroom.id}>
                        <SortableClassroomItem
                          classroom={classroom}
                          isSelected={selectedIds.has(classroom.id)}
                          onSelect={handleSelect}
                          isExpanded={expandedClassrooms.has(classroom.id)}
                          onToggleExpand={() => toggleExpandClassroom(classroom.id)}
                          setEditingClassroom={setEditingClassroom}
                          handleDelete={handleDelete}
                          onMessage={setMessage}
                          onContentCountChange={handleContentCountChange}
                          onCreateChild={handleCreateChild}
                        />
                        {/* Render child classrooms */}
                        {childClassroomsMap[classroom.id]?.map((childClassroom) => (
                          <React.Fragment key={childClassroom.id}>
                            <SortableClassroomItem
                              classroom={childClassroom}
                              isSelected={selectedIds.has(childClassroom.id)}
                              onSelect={handleSelect}
                              isExpanded={expandedClassrooms.has(childClassroom.id)}
                              onToggleExpand={() => toggleExpandClassroom(childClassroom.id)}
                              setEditingClassroom={setEditingClassroom}
                              handleDelete={handleDelete}
                              onMessage={setMessage}
                              onContentCountChange={handleContentCountChange}
                              onCreateChild={handleCreateChild}
                            />
                            {/* Render grandchild classrooms */}
                            {childClassroomsMap[childClassroom.id]?.map((grandchild) => (
                              <SortableClassroomItem
                                key={grandchild.id}
                                classroom={grandchild}
                                isSelected={selectedIds.has(grandchild.id)}
                                onSelect={handleSelect}
                                isExpanded={expandedClassrooms.has(grandchild.id)}
                                onToggleExpand={() => toggleExpandClassroom(grandchild.id)}
                                setEditingClassroom={setEditingClassroom}
                                handleDelete={handleDelete}
                                onMessage={setMessage}
                                onContentCountChange={handleContentCountChange}
                                onCreateChild={handleCreateChild}
                              />
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ClassroomManager;
