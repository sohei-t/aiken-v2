import { describe, it, expect } from 'vitest';
import { askQuestion } from '../services/ragApi';

describe('ragApi', () => {
  describe('askQuestion', () => {
    it('should return a placeholder answer', async () => {
      const result = await askQuestion('test question', 'classroom-1');
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
      expect(typeof result.answer).toBe('string');
      expect(Array.isArray(result.sources)).toBe(true);
    });

    it('should return a non-empty answer string', async () => {
      const result = await askQuestion('What is TypeScript?', 'classroom-1');
      expect(result.answer.length).toBeGreaterThan(0);
    });

    it('should return empty sources array for placeholder', async () => {
      const result = await askQuestion('Any question', 'classroom-1', 'api-key-123');
      expect(result.sources).toEqual([]);
    });

    it('should accept optional apiKey parameter', async () => {
      const result = await askQuestion('test', 'c1', 'key123');
      expect(result.answer).toBeDefined();
    });

    it('should work without apiKey parameter', async () => {
      const result = await askQuestion('test', 'c1');
      expect(result.answer).toBeDefined();
    });
  });
});
