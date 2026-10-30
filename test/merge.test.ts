import { describe, expect, it, vi } from 'vitest'
import { mergeEventHandlers } from '../src/merge.ts'

describe('mergeEventHandlers', () => {
    it('returns the local handler when global is undefined', () => {
        const local = vi.fn()
        expect(mergeEventHandlers(undefined, local)).toBe(local)
    })

    it('returns the global handler when local is undefined', () => {
        const global = vi.fn()
        expect(mergeEventHandlers(global, undefined)).toBe(global)
    })

    it('returns undefined when both are undefined', () => {
        expect(mergeEventHandlers(undefined, undefined)).toBeUndefined()
    })

    it('calls both handlers with the same event and data when both are provided', () => {
        const global = vi.fn()
        const local = vi.fn()

        const merged = mergeEventHandlers(global, local)
        merged?.('success', { ok: true })

        expect(global).toHaveBeenCalledWith('success', { ok: true })
        expect(local).toHaveBeenCalledWith('success', { ok: true })
    })

    it('still calls local when global throws, then rethrows the first error', () => {
        const local = vi.fn(() => { throw new Error('local') })
        const merged = mergeEventHandlers(() => { throw new Error('global') }, local)

        expect(() => merged?.('success')).toThrow('global')
        expect(local).toHaveBeenCalledTimes(1)
    })

    it('rethrows the local error when only local throws', () => {
        const global = vi.fn()
        const merged = mergeEventHandlers(global, () => { throw new Error('local') })

        expect(() => merged?.('success')).toThrow('local')
        expect(global).toHaveBeenCalledTimes(1)
    })

    it('calls global before local', () => {
        const order: string[] = []
        const global = vi.fn(() => order.push('global'))
        const local = vi.fn(() => order.push('local'))

        const merged = mergeEventHandlers(global, local)
        merged?.('request')

        expect(order).toEqual(['global', 'local'])
    })
})
