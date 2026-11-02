import type { StrapiListQuery, StrapiResourceApi } from '@nexdk/driver-strapi'
import { paging, totalOf } from './core.ts'
import type { ListOptions, Page, Repository } from './types.ts'

export type StrapiParams = Omit<StrapiListQuery, 'pagination'>

export function strapiRepository<T extends { id: number | string }>(
    api: StrapiResourceApi<T>,
): Repository<T, number | string, StrapiParams> {
    return {
        list: async (options: ListOptions<StrapiParams> = {}): Promise<Page<T>> => {
            const { page, perPage } = paging(options)
            const rows = await api.get({ ...options.params, pagination: { page, pageSize: perPage } })
            return { items: [...rows], total: totalOf(rows.pagination?.total), page, perPage }
        },
        find: id => api.find({ id }),
        create: input => api.create(input),
        update: (id, patch) => api.update({ ...patch, id }),
        remove: async id => {
            await api.remove({ id })
        },
    }
}
