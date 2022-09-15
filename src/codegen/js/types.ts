export type ParameterType
    = { variant: 'int' }
    | { variant: 'float' }
    | { variant: 'string' }
    | { variant: 'boolean' }
    | { variant: 'option', type: ParameterType }
    | { variant: 'custom', name: string }
    ;

export interface EventData {
    params: { [paramName: string]: any };
    state: { [stateName: string]: any };
    args: any[];
}

export interface ListenerResult {
    state: { [stateName: string]: any };
}

export interface MiKeProgramExternals extends Record<string, any> {
    debug(...args: any[]): void;
}

export type MiKeProgramWithoutExternals = (externals: MiKeProgramExternals) => MiKeProgram;

export interface MiKeProgram {
    params: { name: string, type: ParameterType }[];
    state: { name: string, default: any }[];
    listeners: { event: string, callback: (state: EventData) => ListenerResult }[];
    serialize: (state: { [stateName: string]: any }) => string;
    deserialize: (serializedState: string) => { [stateName: string]: any };
}
