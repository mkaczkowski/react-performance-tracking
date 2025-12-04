/**
 * Validates threshold and buffer parameters.
 * @throws {Error} If threshold is negative or buffer is out of valid range
 */
const validateThresholdParams = (threshold: number, bufferPercent: number): void => {
  if (threshold < 0) {
    throw new Error(`Threshold must be non-negative, got: ${threshold}`);
  }
  if (bufferPercent < 0 || bufferPercent > 100) {
    throw new Error(`Buffer percent must be between 0 and 100, got: ${bufferPercent}`);
  }
};

/**
 * Calculates the effective threshold with buffer tolerance.
 * For "lower is better" metrics (duration, rerenders), buffer is added.
 *
 * @param threshold - The base threshold value (must be non-negative)
 * @param bufferPercent - The buffer percentage to add (0-100)
 * @param ceil - Whether to ceil the result (useful for integer thresholds like sample counts)
 * @returns The effective threshold with buffer applied
 * @throws {Error} If threshold is negative or bufferPercent is out of range
 */
export const calculateEffectiveThreshold = (
  threshold: number,
  bufferPercent: number,
  ceil = false,
): number => {
  validateThresholdParams(threshold, bufferPercent);
  const effective = threshold * (1 + bufferPercent / 100);
  return ceil ? Math.ceil(effective) : effective;
};

/**
 * Calculates the effective minimum threshold with buffer tolerance.
 * For "higher is better" metrics (FPS), buffer is subtracted.
 *
 * @param threshold - The base threshold value (minimum required, must be non-negative)
 * @param bufferPercent - The buffer percentage to subtract (0-100)
 * @param floor - Whether to floor the result
 * @returns The effective minimum threshold with buffer applied
 * @throws {Error} If threshold is negative or bufferPercent is out of range
 */
export const calculateEffectiveMinThreshold = (
  threshold: number,
  bufferPercent: number,
  floor = false,
): number => {
  validateThresholdParams(threshold, bufferPercent);
  const effective = threshold * (1 - bufferPercent / 100);
  return floor ? Math.floor(effective) : effective;
};
