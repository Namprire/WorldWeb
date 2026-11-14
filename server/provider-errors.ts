import { setTimeout as delay } from 'node:timers/promises'

type Provider = 'Context.dev' | 'Gemini'

export class ProviderError extends Error {
  constructor(
    readonly provider: Provider,
    readonly reason: 'unavailable' | 'credentials' | 'quota' | 'timeout' | 'empty' | 'invalid',
  ) {
    const messages = {
      unavailable: 'is unavailable. Try again or switch to Demo Mode.',
      credentials: 'rejected its configuration. Check the server API key and model settings.',
      quota: 'has reached its usage limit. Try again later or switch to Demo Mode.',
      timeout: 'took too long. Try again or switch to Demo Mode.',
      empty: 'found no recent usable technology headlines. Try again later or switch to Demo Mode.',
      invalid: 'did not return a playable mission. Try again or switch to Demo Mode.',
    }
    super(`${provider} ${messages[reason]}`)
  }

  get httpStatus() {
    if (this.reason === 'timeout') return 504
    if (this.reason === 'quota' || this.reason === 'empty') return 503
    return 502
  }
}

function classify(provider: Provider, error: unknown, signal: AbortSignal): ProviderError {
  if (error instanceof ProviderError) return error
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
  if (signal.aborted || status === 408 || status === 504) return new ProviderError(provider, 'timeout')
  if (status === 429) return new ProviderError(provider, 'quota')
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return new ProviderError(provider, 'credentials')
  }
  return new ProviderError(provider, 'unavailable')
}

export async function requestProvider<T>(
  provider: Provider,
  timeoutMs: number,
  request: (signal: AbortSignal, retry: boolean) => Promise<T>,
): Promise<T> {
  for (const retry of [false, true]) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await request(controller.signal, retry)
    } catch (error) {
      const failure = classify(provider, error, controller.signal)
      if (retry || !['timeout', 'unavailable', 'invalid'].includes(failure.reason)) throw failure
      console.warn(`[WEBWORLD] ${provider} ${failure.reason}; retrying once`)
    } finally {
      clearTimeout(timeout)
    }
    await delay(150)
  }

  throw new ProviderError(provider, 'unavailable')
}
