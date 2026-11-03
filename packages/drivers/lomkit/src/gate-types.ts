export type LomkitGateName = 'viewAny' | 'view' | 'create' | 'update' | 'delete' | 'restore' | 'forceDelete'

export interface LomkitGateDetail {
    allowed: boolean
    message: string | null
}

export type LomkitGateValue = boolean | LomkitGateDetail

export interface LomkitGates {
    authorized_to_view?: LomkitGateValue
    authorized_to_create?: LomkitGateValue
    authorized_to_update?: LomkitGateValue
    authorized_to_delete?: LomkitGateValue
    authorized_to_restore?: LomkitGateValue
    authorized_to_force_delete?: LomkitGateValue
    [name: string]: LomkitGateValue | undefined
}

export type LomkitRow<T> = T & { gates?: LomkitGates }

export interface LomkitMeta {
    gates?: LomkitGates
}
