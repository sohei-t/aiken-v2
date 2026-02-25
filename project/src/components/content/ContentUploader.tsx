import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2, ArrowLeft, Files, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { uploadFile, createContent, getClassroom, getContents } from '../../services/firebase';
import Layout from '../layout/Layout';
import type { Classroom, FilePair, UploadProgress } from '../../types';

interface SingleFiles {
  html: File | null;
  mp3: File | null;
}

const ContentUploader: React.FC = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();
  const { user, customerId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload mode: 'single' or 'bulk'
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

  // Single mode state
  const [files, setFiles] = useState<SingleFiles>({ html: null, mp3: null });
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [order, setOrder] = useState<number | string>(0);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');

  // Bulk mode state
  const [filePairs, setFilePairs] = useState<FilePair[]>([]);
  const [useFilenameAsTitle, setUseFilenameAsTitle] = useState<boolean>(true);

  // Common state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ current: 0, total: 0, percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [existingContentCount, setExistingContentCount] = useState<number>(0);

  // Loading state for initial data
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch classroom info and existing content count
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setIsLoading(true);
        const [classroomData, contents] = await Promise.all([
          getClassroom(customerId, classroomId!),
          getContents(customerId, classroomId!)
        ]);
        setClassroom(classroomData);
        setExistingContentCount(contents.length);
      } catch (err) {
        console.error('Failed to fetch classroom data:', err);
        setError('教室データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [classroomId]);

  // Extract base name from filename (without extension)
  const getBaseName = (filename: string): string => {
    return filename.replace(/\.(html|mp3)$/i, '');
  };

  // Extract episode number (e.g. "01-01") from filename
  const extractEpisodeNumber = (filename: string): string | null => {
    const match = filename.match(/(\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  // Extract title from HTML <h1> tag
  const extractTitleFromHtml = async (htmlFile: File): Promise<string | null> => {
    try {
      const text = await htmlFile.text();
      const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(h1Match[0], 'text/html');
        const extractedTitle = doc.body.textContent?.replace(/\s+/g, ' ').trim();
        if (extractedTitle) return extractedTitle;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Get MP3 duration in seconds
  const getMp3Duration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;

      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);
        resolve(Math.round(duration));
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 10000);
    });
  };

  // Process files for both single and bulk modes
  const processFiles = useCallback(async (fileList: FileList): Promise<void> => {
    setError(null);
    const htmlFiles: File[] = [];
    const mp3Files: File[] = [];

    Array.from(fileList).forEach((file) => {
      if (file.name.toLowerCase().endsWith('.html')) {
        htmlFiles.push(file);
      } else if (file.name.toLowerCase().endsWith('.mp3')) {
        mp3Files.push(file);
      }
    });

    if (htmlFiles.length === 0 && mp3Files.length === 0) {
      setError('HTMLファイルまたはMP3ファイルを選択してください');
      return;
    }

    // Determine mode based on file count
    const totalPairs = Math.max(htmlFiles.length, mp3Files.length);

    if (totalPairs === 1) {
      // Single mode
      setUploadMode('single');
      const matchedHtml = htmlFiles[0] || null;
      const matchedMp3 = mp3Files[0] || null;

      setFiles({ html: matchedHtml, mp3: matchedMp3 });

      // Auto-set title: try HTML <h1> first, then fall back to filename
      if (matchedHtml) {
        const htmlTitle = await extractTitleFromHtml(matchedHtml);
        if (htmlTitle) {
          setTitle(htmlTitle);
        } else if (useFilenameAsTitle || !title) {
          setTitle(getBaseName(matchedHtml.name));
        }
      } else if (matchedMp3 && (useFilenameAsTitle || !title)) {
        setTitle(getBaseName(matchedMp3.name));
      }
    } else {
      // Bulk mode - find all pairs
      setUploadMode('bulk');

      // Create a map of base names to files
      const fileMap = new Map<string, { html: File | null; mp3: File | null; title: string; order: number }>();

      htmlFiles.forEach(file => {
        const baseName = getBaseName(file.name);
        if (!fileMap.has(baseName)) {
          fileMap.set(baseName, { html: null, mp3: null, title: baseName, order: 0 });
        }
        fileMap.get(baseName)!.html = file;
      });

      mp3Files.forEach(file => {
        const baseName = getBaseName(file.name);
        if (!fileMap.has(baseName)) {
          fileMap.set(baseName, { html: null, mp3: null, title: baseName, order: 0 });
        }
        fileMap.get(baseName)!.mp3 = file;
      });

      // Extract titles from HTML <h1> tags
      for (const [, entry] of fileMap) {
        if (entry.html) {
          const htmlTitle = await extractTitleFromHtml(entry.html);
          if (htmlTitle) {
            entry.title = htmlTitle;
          }
        }
      }

      // Convert to array and sort by base filename for consistent ordering
      const pairs: FilePair[] = Array.from(fileMap.entries())
        .sort(([aKey], [bKey]) => aKey.localeCompare(bKey, 'ja'))
        .map(([, pair], index) => ({
          ...pair,
          id: `${Date.now()}-${index}`,
          order: existingContentCount + index + 1
        }));

      setFilePairs(pairs);
    }
  }, [title, useFilenameAsTitle, existingContentCount]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (type: 'html' | 'mp3'): void => {
    setFiles((prev) => ({ ...prev, [type]: null }));
  };

  const removePair = (id: string): void => {
    setFilePairs(prev => prev.filter(p => p.id !== id));
  };

  const updatePairTitle = (id: string, newTitle: string): void => {
    setFilePairs(prev => prev.map(p =>
      p.id === id ? { ...p, title: newTitle } : p
    ));
  };

  const updatePairOrder = (id: string, newOrder: string): void => {
    setFilePairs(prev => prev.map(p =>
      p.id === id ? { ...p, order: parseInt(newOrder) || 0 } : p
    ));
  };

  const clearAll = (): void => {
    setFiles({ html: null, mp3: null });
    setFilePairs([]);
    setTitle('');
    setDescription('');
    setOrder(0);
    setYoutubeUrl('');
    setUploadMode('single');
    setError(null);
  };

  // Upload a single content item
  const uploadSingleContent = async (
    htmlFile: File | null,
    mp3File: File | null,
    contentTitle: string,
    contentDescription: string | undefined,
    contentOrder: number | string,
    episodeNumber: string | null,
    contentYoutubeUrl?: string
  ): Promise<void> => {
    const contentData: Record<string, unknown> = {
      title: contentTitle.trim(),
      description: contentDescription?.trim() || '',
      order: parseInt(String(contentOrder)) || 0
    };

    // Add YouTube URL if provided
    if (contentYoutubeUrl?.trim()) {
      contentData.youtubeUrl = contentYoutubeUrl.trim();
    }

    // Add episode number if available
    if (episodeNumber) {
      contentData.episodeNumber = episodeNumber;
    }

    // Read HTML content and upload
    if (htmlFile) {
      const htmlContent = await htmlFile.text();
      contentData.htmlContent = htmlContent;

      try {
        const htmlResult = await uploadFile(htmlFile, classroomId!);
        contentData.htmlFileId = htmlResult.fileId;
        contentData.htmlUrl = htmlResult.url;
      } catch (err) {
        console.warn('Drive upload failed, using Firestore only:', err);
      }
    }

    // Upload MP3 and get duration
    if (mp3File) {
      // Get duration before upload
      const duration = await getMp3Duration(mp3File);
      if (duration) {
        contentData.duration = duration;
      }

      const mp3Result = await uploadFile(mp3File, classroomId!);
      contentData.mp3FileId = mp3Result.fileId;
      contentData.mp3Url = mp3Result.url;
    }

    // Create content document
    await createContent(customerId!, contentData, classroomId!, user!.uid);
  };

  // Handle single upload
  const handleSingleUpload = async (): Promise<void> => {
    if (!files.html && !files.mp3) {
      setError('少なくとも1つのファイルを選択してください');
      return;
    }

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: 1, percent: 0 });
    setError(null);

    try {
      setUploadProgress({ current: 0, total: 1, percent: 50 });
      const epNum = files.html ? extractEpisodeNumber(files.html.name) : null;
      await uploadSingleContent(files.html, files.mp3, title, description, order, epNum, youtubeUrl);
      setUploadProgress({ current: 1, total: 1, percent: 100 });

      setTimeout(() => {
        navigate(`/classroom/${classroomId}`);
      }, 1000);
    } catch (err) {
      console.error('Upload failed:', err);
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('アップロードに失敗しました: ' + errMessage);
      setUploading(false);
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async (): Promise<void> => {
    if (filePairs.length === 0) {
      setError('アップロードするファイルがありません');
      return;
    }

    // Validate all pairs have titles
    const invalidPairs = filePairs.filter(p => !p.title.trim());
    if (invalidPairs.length > 0) {
      setError('すべてのコンテンツにタイトルを入力してください');
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: filePairs.length, percent: 0 });
    setError(null);

    try {
      for (let i = 0; i < filePairs.length; i++) {
        const pair = filePairs[i];
        setUploadProgress({
          current: i,
          total: filePairs.length,
          percent: Math.round((i / filePairs.length) * 100)
        });

        const epNum = pair.html ? extractEpisodeNumber(pair.html.name) : null;
        await uploadSingleContent(pair.html, pair.mp3, pair.title, '', pair.order, epNum);
      }

      setUploadProgress({ current: filePairs.length, total: filePairs.length, percent: 100 });

      setTimeout(() => {
        navigate(`/classroom/${classroomId}`);
      }, 1500);
    } catch (err) {
      console.error('Bulk upload failed:', err);
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('アップロードに失敗しました: ' + errMessage);
      setUploading(false);
    }
  };

  const handleUpload = (): void => {
    if (uploadMode === 'single') {
      handleSingleUpload();
    } else {
      handleBulkUpload();
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          to={`/classroom/${classroomId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {classroom?.name || '教室'}に戻る
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">コンテンツをアップロード</h1>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Options */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useFilenameAsTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseFilenameAsTitle(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              タイトルを自動取得する
            </span>
          </label>
          <p className="mt-1 ml-7 text-xs text-gray-500">
            HTMLの見出し（h1）から自動取得します。見出しがない場合はファイル名を使用します
          </p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".html,.mp3"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700">
            ファイルをドラッグ＆ドロップ
          </p>
          <p className="mt-2 text-sm text-gray-500">
            または クリックしてファイルを選択
          </p>
          <p className="mt-4 text-xs text-gray-400">
            同名の .html と .mp3 ファイルは自動でペアになります（複数可）
          </p>
        </div>

        {/* Single Mode: Selected Files */}
        {uploadMode === 'single' && (files.html || files.mp3) && (
          <>
            <div className="mt-6 space-y-3">
              {files.html && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{files.html.name}</span>
                    <span className="text-sm text-gray-500">
                      ({(files.html.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile('html'); }}
                    className="p-1 hover:bg-blue-100 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              )}
              {files.mp3 && (
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-gray-900">{files.mp3.name}</span>
                    <span className="text-sm text-gray-500">
                      ({(files.mp3.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile('mp3'); }}
                    className="p-1 hover:bg-purple-100 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              )}
            </div>

            {/* Content Details Form */}
            <div className="mt-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="コンテンツのタイトル"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="コンテンツの説明（任意）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表示順序
                </label>
                <input
                  type="number"
                  value={order}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrder(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL（任意）
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYoutubeUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  無料ユーザー向けのサンプル動画URL（未入力でもOK）
                </p>
              </div>
            </div>
          </>
        )}

        {/* Bulk Mode: File Pairs List */}
        {uploadMode === 'bulk' && filePairs.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Files className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">
                  {filePairs.length}件のコンテンツを検出
                </span>
              </div>
              <button
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                すべてクリア
              </button>
            </div>

            <div className="space-y-4">
              {filePairs.map((pair, index) => (
                <div key={pair.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {pair.html && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              HTML
                            </span>
                          )}
                          {pair.mp3 && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                              MP3
                            </span>
                          )}
                          {!pair.html && !pair.mp3 && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                              ファイルなし
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            タイトル
                          </label>
                          <input
                            type="text"
                            value={pair.title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePairTitle(pair.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            表示順序
                          </label>
                          <input
                            type="number"
                            value={pair.order}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePairOrder(pair.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-gray-400 truncate">
                        {pair.html && <span>{pair.html.name}</span>}
                        {pair.html && pair.mp3 && <span> + </span>}
                        {pair.mp3 && <span>{pair.mp3.name}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => removePair(pair.id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {uploadMode === 'bulk'
                  ? `アップロード中... (${uploadProgress.current}/${uploadProgress.total})`
                  : 'アップロード中...'}
              </span>
              <span className="text-sm text-gray-500">{uploadProgress.percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
            {uploadProgress.percent === 100 && (
              <div className="mt-4 flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  {uploadMode === 'bulk'
                    ? `${filePairs.length}件のアップロード完了！`
                    : 'アップロード完了！'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={uploading || (uploadMode === 'single' ? (!files.html && !files.mp3) || !title.trim() : filePairs.length === 0)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            {uploadMode === 'bulk' ? `${filePairs.length}件をアップロード` : 'アップロード'}
          </button>
          <Link
            to={`/classroom/${classroomId}`}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default ContentUploader;
