import { useState, useEffect, useRef, useCallback } from 'react';
import type { AudioPlayerRef } from '../types';

interface UseAudioPlayerOptions {
  initialPlaybackRate?: number;
}

interface UseAudioPlayerReturn {
  audioPlayerRef: React.RefObject<AudioPlayerRef | null>;
  isAudioPlaying: boolean;
  playbackRate: number;
  audioCurrentTime: number;
  audioDuration: number;
  isAudioLoading: boolean;
  handleToggleAudio: () => void;
  handleCyclePlaybackRate: () => void;
  handleAudioSeek: (time: number) => void;
  handleAudioSkip: (seconds: number) => void;
  handlePlaybackRateChange: (newRate: number) => void;
  handleAudioPlayStateChange: (playing: boolean) => void;
  handleAudioLoadingChange: (isLoading: boolean) => void;
}

export const useAudioPlayer = (options: UseAudioPlayerOptions = {}): UseAudioPlayerReturn => {
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const saved = localStorage.getItem('viewerPlaybackRate');
    return saved ? parseFloat(saved) : (options.initialPlaybackRate ?? 1);
  });
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(true);

  // Poll audio time for seek bar display
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioPlayerRef.current) {
        const time = audioPlayerRef.current.getCurrentTime?.() || 0;
        const dur = audioPlayerRef.current.getDuration?.() || 0;
        setAudioCurrentTime(time);
        setAudioDuration(dur);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Save playbackRate preference
  useEffect(() => {
    localStorage.setItem('viewerPlaybackRate', playbackRate.toString());
  }, [playbackRate]);

  const handleToggleAudio = useCallback((): void => {
    audioPlayerRef.current?.togglePlay();
  }, []);

  const handleCyclePlaybackRate = useCallback((): void => {
    const newRate = audioPlayerRef.current?.cyclePlaybackRate();
    if (newRate !== undefined) {
      setPlaybackRate(newRate);
    } else {
      const rates = [1, 1.5, 2];
      let idx = rates.findIndex(r => Math.abs(r - playbackRate) < 0.01);
      if (idx === -1) idx = 0;
      const fallbackRate = rates[(idx + 1) % rates.length];
      setPlaybackRate(fallbackRate);
    }
  }, [playbackRate]);

  const handleAudioSeek = useCallback((time: number): void => {
    audioPlayerRef.current?.seekTo(time);
  }, []);

  const handleAudioSkip = useCallback((seconds: number): void => {
    audioPlayerRef.current?.skip(seconds);
  }, []);

  const handlePlaybackRateChange = useCallback((newRate: number): void => {
    if (newRate !== undefined) {
      setPlaybackRate(newRate);
    }
  }, []);

  const handleAudioPlayStateChange = useCallback((playing: boolean): void => {
    setIsAudioPlaying(playing);
  }, []);

  const handleAudioLoadingChange = useCallback((isLoading: boolean): void => {
    setIsAudioLoading(isLoading);
  }, []);

  return {
    audioPlayerRef,
    isAudioPlaying,
    playbackRate,
    audioCurrentTime,
    audioDuration,
    isAudioLoading,
    handleToggleAudio,
    handleCyclePlaybackRate,
    handleAudioSeek,
    handleAudioSkip,
    handlePlaybackRateChange,
    handleAudioPlayStateChange,
    handleAudioLoadingChange,
  };
};
