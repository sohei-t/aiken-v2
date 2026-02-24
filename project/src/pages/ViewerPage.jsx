import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, SkipBack, SkipForward, Loader2, AlertCircle, Lock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getContent, getContents, getClassroom, hasClassroomAccess, fetchMp3AsBlob, recordWatchHistory } from '../services/firebase';
import Layout from '../components/layout/Layout';
import ChatPanel from '../components/content/ChatPanel';

// AudioPlayer with external control support
const AudioPlayer = forwardRef(({ fileId, onPlayStateChange, onEnded, initialPlaybackRate = 1, onPlaybackRateChange, onLoadingChange }, ref) => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [audioSrc, setAudioSrc] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [audioError, setAudioError] = useState(null);

  // Expose control methods to parent
  useImperativeHandle(ref, () => ({
    togglePlay: () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
      }
    },
    isPlaying: () => isPlaying,
    isReady: () => !!audioSrc && !loadingAudio && !audioError,
    getPlaybackRate: () => playbackRate,
    cyclePlaybackRate: () => {
      const rates = [1, 1.5, 2];
      // Find closest rate to handle floating point comparison issues
      let currentIndex = rates.findIndex(r => Math.abs(r - playbackRate) < 0.01);
      if (currentIndex === -1) currentIndex = 0; // Default to first rate if not found
      const newRate = rates[(currentIndex + 1) % rates.length];
      setPlaybackRate(newRate);
      if (audioRef.current) {
        audioRef.current.playbackRate = newRate;
      }
      // Notify parent of playback rate change
      onPlaybackRateChange?.(newRate);
      return newRate;
    },
    // New methods for seek functionality
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    seekTo: (time) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(duration, time));
      }
    },
    skip: (seconds) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
      }
    },
  }), [isPlaying, audioSrc, loadingAudio, audioError, playbackRate, currentTime, duration, onPlaybackRateChange]);

  // Fetch MP3 from Google Drive API as Blob
  useEffect(() => {
    let blobUrl = null;
    let isCancelled = false;

    const loadAudio = async () => {
      if (!fileId) {
        setLoadingAudio(false);
        setAudioError('音声ファイルIDがありません');
        return;
      }

      try {
        // Reset state when fileId changes
        setLoadingAudio(true);
        setAudioError(null);
        setAudioSrc(null);  // Clear previous audio immediately
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        blobUrl = await fetchMp3AsBlob(fileId);

        // Only set if not cancelled (component still mounted with same fileId)
        if (!isCancelled) {
          setAudioSrc(blobUrl);
        }
      } catch (err) {
        console.error('Failed to load audio:', err);
        if (!isCancelled) {
          setAudioError('音声の読み込みに失敗しました。再ログインしてください。');
        }
      } finally {
        if (!isCancelled) {
          setLoadingAudio(false);
        }
      }
    };

    loadAudio();

    // Cleanup blob URL on unmount or when fileId changes
    return () => {
      isCancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileId]);

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(loadingAudio);
  }, [loadingAudio, onLoadingChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      // Apply initial playback rate when audio is loaded
      audio.playbackRate = playbackRate;
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
      onEnded?.();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioSrc, onPlayStateChange, playbackRate]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressClick = (e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (rect && audioRef.current) {
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      audioRef.current.currentTime = percent * duration;
    }
  };

  const skip = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  const changePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    // Find closest rate to handle floating point comparison issues
    let currentIndex = rates.findIndex(r => Math.abs(r - playbackRate) < 0.01);
    if (currentIndex === -1) currentIndex = 0; // Default to first rate if not found
    const newRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
    // Notify parent of playback rate change
    onPlaybackRateChange?.(newRate);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loadingAudio) {
    return (
      <div className="bg-gray-900 text-white p-4 rounded-lg flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>音声を読み込み中...</span>
      </div>
    );
  }

  if (audioError) {
    return (
      <div className="bg-gray-900 text-white p-4 rounded-lg">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{audioError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg">
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Progress Bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="h-2 bg-gray-700 rounded-full cursor-pointer mb-4 overflow-hidden"
      >
        <div
          className="h-full bg-blue-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Left: Time */}
        <div className="text-sm text-gray-400 w-24">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Center: Play Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => skip(-10)}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="10秒戻る"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
          <button
            onClick={() => skip(10)}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="10秒進む"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume & Speed */}
        <div className="flex items-center gap-2 w-24 justify-end">
          <button
            onClick={changePlaybackRate}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="再生速度を変更"
          >
            ×{playbackRate}
          </button>
          <button
            onClick={toggleMute}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

// CSS to inject into HTML slides - minimal, only enable scrolling + mobile fixes
const slideOverrideCSS = `
<style>
  /* Enable vertical scrolling on root elements */
  html, body {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
  }
  /* Ensure scrollability on touch devices */
  * {
    -webkit-overflow-scrolling: touch;
  }

  /* Center content on wide screens (PC) */
  body {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    min-height: 100vh !important;
  }
  body > * {
    max-width: 100% !important;
  }

  /* Mobile step-indicator fix - vertical layout */
  @media (max-width: 768px) {
    .step-indicator {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }

    .step-indicator .step {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      width: 100% !important;
    }

    .step-indicator .step-number {
      width: 28px !important;
      height: 28px !important;
      font-size: 12px !important;
      flex-shrink: 0 !important;
    }

    .step-indicator .step-label {
      font-size: 14px !important;
    }

    .step-indicator .step-line {
      display: none !important;
    }
  }
</style>
`;

const SlideViewer = ({
  htmlContent,
  isAudioPlaying,
  onToggleAudio,
  hasAudio,
  playbackRate,
  onCyclePlaybackRate,
  isAudioLoading, // NEW: track audio loading state
  // Content navigation props
  contentNavigation,
  // Header props
  headerInfo,
  // Audio player component
  audioPlayerComponent,
  // Audio seek props
  audioCurrentTime,
  audioDuration,
  onAudioSeek,
  onAudioSkip,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(true); // Default to fullscreen
  const [slideInfo, setSlideInfo] = useState({ current: 1, total: 1 });
  const [showAudioBar, setShowAudioBar] = useState(false);
  const audioBarTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const audioBarRef = useRef(null);

  // Auto-hide audio bar after inactivity
  const showAudioBarWithTimeout = () => {
    setShowAudioBar(true);
    if (audioBarTimeoutRef.current) {
      clearTimeout(audioBarTimeoutRef.current);
    }
    audioBarTimeoutRef.current = setTimeout(() => {
      setShowAudioBar(false);
    }, 5000); // Hide after 5 seconds
  };

  // Toggle audio bar visibility
  const toggleAudioBar = () => {
    if (showAudioBar) {
      setShowAudioBar(false);
      if (audioBarTimeoutRef.current) {
        clearTimeout(audioBarTimeoutRef.current);
      }
    } else {
      showAudioBarWithTimeout();
    }
  };

  // Format time for display
  const formatTime = (time) => {
    if (isNaN(time) || time === 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleProgressClick = (e) => {
    if (!audioBarRef.current || !audioDuration) return;
    const rect = audioBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * audioDuration;
    onAudioSeek?.(newTime);
    showAudioBarWithTimeout(); // Reset timeout on interaction
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (audioBarTimeoutRef.current) {
        clearTimeout(audioBarTimeoutRef.current);
      }
    };
  }, []);


  // Detect slides in iframe and setup platform control (works with standard HTML structure)
  const detectAndSetupSlides = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (!iframeDoc) return;

      // Find all slides (standard class: .slide)
      const slides = iframeDoc.querySelectorAll('.slide');
      if (slides.length === 0) {
        setSlideInfo({ current: 1, total: 1 });
        return;
      }

      // Find current active slide
      let currentIndex = 0;
      slides.forEach((slide, index) => {
        if (slide.classList.contains('active')) {
          currentIndex = index;
        }
      });

      setSlideInfo({ current: currentIndex + 1, total: slides.length });
      console.log(`Slides detected: ${slides.length}, current: ${currentIndex + 1}`);
    } catch (e) {
      console.warn('Slide detection failed:', e);
    }
  };

  // Hide content's navigation when in fullscreen (inject CSS)
  const hideContentNavigation = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (!iframeDoc) return;

      // Remove existing style first
      const existingStyle = iframeDoc.getElementById('platform-fullscreen-style');
      if (existingStyle) existingStyle.remove();

      const style = iframeDoc.createElement('style');
      style.id = 'platform-fullscreen-style';
      style.textContent = `
        /* Hide ALL navigation elements in fullscreen mode */
        .slide-nav,
        nav.slide-nav,
        nav,
        [class*="slide-nav"],
        [class*="navigation"],
        [class*="nav-"],
        .nav-btn,
        .page-indicator,
        button[id*="Btn"],
        #firstBtn, #prevBtn, #nextBtn,
        /* Fixed position elements at bottom (likely navigation) */
        [style*="position: fixed"][style*="bottom"],
        [style*="position:fixed"][style*="bottom"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          height: 0 !important;
          overflow: hidden !important;
        }

        /* CRITICAL: Fix slide layout for fullscreen - align to top, allow scroll */
        html, body {
          scroll-behavior: auto !important;
          height: auto !important;
          min-height: auto !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        /* Reset slide-container to allow content to flow naturally and center */
        .slide-container,
        [class*="slide-container"],
        [class*="slides-wrapper"],
        .slides-wrapper {
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          position: relative !important;
          width: 100% !important;
          max-width: 1200px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        /* Keep inactive slides hidden */
        .slide:not(.active) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }

        /* Active slide: reset positioning, center on desktop */
        .slide.active {
          display: block !important;
          position: relative !important;
          top: auto !important;
          left: auto !important;
          width: 100% !important;
          max-width: 1200px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          height: auto !important;
          min-height: auto !important;
          max-height: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: none !important;
          padding: 20px !important;
          padding-bottom: 80px !important;
          overflow: visible !important;
          box-sizing: border-box !important;
        }

        /* Reset any title-slide specific flex centering */
        .slide.active.title-slide {
          display: block !important;
          justify-content: flex-start !important;
          align-items: flex-start !important;
        }

        /* Generic centering for content without .slide class */
        body > *:not(script):not(style):not(link) {
          max-width: 1200px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Ensure all main content wrappers are centered */
        main, article, section, .content, .wrapper, .container, #content, #main {
          max-width: 1200px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          width: 100% !important;
        }
      `;
      iframeDoc.head.appendChild(style);

      // Force scroll to top
      iframeDoc.documentElement.scrollTop = 0;
      iframeDoc.body.scrollTop = 0;
      iframeRef.current?.contentWindow?.scrollTo(0, 0);

      console.log('Content navigation hidden for fullscreen');
    } catch (e) {
      console.warn('Failed to hide content navigation:', e);
    }
  };

  // Platform slide navigation - directly manipulate iframe content
  const goToSlide = (targetIndex) => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (!iframeDoc) return;

      const slides = iframeDoc.querySelectorAll('.slide');
      if (slides.length === 0) return;

      // Clamp target index
      const newIndex = Math.max(0, Math.min(slides.length - 1, targetIndex));

      // Remove active from all slides
      slides.forEach(slide => slide.classList.remove('active'));

      // Add active to target slide
      slides[newIndex].classList.add('active');

      // Scroll to top - multiple methods to ensure it works
      try {
        iframeDoc.documentElement.scrollTop = 0;
        iframeDoc.body.scrollTop = 0;
        iframeRef.current.contentWindow?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch (scrollError) {
        console.warn('Scroll reset failed:', scrollError);
      }

      // Update state
      setSlideInfo({ current: newIndex + 1, total: slides.length });

      console.log(`Navigated to slide ${newIndex + 1}/${slides.length}`);
    } catch (e) {
      console.warn('Slide navigation failed:', e);
    }
  };

  const goToPrevSlide = () => {
    goToSlide(slideInfo.current - 2); // -2 because current is 1-indexed
  };

  const goToNextSlide = () => {
    goToSlide(slideInfo.current); // current is 1-indexed, so this goes to next
  };

  const goToFirstSlide = () => {
    goToSlide(0);
  };

  // Inject scroll-to-top script and classList bug fix
  const scrollToTopScript = `
<script>
  // Scroll to top when loaded
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Fix classList.add/remove bug - ignore empty strings
  (function() {
    var originalAdd = DOMTokenList.prototype.add;
    var originalRemove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.add = function() {
      for (var i = 0; i < arguments.length; i++) {
        var token = arguments[i];
        if (token && token.trim && token.trim() !== '') {
          originalAdd.call(this, token);
        }
      }
    };
    DOMTokenList.prototype.remove = function() {
      for (var i = 0; i < arguments.length; i++) {
        var token = arguments[i];
        if (token && token.trim && token.trim() !== '') {
          originalRemove.call(this, token);
        }
      }
    };
  })();
</script>
`;

  // Inject CSS and scroll script into HTML content
  const enhancedHtmlContent = htmlContent ?
    htmlContent
      .replace('</head>', `${slideOverrideCSS}</head>`)
      .replace('</body>', `${scrollToTopScript}</body>`) :
    htmlContent;

  // Reset iframe scroll position when content changes
  useEffect(() => {
    if (iframeRef.current) {
      try {
        const iframeWindow = iframeRef.current.contentWindow;
        if (iframeWindow) {
          iframeWindow.scrollTo(0, 0);
        }
      } catch (e) {
        // Cross-origin restriction - script injection should handle it
      }
    }
    setSlideInfo({ current: 1, total: 1 });
  }, [htmlContent]);

  // Detect slides after iframe loads
  useEffect(() => {
    const handleIframeLoad = () => {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        detectAndSetupSlides();
      }, 100);
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
      return () => iframe.removeEventListener('load', handleIframeLoad);
    }
  }, [htmlContent]);

  // Keyboard shortcuts for slide navigation in fullscreen
  useEffect(() => {
    if (!isFullscreen || slideInfo.total <= 1) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevSlide();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, slideInfo]);

  // Initialize fullscreen body styles on mount (since fullscreen is default)
  useEffect(() => {
    // Set body styles for fullscreen
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // No longer need special back button handling since fullscreen is default
  // Navigation back to classroom is handled by the header back button

  if (!htmlContent) {
    return (
      <div className="bg-gray-100 rounded-xl p-12 text-center">
        <p className="text-gray-500">スライドがありません</p>
      </div>
    );
  }

  // Full screen mode - covers entire viewport (default view)
  // Minimalist overlay UI for maximum content visibility
  if (isFullscreen) {
    const hasContentNav = contentNavigation && contentNavigation.totalContents > 1;

    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-[9999] bg-black flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 50px)', // Compact control bar space
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Full-screen iframe - the main content (z-0 to stay below overlay controls) */}
        <iframe
          ref={iframeRef}
          srcDoc={enhancedHtmlContent}
          className="w-full h-full border-0 relative z-0"
          style={{
            flex: '1 1 auto',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
          sandbox="allow-scripts allow-same-origin"
          title="Slide Viewer"
          onLoad={() => {
            setTimeout(() => {
              hideContentNavigation();
              detectAndSetupSlides();
            }, 100);
          }}
        />

        {/* Audio bar trigger - removed side tabs, now triggered by long-press on play button */}

        {/* Audio seek bar - appears when triggered */}
        {hasAudio && showAudioBar && (
          <div
            className="absolute left-4 right-4 z-20 bg-black/80 backdrop-blur-md rounded-2xl p-4 transition-all duration-200"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 110px)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowAudioBar(false)}
              className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-full text-xs touch-manipulation"
            >
              ✕
            </button>

            {/* Time display */}
            <div className="flex justify-between text-white text-xs mb-2">
              <span>{formatTime(audioCurrentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>

            {/* Progress bar */}
            <div
              ref={audioBarRef}
              onClick={handleProgressClick}
              className="h-2 bg-gray-600 rounded-full cursor-pointer mb-3 overflow-hidden touch-manipulation"
            >
              <div
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: audioDuration > 0 ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' }}
              />
            </div>

            {/* Skip buttons */}
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => { onAudioSkip?.(-10); showAudioBarWithTimeout(); }}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs rounded-full transition-colors touch-manipulation"
              >
                <SkipBack className="w-4 h-4" />
                <span>10秒</span>
              </button>
              <button
                onClick={() => { onToggleAudio?.(); showAudioBarWithTimeout(); }}
                className="p-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-500 text-white rounded-full transition-colors touch-manipulation"
              >
                {isAudioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => { onAudioSkip?.(10); showAudioBarWithTimeout(); }}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs rounded-full transition-colors touch-manipulation"
              >
                <span>10秒</span>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Overlay controls - all semi-transparent, positioned absolutely */}

        {/* Top-left: Back to list button (z-10 to stay above iframe) */}
        {headerInfo?.onBack && (
          <div
            className="absolute top-0 left-0 p-2 z-10"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4px)' }}
          >
            <button
              onClick={headerInfo.onBack}
              className="flex items-center gap-1 text-white text-xs bg-black/40 hover:bg-black/60 active:bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full transition-colors touch-manipulation"
              title={headerInfo.backLabel || '一覧へ戻る'}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>一覧</span>
            </button>
          </div>
        )}

        {/* Top-right: Progress indicator (z-10 to stay above iframe) */}
        {headerInfo?.progress && (
          <div
            className="absolute top-0 right-0 p-2 z-10"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4px)' }}
          >
            <span className="text-white text-xs bg-blue-500/50 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
              {headerInfo.progress}
            </span>
          </div>
        )}

        {/* Audio bar trigger tabs - on both sides */}
        {hasAudio && !showAudioBar && !isAudioLoading && (
          <>
            <button
              onClick={showAudioBarWithTimeout}
              className="absolute left-0 z-20 flex items-center justify-center bg-blue-500/40 hover:bg-blue-500/60 active:bg-blue-600 text-white rounded-r-lg transition-colors touch-manipulation"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom) + 60px)',
                width: '20px',
                height: '48px',
              }}
              title="オーディオ操作を表示"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={showAudioBarWithTimeout}
              className="absolute right-0 z-20 flex items-center justify-center bg-blue-500/40 hover:bg-blue-500/60 active:bg-blue-600 text-white rounded-l-lg transition-colors touch-manipulation"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom) + 60px)',
                width: '20px',
                height: '48px',
              }}
              title="オーディオ操作を表示"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          </>
        )}

        {/* Bottom: ALL-IN-ONE compact control bar (z-10 to stay above iframe) */}
        <div
          className="absolute left-0 right-0 z-10 flex items-center justify-between px-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        >
          {/* Left: Previous lesson - ORANGE to distinguish from page nav */}
          {contentNavigation ? (
            <button
              onClick={contentNavigation.onPrev}
              disabled={!contentNavigation.hasPrev}
              className={`p-2 rounded-full transition-colors touch-manipulation ${
                contentNavigation.hasPrev
                  ? 'bg-orange-500/60 hover:bg-orange-500/80 active:bg-orange-600 text-white'
                  : 'bg-gray-500/25 text-white/40 cursor-not-allowed'
              }`}
              title={contentNavigation.prevContent?.title || '前のトピック'}
            >
              <SkipBack className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-10" />
          )}

          {/* Center: Unified audio + page controls */}
          <div className="flex items-center gap-1 bg-blue-500/50 backdrop-blur-sm px-2 py-1 rounded-full">
            {/* Audio controls */}
            {hasAudio && (
              <>
                {isAudioLoading ? (
                  <div className="flex items-center gap-1 px-2">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                    <span className="text-white text-[10px]">準備中</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onToggleAudio}
                      onContextMenu={(e) => { e.preventDefault(); showAudioBarWithTimeout(); }}
                      className="p-1.5 text-white hover:bg-white/20 active:bg-white/30 rounded-full transition-colors touch-manipulation"
                      title={isAudioPlaying ? '一時停止' : '再生'}
                    >
                      {isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={onCyclePlaybackRate}
                      className="px-1.5 py-0.5 text-white text-[10px] hover:bg-white/20 active:bg-white/30 rounded-full transition-colors touch-manipulation"
                      title="再生速度"
                    >
                      ×{playbackRate}
                    </button>
                  </>
                )}
                {/* Divider */}
                {slideInfo.total > 1 && <div className="w-px h-4 bg-white/30 mx-1" />}
              </>
            )}

            {/* Page navigation - highlighted arrows */}
            {slideInfo.total > 1 && (
              <>
                <button
                  onClick={goToPrevSlide}
                  disabled={slideInfo.current === 1}
                  className={`p-1.5 rounded-full transition-colors touch-manipulation ${
                    slideInfo.current === 1
                      ? 'bg-white/10 text-white/40'
                      : 'bg-white/20 text-white hover:bg-white/30 active:bg-white/40'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white text-xs font-bold min-w-[32px] text-center">
                  {slideInfo.current}/{slideInfo.total}
                </span>
                <button
                  onClick={goToNextSlide}
                  disabled={slideInfo.current === slideInfo.total}
                  className={`p-1.5 rounded-full transition-colors touch-manipulation ${
                    slideInfo.current === slideInfo.total
                      ? 'bg-white/10 text-white/40'
                      : 'bg-white/20 text-white hover:bg-white/30 active:bg-white/40'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Audio detail button removed - use side triggers instead */}
          </div>

          {/* Right: Next lesson - ORANGE to distinguish from page nav */}
          {contentNavigation ? (
            <button
              onClick={contentNavigation.onNext}
              disabled={!contentNavigation.hasNext}
              className={`p-2 rounded-full transition-colors touch-manipulation ${
                contentNavigation.hasNext
                  ? 'bg-orange-500/60 hover:bg-orange-500/80 active:bg-orange-600 text-white'
                  : 'bg-gray-500/25 text-white/40 cursor-not-allowed'
              }`}
              title={contentNavigation.nextContent?.title || '次のトピック'}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
    );
  }

  // Fullscreen is the default and only mode
  // This return statement should never be reached
  return null;
};

// YouTube URL → embed URL conversion
const convertToYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  if (url.includes('/embed/')) return url;
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  return url;
};

const ViewerPage = () => {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, customerId, user, loading: authLoading } = useAuth();
  const [content, setContent] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [allContents, setAllContents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem('viewerPlaybackRate');
    return saved ? parseFloat(saved) : 1;
  });
  const [autoNext, setAutoNext] = useState(() => {
    return localStorage.getItem('viewerAutoNext') === 'true';
  });
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(true); // Track audio loading state
  const audioPlayerRef = useRef(null);

  // Poll audio time for seek bar display
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioPlayerRef.current) {
        const time = audioPlayerRef.current.getCurrentTime?.() || 0;
        const dur = audioPlayerRef.current.getDuration?.() || 0;
        setAudioCurrentTime(time);
        setAudioDuration(dur);
      }
    }, 100); // Update every 100ms
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get content (critical - without this, nothing can render)
        const contentData = await getContent(customerId, contentId);
        if (!contentData) {
          setError('コンテンツが見つかりません');
          setLoading(false);
          return;
        }
        setContent(contentData);

        // Get classroom (non-critical for viewing, but needed for navigation label)
        try {
          const classroomData = await getClassroom(customerId, contentData.classroomId);
          setClassroom(classroomData);
        } catch (e) {
          console.warn('Failed to fetch classroom:', e);
          // Set minimal classroom info so navigation still works
          setClassroom({ id: contentData.classroomId, name: '教室' });
        }

        // Get all contents in this classroom for navigation (non-critical)
        try {
          const contents = await getContents(customerId, contentData.classroomId);
          setAllContents(contents);
          const index = contents.findIndex(c => c.id === contentId);
          setCurrentIndex(index);
        } catch (e) {
          console.warn('Failed to fetch contents list:', e);
          // Set minimal content list with just the current content
          setAllContents([contentData]);
          setCurrentIndex(0);
        }

        // Check access
        const access = await hasClassroomAccess(customerId, user?.uid, contentData.classroomId, isAdmin);
        setHasAccess(access);

        // Record watch history (for both authenticated and anonymous users)
        if (access) {
          try {
            await recordWatchHistory(user?.uid, contentId);
          } catch (e) {
            console.warn('Failed to record watch history:', e);
          }
        }
      } catch (err) {
        console.error('Failed to fetch content:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchData();
    }
  }, [contentId, isAuthenticated, isAdmin, user, authLoading]);

  // Save autoNext preference
  useEffect(() => {
    localStorage.setItem('viewerAutoNext', autoNext.toString());
  }, [autoNext]);

  // Save playbackRate preference
  useEffect(() => {
    localStorage.setItem('viewerPlaybackRate', playbackRate.toString());
  }, [playbackRate]);

  // Computed navigation info
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allContents.length - 1;
  const prevContent = hasPrev ? allContents[currentIndex - 1] : null;
  const nextContent = hasNext ? allContents[currentIndex + 1] : null;

  const goToPrev = () => {
    if (prevContent) {
      navigate(`/viewer/${prevContent.id}`);
    }
  };

  const goToNext = () => {
    if (nextContent) {
      navigate(`/viewer/${nextContent.id}`);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
      // Arrow keys for content navigation (with Alt key to avoid conflict with slide navigation)
      if (e.altKey && e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        goToPrev();
      }
      if (e.altKey && e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        goToNext();
      }
      // Space to toggle audio
      if (e.key === ' ' && !e.target.closest('button')) {
        e.preventDefault();
        audioPlayerRef.current?.togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, prevContent, nextContent]);

  const handleToggleAudio = () => {
    audioPlayerRef.current?.togglePlay();
  };

  const handleCyclePlaybackRate = () => {
    const newRate = audioPlayerRef.current?.cyclePlaybackRate();
    if (newRate !== undefined) {
      setPlaybackRate(newRate);
    } else {
      // Fallback: manually cycle rate if ref method fails
      const rates = [1, 1.5, 2];
      let currentIndex = rates.findIndex(r => Math.abs(r - playbackRate) < 0.01);
      if (currentIndex === -1) currentIndex = 0;
      const fallbackRate = rates[(currentIndex + 1) % rates.length];
      setPlaybackRate(fallbackRate);
    }
  };

  const handleAudioSeek = (time) => {
    audioPlayerRef.current?.seekTo(time);
  };

  const handleAudioSkip = (seconds) => {
    audioPlayerRef.current?.skip(seconds);
  };

  const handlePlaybackRateChange = (newRate) => {
    if (newRate !== undefined) {
      setPlaybackRate(newRate);
    }
  };

  const handleAudioPlayStateChange = (playing) => {
    setIsAudioPlaying(playing);
  };

  const handleAudioLoadingChange = (loading) => {
    setIsAudioLoading(loading);
  };

  const handleAudioEnded = () => {
    const nextIsLocked = false; // B2B: all customer members have full access
    if (autoNext && hasNext && !nextIsLocked) {
      // Short delay before auto-navigating
      setTimeout(() => {
        goToNext();
      }, 1000);
    }
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

  if (error || !hasAccess) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
            <p className="mt-4 text-gray-700 font-medium">
              {error || 'このコンテンツにアクセスする権限がありません'}
            </p>
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

  // Prepare content navigation props
  const contentNavigation = allContents.length > 1 ? {
    contents: allContents,
    currentIndex,
    totalContents: allContents.length,
    hasPrev,
    hasNext,
    prevContent,
    nextContent,
    onPrev: goToPrev,
    onNext: goToNext,
    onNavigate: (id) => navigate(`/viewer/${id}`),
  } : null;

  // Prepare header props
  const headerInfo = {
    title: content.title,
    progress: allContents.length > 1 ? `${currentIndex + 1} / ${allContents.length}` : null,
    onBack: () => navigate(`/classroom/${content.classroomId}`),
    backLabel: `${classroom?.name || '教室'}に戻る`,
  };

  // Audio player component with auto-next toggle
  const audioPlayerComponent = content.mp3FileId ? (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">音声解説</span>
        {hasNext && (
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span>終了後に次へ</span>
          </label>
        )}
      </div>
      <AudioPlayer
        key={`audio-component-${contentId}`}
        ref={audioPlayerRef}
        fileId={content.mp3FileId}
        onPlayStateChange={handleAudioPlayStateChange}
        onEnded={handleAudioEnded}
        onLoadingChange={handleAudioLoadingChange}
      />
    </div>
  ) : null;

  // If no HTML content, show error in Layout
  if (!content.htmlContent) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto" />
            <p className="mt-4 text-gray-700 font-medium">スライドがありません</p>
            <Link
              to={`/classroom/${content.classroomId}`}
              className="mt-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
              {classroom?.name || '教室'}に戻る
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Render SlideViewer in fullscreen mode (default)
  // AudioPlayer must be rendered (hidden) to load and control audio
  return (
    <>
      <SlideViewer
        htmlContent={content.htmlContent}
        isAudioPlaying={isAudioPlaying}
        onToggleAudio={handleToggleAudio}
        hasAudio={!!content.mp3FileId}
        playbackRate={playbackRate}
        onCyclePlaybackRate={handleCyclePlaybackRate}
        isAudioLoading={isAudioLoading}
        contentNavigation={contentNavigation}
        headerInfo={headerInfo}
        audioPlayerComponent={audioPlayerComponent}
        audioCurrentTime={audioCurrentTime}
        audioDuration={audioDuration}
        onAudioSeek={handleAudioSeek}
        onAudioSkip={handleAudioSkip}
      />
      {/* Hidden AudioPlayer for audio loading and playback control */}
      {/* Key ensures component remounts when content changes */}
      {content.mp3FileId && (
        <div className="hidden">
          <AudioPlayer
            key={`audio-${contentId}-${content.mp3FileId}`}
            ref={audioPlayerRef}
            fileId={content.mp3FileId}
            onPlayStateChange={handleAudioPlayStateChange}
            onEnded={handleAudioEnded}
            initialPlaybackRate={playbackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
            onLoadingChange={handleAudioLoadingChange}
          />
        </div>
      )}
      {/* RAG ChatPanel - ragEnabled な講座のみ表示 */}
      {classroom?.ragEnabled && (
        <ChatPanel
          classroomId={content.classroomId}
          classroomName={classroom?.name}
        />
      )}
    </>
  );
};

export default ViewerPage;
