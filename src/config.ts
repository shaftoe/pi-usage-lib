/**
 * pi-usage-lib — User configuration management
 *
 * Loads color thresholds (and future settings) from a user-managed
 * JSON file at `~/.pi/agent/usage-lib.json`, merged with built-in defaults.
 *
 * The Pi SDK does not offer a settings mechanism for extensions, so we
 * manage our own file.  Unknown keys are silently ignored so the schema
 * can grow without breaking existing files.
 */

import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ColorThresholds } from "./types"

/** Default color thresholds used when no user overrides are present. */
export const DEFAULT_COLOR_THRESHOLDS: ColorThresholds = {
  percentage: { warning: 80, critical: 90 },
  credit: { warning: 5, critical: 1 },
} as const

/** Filename for user-managed settings, relative to the home directory. */
export const SETTINGS_RELATIVE_PATH = ".pi/agent/usage-lib.json"

/** Resolve the absolute path to the user settings file. */
export function getSettingsFilePath(): string {
  return join(homedir(), SETTINGS_RELATIVE_PATH)
}

/**
 * Merge a *partial* set of user-provided thresholds into the defaults.
 *
 * Only known, numeric keys are applied — everything else (unknown keys,
 * non-numeric values) is ignored so a malformed file cannot break rendering.
 */
export function mergeThresholds(defaults: ColorThresholds, overrides: unknown): ColorThresholds {
  const o = (overrides ?? {}) as Record<string, unknown>
  const pct = o.percentage as Record<string, unknown> | undefined
  const credit = o.credit as Record<string, unknown> | undefined

  return {
    percentage: {
      warning: pickNumber(pct?.warning, defaults.percentage.warning),
      critical: pickNumber(pct?.critical, defaults.percentage.critical),
    },
    credit: {
      warning: pickNumber(credit?.warning, defaults.credit.warning),
      critical: pickNumber(credit?.critical, defaults.credit.critical),
    },
  }
}

/** Return the value if it is a finite number, otherwise the fallback. */
function pickNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

let cachedThresholds: ColorThresholds | null = null

/**
 * Load color thresholds from `~/.pi/agent/usage-lib.json`, merged with defaults.
 *
 * The file is read **once** per process and cached — subsequent calls return
 * the cached object without touching the filesystem.
 *
 * Returns the built-in defaults if the file is missing, unreadable, or
 * contains invalid JSON.
 *
 * Expected file format:
 * ```json
 * {
 *   "thresholds": {
 *     "percentage": { "warning": 75, "critical": 85 },
 *     "credit":     { "warning": 3,  "critical": 1.5 }
 *   }
 * }
 * ```
 */
export function loadColorThresholds(): ColorThresholds {
  if (cachedThresholds) return cachedThresholds

  let fileContent: string
  try {
    fileContent = readFileSync(getSettingsFilePath(), "utf-8")
  } catch {
    // File missing or unreadable — use defaults
    cachedThresholds = { ...DEFAULT_COLOR_THRESHOLDS }
    return cachedThresholds
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fileContent)
  } catch {
    // Invalid JSON — use defaults
    cachedThresholds = { ...DEFAULT_COLOR_THRESHOLDS }
    return cachedThresholds
  }

  const thresholds = (parsed as Record<string, unknown> | null)?.thresholds
  cachedThresholds = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, thresholds)
  return cachedThresholds
}

/**
 * Reset the internal cache so the next `loadColorThresholds()` call re-reads
 * the settings file.  Primarily useful for testing.
 */
export function resetThresholdsCache(): void {
  cachedThresholds = null
}
