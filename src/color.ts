/**
 * pi-usage-lib — Color threshold helpers for usage display
 *
 * Utility functions that return the appropriate TUI color function
 * based on threshold values, so extensions can highlight usage
 * when approaching or exceeding limits.
 *
 * Thresholds default to values loaded from `~/.pi/agent/usage-lib.json`
 * (falling back to built-in defaults).  Callers can also pass explicit
 * thresholds per-call to override at render time.
 */

import { loadColorThresholds } from "./config"
import type { ColorThresholds, Theme } from "./types"

/**
 * Get the appropriate TUI color function for a percentage-based usage value.
 *
 * - accent (default) when percentage ≤ warning threshold
 * - **warning** (yellow) when percentage > warning threshold
 * - **error** (red) when percentage ≥ critical threshold
 *
 * @param percentage - usage percentage (0–100)
 * @param theme - the Pi TUI theme
 * @param thresholds - optional override; defaults to the loaded settings file
 *
 * @example
 * ```ts
 * const color = colorForPercentage(data.percentage, theme)
 * return theme.fg("muted", "Z.ai:") + color(`${displayPercentage}%`)
 * ```
 */
export function colorForPercentage(
  percentage: number,
  theme: Theme,
  thresholds?: ColorThresholds,
): (text: string) => string {
  const t = thresholds ?? loadColorThresholds()
  if (percentage >= t.percentage.critical) return (s: string) => theme.fg("error", s)
  if (percentage > t.percentage.warning) return (s: string) => theme.fg("warning", s)
  return (s: string) => theme.fg("accent", s)
}

/**
 * Get the appropriate TUI color function for a credit / monetary balance value.
 *
 * - accent (default) when credit ≥ warning threshold
 * - **warning** (yellow) when credit < warning threshold
 * - **error** (red) when credit ≤ critical threshold
 *
 * @param credit - remaining credit / balance in USD
 * @param theme - the Pi TUI theme
 * @param thresholds - optional override; defaults to the loaded settings file
 *
 * @example
 * ```ts
 * const color = colorForCredit(balance, theme)
 * return theme.fg("muted", "DeepSeek:") + color(displayBalance)
 * ```
 */
export function colorForCredit(
  credit: number,
  theme: Theme,
  thresholds?: ColorThresholds,
): (text: string) => string {
  const t = thresholds ?? loadColorThresholds()
  if (credit <= t.credit.critical) return (s: string) => theme.fg("error", s)
  if (credit < t.credit.warning) return (s: string) => theme.fg("warning", s)
  return (s: string) => theme.fg("accent", s)
}

/** Default color thresholds — re-exported for convenience. */
export { DEFAULT_COLOR_THRESHOLDS } from "./config"
