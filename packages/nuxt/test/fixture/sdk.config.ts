import { LomkitDriver } from '@nexdk/driver-lomkit'
import { defineResource } from 'nexdk'
import type { StandardSchemaV1 } from 'nexdk'
import type { NuxtApp } from '#app'

interface User {
    id: number
    name: string
    side: string
}

const userSchema: StandardSchemaV1<User> = {
    '~standard': { version: 1, vendor: 'fixture', validate: value => ({ value: value as User }) },
}

const users = defineResource({ name: 'users', schema: userSchema })

const rows = [
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
]

async function fakeFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const side = new Headers(init?.headers).get('x-side')
    const body = { data: rows.map(row => ({ ...row, side })) }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

export default (nuxtApp: NuxtApp) => defineSdkConfig({
    drivers: {
        lomkit: new LomkitDriver({
            baseUrl: 'http://api.test',
            fetch: fakeFetch,
            headers: { 'X-Side': nuxtApp.ssrContext ? 'server' : 'client' },
        }),
    },
    resources: { lomkit: { users } },
})
