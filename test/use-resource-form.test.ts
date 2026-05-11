import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@pilota/core'
import { useResourceForm } from '../src/use-resource-form.ts'

const UserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
})

const userResource = defineResource({ name: 'users', schema: UserSchema })

describe('useResourceForm', () => {
    it('initializes all fields to null', () => {
        const { values } = useResourceForm(userResource)
        expect(values.value).toEqual({ name: null, email: null })
    })

    it('initializes errors to empty object', () => {
        const { errors } = useResourceForm(userResource)
        expect(errors.value).toEqual({})
    })

    it('isDirty is false initially', () => {
        const { isDirty } = useResourceForm(userResource)
        expect(isDirty.value).toBe(false)
    })

    it('isDirty is true after a field changes', () => {
        const { values, isDirty } = useResourceForm(userResource)
        values.value.name = 'Alice'
        expect(isDirty.value).toBe(true)
    })

    it('isDirty returns to false after reset', () => {
        const { values, isDirty, reset } = useResourceForm(userResource)
        values.value.name = 'Alice'
        reset()
        expect(isDirty.value).toBe(false)
    })

    it('reset clears values and errors', () => {
        const { values, errors, reset } = useResourceForm(userResource)
        values.value.name = 'Alice'
        errors.value = { name: ['some error'] }
        reset()
        expect(values.value).toEqual({ name: null, email: null })
        expect(errors.value).toEqual({})
    })

    it('handleSubmit populates errors when validation fails', async () => {
        const { values, errors, handleSubmit } = useResourceForm(userResource)
        values.value.name = ''

        const submit = handleSubmit(vi.fn())
        await submit()

        expect(errors.value).toHaveProperty('name')
    })

    it('handleSubmit calls onValid with parsed data when valid', async () => {
        const { values, handleSubmit } = useResourceForm(userResource)
        values.value.name = 'Alice'
        values.value.email = 'alice@test.com'

        const onValid = vi.fn()
        const submit = handleSubmit(onValid)
        await submit()

        expect(onValid).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@test.com' })
    })

    it('handleSubmit clears errors before running', async () => {
        const { values, errors, handleSubmit } = useResourceForm(userResource)
        errors.value = { name: ['old error'] }
        values.value.name = 'Alice'
        values.value.email = 'alice@test.com'

        const submit = handleSubmit(vi.fn())
        await submit()

        expect(errors.value).toEqual({})
    })

    it('setServerErrors injects server errors into errors', () => {
        const { errors, setServerErrors } = useResourceForm(userResource)
        setServerErrors({ email: ['This email is already taken.'] })
        expect(errors.value).toEqual({ email: ['This email is already taken.'] })
    })
})
