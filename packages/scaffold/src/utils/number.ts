/**
 * Check if a number is a C++ integer.
 */
export function is32BitNumber(n: number): boolean {
  return Number.isInteger(n)
    && n >= -2147483648
    && n <= 2147483647;
}
