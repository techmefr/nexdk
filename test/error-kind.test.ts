import { describe, expect, it } from 'vitest'
import { SdkError, toErrorPayload } from '../src/index.ts'

describe('SdkError kind and cause', () => {
    it('keeps the cause and the kind and reports the kind in the error payload', () => {
        const cause = new TypeError('fetch failed')
        const error = new SdkError('offline', { status: 0, kind: 'network', cause })
        expect(error.cause).toBe(cause)
        expect(error.kind).toBe('network')
        expect(toErrorPayload(error)).toEqual({ message: 'offline', status: 0, kind: 'network' })
    })

    it('leaves kind and cause undefined by default', () => {
        const error = new SdkError('x')
        expect(error.kind).toBeUndefined()
        expect('cause' in error).toBe(false)
        expect(toErrorPayload(error)).toEqual({ message: 'x' })
    })
})
