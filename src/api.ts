/**
 * pi-usage-lib — API utilities
 * Sandbox-aware auth, safe fetch, structured errors.
 * Extracted from the Z.ai extension (most battle-tested).
 */

import type { ModelRegistry } from "@earendil-works/pi-coding-agent"

/** Sentinel value injected by Docker Sandbox proxy when an env var is
 * proxy-managed (listed under environment.proxyManaged in spec.yaml).
 * When the API key reads as this value, the proxy will inject the real
 * Authorization header, so we should not set it ourselves. */
const PROXY_MANAGED_SENTINEL = "proxy-managed"

/** Error thrown by API interactions; carries a short code for footer display */
export class UsageError extends Error {
  override readonly name = "UsageError"
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}

/**
 * Build authenticated headers — Z.ai's 3-way sandbox-aware strategy:
 *
 * 1. Real key present → send "Authorization: Bearer <key>"
 * 2. Key is "proxy-managed" sentinel → don't set auth (sandbox proxy handles it)
 * 3. No key → don't set auth (API returns 401, shown as error)
 *
 * Also sets Accept-Encoding: identity to work around Pi v0.75.0's
 * undici EnvHttpProxyAgent gzip decompression issue.
 */
export async function buildAuthHeaders(
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
  providerName: string,
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const apiKey = await modelRegistry.getApiKeyForProvider(providerName)
  const headers: Record<string, string> = {
    // Prevent gzip encoding: Pi v0.75.0 routes fetch() through undici's
    // EnvHttpProxyAgent which fails to decompress gzip responses, causing
    // response.json() to see garbled bytes and throw SyntaxError.
    "Accept-Encoding": "identity",
    ...extra,
  }
  if (apiKey && apiKey !== PROXY_MANAGED_SENTINEL) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

/**
 * Fetch with error wrapping:
 * - Network errors (DNS, timeout, proxy) → UsageError("fetch")
 * - HTTP errors (4xx, 5xx) → UsageError("http{status}")
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (e) {
    throw new UsageError(`Network error: ${e instanceof Error ? e.message : String(e)}`, "fetch")
  }
  if (!response.ok) {
    throw new UsageError(
      `API request failed with status ${response.status}`,
      `http${response.status}`,
    )
  }
  return response
}

/**
 * Parse JSON with error handling:
 * - Empty/malformed body → UsageError("badjson")
 */
export async function safeParseJson<T = unknown>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch (e) {
    const message = e instanceof SyntaxError ? "empty or malformed response" : String(e)
    throw new UsageError(`API returned invalid JSON (${message})`, "badjson")
  }
}
