import type { LomkitResourceApi } from '@nexdk/driver-lomkit'
import { SdkError } from 'nexdk'
import type { WriteInput } from 'nexdk'
import { notFound, paging, totalOf } from './core.ts'
import type { ListOptions, Page, Repository } from './types.ts'

export interface LomkitParams {
    search?: Record<string, unknown>
    [key: string]: unknown
}

export interface LomkitRepositoryOptions {
    key?: string
}

const ATTRIBUTE_PREFIX = /^mutate\.\d+\.attributes\./

function withoutPrefix(error: unknown): unknown {
    if (!(error instanceof SdkError)) return error
    const { errors } = error
    if (errors === null || typeof errors !== 'object' || Array.isArray(errors)) return error
    const fields = Object.entries(errors).map(([field, messages]) => [field.replace(ATTRIBUTE_PREFIX, ''), messages])
    return new SdkError(error.message, { status: error.status, errors: Object.fromEntries(fields), data: error.data })
}

function guarded<A extends unknown[], R>(work: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    return async (...args) => {
        try {
            return await work(...args)
        } catch (error) {
            throw withoutPrefix(error)
        }
    }
}

export function lomkitRepository<T extends object>(
    api: LomkitResourceApi<T>,
    options: LomkitRepositoryOptions = {},
): Repository<T, string | number, LomkitParams> {
    const key = options.key ?? 'id'

    const find = async (id: string | number): Promise<T> => {
        const result = await api.get({ search: { filters: [{ field: key, operator: '=', value: id }], limit: 1 } })
        const [row] = result.data
        if (row === undefined) throw notFound()
        return row
    }

    const created = async (input: WriteInput<T>): Promise<string | number> => {
        const [id] = (await api.mutate({ operation: 'create', attributes: input })).created
        if (id === undefined) throw new SdkError('The backend did not return the id of the created record', { status: 0 })
        return id
    }

    return {
        list: guarded(async (listOptions: ListOptions<LomkitParams> = {}): Promise<Page<T>> => {
            const { page, perPage } = paging(listOptions)
            const params = listOptions.params ?? {}
            const result = await api.get({ ...params, search: { ...params.search, page, limit: perPage } })
            return { items: result.data, total: totalOf(result.total), page, perPage }
        }),
        find: guarded(find),
        create: guarded(async input => find(await created(input))),
        update: guarded(async (id, patch) => {
            await api.mutate({ operation: 'update', key: id, attributes: patch })
            return find(id)
        }),
        remove: guarded(async id => {
            await api.delete({ resources: [id] })
        }),
    }
}
