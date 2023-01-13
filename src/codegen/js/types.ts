export type ParameterType
    = { variant: 'int' }
    | { variant: 'float' }
    | { variant: 'string' }
    | { variant: 'boolean' }
    | { variant: 'option', type: ParameterType }
    | { variant: 'custom', name: string }
    ;

export interface CreateParamsFunctions<Args extends any[] = [name: string]> {
    getIntParam(...args: Args): BigInt;
    getFloatParam(...args: Args): number;
    getStringParam(...args: Args): string;
    getBooleanParam(...args: Args): boolean;
    getOptionParam(...args: Args): CreateParamsFunctions<[]> | undefined;
    getCustomParam(...args: [...args: Args, typeName: string]): unknown;
}

export type StateRecord = { [stateName: string]: unknown };
export type ParamRecord = { [stateName: string]: unknown };

export interface EventData {
    params: ParamRecord;
    state: StateRecord;
    args: unknown[];
}

export interface ListenerResult {
    state: StateRecord;
}

export interface MiKeProgramExternals extends Record<string, any> {
    debug(...args: any[]): void;
}

export type MiKeProgramWithoutExternals<Exposed extends {} = {}>
    = (externals: MiKeProgramExternals) => MiKeProgram<Exposed>;

export interface MiKeProgram<Exposed extends {} = {}> {
    listeners: { event: string, callback: (state: EventData) => ListenerResult }[];
    serialize: (state: StateRecord) => string;
    createInitialState(): StateRecord;
    deserialize: (serializedState: string) => StateRecord;
    params: { name: string, type: ParameterType }[];
    createParams(callbacks: CreateParamsFunctions): ParamRecord;
    exposed: Exposed;
}
