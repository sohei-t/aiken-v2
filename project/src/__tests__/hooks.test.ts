import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchHistory } from '../hooks/useWatchHistory';

// Mock firebase service
vi.mock('../services/firebase', () => ({
  getWatchHistory: vi.fn(),
}));

describe('useWatchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty watch history', () => {
    const { result } = renderHook(() => useWatchHistory());
    expect(result.current.watchHistory).toEqual({});
  });

  it('should provide a refreshWatchHistory function', () => {
    const { result } = renderHook(() => useWatchHistory());
    expect(typeof result.current.refreshWatchHistory).toBe('function');
  });

  it('should set empty history when contentIds is empty', async () => {
    const { result } = renderHook(() => useWatchHistory());

    await act(async () => {
      await result.current.refreshWatchHistory('user-1', []);
    });

    expect(result.current.watchHistory).toEqual({});
  });

  it('should fetch and set watch history', async () => {
    const mockHistory = {
      'content-1': {
        watchedAt: new Date('2024-01-01'),
        lastWatchedAt: new Date('2024-01-15'),
      },
    };

    const { getWatchHistory } = await import('../services/firebase');
    (getWatchHistory as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockHistory);

    const { result } = renderHook(() => useWatchHistory());

    await act(async () => {
      await result.current.refreshWatchHistory('user-1', ['content-1']);
    });

    expect(result.current.watchHistory).toEqual(mockHistory);
  });

  it('should handle errors gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getWatchHistory } = await import('../services/firebase');
    (getWatchHistory as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useWatchHistory());

    await act(async () => {
      await result.current.refreshWatchHistory('user-1', ['content-1']);
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});
