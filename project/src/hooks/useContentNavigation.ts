import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Content, ContentNavigation } from '../types';

interface UseContentNavigationReturn {
  allContents: Content[];
  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevContent: Content | null;
  nextContent: Content | null;
  goToPrev: () => void;
  goToNext: () => void;
  setAllContents: React.Dispatch<React.SetStateAction<Content[]>>;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  contentNavigationProps: ContentNavigation | null;
}

export const useContentNavigation = (contentId: string | undefined): UseContentNavigationReturn => {
  const navigate = useNavigate();
  const [allContents, setAllContents] = useState<Content[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allContents.length - 1;
  const prevContent = hasPrev ? allContents[currentIndex - 1] : null;
  const nextContent = hasNext ? allContents[currentIndex + 1] : null;

  const goToPrev = useCallback((): void => {
    if (prevContent) {
      navigate(`/viewer/${prevContent.id}`);
    }
  }, [prevContent, navigate]);

  const goToNext = useCallback((): void => {
    if (nextContent) {
      navigate(`/viewer/${nextContent.id}`);
    }
  }, [nextContent, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
      if (e.altKey && e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        goToPrev();
      }
      if (e.altKey && e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, goToPrev, goToNext]);

  const contentNavigationProps: ContentNavigation | null = allContents.length > 1 ? {
    contents: allContents,
    currentIndex,
    totalContents: allContents.length,
    hasPrev,
    hasNext,
    prevContent,
    nextContent,
    onPrev: goToPrev,
    onNext: goToNext,
    onNavigate: (id: string) => navigate(`/viewer/${id}`),
  } : null;

  return {
    allContents,
    currentIndex,
    hasPrev,
    hasNext,
    prevContent,
    nextContent,
    goToPrev,
    goToNext,
    setAllContents,
    setCurrentIndex,
    contentNavigationProps,
  };
};
