import type { SymfonyResourceApi } from '@nexdk/driver-symfony'
import { paging, totalOf } from './core.ts'
import type { ListOptions, Page, PagingParams, Repository } from './types.ts'

export interface SymfonyRepositoryOptions {
    paging?: PagingParams
}

const defaultPaging: PagingParams = (page, perPage) => ({ page, itemsPerPage: perPage })

export function symfonyRepository<T extends { id: number | string }>(
    api: SymfonyResourceApi<T>,
    options: SymfonyRepositoryOptions = {},
): Repository<T> {
    const toParams = options.paging ?? defaultPaging
    return {
        list: async (listOptions: ListOptions = {}): Promise<Page<T>> => {
            const { page, perPage } = paging(listOptions)
            const rows = await api.get({ ...listOptions.params, ...toParams(page, perPage) })
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
