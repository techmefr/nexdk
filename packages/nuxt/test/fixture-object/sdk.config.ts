import { LomkitDriver } from '@nexdk/driver-lomkit'
import { defineResource, defineSdkConfig } from 'nexdk'
import { z } from 'zod'

const users = defineResource({ name: 'users', schema: z.object({ id: z.number(), name: z.string() }) })

let calls = 0

async function countingFetch(): Promise<Response> {
    calls++
    return new Response(JSON.stringify({ data: [{ id: calls, name: `call ${calls}` }] }), { headers: { 'Content-Type': 'application/json' } })
}

export default defineSdkConfig({
    drivers: { lomkit: new LomkitDriver({ baseUrl: 'http://api.test', fetch: countingFetch }) },
    resources: { lomkit: { users } },
    throw: true,
})
