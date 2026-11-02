export interface Row {
    id: number | string
    name: string
    email: string
    age: number
}

export type Draft = Partial<Omit<Row, 'id'>>

export const USER_COUNT = 45

export const NAME_ERROR = 'name must be longer than or equal to 2 characters'

export function validate(draft: Draft): string | undefined {
    return draft.name !== undefined && draft.name.length < 2 ? NAME_ERROR : undefined
}

export class Store {
    rows: Row[]
    private next: number

    constructor(
        private readonly idOf: (n: number) => number | string,
        count: number = USER_COUNT,
    ) {
        this.rows = Array.from({ length: count }, (_, index) => ({
            id: idOf(index + 1),
            name: `User ${index + 1}`,
            email: `user${index + 1}@example.test`,
            age: 20 + (index % 30),
        }))
        this.next = count + 1
    }

    slice(page: number, perPage: number): Row[] {
        return this.rows.slice((page - 1) * perPage, page * perPage)
    }

    find(id: string): Row | undefined {
        return this.rows.find(row => String(row.id) === id)
    }

    insert(draft: Draft): Row {
        const row = { name: '', email: '', age: 0, ...draft, id: this.idOf(this.next++) }
        this.rows.push(row)
        return row
    }

    patch(id: string, draft: Draft): Row | undefined {
        const row = this.find(id)
        return row === undefined ? undefined : Object.assign(row, draft)
    }

    remove(id: string): boolean {
        const before = this.rows.length
        this.rows = this.rows.filter(row => String(row.id) !== id)
        return this.rows.length < before
    }
}
