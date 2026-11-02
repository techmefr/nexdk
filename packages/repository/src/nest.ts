import type { NestResourceApi } from '@nexdk/driver-nest'
import { paging } from './core.ts'
import type { ListOptions, Page, PagingParams, Repository } from './types.ts'

export interface NestRepositoryOptions {
    paging?: PagingParams
}

const defaultPaging: PagingParams = (page, perPage) => ({ page, limit: perPage })

export function nestRepository<T extends { id: number | string }>(
    api: NestResourceApi<T>,
    options: NestRepositoryOptions = {},
): Repository<T> {
    const toParams = options.paging ?? defaultPaging
    return {
        list: async (listOptions: ListOptions = {}): Promise<Page<T>> => {
            const { page, perPage } = paging(listOptions)
            const items = await api.get({ ...listOptions.params, ...toParams(page, perPage) })
            return { items: [...items], total: null, page, perPage }
        },
        find: id => api.find({ id }),
        create: input => api.create(input),
        update: (id, patch) => api.update({ ...patch, id }),
        remove: async id => {
            await api.remove({ id })
        },
    }
}
