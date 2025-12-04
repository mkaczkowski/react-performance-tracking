/**
 * Formats bytes to human-readable string.
 *
 * @param bytes - Number of bytes (can be negative)
 * @returns Formatted string like "1.50 MB" or "-256.00 KB"
 *
 * @example
 * formatBytes(1024)       // "1.00 KB"
 * formatBytes(1536)       // "1.50 KB"
 * formatBytes(-1048576)   // "-1.00 MB"
 * formatBytes(0)          // "0 B"
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const absBytes = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;

  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const value = absBytes / Math.pow(k, i);

  return `${sign}${value.toFixed(2)} ${units[i]}`;
};

/**
 * Formats throughput (bytes per second) to human-readable string.
 *
 * @param bytesPerSecond - Throughput in bytes per second. Use -1 for unlimited.
 * @returns Formatted string like "1.6 Mbps" or "500 Kbps"
 *
 * @example
 * formatThroughput(204800)  // "1.6 Mbps" (1.6 * 1024 * 1024 / 8)
 * formatThroughput(-1)      // "unlimited"
 * formatThroughput(64000)   // "500 Kbps"
 */
export const formatThroughput = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 0) {
    return 'unlimited';
  }

  // Convert bytes/s to Kbps for readability
  const kbps = (bytesPerSecond * 8) / 1024;

  if (kbps >= 1024) {
    return `${(kbps / 1024).toFixed(1)} Mbps`;
  }

  return `${Math.round(kbps)} Kbps`;
};

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string like "150.00ms" or "2.50s"
 *
 * @example
 * formatDuration(150)      // "150.00ms"
 * formatDuration(2500)     // "2.50s"
 * formatDuration(150, 0)   // "150ms"
 */
export const formatDuration = (ms: number, precision = 2): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(precision)}s`;
  }
  return `${ms.toFixed(precision)}ms`;
};

/**
 * Formats a percentage value.
 *
 * @param value - The percentage value
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string like "25.00%"
 *
 * @example
 * formatPercent(25.5)     // "25.50%"
 * formatPercent(100, 0)   // "100%"
 */
export const formatPercent = (value: number, precision = 2): string => {
  return `${value.toFixed(precision)}%`;
};
