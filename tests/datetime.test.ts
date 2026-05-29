/**
 * Unit tests for datetime.ts
 */

import { describe, expect, it } from "bun:test"
import { Temporal } from "temporal-polyfill"
import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "../src/datetime"

describe("formatInstantFromEpochMs", () => {
  it("should format an instant as a localized date/time string", () => {
    // January 15, 2024, 14:30:45 UTC
    const epochMs = 1_705_318_245_000
    const result = formatInstantFromEpochMs(epochMs)

    expect(result).toMatch(/\d{1,2}/) // Day
    expect(result).toMatch(/[A-Za-z]{3}/) // Month abbreviation
    expect(result).toMatch(/\d{4}/) // Year
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/) // Time
  })

  it("should handle epoch zero", () => {
    const result = formatInstantFromEpochMs(0)
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("should handle recent timestamps", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const result = formatInstantFromEpochMs(now)
    expect(result).toMatch(/\d{4}/)
  })
})

describe("formatTimeRemainingFromEpochMs", () => {
  it("should format remaining time in hours, minutes, and seconds", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 3_665_000 // 1h 1m 5s
    const result = formatTimeRemainingFromEpochMs(future)
    expect(result).toMatch(/\d+h \d+m \d+s/)
  })

  it("should format remaining time in minutes and seconds when less than an hour", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 65_000 // 1m 5s
    const result = formatTimeRemainingFromEpochMs(future)
    expect(result).toMatch(/\d+m \d+s/)
  })

  it("should format remaining time in seconds when less than a minute", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 45_000 // 45s
    const result = formatTimeRemainingFromEpochMs(future)
    expect(result).toMatch(/\d+s/)
  })

  it("should return '0h 0m 0s' for past timestamps", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const past = now - 1_000_000
    const result = formatTimeRemainingFromEpochMs(past)
    expect(result).toBe("0h 0m 0s")
  })

  it("should return '0s' for exactly now", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const result = formatTimeRemainingFromEpochMs(now)
    expect(result).toBe("0s")
  })

  it("should round down seconds", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 1500 // 1.5s
    const result = formatTimeRemainingFromEpochMs(future)
    expect(result).toBe("1s")
  })

  it("should format hours correctly for large durations", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 73_200_000 // ~20h 20m
    const result = formatTimeRemainingFromEpochMs(future)
    expect(result).toMatch(/\d+h \d+m \d+s/)
  })
})
