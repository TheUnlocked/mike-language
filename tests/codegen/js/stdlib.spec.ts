import { expect } from 'chai';
import { noop } from 'lodash';
import { EventData, MiKeProgram, MiKeProgramWithoutExternals } from '../../../src/codegen/js/types';
import { compileMiKeToJavascriptWithoutExternals as compile, compileMiKeToJavascript as compileDefault, compileMiKeToJavascriptText } from '../../util';

function getDebugFragments(programFn: MiKeProgramWithoutExternals, evtData?: Partial<EventData>) {
    const debugFragments = [] as any[];

    const program = programFn({ debug: debugFragments.push.bind(debugFragments) });
    program.listeners.find(x => x.event === 'test')!.callback(Object.assign({
        args: [],
        params: {},
        state: Object.fromEntries(program.state.map(st => [st.name, st.default])),
    } as EventData, evtData));
    
    return debugFragments;
}

function getStateAfterRunning(program: MiKeProgram, evtData?: Partial<EventData>) {
    return program.listeners.find(x => x.event === 'test')!.callback(Object.assign({
        args: [],
        params: {},
        state: Object.fromEntries(program.state.map(st => [st.name, st.default])),
    } as EventData, evtData));
}

export default () => describe('stdlib', () => {

    describe('types', () => {

        describe('Array', () => {

            it('get', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr = Array[1, 2, 3];
                        debug arr.get(0), arr.get(2), arr.get(-1), arr.get(3);
                    }
                `));
                expect(result).deep.equals([
                    { hasValue: true, value: 1n },
                    { hasValue: true, value: 3n },
                    { hasValue: false },
                    { hasValue: false },
                ]);
            });

            it('set', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr = Array[1, 2, 3];
                        debug arr.set(1, 9), arr.set(-1, 2), arr.set(3, 0);
                        debug arr.get(0), arr.get(1), arr.get(-1);
                    }
                `));
                expect(result).deep.equals([
                    true,
                    false,
                    false,
                    { hasValue: true, value: 1n },
                    { hasValue: true, value: 9n },
                    { hasValue: false },
                ]);
            });

            it('length', async () => {
                const result = getDebugFragments(await compile(`
                    on test() {
                        let arr1: Array<int> = [];
                        let arr2 = Array[1, 2, 3];

                        debug arr1.length, arr2.length;
                        arr2.set(3, 1);
                        debug arr2.length;
                    }
                `));
                expect(result).deep.equals([
                    0n,
                    3n,
                    3n,
                ]);
            });

            it('serialize/deserialize', async () => {
                const program = await compileDefault(`
                    state s: Array<int> = [];

                    on test() {
                        if s.length == 0 {
                            s = [1, 2, 3];
                        }
                        else {
                            s.set(0, 7);
                            s.set(-1, 2);
                        }
                    }
                `);

                const st1 = program.serialize(getStateAfterRunning(program).state);

                expect(JSON.parse(st1)).deep.equals({
                    objs: [[1, 2, 3], '1', '2', '3'],
                    refs: { s: 0 }
                });

                const st2 = program.serialize(getStateAfterRunning(program, {
                    state: program.deserialize(st1)
                }).state);

                expect(JSON.parse(st2)).deep.equals({
                    objs: [[1, 2, 3], '7', '2', '3'],
                    refs: { s: 0 }
                });
            });

        });

    });

    describe('values', () => {

    });
    
});