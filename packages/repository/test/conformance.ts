import { SdkError } from 'nexdk'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_PER_PAGE } from '../src/index.ts'
import type { Repository } from '../src/index.ts'
import type { Row } from './support/store.ts'

export interface ConformanceTarget<T extends Row, Id extends string | number> {
    name: string
    total: 'exact' | 'unavailable'
    count: number
    missingId: Id
    open: () => Promise<{ repository: Repository<T, Id, never>; close?: () => Promise<void> }>
}

const rejection = (work: Promise<unknown>): Promise<unknown> => work.then(() => undefined, error => error)

const idsOf = (rows: Row[]): Array<number | string> => rows.map(row => row.id)

export function defineConformance<T extends Row, Id extends string | number>(target: ConformanceTarget<T, Id>): void {
    describe(`repository conformance: ${target.name}`, () => {
        let repository: Repository<T, Id, never>
        let close: (() => Promise<void>) | undefined

        beforeAll(async () => {
            ;({ repository, close } = await target.open())
        })

        afterAll(async () => {
            await close?.()
        })

        it('lists the first page with the default size', async () => {
            const page = await repository.list()

            expect(page.page).toBe(1)
            expect(page.perPage).toBe(DEFAULT_PER_PAGE)
            expect(page.items).toHaveLength(DEFAULT_PER_PAGE)
        })

        it('returns exactly items, total, page and perPage as plain values', async () => {
            const page = await repository.list({ perPage: 5 })

            expect(Object.keys(page).sort()).toEqual(['items', 'page', 'perPage', 'total'])
            expect(Object.keys(page.items)).toEqual(['0', '1', '2', '3', '4'])
        })

        it('serves distinct pages of the requested size', async () => {
            const first = await repository.list({ perPage: 10, page: 1 })
            const second = await repository.list({ perPage: 10, page: 2 })

            expect(first.items).toHaveLength(10)
            expect(second.items).toHaveLength(10)
            expect(second.page).toBe(2)
            expect(idsOf(first.items).filter(id => idsOf(second.items).includes(id))).toEqual([])
        })

        it('serves a short last page then an empty page', async () => {
            const lastPage = Math.ceil(target.count / 10)
            const last = await repository.list({ perPage: 10, page: lastPage })
            const beyond = await repository.list({ perPage: 10, page: lastPage + 1 })

            expect(last.items).toHaveLength(target.count - (lastPage - 1) * 10)
            expect(beyond.items).toEqual([])
        })

        it(target.total === 'exact' ? 'reports the exact total on every page' : 'reports a null total', async () => {
            const expected = target.total === 'exact' ? target.count : null

            expect((await repository.list({ perPage: 10 })).total).toBe(expected)
            expect((await repository.list({ perPage: 10, page: 3 })).total).toBe(expected)
        })

        it('rejects a page or size that is not a positive integer', async () => {
            await expect(repository.list({ page: 0 })).rejects.toBeInstanceOf(RangeError)
            await expect(repository.list({ perPage: 1.5 })).rejects.toBeInstanceOf(RangeError)
        })

        it('finds a listed record by id', async () => {
            const [first] = (await repository.list({ perPage: 1 })).items

            expect(await repository.find(first!.id as Id)).toMatchObject({ id: first!.id, email: first!.email })
        })

        it('throws a 404 SdkError for a missing id on find and update', async () => {
            for (const work of [repository.find(target.missingId), repository.update(target.missingId, { age: 1 } as Partial<T>)]) {
                const error = await rejection(work)

                expect(error).toBeInstanceOf(SdkError)
                expect((error as SdkError).status).toBe(404)
            }
        })

        it('creates, updates and removes a record', async () => {
            const created = await repository.create({ name: 'Zoe Martin', email: 'zoe@example.test', age: 31 } as Partial<T>)
            expect(created).toMatchObject({ name: 'Zoe Martin', age: 31 })

            const updated = await repository.update(created.id as Id, { age: 32 } as Partial<T>)
            expect(updated).toMatchObject({ id: created.id, name: 'Zoe Martin', age: 32 })

            await repository.remove(created.id as Id)
            expect(((await rejection(repository.find(created.id as Id))) as SdkError).status).toBe(404)
        })

        it('throws an SdkError whose errors are keyed by field on a validation failure', async () => {
            const error = (await rejection(repository.create({ name: 'A', email: 'a@example.test', age: 30 } as Partial<T>))) as SdkError

            expect(error).toBeInstanceOf(SdkError)
            expect([400, 422]).toContain(error.status)
            expect(error.errors).toEqual({ name: [expect.any(String)] })
        })
    })
}
