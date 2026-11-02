import { backend, empty, intParam, json, lastSegment } from './http.ts'
import type { FakeBackend } from './http.ts'
import { NAME_ERROR, Store, validate } from './store.ts'

export const LOMKIT_URL = 'http://backend.test/api'
export const POCKETBASE_URL = 'http://backend.test'
export const STRAPI_URL = 'http://backend.test'
export const NEST_URL = 'http://backend.test'
export const SYMFONY_URL = 'http://backend.test/api'

export function lomkitBackend(store: Store): FakeBackend {
    return backend(({ method, url, body }) => {
        if (url.pathname.endsWith('/users/search')) {
            const search = body.search ?? {}
            const filters: Array<{ field: string; value: unknown }> = search.filters ?? []
            const matching = store.rows.filter(row =>
                filters.every(filter => String((row as unknown as Record<string, unknown>)[filter.field]) === String(filter.value)),
            )
            const perPage: number = search.limit ?? 15
            const page: number = search.page ?? 1
            const data = matching.slice((page - 1) * perPage, page * perPage)
            return json(200, {
                data,
                current_page: page,
                last_page: Math.max(1, Math.ceil(matching.length / perPage)),
                per_page: perPage,
                total: matching.length,
            })
        }
        if (url.pathname.endsWith('/users/mutate')) {
            const [change] = body.mutate
            if (change.operation === 'create') {
                const message = validate(change.attributes)
                if (message !== undefined) {
                    return json(422, { message: 'The given data was invalid.', errors: { 'mutate.0.attributes.name': [message] } })
                }
                return json(200, { created: [store.insert(change.attributes).id], updated: [] })
            }
            const row = store.patch(String(change.key), change.attributes)
            return row === undefined ? json(404, { message: 'No query results' }) : json(200, { created: [], updated: [row.id] })
        }
        if (method === 'DELETE') {
            for (const id of body.resources) store.remove(String(id))
            return json(200, { success: true })
        }
        return json(404, { message: 'Not Found' })
    })
}

export function pocketbaseBackend(store: Store): FakeBackend {
    const missing = () => json(404, { status: 404, message: 'The requested resource was not found.', data: {} })
    const invalid = () =>
        json(400, {
            status: 400,
            message: 'Failed to create record.',
            data: { name: { code: 'validation_min_text_constraint', message: NAME_ERROR } },
        })
    return backend(({ method, url, body }) => {
        const isCollection = url.pathname.endsWith('/records')
        if (isCollection && method === 'GET') {
            const page = intParam(url, 'page', 1)
            const perPage = intParam(url, 'perPage', 30)
            return json(200, {
                page,
                perPage,
                totalItems: store.rows.length,
                totalPages: Math.ceil(store.rows.length / perPage),
                items: store.slice(page, perPage),
            })
        }
        if (isCollection && method === 'POST') {
            return validate(body) === undefined ? json(200, store.insert(body)) : invalid()
        }
        const id = lastSegment(url)
        if (method === 'GET') {
            const row = store.find(id)
            return row === undefined ? missing() : json(200, row)
        }
        if (method === 'PATCH') {
            const row = store.patch(id, body)
            return row === undefined ? missing() : json(200, row)
        }
        return store.remove(id) ? empty() : missing()
    })
}

export function strapiBackend(store: Store): FakeBackend {
    const missing = () => json(404, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found', details: {} } })
    const invalid = () =>
        json(400, {
            data: null,
            error: {
                status: 400,
                name: 'ValidationError',
                message: NAME_ERROR,
                details: { errors: [{ path: ['name'], message: NAME_ERROR, name: 'ValidationError' }] },
            },
        })
    return backend(({ method, url, body }) => {
        const isCollection = url.pathname.endsWith('/api/users')
        if (isCollection && method === 'GET') {
            const page = intParam(url, 'pagination[page]', 1)
            const pageSize = intParam(url, 'pagination[pageSize]', 25)
            return json(200, {
                data: store.slice(page, pageSize),
                meta: { pagination: { page, pageSize, pageCount: Math.ceil(store.rows.length / pageSize), total: store.rows.length } },
            })
        }
        if (isCollection && method === 'POST') {
            return validate(body.data) === undefined ? json(200, { data: store.insert(body.data), meta: {} }) : invalid()
        }
        const id = lastSegment(url)
        if (method === 'GET') {
            const row = store.find(id)
            return row === undefined ? missing() : json(200, { data: row, meta: {} })
        }
        if (method === 'PUT') {
            const row = store.patch(id, body.data)
            return row === undefined ? missing() : json(200, { data: row, meta: {} })
        }
        return store.remove(id) ? empty() : missing()
    })
}

export function nestBackend(store: Store): FakeBackend {
    const missing = () => json(404, { statusCode: 404, message: 'Not Found' })
    return backend(({ method, url, body }) => {
        const isCollection = url.pathname === '/users'
        if (isCollection && method === 'GET') {
            return json(200, store.slice(intParam(url, 'page', 1), intParam(url, 'limit', 10)))
        }
        if (isCollection && method === 'POST') {
            const message = validate(body)
            return message === undefined ? json(201, store.insert(body)) : json(400, { statusCode: 400, message: [message], error: 'Bad Request' })
        }
        const id = lastSegment(url)
        if (method === 'GET') {
            const row = store.find(id)
            return row === undefined ? missing() : json(200, row)
        }
        if (method === 'PATCH') {
            const row = store.patch(id, body)
            return row === undefined ? missing() : json(200, row)
        }
        return store.remove(id) ? json(200, { success: true }) : missing()
    })
}

export function symfonyBackend(store: Store): FakeBackend {
    const missing = () => json(404, { 'hydra:description': 'Not Found' })
    return backend(({ method, url, body }) => {
        const isCollection = url.pathname.endsWith('/api/users')
        if (isCollection && method === 'GET') {
            return json(200, {
                'hydra:member': store.slice(intParam(url, 'page', 1), intParam(url, 'itemsPerPage', 30)),
                'hydra:totalItems': store.rows.length,
            })
        }
        if (isCollection && method === 'POST') {
            const message = validate(body)
            return message === undefined ? json(201, store.insert(body)) : json(422, { violations: [{ propertyPath: 'name', message }] })
        }
        const id = lastSegment(url)
        if (method === 'GET') {
            const row = store.find(id)
            return row === undefined ? missing() : json(200, row)
        }
        if (method === 'PATCH') {
            const row = store.patch(id, body)
            return row === undefined ? missing() : json(200, row)
        }
        return store.remove(id) ? empty() : missing()
    })
}
