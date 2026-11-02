import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/request.ts'

describe('HttpError field errors', () => {
    it('keeps Laravel errors as they are', () => {
        const data = { message: 'invalid', errors: { email: ['required'] } }

        expect(new HttpError(422, data).errors).toEqual({ email: ['required'] })
    })

    it('maps the PocketBase data map to message arrays', () => {
        const data = {
            status: 400,
            message: 'Failed to create record.',
            data: { name: { code: 'validation_required', message: 'Cannot be blank.' } },
        }

        const error = new HttpError(400, data)

        expect(error.errors).toEqual({ name: ['Cannot be blank.'] })
        expect(error.data).toEqual(data)
    })

    it('prefers errors over data when both are present', () => {
        const data = { errors: { a: ['x'] }, data: { b: { message: 'y' } } }

        expect(new HttpError(400, data).errors).toEqual({ a: ['x'] })
    })

    it('leaves errors undefined for an empty data map', () => {
        expect(new HttpError(400, { status: 400, message: 'm', data: {} }).errors).toBeUndefined()
    })

    it('leaves errors undefined when data entries are not field issues', () => {
        expect(new HttpError(400, { message: 'm', data: { id: 3 } }).errors).toBeUndefined()
        expect(new HttpError(400, { message: 'm', data: [{ message: 'x' }] }).errors).toBeUndefined()
    })
})
