import { describe, expect, it } from 'vitest'
import { SdkError, toErrorPayload } from '../src/errors.ts'

describe('SdkError', () => {
    it('carries status, errors and data', () => {
        const error = new SdkError('Invalid', { status: 422, errors: { email: ['bad'] }, data: { message: 'Invalid' } })
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Invalid')
        expect(error.status).toBe(422)
        expect(error.errors).toEqual({ email: ['bad'] })
        expect(error.data).toEqual({ message: 'Invalid' })
    })

    it('leaves status, errors and data undefined by default', () => {
        const error = new SdkError('boom')
        expect(error.status).toBeUndefined()
        expect(error.errors).toBeUndefined()
        expect(error.data).toBeUndefined()
    })
})

describe('toErrorPayload', () => {
    it('maps an SdkError to message, status and errors', () => {
        const error = new SdkError('Invalid', { status: 422, errors: { email: ['bad'] } })
        expect(toErrorPayload(error)).toEqual({ message: 'Invalid', status: 422, errors: { email: ['bad'] } })
    })

    it('maps a plain Error to its message only', () => {
        expect(toErrorPayload(new Error('boom'))).toEqual({ message: 'boom' })
    })

    it('maps a non-error to a string message', () => {
        expect(toErrorPayload('nope')).toEqual({ message: 'nope' })
    })
})

describe('toErrorPayload consistency with SdkError', () => {
    it('does not invent errors from data for an SdkError without errors', () => {
        const error = new SdkError('Bad', { status: 500, data: { detail: 'x' } })
        expect(toErrorPayload(error)).toEqual({ message: 'Bad', status: 500 })
    })
})
