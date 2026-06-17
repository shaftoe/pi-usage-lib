/**
 * Unit tests for config.ts — user settings & threshold loading
 */

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import * as fs from "node:fs"
import {
  DEFAULT_COLOR_THRESHOLDS,
  getSettingsFilePath,
  loadColorThresholds,
  mergeThresholds,
  resetThresholdsCache,
} from "../src/config"
import type { ColorThresholds } from "../src/types"

beforeEach(() => {
  resetThresholdsCache()
})

afterEach(() => {
  resetThresholdsCache()
  mock.restore()
})

describe("DEFAULT_COLOR_THRESHOLDS", () => {
  it("should match the documented defaults", () => {
    expect(DEFAULT_COLOR_THRESHOLDS).toEqual({
      percentage: { warning: 80, error: 90 },
      credit: { warning: 2, error: 1 },
    })
  })
})

describe("getSettingsFilePath", () => {
  it("should point to ~/.pi/agent/usage-lib.json", () => {
    const path = getSettingsFilePath()
    expect(path.endsWith(".pi/agent/usage-lib.json")).toBe(true)
  })
})

describe("mergeThresholds", () => {
  it("should return defaults when overrides are empty", () => {
    expect(mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {})).toEqual(DEFAULT_COLOR_THRESHOLDS)
  })

  it("should return defaults when overrides are null", () => {
    expect(mergeThresholds(DEFAULT_COLOR_THRESHOLDS, null)).toEqual(DEFAULT_COLOR_THRESHOLDS)
  })

  it("should return defaults when overrides are undefined", () => {
    expect(mergeThresholds(DEFAULT_COLOR_THRESHOLDS, undefined)).toEqual(DEFAULT_COLOR_THRESHOLDS)
  })

  it("should override percentage.warning", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      percentage: { warning: 70 },
    })
    expect(result.percentage.warning).toBe(70)
    // Other values unchanged
    expect(result.percentage.error).toBe(90)
    expect(result.credit).toEqual({ warning: 2, error: 1 })
  })

  it("should override percentage.error", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      percentage: { error: 85 },
    })
    expect(result.percentage.error).toBe(85)
    expect(result.percentage.warning).toBe(80)
  })

  it("should override credit thresholds", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      credit: { warning: 5, error: 2 },
    })
    expect(result.credit).toEqual({ warning: 5, error: 2 })
    expect(result.percentage).toEqual({ warning: 80, error: 90 })
  })

  it("should override all thresholds at once", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      percentage: { warning: 70, error: 80 },
      credit: { warning: 3, error: 0.5 },
    })
    expect(result).toEqual({
      percentage: { warning: 70, error: 80 },
      credit: { warning: 3, error: 0.5 },
    })
  })

  it("should ignore non-numeric values", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      percentage: { warning: "high" },
      credit: { error: null },
    })
    expect(result).toEqual(DEFAULT_COLOR_THRESHOLDS)
  })

  it("should ignore unknown keys", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      unknownKey: 42,
      percentage: { warning: 75, bogus: true },
    })
    expect(result.percentage.warning).toBe(75)
    expect(result.percentage.error).toBe(90)
    expect(result.credit).toEqual({ warning: 2, error: 1 })
  })

  it("should handle fractional thresholds", () => {
    const result = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, {
      credit: { error: 0.25 },
    })
    expect(result.credit.error).toBe(0.25)
  })
})

describe("loadColorThresholds — caching", () => {
  it("should return the same object on subsequent calls (cached)", () => {
    // Both calls should return the exact same cached reference
    const first = loadColorThresholds()
    const second = loadColorThresholds()
    expect(second).toBe(first)
  })

  it("should re-read after cache reset", () => {
    const first = loadColorThresholds()
    resetThresholdsCache()
    const second = loadColorThresholds()
    // After reset, a new object is created
    expect(second).not.toBe(first)
    expect(second).toEqual(first) // but values are the same
  })
})

describe("loadColorThresholds — file loading", () => {
  it("should use defaults when settings file is missing", () => {
    const readSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException
      err.code = "ENOENT"
      throw err
    })

    const result = loadColorThresholds()
    expect(result).toEqual(DEFAULT_COLOR_THRESHOLDS)
    readSpy.mockRestore()
  })

  it("should use defaults when settings file has invalid JSON", () => {
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue("{ this is not valid json")

    const result = loadColorThresholds()
    expect(result).toEqual(DEFAULT_COLOR_THRESHOLDS)
    readSpy.mockRestore()
  })

  it("should merge user thresholds from a valid settings file", () => {
    const settingsFileContent = JSON.stringify({
      thresholds: {
        percentage: { warning: 70, error: 80 },
        credit: { warning: 5, error: 2 },
      },
    })
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(settingsFileContent)

    const result = loadColorThresholds()
    expect(result).toEqual({
      percentage: { warning: 70, error: 80 },
      credit: { warning: 5, error: 2 },
    })
    readSpy.mockRestore()
  })

  it("should merge partial thresholds (percentage only)", () => {
    const settingsFileContent = JSON.stringify({
      thresholds: {
        percentage: { warning: 75 },
      },
    })
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(settingsFileContent)

    const result = loadColorThresholds()
    expect(result.percentage).toEqual({ warning: 75, error: 90 })
    expect(result.credit).toEqual({ warning: 2, error: 1 })
    readSpy.mockRestore()
  })

  it("should handle file without thresholds key", () => {
    const settingsFileContent = JSON.stringify({ someOtherKey: true })
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(settingsFileContent)

    const result = loadColorThresholds()
    expect(result).toEqual(DEFAULT_COLOR_THRESHOLDS)
    readSpy.mockRestore()
  })

  it("should ignore non-numeric values from the file", () => {
    const settingsFileContent = JSON.stringify({
      thresholds: {
        percentage: { warning: "not-a-number" },
        credit: { error: Infinity },
      },
    })
    const readSpy = spyOn(fs, "readFileSync").mockReturnValue(settingsFileContent)

    const result = loadColorThresholds()
    expect(result.percentage.warning).toBe(80) // default preserved
    expect(result.credit.error).toBe(1) // default preserved
    readSpy.mockRestore()
  })
})

// Type guard for the test helpers

// Ensure the ColorThresholds type is structurally correct at compile time
const _typeCheck: ColorThresholds = {
  percentage: { warning: 1, error: 2 },
  credit: { warning: 1, error: 2 },
}
void _typeCheck
