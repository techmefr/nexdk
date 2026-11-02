import type { PocketbaseListQuery, PocketbaseResourceApi } from '@nexdk/driver-pocketbase'
import { paging, totalOf } from './core.ts'
import type { ListOptions, Page, Repository } from './types.ts'

export type PocketbaseParams = Omit<PocketbaseListQuery, 'page' | 'perPage'>

export function pocketbaseRepository<T extends { id: string }>(
    api: PocketbaseResourceApi<T>,
): Repository<T, string, PocketbaseParams> {
    return {
        list: async (options: ListOptions<PocketbaseParams> = {}): Promise<Page<T>> => {
            const { page, perPage } = paging(options)
            const rows = await api.get({ ...options.params, page, perPage })
            return { items: [...rows], total: totalOf(rows.pagination?.totalItems), page, perPage }
        },
        find: id => api.find({ id }),
        create: input => api.create(input),
        update: (id, patch) => api.update({ ...patch, id }),
        remove: async id => {
            await api.remove({ id })
        },
    }
}
