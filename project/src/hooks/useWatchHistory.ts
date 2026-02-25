import { useState, useCallback } from 'react';
import { getWatchHistory } from '../services/firebase';
import type { WatchHistoryMap } from '../types';

interface UseWatchHistoryReturn {
  watchHistory: WatchHistoryMap;
  refreshWatchHistory: (userId: string | undefined, contentIds: string[]) => Promise<void>;
}

export const useWatchHistory = (): UseWatchHistoryReturn => {
  const [watchHistory, setWatchHistory] = useState<WatchHistoryMap>({});

  const refreshWatchHistory = useCallback(
    async (userId: string | undefined, contentIds: string[]): Promise<void> => {
      if (contentIds.length === 0) {
        setWatchHistory({});
        return;
      }
      try {
        const history = await getWatchHistory(userId, contentIds);
        setWatchHistory(history);
      } catch (e) {
        console.warn('Failed to refresh watch history:', e);
      }
    },
    []
  );

  return {
    watchHistory,
    refreshWatchHistory,
  };
};
