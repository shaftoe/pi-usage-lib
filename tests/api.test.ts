/**
 * Unit tests for api.ts
 */

import { afterEach, describe, expect, it } from "bun:test"
import { buildAuthHeaders, safeFetch, safeParseJson, UsageError } from "../src/api"

// --- Helpers ---

function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => {
      if (body === "") {
        return Promise.reject(new SyntaxError("Unexpected end of JSON input"))
      }
      if (typeof body === "string") {
        return Promise.reject(new SyntaxError(`${body} is not valid JSON`))
      }
      return Promise.resolve(body)
    },
  } as Response
}

function mockErrorResponse(status: number): Response {
  return { ok: false, status } as Response
}

type FetchMock = ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) & {
  preconnect?: (url: string | URL) => void
}

function createMockFetch(
  fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): FetchMock {
  const mockFn = fn as FetchMock
  mockFn.preconnect = () => {}
  return mockFn
}

// --- UsageError ---

describe("UsageError", () => {
  it("should have correct name and properties", () => {
    const err = new UsageError("something broke", "test")
    expect(err.name).toBe("UsageError")
    expect(err.message).toBe("something broke")
    expect(err.code).toBe("test")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(UsageError)
  })
})

// --- buildAuthHeaders ---

describe("buildAuthHeaders", () => {
  it("should set Bearer header when real API key is present", async () => {
    const registry = { getApiKeyForProvider: async () => "my-secret-key" }
    const headers = await buildAuthHeaders(registry, "test-provider")
    expect(headers.Authorization).toBe("Bearer my-secret-key")
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should NOT set Authorization when API key is undefined", async () => {
    const registry = { getApiKeyForProvider: async () => undefined }
    const headers = await buildAuthHeaders(registry, "test-provider")
    expect(headers.Authorization).toBeUndefined()
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should NOT set Authorization when API key is empty string", async () => {
    const registry = { getApiKeyForProvider: async () => "" }
    const headers = await buildAuthHeaders(registry, "test-provider")
    expect(headers.Authorization).toBeUndefined()
  })

  it("should NOT set Authorization when API key is proxy-managed sentinel", async () => {
    const registry = { getApiKeyForProvider: async () => "proxy-managed" }
    const headers = await buildAuthHeaders(registry, "test-provider")
    expect(headers.Authorization).toBeUndefined()
  })

  it("should always set Accept-Encoding: identity", async () => {
    const registry = { getApiKeyForProvider: async () => "key" }
    const headers = await buildAuthHeaders(registry, "test-provider")
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should merge extra headers", async () => {
    const registry = { getApiKeyForProvider: async () => "key" }
    const headers = await buildAuthHeaders(registry, "test-provider", { "X-Custom": "value" })
    expect(headers["X-Custom"]).toBe("value")
    expect(headers.Authorization).toBe("Bearer key")
  })

  it("should allow extra headers to override defaults", async () => {
    const registry = { getApiKeyForProvider: async () => "key" }
    const headers = await buildAuthHeaders(registry, "test-provider", {
      "Accept-Encoding": "gzip",
    })
    expect(headers["Accept-Encoding"]).toBe("gzip")
  })
})

// --- safeFetch ---

describe("safeFetch", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("should return response on success", async () => {
    globalThis.fetch = createMockFetch(async () => mockOkResponse({ data: "hello" }))

    const result = await safeFetch("https://example.com/api")
    expect(result.ok).toBe(true)
  })

  it("should wrap network errors as UsageError with code 'fetch'", async () => {
    globalThis.fetch = createMockFetch(async () => {
      throw new TypeError("fetch failed")
    })

    try {
      await safeFetch("https://example.com/api")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("fetch")
      expect((e as UsageError).message).toContain("Network error")
    }
  })

  it("should wrap non-Error rejections as UsageError", async () => {
    globalThis.fetch = createMockFetch(async () => {
      throw "raw string error"
    })

    try {
      await safeFetch("https://example.com/api")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("fetch")
      expect((e as UsageError).message).toContain("raw string error")
    }
  })

  it("should throw UsageError with code 'http401' for 401", async () => {
    globalThis.fetch = createMockFetch(async () => mockErrorResponse(401))

    try {
      await safeFetch("https://example.com/api")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("http401")
      expect((e as UsageError).message).toContain("401")
    }
  })

  it("should throw UsageError with code 'http500' for 500", async () => {
    globalThis.fetch = createMockFetch(async () => mockErrorResponse(500))

    try {
      await safeFetch("https://example.com/api")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("http500")
    }
  })

  it("should pass url and init to fetch", async () => {
    let calledUrl = ""
    let calledInit: RequestInit | undefined
    globalThis.fetch = createMockFetch(async (url, init?) => {
      calledUrl = url.toString()
      calledInit = init
      return mockOkResponse({})
    })

    await safeFetch("https://example.com/api", { headers: { Foo: "bar" } })
    expect(calledUrl).toBe("https://example.com/api")
    expect(calledInit?.headers).toEqual({ Foo: "bar" })
  })
})

// --- safeParseJson ---

describe("safeParseJson", () => {
  it("should parse valid JSON response", async () => {
    const response = mockOkResponse({ hello: "world" })
    const result = await safeParseJson(response)
    expect(result).toEqual({ hello: "world" })
  })

  it("should throw UsageError with code 'badjson' on empty body", async () => {
    const response = mockOkResponse("")
    try {
      await safeParseJson(response)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("badjson")
      expect((e as UsageError).message).toContain("empty or malformed")
    }
  })

  it("should throw UsageError with code 'badjson' on invalid JSON string", async () => {
    const response = mockOkResponse("not json")
    try {
      await safeParseJson(response)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).code).toBe("badjson")
    }
  })

  it("should handle typed parsing", async () => {
    const response = mockOkResponse({ value: 42 })
    const result = await safeParseJson<{ value: number }>(response)
    expect(result.value).toBe(42)
  })
})
