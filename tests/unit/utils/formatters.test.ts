import { describe, expect, it } from 'vitest';

import { formatBytes, formatDuration, formatPercent, formatThroughput } from '@/utils/formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it.each([
      [0, '0 B'],
      [512, '512.00 B'],
      [1024, '1.00 KB'],
      [1536, '1.50 KB'],
      [1048576, '1.00 MB'],
      [1572864, '1.50 MB'],
      [1073741824, '1.00 GB'],
      [-1024, '-1.00 KB'],
      [-1048576, '-1.00 MB'],
    ])('formatBytes(%d) → %s', (input, expected) => {
      expect(formatBytes(input)).toBe(expected);
    });
  });

  describe('formatThroughput', () => {
    it('should return unlimited for negative values', () => {
      expect(formatThroughput(-1)).toBe('unlimited');
    });

    it('should format Kbps values', () => {
      // 500 Kbps = 500 * 1024 / 8 bytes/s = 64000
      expect(formatThroughput(64000)).toBe('500 Kbps');
    });

    it('should format Mbps values', () => {
      // 1.6 Mbps = 1.6 * 1024 * 1024 / 8 bytes/s = 209715.2
      expect(formatThroughput(209715)).toBe('1.6 Mbps');
    });

    it('should round Kbps values', () => {
      expect(formatThroughput(128000)).toBe('1000 Kbps');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(150)).toBe('150.00ms');
    });

    it('should format seconds for values >= 1000', () => {
      expect(formatDuration(2500)).toBe('2.50s');
    });

    it('should respect precision parameter', () => {
      expect(formatDuration(150, 0)).toBe('150ms');
      expect(formatDuration(2500, 1)).toBe('2.5s');
    });
  });

  describe('formatPercent', () => {
    it('should format percentage with default precision', () => {
      expect(formatPercent(25.5)).toBe('25.50%');
    });

    it('should respect precision parameter', () => {
      expect(formatPercent(100, 0)).toBe('100%');
      expect(formatPercent(33.333, 1)).toBe('33.3%');
    });
  });
});
