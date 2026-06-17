/**
 * Unit tests for color.ts — colorForPercentage and colorForCredit
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { colorForCredit, colorForPercentage } from "../src/color"
import { resetThresholdsCache } from "../src/config"
import type { ColorThresholds, Theme } from "../src/types"

// --- Helpers ---

/** Simple mock theme that returns `color:text` strings */
const mockTheme: Theme = {
  fg: (color: string, text: string) => `${color}:${text}`,
} as Theme

beforeEach(() => {
  resetThresholdsCache()
})

afterEach(() => {
  resetThresholdsCache()
})

// --- colorForPercentage ---

describe("colorForPercentage", () => {
  it("should return accent for percentage ≤ 80%", () => {
    const colors = [
      colorForPercentage(0, mockTheme),
      colorForPercentage(50, mockTheme),
      colorForPercentage(80, mockTheme),
    ]
    expect(colors.map((c) => c("value"))).toEqual(["accent:value", "accent:value", "accent:value"])
  })

  it("should return warning for percentage > 80% and < 90%", () => {
    const colors = [
      colorForPercentage(80.1, mockTheme),
      colorForPercentage(85, mockTheme),
      colorForPercentage(89.9, mockTheme),
    ]
    expect(colors.map((c) => c("value"))).toEqual([
      "warning:value",
      "warning:value",
      "warning:value",
    ])
  })

  it("should return error for percentage ≥ 90%", () => {
    const colors = [
      colorForPercentage(90, mockTheme),
      colorForPercentage(95, mockTheme),
      colorForPercentage(100, mockTheme),
    ]
    expect(colors.map((c) => c("value"))).toEqual(["error:value", "error:value", "error:value"])
  })

  it("should handle negative percentages (treat as normal, accent)", () => {
    const color = colorForPercentage(-5, mockTheme)
    expect(color("value")).toBe("accent:value")
  })

  it("should be usable in a render string pattern", () => {
    const color = colorForPercentage(95, mockTheme)
    const result = `Z.ai:${color("95%")}`
    expect(result).toBe("Z.ai:error:95%")
  })

  describe("with custom thresholds", () => {
    const custom: ColorThresholds = {
      percentage: { warning: 60, error: 75 },
      credit: { warning: 5, error: 1 },
    }

    it("should use custom warning threshold", () => {
      // 62 > 60 (custom warning) but < 75 (custom error)
      const color = colorForPercentage(62, mockTheme, custom)
      expect(color("62%")).toBe("warning:62%")
    })

    it("should use custom error threshold", () => {
      // exactly 75 → error
      const color = colorForPercentage(75, mockTheme, custom)
      expect(color("75%")).toBe("error:75%")
    })

    it("should return accent below custom warning", () => {
      const color = colorForPercentage(50, mockTheme, custom)
      expect(color("50%")).toBe("accent:50%")
    })

    it("should not affect colorForCredit thresholds", () => {
      // 3 < 5 (custom credit warning) and > 1 (custom credit error)
      const color = colorForCredit(3, mockTheme, custom)
      expect(color("$3.00")).toBe("warning:$3.00")
    })
  })
})

// --- colorForCredit ---

describe("colorForCredit", () => {
  it("should return accent for credit ≥ $2", () => {
    const colors = [
      colorForCredit(2, mockTheme),
      colorForCredit(5, mockTheme),
      colorForCredit(100, mockTheme),
    ]
    expect(colors.map((c) => c("$2.00"))).toEqual(["accent:$2.00", "accent:$2.00", "accent:$2.00"])
  })

  it("should return warning for credit < $2 and > $1", () => {
    const colors = [
      colorForCredit(1.01, mockTheme),
      colorForCredit(1.5, mockTheme),
      colorForCredit(1.99, mockTheme),
    ]
    expect(colors.map((c) => c("$1.50"))).toEqual([
      "warning:$1.50",
      "warning:$1.50",
      "warning:$1.50",
    ])
  })

  it("should return error for credit ≤ $1", () => {
    const colors = [
      colorForCredit(0, mockTheme),
      colorForCredit(0.5, mockTheme),
      colorForCredit(1, mockTheme),
    ]
    expect(colors.map((c) => c("$1.00"))).toEqual(["error:$1.00", "error:$1.00", "error:$1.00"])
  })

  it("should handle negative credit (error threshold)", () => {
    const color = colorForCredit(-5, mockTheme)
    expect(color("-$5.00")).toBe("error:-$5.00")
  })

  it("should be usable in a render string pattern", () => {
    const color = colorForCredit(0.75, mockTheme)
    const result = `DeepSeek:${color("$0.75")}`
    expect(result).toBe("DeepSeek:error:$0.75")
  })

  describe("with custom thresholds", () => {
    const custom: ColorThresholds = {
      percentage: { warning: 80, error: 90 },
      credit: { warning: 10, error: 5 },
    }

    it("should use custom warning threshold", () => {
      // 7 < 10 (custom warning) and > 5 (custom error)
      const color = colorForCredit(7, mockTheme, custom)
      expect(color("$7.00")).toBe("warning:$7.00")
    })

    it("should use custom error threshold", () => {
      // exactly 5 → error
      const color = colorForCredit(5, mockTheme, custom)
      expect(color("$5.00")).toBe("error:$5.00")
    })

    it("should return accent above custom warning", () => {
      const color = colorForCredit(15, mockTheme, custom)
      expect(color("$15.00")).toBe("accent:$15.00")
    })

    it("should not affect colorForPercentage thresholds", () => {
      // 85 > 80 (percentage warning) but < 90 (percentage error)
      const color = colorForPercentage(85, mockTheme, custom)
      expect(color("85%")).toBe("warning:85%")
    })
  })
})
