import { expect } from 'chai';
import { makeBinaryOpNode, makeBoolLiteralNode, makeDereferenceNode, makeFloatLiteralNode, makeIntLiteralNode, makeInvokeNode, makeMapLiteralNode, makeSequenceLiteralNode, makeVariableNode, typeOf } from '../../ast/Ast.gen';
import { parseExpression } from '../../grammar';
import { booleanType, booleanTypeExact, floatType, floatTypeExact, intType, intTypeExact } from '../../types/BuiltinTypes.gen';
import { makeFunctionType, makeFunctionTypeExact, makeMapLike, makeSequenceLike, makeSimpleType, makeSimpleTypeExact } from '../../types/Types.gen';
import { resolveExpressionTypes, targetType, typeState } from '../Typechecking.gen';

describe('typechecking', () => {
    const empty = { bindings: new Map() } as typeState;

    describe('type assignment', () => {
        it('should type [] as SequenceLike<?>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[]'))).to.deep.equal(
                makeSequenceLiteralNode([], makeSequenceLike(null))
            );
        });
    
        it('should type [1] as SequenceLike<int>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[1]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [makeIntLiteralNode(1, intType)],
                    makeSequenceLike(intType)
                )
            );
        });
    
        it('should type [1, 1.] as SequenceLike<float>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[1, 1.]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeIntLiteralNode(1, intType),
                        makeFloatLiteralNode(1, floatType),
                    ],
                    makeSequenceLike(floatType)
                )
            );
        });
    
        it('should type [1., 1] as SequenceLike<float>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[1., 1]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeFloatLiteralNode(1, floatType),
                        makeIntLiteralNode(1, intType),
                    ],
                    makeSequenceLike(floatType)
                )
            );
        });
    
        it('should type [[], []] as SequenceLike<SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[[], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeSequenceLiteralNode([], makeSequenceLike(null)),
                        makeSequenceLiteralNode([], makeSequenceLike(null)),
                    ],
                    makeSequenceLike(makeSequenceLike(null))
                )
            );
        });
    
        it('should type [[], [1]] as SequenceLike<SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[[], [1]]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeSequenceLiteralNode([], makeSequenceLike(null)),
                        makeSequenceLiteralNode([makeIntLiteralNode(1, intType)], makeSequenceLike(intType)),
                    ],
                    makeSequenceLike(makeSequenceLike(intType))
                )
            );
        });
    
        it('should type [[[]], []] as SequenceLike<SequenceLike<SequenceLike<?>>>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('[[[]], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeSequenceLiteralNode(
                            [makeSequenceLiteralNode([], makeSequenceLike(null))],
                            makeSequenceLike(makeSequenceLike(null))
                        ),
                        makeSequenceLiteralNode([], makeSequenceLike(null)),
                    ],
                    makeSequenceLike(makeSequenceLike(makeSequenceLike(null)))
                )
            );
        });
    
        it('should type {} as MapLike<?>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('{}'))).to.deep.equal(
                makeMapLiteralNode([], [], makeMapLike(null))
            );
        });
    
        it('should type { 1: [] } as MapLike<int, SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('{ 1: [] }'))).to.deep.equal(
                makeMapLiteralNode(
                    [makeIntLiteralNode(1, intType)],
                    [makeSequenceLiteralNode([], makeSequenceLike(null))],
                    makeMapLike([intType, makeSequenceLike(null)])
                )
            );
        });
    
        it('should type { 1: [], 2: [1] } as MapLike<int, SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(empty, parseExpression('{ 1: [], 2: [1] }'))).to.deep.equal(
                makeMapLiteralNode(
                    [
                        makeIntLiteralNode(1, intType),
                        makeIntLiteralNode(2, intType)
                    ],
                    [
                        makeSequenceLiteralNode([], makeSequenceLike(null)),
                        makeSequenceLiteralNode([makeIntLiteralNode(1, intType)], makeSequenceLike(intType))
                    ],
                    makeMapLike([intType, makeSequenceLike(intType)])
                )
            );
        });
    
        it('should type /* Array<float> */ arr.get(1) as float', () => {
            expect(typeOf(resolveExpressionTypes(
                { bindings: new Map([['arr', makeSimpleType('Array', [floatType])]]) },
                parseExpression('arr.get(1)'))
            ))
                .to.deep.equal(floatType);
        });
    
        it('should type /* f: (Queue<float>) => boolean */ f([1, 2, 3]) as boolean', () => {
            expect(resolveExpressionTypes(
                {
                    bindings: new Map([
                        ['f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)]
                    ])
                },
                parseExpression('f([1, 2, 3])')
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)),
                    [makeSequenceLiteralNode(
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
    });

    describe('type refinement', () => {
        it('can target type 1 to float', () => {
            expect(targetType(floatTypeExact, resolveExpressionTypes(empty, parseExpression('1')))).to.deep.equal(
                makeIntLiteralNode(1, floatTypeExact)
            );
        });

        it('can target type true to boolean', () => {
            expect(targetType(booleanTypeExact, resolveExpressionTypes(empty, parseExpression('true')))).to.deep.equal(
                makeBoolLiteralNode(true, booleanTypeExact)
            );
        });

        it('cannot target type 1 to boolean', () => {
            expect(() => targetType(booleanTypeExact, resolveExpressionTypes(empty, parseExpression('1')))).to.throw();
        });
    
        it('can target type /* f: (Queue<float>) => boolean */ f([1, 2, 3])', () => {
            expect(targetType(
                booleanTypeExact,
                resolveExpressionTypes(
                    {
                        bindings: new Map([
                            ['f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)]
                        ])
                    },
                    parseExpression('f([1, 2, 3])')
                )
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionTypeExact([makeSimpleTypeExact('Queue', [floatTypeExact])], booleanTypeExact)),
                    [makeSequenceLiteralNode(
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
    
        it('can target type {} to Map<int, boolean>', () => {
            const m = makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact]);
    
            expect(targetType(m, resolveExpressionTypes(empty, parseExpression('{}')))).to.deep.equal(
                makeMapLiteralNode([], [], m)
            );
        });
    
        it('cannot target type [] to Map<int, boolean>', () => {
            const m = makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact]);
    
            expect(() => targetType(m, resolveExpressionTypes(empty, parseExpression('[]')))).to.throw();
        });
    
        it('can target type [] to Stack<Map<int, boolean>>', () => {
            const s = makeSimpleTypeExact('Stack', [makeSimpleTypeExact('Map', [intTypeExact, booleanTypeExact])]);
    
            expect(targetType(s, resolveExpressionTypes(empty, parseExpression('[]')))).to.deep.equal(
                makeSequenceLiteralNode([], s)
            );
        });
    
        it('can target type { 1: [], 2: [1] } to Map<int, Queue<int>>', () => {
            const q = makeSimpleTypeExact('Queue', [intTypeExact]);
            const m = makeSimpleTypeExact('Map', [intTypeExact, q]);
    
            expect(targetType(
                m,
                resolveExpressionTypes(empty, parseExpression('{ 1: [], 2: [1] }'))
            )).to.deep.equal(
                makeMapLiteralNode(
                    [
                        makeIntLiteralNode(1, intTypeExact),
                        makeIntLiteralNode(2, intTypeExact)
                    ],
                    [
                        makeSequenceLiteralNode([], q),
                        makeSequenceLiteralNode([makeIntLiteralNode(1, intTypeExact)], q)
                    ],
                    m
                )
            );
        });
    
        it('can target type [[[]], []] to Set<Set<Stack<int>>>', () => {
            const s3 = makeSimpleTypeExact('Stack', [intTypeExact]);
            const s2 = makeSimpleTypeExact('Set', [s3]);
            const s1 = makeSimpleTypeExact('Set', [s2]);
    
            expect(targetType(s1, resolveExpressionTypes(empty, parseExpression('[[[]], []]')))).to.deep.equal(
                makeSequenceLiteralNode(
                    [
                        makeSequenceLiteralNode(
                            [makeSequenceLiteralNode([], s3)],
                            s2
                        ),
                        makeSequenceLiteralNode([], s2),
                    ],
                    s1
                )
            );
        });
    
        it('can target type /* Array<SequenceLike<boolean>> */ a to Array<Queue<boolean>>', () => {
            const t = makeSimpleTypeExact('Array', [makeSimpleTypeExact('Queue', [booleanTypeExact])]);
    
            expect(typeOf(targetType(
                t,
                resolveExpressionTypes(
                    {
                        bindings: new Map([
                            ['a', makeSimpleType('Array', [makeSequenceLike(booleanType)])]
                        ])
                    },
                    parseExpression('a')
                )
            )))
            .to.deep.equal(t);
        });

        it('can target type `1 + 3.` to float', () => {
            expect(targetType(floatTypeExact, resolveExpressionTypes(empty, parseExpression('1 + 3.'))))
                .to.deep.equal(makeBinaryOpNode(
                    'Add',
                    makeIntLiteralNode(1, floatTypeExact),
                    makeFloatLiteralNode(3, floatTypeExact),
                    floatTypeExact
                ));
        });
    
        it('cannot target type `1 + 3.` to int', () => {
            expect(() => targetType(intTypeExact, resolveExpressionTypes(empty, parseExpression('1 + 3.'))))
                .to.throw();
        });

        it('cannot target type [].length to int', () => {
            expect(() => targetType(intTypeExact, resolveExpressionTypes(empty, parseExpression('[].length'))))
                .to.throw();
        });

        it('can target type /* arr: Array<float> */ arr.length to int', () => {
            expect(targetType(intTypeExact, resolveExpressionTypes(
                { bindings: new Map([
                    ['arr', makeSimpleType('Array', [floatType])]
                ]) },
                parseExpression('arr.length')
            ))).to.deep.equal(makeDereferenceNode(
                    makeVariableNode('arr', makeSimpleTypeExact('Array', [floatTypeExact])),
                    'length',
                    intTypeExact
                ));
        });
    });

});