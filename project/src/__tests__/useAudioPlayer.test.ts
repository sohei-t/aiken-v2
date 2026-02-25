import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

describe('useAudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.isAudioPlaying).toBe(false);
    expect(result.current.playbackRate).toBe(1);
    expect(result.current.audioCurrentTime).toBe(0);
    expect(result.current.audioDuration).toBe(0);
    expect(result.current.isAudioLoading).toBe(true);
  });

  it('should restore playback rate from localStorage', () => {
    localStorage.setItem('viewerPlaybackRate', '1.5');
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.playbackRate).toBe(1.5);
  });

  it('should provide audio control functions', () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(typeof result.current.handleToggleAudio).toBe('function');
    expect(typeof result.current.handleCyclePlaybackRate).toBe('function');
    expect(typeof result.current.handleAudioSeek).toBe('function');
    expect(typeof result.current.handleAudioSkip).toBe('function');
    expect(typeof result.current.handlePlaybackRateChange).toBe('function');
    expect(typeof result.current.handleAudioPlayStateChange).toBe('function');
    expect(typeof result.current.handleAudioLoadingChange).toBe('function');
  });

  it('should update isAudioPlaying state', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.handleAudioPlayStateChange(true);
    });
    expect(result.current.isAudioPlaying).toBe(true);

    act(() => {
      result.current.handleAudioPlayStateChange(false);
    });
    expect(result.current.isAudioPlaying).toBe(false);
  });

  it('should update isAudioLoading state', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.handleAudioLoadingChange(false);
    });
    expect(result.current.isAudioLoading).toBe(false);
  });

  it('should update playback rate and persist to localStorage', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.handlePlaybackRateChange(2);
    });
    expect(result.current.playbackRate).toBe(2);
    expect(localStorage.getItem('viewerPlaybackRate')).toBe('2');
  });

  it('should provide audioPlayerRef', () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.audioPlayerRef).toBeDefined();
    expect(result.current.audioPlayerRef.current).toBeNull();
  });

  it('should cycle playback rate with fallback when ref is null', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.handleCyclePlaybackRate();
    });
    // When audioPlayerRef is null, it should use fallback logic
    // Starting from 1, next should be 1.5
    expect(result.current.playbackRate).toBe(1.5);
  });
});
