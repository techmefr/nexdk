import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineResource } from '@pilota/core'
import { useResourceForm } from '../src/use-resource-form.ts'

const UserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
})

const userResource = defineResource({ name: 'users', schema: UserSchema })

const ProductSchema = z.object({
    name: z.string().default(''),
    price: z.number().default(0),
    published: z.boolean().default(false),
})

const productResource = defineResource({ name: 'products', schema: ProductSchema })

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

    it('fill hydrates values', () => {
        const { values, fill } = useResourceForm(userResource)
        fill({ name: 'Alice', email: 'alice@test.com' })
        expect(values.value.name).toBe('Alice')
        expect(values.value.email).toBe('alice@test.com')
    })

    it('isDirty is false immediately after fill', () => {
        const { isDirty, fill } = useResourceForm(userResource)
        fill({ name: 'Alice', email: 'alice@test.com' })
        expect(isDirty.value).toBe(false)
    })

    it('isDirty is true after modifying a field post-fill', () => {
        const { values, isDirty, fill } = useResourceForm(userResource)
        fill({ name: 'Alice', email: 'alice@test.com' })
        values.value.name = 'Bob'
        expect(isDirty.value).toBe(true)
    })

    it('reset after fill returns to null (initial), not fill values', () => {
        const { values, fill, reset } = useResourceForm(userResource)
        fill({ name: 'Alice', email: 'alice@test.com' })
        reset()
        expect(values.value).toEqual({ name: null, email: null })
    })

    it('isDirty is false after reset following a fill', () => {
        const { values, isDirty, fill, reset } = useResourceForm(userResource)
        fill({ name: 'Alice', email: 'alice@test.com' })
        values.value.name = 'Bob'
        reset()
        expect(isDirty.value).toBe(false)
    })

    it('reads Zod defaults as initial values', () => {
        const { values } = useResourceForm(productResource)
        expect(values.value).toEqual({ name: '', price: 0, published: false })
    })

    it('isDirty is false when value equals Zod default', () => {
        const { values, isDirty } = useResourceForm(productResource)
        values.value.name = ''
        expect(isDirty.value).toBe(false)
    })
})
