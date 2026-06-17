/**
 * pi-usage-lib — Color threshold helpers for usage display
 *
 * Utility functions that return the appropriate TUI color function
 * based on threshold values, so extensions can highlight usage
 * when approaching or exceeding limits.
 */

import type { Theme } from "./types"

const THRESHOLDS = {
  percentage: { warning: 80, error: 90 },
  credit: { warning: 2, error: 1 },
} as const

/**
 * Get the appropriate TUI color function for a percentage-based usage value.
 *
 * - accent (default) when percentage ≤ 80%
 * - **warning** (yellow) when percentage > 80%
 * - **error** (red) when percentage ≥ 90%
 *
 * @example
 * ```ts
 * const color = colorForPercentage(data.percentage, theme)
 * return theme.fg("muted", "Z.ai:") + color(`${displayPercentage}%`)
 * ```
 */
export function colorForPercentage(percentage: number, theme: Theme): (text: string) => string {
  if (percentage >= THRESHOLDS.percentage.error) return (s: string) => theme.fg("error", s)
  if (percentage > THRESHOLDS.percentage.warning) return (s: string) => theme.fg("warning", s)
  return (s: string) => theme.fg("accent", s)
}

/**
 * Get the appropriate TUI color function for a credit / monetary balance value.
 *
 * - accent (default) when credit ≥ $2
 * - **warning** (yellow) when credit < $2
 * - **error** (red) when credit ≤ $1
 *
 * @example
 * ```ts
 * const color = colorForCredit(balance, theme)
 * return theme.fg("muted", "DeepSeek:") + color(displayBalance)
 * ```
 */
export function colorForCredit(credit: number, theme: Theme): (text: string) => string {
  if (credit <= THRESHOLDS.credit.error) return (s: string) => theme.fg("error", s)
  if (credit < THRESHOLDS.credit.warning) return (s: string) => theme.fg("warning", s)
  return (s: string) => theme.fg("accent", s)
}
