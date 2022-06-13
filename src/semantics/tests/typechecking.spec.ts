import { expect } from 'chai';
import { makeBinaryOpNode, makeBoolLiteralNode, makeDereferenceNode, makeFloatLiteralNode, makeIntLiteralNode, makeInvokeNode, makeMapLiteralNode, makeSequenceLiteralNode, makeStringLiteralNode, makeVariableNode, typeOf } from '../../ast/Ast.gen';
import { parseExpression } from '../../grammar/Expressions';
import { booleanType, booleanTypeExact, builtinTypesMap, floatType, floatTypeExact, intType, intTypeExact, stringType, stringTypeExact } from '../../types/BuiltinTypes.gen';
import { makeFunctionType, makeFunctionTypeExact, makeMapLike, makeSequenceLike, makeSimpleType, makeSimpleTypeExact } from '../../types/Types.gen';
import Scope from '../Scope';
import { inferType, resolveExpressionTypes, targetType } from '../Typechecking.gen';

describe('typechecking', () => {
    const types = builtinTypesMap;
    const root = new Scope();

    describe('resolveExpressionTypes', () => {
        it('should type "abc" as string', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('"abc"'))).to.deep.equal(
                makeStringLiteralNode('abc', stringType)
            );
        });

        it('should type `1 + 1.` as float', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1 + 1.'))).to.deep.equal(
                makeBinaryOpNode(
                    'Add',
                    makeIntLiteralNode(1, intType),
                    makeFloatLiteralNode(1, floatType),
                    floatType
                )
            );
        });

        it('should type `1. + 1` as float', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1. + 1'))).to.deep.equal(
                makeBinaryOpNode(
                    'Add',
                    makeFloatLiteralNode(1, floatType),
                    makeIntLiteralNode(1, intType),
                    floatType
                )
            );
        });

        it('should type `1 + 1` as int', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1 + 1'))).to.deep.equal(
                makeBinaryOpNode(
                    'Add',
                    makeIntLiteralNode(1, intType),
                    makeIntLiteralNode(1, intType),
                    intType
                )
            );
        });

        it('should reject `1 + false`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('1 + false'))).to.throw();
        });

        it('should reject `false + 1`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('false + 1'))).to.throw();
        });

        it('should reject `1. + false`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('1. + false'))).to.throw();
        });

        it('should reject `false + 1.`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('false + 1.'))).to.throw();
        });

        it('should reject `1 + []`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('1 + []'))).to.throw();
        });

        it('should reject `1. + []`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('1. + []'))).to.throw();
        });

        it('should reject `[] + []`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('[] + []'))).to.throw();
        });

        it('should reject /* unbound */ a', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('a')))
                .to.throw();
        });

        it('should type [] as SequenceLike<?>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[]'))).to.deep.equal(
                makeSequenceLiteralNode(null, [], makeSequenceLike(null))
            );
        });
    
        it('should type [1] as SequenceLike<int>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[1]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [makeIntLiteralNode(1, intType)],
                    makeSequenceLike(intType)
                )
            );
        });
    
        it('should type [1, 1.] as SequenceLike<float>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[1, 1.]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeIntLiteralNode(1, intType),
                        makeFloatLiteralNode(1, floatType),
                    ],
                    makeSequenceLike(floatType)
                )
            );
        });
    
        it('should type [1., 1] as SequenceLike<float>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[1., 1]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeFloatLiteralNode(1, floatType),
                        makeIntLiteralNode(1, intType),
                    ],
                    makeSequenceLike(floatType)
                )
            );
        });
    
        it('should type [[], []] as SequenceLike<SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeSequenceLiteralNode(null, [], makeSequenceLike(null)),
                        makeSequenceLiteralNode(null, [], makeSequenceLike(null)),
                    ],
                    makeSequenceLike(makeSequenceLike(null))
                )
            );
        });

        it('should type {1: {}, 2: {}} as MapLike<int, MapLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{1: {}, 2: {}}'))).to.deep.equal(
                makeMapLiteralNode(
                    null,
                    [makeIntLiteralNode(1, intType), makeIntLiteralNode(2, intType)],
                    [makeMapLiteralNode(null, [], [], makeMapLike(null)), makeMapLiteralNode(null, [], [], makeMapLike(null))],
                    makeMapLike([intType, makeMapLike(null)])
                )
            );
        });

        it('should type {1: {6.0: true}, 2: {}} as MapLike<int, MapLike<float, boolean>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{1: {6.0: true}, 2: {}}'))).to.deep.equal(
                makeMapLiteralNode(
                    null,
                    [
                        makeIntLiteralNode(1, intType),
                        makeIntLiteralNode(2, intType)
                    ],
                    [
                        makeMapLiteralNode(null, [makeFloatLiteralNode(6, floatType)], [makeBoolLiteralNode(true, booleanType)], makeMapLike([floatType, booleanType])),
                        makeMapLiteralNode(null, [], [], makeMapLike(null))
                    ],
                    makeMapLike([intType, makeMapLike([floatType, booleanType])])
                )
            );
        });
    
        it('should type [[], [1]] as SequenceLike<SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[], [1]]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeSequenceLiteralNode(null, [], makeSequenceLike(null)),
                        makeSequenceLiteralNode(null, [makeIntLiteralNode(1, intType)], makeSequenceLike(intType)),
                    ],
                    makeSequenceLike(makeSequenceLike(intType))
                )
            );
        });
    
        it('should type [[[]], []] as SequenceLike<SequenceLike<SequenceLike<?>>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[[]], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeSequenceLiteralNode(
                            null,
                            [makeSequenceLiteralNode(null, [], makeSequenceLike(null))],
                            makeSequenceLike(makeSequenceLike(null))
                        ),
                        makeSequenceLiteralNode(null, [], makeSequenceLike(null)),
                    ],
                    makeSequenceLike(makeSequenceLike(makeSequenceLike(null)))
                )
            );
        });
    
        it('should type {} as MapLike<?>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{}'))).to.deep.equal(
                makeMapLiteralNode(null, [], [], makeMapLike(null))
            );
        });
    
        it('should type { 1: [] } as MapLike<int, SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{ 1: [] }'))).to.deep.equal(
                makeMapLiteralNode(
                    null,
                    [makeIntLiteralNode(1, intType)],
                    [makeSequenceLiteralNode(null, [], makeSequenceLike(null))],
                    makeMapLike([intType, makeSequenceLike(null)])
                )
            );
        });
    
        it('should type { 1: [], 2: [1] } as MapLike<int, SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{ 1: [], 2: [1] }'))).to.deep.equal(
                makeMapLiteralNode(
                    null,
                    [
                        makeIntLiteralNode(1, intType),
                        makeIntLiteralNode(2, intType)
                    ],
                    [
                        makeSequenceLiteralNode(null, [], makeSequenceLike(null)),
                        makeSequenceLiteralNode(null, [makeIntLiteralNode(1, intType)], makeSequenceLike(intType))
                    ],
                    makeMapLike([intType, makeSequenceLike(intType)])
                )
            );
        });
    
        it('should type /* Array<float> */ arr.get(1) as Option<float>', () => {
            expect(typeOf(resolveExpressionTypes(
                types, 
                new Scope(root, [['arr', makeSimpleTypeExact('Array', [floatTypeExact])]]),
                parseExpression('arr.get(1)'))
            )).to.deep.equal(makeSimpleType('Option', [floatType]));
        });

        it('should reject /* Array<float> */ arr.get()', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleTypeExact('Array', [floatTypeExact])]]),
                parseExpression('arr.get()'))
            ).to.throw();
        });

        it('should reject /* Array<float> */ arr.get(1, 2)', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleTypeExact('Array', [floatTypeExact])]]),
                parseExpression('arr.get(1, 2)'))
            ).to.throw();
        });

        it('should reject /* Array<float> */ arr(1)', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleTypeExact('Array', [floatTypeExact])]]),
                parseExpression('arr(1)'))
            ).to.throw();
        });
    
        it('should type /* f: (Queue<float>) => boolean */ f([1, 2, 3]) as boolean', () => {
            expect(resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionTypeExact([makeSimpleTypeExact('Queue', [floatTypeExact])], booleanTypeExact)]
                ]),
                parseExpression('f([1, 2, 3])')
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)),
                    [makeSequenceLiteralNode(
                        null,
                        [
                            makeIntLiteralNode(1, intType),
                            makeIntLiteralNode(2, intType),
                            makeIntLiteralNode(3, intType)
                        ],
                        makeSequenceLike(intType)
                    )],
                    booleanType
                )
            );
        });

        it('should type /* q: Queue<float> */ q.pop as () => Option<float>', () => {
            expect(resolveExpressionTypes(types, 
                new Scope(root, [['q', makeSimpleTypeExact('Queue', [floatTypeExact])]]),
                parseExpression('q.pop')
            )).to.deep.equal(
                makeDereferenceNode(
                    makeVariableNode('q', makeSimpleType('Queue', [floatType])),
                    'pop',
                    makeFunctionType([], makeSimpleType('Option', [floatType]))
                )
            );
        });

        it('should reject /* q: Queue<float> */ q.pop.pop', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [
                    ['q', makeSimpleTypeExact('Queue', [floatTypeExact])]
                ]),
                parseExpression('q.pop.pop')
            )).to.throw();
        });

        it('should reject /* arr: Array<float> */ arr.pop', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [
                    ['arr', makeSimpleTypeExact('Array', [floatTypeExact])]
                ]),
                parseExpression('arr.pop')
            )).to.throw();
        });
    });

    describe('targetType', () => {
        it('can target type "abc" to string', () => {
            expect(targetType(stringTypeExact, resolveExpressionTypes(types, root, parseExpression('"abc"')))).to.deep.equal(
                makeStringLiteralNode('abc', stringTypeExact)
            );
        });

        it('can target type 1 to float', () => {
            expect(targetType(floatTypeExact, resolveExpressionTypes(types, root, parseExpression('1')))).to.deep.equal(
                makeIntLiteralNode(1, floatTypeExact)
            );
        });

        it('can target type true to boolean', () => {
            expect(targetType(booleanTypeExact, resolveExpressionTypes(types, root, parseExpression('true')))).to.deep.equal(
                makeBoolLiteralNode(true, booleanTypeExact)
            );
        });

        it('cannot target type 1 to boolean', () => {
            expect(() => targetType(booleanTypeExact, resolveExpressionTypes(types, root, parseExpression('1')))).to.throw();
        });

        it('cannot target type /* q: Queue<float> */ q.pop to () => int', () => {
            const f = makeFunctionTypeExact([], intTypeExact);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['q', makeSimpleTypeExact('Queue', [floatTypeExact])]
                ]),
                parseExpression('q.pop')
            ))).to.throw();
        });

        it('can target type /* q: Queue<int> */ q.pop to () => Option<float>', () => {
            const f = makeFunctionTypeExact([], makeSimpleTypeExact('Option', [floatTypeExact]));

            expect(() => typeOf(targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['q', makeSimpleTypeExact('Queue', [intTypeExact])]
                ]),
                parseExpression('q.pop')
            )))).to.not.throw();
        });

        it('cannot target type /* f: (int) => int */ f to (float) => int', () => {
            const f = makeFunctionTypeExact([floatTypeExact], intTypeExact);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionTypeExact([intTypeExact], intTypeExact)]
                ]),
                parseExpression('f')
            ))).to.throw();
        });

        it('can target type /* f: (float) => int */ f to (int) => int', () => {
            const f = makeFunctionTypeExact([intTypeExact], intTypeExact);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionTypeExact([floatTypeExact], intTypeExact)]
                ]),
                parseExpression('f')
            ))).to.not.throw();
        });
    
        it('can target type /* f: (Queue<float>) => boolean */ f([1, 2, 3])', () => {
            expect(targetType(
                booleanTypeExact,
                resolveExpressionTypes(types, 
                    new Scope(root, [
                        ['f', makeFunctionTypeExact([makeSimpleTypeExact('Queue', [floatTypeExact])], booleanTypeExact)]
                    ]),
                    parseExpression('f([1, 2, 3])')
                )
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionTypeExact([makeSimpleTypeExact('Queue', [floatTypeExact])], booleanTypeExact)),
                    [makeSequenceLiteralNode(
                        null,
                        [
                            makeIntLiteralNode(1, floatTypeExact),
                            makeIntLiteralNode(2, floatTypeExact),
                            makeIntLiteralNode(3, floatTypeExact)
                        ],
                        makeSimpleTypeExact('Queue', [floatTypeExact])
                    )],
                    booleanTypeExact
                )
            );
        });

        it('can target type /* f: (Map<int, float>) => boolean */ f({1: 1, 6: 2, 4: 3})', () => {
            expect(targetType(
                booleanTypeExact,
                resolveExpressionTypes(types, 
                    new Scope(root, [
                        ['f', makeFunctionTypeExact([makeSimpleTypeExact('Map', [intTypeExact, floatTypeExact])], booleanTypeExact)]
                    ]),
                    parseExpression('f({1: 1, 6: 2, 4: 3})')
                )
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionTypeExact([makeSimpleTypeExact('Map', [intTypeExact, floatTypeExact])], booleanTypeExact)),
                    [makeMapLiteralNode(
                        null,
                        [
                            makeIntLiteralNode(1, intTypeExact),
                            makeIntLiteralNode(6, intTypeExact),
                            makeIntLiteralNode(4, intTypeExact)
                        ],
                        [
                            makeIntLiteralNode(1, floatTypeExact),
                            makeIntLiteralNode(2, floatTypeExact),
                            makeIntLiteralNode(3, floatTypeExact)
                        ],
                        makeSimpleTypeExact('Map', [intTypeExact, floatTypeExact])
                    )],
                    booleanTypeExact
                )
            );
        });
    
        it('can target type {} to Map<int, boolean>', () => {
            const m = makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact]);
    
            expect(targetType(m, resolveExpressionTypes(types, root, parseExpression('{}')))).to.deep.equal(
                makeMapLiteralNode(null, [], [], m)
            );
        });
    
        it('cannot target type [] to Map<int, boolean>', () => {
            const m = makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('cannot target type [] to Option<int>', () => {
            const m = makeSimpleTypeExact('Option', [intTypeExact]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('cannot target type {} to Array<int>', () => {
            const m = makeSimpleTypeExact('Array', [intTypeExact]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('{}')))).to.throw();
        });
    
        it('can target type [] to Stack<Map<int, boolean>>', () => {
            const s = makeSimpleTypeExact('Stack', [makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact])]);
    
            expect(targetType(s, resolveExpressionTypes(types, root, parseExpression('[]')))).to.deep.equal(
                makeSequenceLiteralNode(null, [], s)
            );
        });
    
        it('can target type { 1: [], 2: [1] } to Map<int, Queue<int>>', () => {
            const q = makeSimpleTypeExact('Queue', [intTypeExact]);
            const m = makeSimpleTypeExact('Map', [intTypeExact, q]);
    
            expect(targetType(
                m,
                resolveExpressionTypes(types, root, parseExpression('{ 1: [], 2: [1] }'))
            )).to.deep.equal(
                makeMapLiteralNode(
                    null,
                    [
                        makeIntLiteralNode(1, intTypeExact),
                        makeIntLiteralNode(2, intTypeExact)
                    ],
                    [
                        makeSequenceLiteralNode(null, [], q),
                        makeSequenceLiteralNode(null, [makeIntLiteralNode(1, intTypeExact)], q)
                    ],
                    m
                )
            );
        });
    
        it('can target type [[[]], []] to Set<Set<Stack<int>>>', () => {
            const s3 = makeSimpleTypeExact('Stack', [intTypeExact]);
            const s2 = makeSimpleTypeExact('Set', [s3]);
            const s1 = makeSimpleTypeExact('Set', [s2]);
    
            expect(targetType(s1, resolveExpressionTypes(types, root, parseExpression('[[[]], []]')))).to.deep.equal(
                makeSequenceLiteralNode(
                    null,
                    [
                        makeSequenceLiteralNode(
                            null,
                            [makeSequenceLiteralNode(null, [], s3)],
                            s2
                        ),
                        makeSequenceLiteralNode(null, [], s2),
                    ],
                    s1
                )
            );
        });

        it('can target type Array[[]] to Array<Queue<boolean>>', () => {
            const t = makeSimpleTypeExact('Array', [makeSimpleTypeExact('Queue', [booleanTypeExact])]);
    
            expect(typeOf(targetType(t, resolveExpressionTypes(types, root, parseExpression('Array[[]]'))))).to.deep.equal(t);
        });

        it('cannot target type Queue[[]] to Array<Queue<boolean>>', () => {
            const t = makeSimpleTypeExact('Array', [makeSimpleTypeExact('Queue', [booleanTypeExact])]);
    
            expect(() => targetType(t, resolveExpressionTypes(types, root, parseExpression('Queue[[]]')))).to.throw();
        });

        it('can target type `1 + 3.` to float', () => {
            expect(targetType(floatTypeExact, resolveExpressionTypes(types, root, parseExpression('1 + 3.'))))
                .to.deep.equal(makeBinaryOpNode(
                    'Add',
                    makeIntLiteralNode(1, floatTypeExact),
                    makeFloatLiteralNode(3, floatTypeExact),
                    floatTypeExact
                ));
        });
    
        it('cannot target type `1 + 3.` to int', () => {
            expect(() => targetType(intTypeExact, resolveExpressionTypes(types, root, parseExpression('1 + 3.'))))
                .to.throw();
        });

        it('can target type `1 + 3` to int', () => {
            expect(targetType(intTypeExact, resolveExpressionTypes(types, root, parseExpression('1 + 3'))))
                .to.deep.equal(makeBinaryOpNode(
                    'Add',
                    makeIntLiteralNode(1, intTypeExact),
                    makeIntLiteralNode(3, intTypeExact),
                    intTypeExact
                ));
        });

        it('cannot target type [].length to int', () => {
            expect(() => targetType(intTypeExact, resolveExpressionTypes(types, root, parseExpression('[].length'))))
                .to.throw();
        });

        it('cannot target type {}.length to int', () => {
            expect(() => targetType(intTypeExact, resolveExpressionTypes(types, root, parseExpression('{}.length'))))
                .to.throw();
        });

        it('can target type /* arr: Array<float> */ arr.length to int', () => {
            expect(targetType(intTypeExact, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['arr', makeSimpleTypeExact('Array', [floatTypeExact])]
                ]),
                parseExpression('arr.length')
            ))).to.deep.equal(makeDereferenceNode(
                    makeVariableNode('arr', makeSimpleTypeExact('Array', [floatTypeExact])),
                    'length',
                    intTypeExact
                ));
        });

        it('can target type /* g: () => int, f: (() => int) => int */ f(g) to int', () => {
            expect(targetType(intTypeExact, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['g', makeFunctionTypeExact([], intTypeExact)],
                    ['f', makeFunctionTypeExact([makeFunctionTypeExact([], intTypeExact)], intTypeExact)]
                ]),
                parseExpression('f(g)')
            ))).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionTypeExact([makeFunctionTypeExact([], intTypeExact)], intTypeExact)),
                    [makeVariableNode('g', makeFunctionTypeExact([], intTypeExact))],
                    intTypeExact
                )
            );
        });
    });

    describe('inferType', () => {
        it('should infer 1 is int', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('1'))))
                .to.deep.equal(intTypeExact);
        });

        it('should infer 1.0 is float', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('1.0'))))
                .to.deep.equal(floatTypeExact);
        });

        it('cannot infer the type of []', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('should infer Array[1] is Array<int>', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('Array[1]'))))
                .to.deep.equal(makeSimpleTypeExact('Array', [intTypeExact]));
        });

        it('cannot infer the type of Array[]', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Array[]')))).to.throw();
        });

        it('should infer Map{ 1: 1.0 } is Map<int, float>', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('Map{ 1: 1.0 }'))))
                .to.deep.equal(makeSimpleTypeExact('Map', [intTypeExact, floatTypeExact]));
        });

        it('cannot infer the type of Map{}', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Map{}')))).to.throw();
        });

        it('cannot infer the type of Map[]', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Map[]')))).to.throw();
        });

        it('cannot infer the type of Array{}', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Array{}')))).to.throw();
        });
    });
});