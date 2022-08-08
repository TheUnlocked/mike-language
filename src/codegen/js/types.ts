export type ParameterType
    = 'int'
    | 'float'
    | 'string'
    | 'boolean'
    | { variant: 'option', type: ParameterType }
    | { variant: 'custom', name: string }
    ;

export interface EventData {
    params: object;
    state: object;
    args: any[];
}

export interface ListenerResult {
    state: object;
}

export interface MiKeProgram {
    params: { name: string, type: ParameterType }[];
    state: { name: string, default: any }[];
    listeners: { event: string, callback: (state: EventData) => ListenerResult };
}