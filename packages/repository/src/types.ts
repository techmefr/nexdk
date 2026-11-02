export interface Page<T> {
    items: T[]
    total: number | null
    page: number
    perPage: number
}

export interface ListOptions<Params = Record<string, unknown>> {
    page?: number
    perPage?: number
    params?: Params
}

export interface Repository<
    T extends object,
    Id extends string | number = string | number,
    Params = Record<string, unknown>,
> {
    list: (options?: ListOptions<Params>) => Promise<Page<T>>
    find: (id: Id) => Promise<T>
    create: (input: Partial<T>) => Promise<T>
    update: (id: Id, patch: Partial<T>) => Promise<T>
    remove: (id: Id) => Promise<void>
}

export type PagingParams = (page: number, perPage: number) => Record<string, unknown>
