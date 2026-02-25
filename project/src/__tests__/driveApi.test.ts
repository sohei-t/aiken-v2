import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHealth, downloadPublicFile } from '../services/driveApi';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock URL.createObjectURL
vi.stubGlobal('URL', {
  ...globalThis.URL,
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

describe('driveApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await checkHealth();
      expect(result).toBe(true);
    });

    it('should return false when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await checkHealth();
      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await checkHealth();
      expect(result).toBe(false);
    });

    it('should call the correct health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await checkHealth();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/health'));
    });
  });

  describe('downloadPublicFile', () => {
    it('should return a blob URL on success', async () => {
      const mockBlob = new Blob(['test'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await downloadPublicFile('file-123');
      expect(result).toBe('blob:mock-url');
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(downloadPublicFile('file-123')).rejects.toThrow('ファイルのダウンロードに失敗しました');
    });

    it('should call the correct public download endpoint', async () => {
      const mockBlob = new Blob(['test']);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await downloadPublicFile('abc123');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/public/download/abc123'));
    });
  });
});
