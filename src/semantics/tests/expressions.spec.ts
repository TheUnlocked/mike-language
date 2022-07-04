import { expect } from 'chai';
import { Expression, InfixOperator, PrefixOperator } from '../../ast/Ast';
import { makeBinaryOpNode, makeBoolLiteralNode, makeDereferenceNode, makeFloatLiteralNode, makeIntLiteralNode, makeInvokeNode, makeMapLiteralNode, makeSequenceLiteralNode, makeStringLiteralNode, makeUnaryOpNode, makeVariableNode } from '../../ast/tests/util';
import { makeFunctionType, makeMapLike, makeSequenceLike, makeSimpleType } from '../../types/tests/util';
import { parseExpression } from '../../grammar/tests/util';
import Scope from '../Scope';
import { booleanType, floatType, intType, stringType } from '../../types/Primitives';
import { TypeInfo } from '../../types/Type';
import { Typechecker } from '../Typechecker';
import { ExactType, KnownType } from '../../types/TypeReference';
import { Diagnostics, Severity } from '../../diagnostics/Diagnostics';
import { DiagnosticCodes } from '../../diagnostics/DiagnosticCodes';
import { makeDiagnostics } from '../../diagnostics/tests/util';

describe('typechecking', () => {

    function resolveExpressionTypes(types: TypeInfo[], scope: Scope, expr: Expression<undefined>, diagnostics?: Diagnostics) {
        const checker = new Typechecker({
            rootScope: scope
        });

        if (diagnostics) {
            checker.setDiagnostics(diagnostics);
        }

        checker.addType(...types);

        let result!: Expression<KnownType>;
        try {
            result = checker.resolveKnownTypes(expr);
        }
        catch (e: any) {
            if (e.constructor.name !== 'Poison') {
                throw e;
            }
        }

        if (checker.diagnosticsManager.getDiagnostics().filter(x => x.severity === Severity.Error).length > 0) {
            throw new Error(JSON.stringify(checker.diagnosticsManager.getDiagnostics(), null, 4));
        }

        return result;
    }

    function targetType(target: ExactType, expr: Expression<KnownType>, diagnostics?: Diagnostics) {
        const checker = new Typechecker();

        if (diagnostics) {
            checker.setDiagnostics(diagnostics);
        }

        checker.addType(...types);

        let result!: Expression<ExactType>;
        try {
            result = checker.resolveTargetTyped(target, expr);
        }
        catch (e) {}

        if (checker.diagnosticsManager.getDiagnostics().filter(x => x.severity === Severity.Error).length > 0) {
            throw new Error(JSON.stringify(checker.diagnosticsManager.getDiagnostics(), null, 4));
        }

        return result;
    }

    function inferType(expr: Expression<KnownType>): ExactType {
        const checker = new Typechecker();

        checker.addType(...types);

        let result!: ExactType;
        try {
            result = checker.inferTypeOf(expr);
        }
        catch (e) {}

        if (checker.diagnosticsManager.getDiagnostics().length > 0) {
            throw new Error(JSON.stringify(checker.diagnosticsManager.getDiagnostics(), null, 4));
        }

        return result;
    }
    
    const types = [] as TypeInfo[];
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
                    InfixOperator.Add,
                    makeIntLiteralNode(1, intType),
                    makeFloatLiteralNode(1, floatType),
                    floatType
                )
            );
        });

        it('should type `1. + 1` as float', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1. + 1'))).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Add,
                    makeFloatLiteralNode(1, floatType),
                    makeIntLiteralNode(1, intType),
                    floatType
                )
            );
        });

        it('should type `1 + 1` as int', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1 + 1'))).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Add,
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

        it('should type `1 > 1.` as boolean', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1 > 1.'))).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.GreaterThan,
                    makeIntLiteralNode(1, intType),
                    makeFloatLiteralNode(1, floatType),
                    booleanType
                )
            );
        });

        it('should type `1. > 1` as boolean', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('1. > 1'))).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.GreaterThan,
                    makeFloatLiteralNode(1, floatType),
                    makeIntLiteralNode(1, intType),
                    booleanType
                )
            );
        });

        it('should reject `[] > []`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('[] > []'))).to.throw();
        });

        it('should warn about `1 == 1.` but still type it as boolean', () => {
            const diagnostics = makeDiagnostics();
            expect(resolveExpressionTypes(types, root, parseExpression('1 == 1.'), diagnostics)).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Equals,
                    makeIntLiteralNode(1, intType),
                    makeFloatLiteralNode(1, floatType),
                    booleanType
                )
            );
            expect(diagnostics.getDiagnostics()).to.have.length(1);
            expect(diagnostics.getDiagnostics()[0]).to.include({
                severity: Severity.Warning,
                id: `mike${DiagnosticCodes.EqualityArgumentTypeMismatch}`
            });
        });

        it('should warn about `1. == 1` but still type it as boolean', () => {
            const diagnostics = makeDiagnostics();
            expect(resolveExpressionTypes(types, root, parseExpression('1. == 1'), diagnostics)).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Equals,
                    makeFloatLiteralNode(1, floatType),
                    makeIntLiteralNode(1, intType),
                    booleanType
                )
            );
            expect(diagnostics.getDiagnostics()).to.have.length(1);
            expect(diagnostics.getDiagnostics()[0]).to.include({
                severity: Severity.Warning,
                id: `mike${DiagnosticCodes.EqualityArgumentTypeMismatch}`
            });
        });

        it('should reject `[] == []`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('[] == []'))).to.throw();
        });

        it('should reject `Queue[] == Array[]`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('Queue[] == Array[]'))).to.throw();
        });

        it('should warn about `Queue[1] == Queue[1, 2]` but still type it as boolean', () => {
            const diagnostics = makeDiagnostics();
            expect(resolveExpressionTypes(types, root, parseExpression('Queue[1] == Queue[1, 2]'), diagnostics)).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Equals,
                    makeSequenceLiteralNode('Queue', [makeIntLiteralNode(1, intType)], makeSimpleType('Queue', [intType])),
                    makeSequenceLiteralNode(
                        'Queue',
                        [makeIntLiteralNode(1, intType), makeIntLiteralNode(2, intType)],
                        makeSimpleType('Queue', [intType])
                    ),
                    booleanType
                )
            );
            expect(diagnostics.getDiagnostics()).to.have.length(2);
            expect(diagnostics.getDiagnostics()[0]).to.include({
                severity: Severity.Warning,
                id: `mike${DiagnosticCodes.EqualityArgumentIsLiteral}`
            });
        });

        it('should warn about `Queue[1] == Array[1, 2]` but still type it as boolean', () => {
            const diagnostics = makeDiagnostics();
            expect(resolveExpressionTypes(types, root, parseExpression('Queue[1] == Array[1, 2]'), diagnostics)).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Equals,
                    makeSequenceLiteralNode('Queue', [makeIntLiteralNode(1, intType)], makeSimpleType('Queue', [intType])),
                    makeSequenceLiteralNode(
                        'Array',
                        [makeIntLiteralNode(1, intType), makeIntLiteralNode(2, intType)],
                        makeSimpleType('Array', [intType])
                    ),
                    booleanType
                )
            );
            expect(diagnostics.getDiagnostics()).to.have.length(3);
        });

        it('should type `true || false` as boolean', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('true || false'))).to.deep.equal(
                makeBinaryOpNode(
                    InfixOperator.Or,
                    makeBoolLiteralNode(true, booleanType),
                    makeBoolLiteralNode(false, booleanType),
                    booleanType
                )
            );
        });

        it('should reject `1 || false`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('1 || false'))).to.throw();
        });

        it('should reject `true && 1`', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('true && 1'))).to.throw();
        });

        it('should type !!true as boolean', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('!!true'))).to.deep.equal(
                makeUnaryOpNode(
                    PrefixOperator.Not,
                    makeUnaryOpNode(PrefixOperator.Not, makeBoolLiteralNode(true, booleanType), booleanType),
                    booleanType
                )
            );
        });

        it('should reject !1', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('!1'))).to.throw();
        });

        it('should reject -"1"', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('-"1"'))).to.throw();
        });

        it('should reject /* unbound */ a', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('a')))
                .to.throw();
        });

        it('should type [] as SequenceLike<?>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[]'))).to.deep.equal(
                makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined))
            );
        });
    
        it('should type [1] as SequenceLike<int>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[1]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
                    [makeIntLiteralNode(1, intType)],
                    makeSequenceLike(intType)
                )
            );
        });
    
        it('should type [1, 1.] as SequenceLike<float>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[1, 1.]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
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
                    undefined,
                    [
                        makeFloatLiteralNode(1, floatType),
                        makeIntLiteralNode(1, intType),
                    ],
                    makeSequenceLike(floatType)
                )
            );
        });

        it('should reject [1, true]', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('[1, true]'))).to.throw();
        });
    
        it('should type [[], []] as SequenceLike<SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
                    [
                        makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined)),
                        makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined)),
                    ],
                    makeSequenceLike(makeSequenceLike(undefined))
                )
            );
        });

        it('should type {1: {}, 2: {}} as MapLike<int, MapLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{1: {}, 2: {}}'))).to.deep.equal(
                makeMapLiteralNode(
                    undefined,
                    [
                        [makeIntLiteralNode(1, intType), makeMapLiteralNode(undefined, [], makeMapLike(undefined))],
                        [makeIntLiteralNode(2, intType), makeMapLiteralNode(undefined, [], makeMapLike(undefined))]
                    ],
                    makeMapLike([intType, makeMapLike(undefined)])
                )
            );
        });

        it('should type {1: {6.0: true}, 2: {}} as MapLike<int, MapLike<float, boolean>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{1: {6.0: true}, 2: {}}'))).to.deep.equal(
                makeMapLiteralNode(
                    undefined,
                    [
                        [
                            makeIntLiteralNode(1, intType),
                            makeMapLiteralNode(
                                undefined,
                                [[makeFloatLiteralNode(6, floatType), makeBoolLiteralNode(true, booleanType)]],
                                makeMapLike([floatType, booleanType])
                            ),
                        ],
                        [
                            makeIntLiteralNode(2, intType),
                            makeMapLiteralNode(undefined, [], makeMapLike(undefined))
                        ]
                    ],
                    makeMapLike([intType, makeMapLike([floatType, booleanType])])
                )
            );
        });
    
        it('should type [[], [1]] as SequenceLike<SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[], [1]]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
                    [
                        makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined)),
                        makeSequenceLiteralNode(undefined, [makeIntLiteralNode(1, intType)], makeSequenceLike(intType)),
                    ],
                    makeSequenceLike(makeSequenceLike(intType))
                )
            );
        });
    
        it('should type [[[]], []] as SequenceLike<SequenceLike<SequenceLike<?>>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('[[[]], []]'))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
                    [
                        makeSequenceLiteralNode(
                            undefined,
                            [makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined))],
                            makeSequenceLike(makeSequenceLike(undefined))
                        ),
                        makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined)),
                    ],
                    makeSequenceLike(makeSequenceLike(makeSequenceLike(undefined)))
                )
            );
        });
    
        it('should type {} as MapLike<?>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{}'))).to.deep.equal(
                makeMapLiteralNode(undefined, [], makeMapLike(undefined))
            );
        });
    
        it('should type { 1: [] } as MapLike<int, SequenceLike<?>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{ 1: [] }'))).to.deep.equal(
                makeMapLiteralNode(
                    undefined,
                    [
                        [makeIntLiteralNode(1, intType), makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined))],
                    ],
                    makeMapLike([intType, makeSequenceLike(undefined)])
                )
            );
        });
    
        it('should type { 1: [], 2: [1] } as MapLike<int, SequenceLike<int>>', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('{ 1: [], 2: [1] }'))).to.deep.equal(
                makeMapLiteralNode(
                    undefined,
                    [
                        [
                            makeIntLiteralNode(1, intType),
                            makeSequenceLiteralNode(undefined, [], makeSequenceLike(undefined))
                        ],
                        [
                            makeIntLiteralNode(2, intType),
                            makeSequenceLiteralNode(undefined, [makeIntLiteralNode(1, intType)], makeSequenceLike(intType))
                        ]
                    ],
                    makeMapLike([intType, makeSequenceLike(intType)])
                )
            );
        });

        it('should reject "abc".x', () => {
            expect(() => resolveExpressionTypes(types, root, parseExpression('"abc".x'))).to.throw();
        });
    
        it('should type /* Array<float> */ arr.get(1) as Option<float>', () => {
            expect(resolveExpressionTypes(
                types, 
                new Scope(root, [['arr', makeSimpleType('Array', [floatType])]]),
                parseExpression('arr.get(1)')
            ).type).to.deep.equal(makeSimpleType('Option', [floatType]));
        });

        it('should reject /* Array<float> */ arr.get()', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleType('Array', [floatType])]]),
                parseExpression('arr.get()'))
            ).to.throw();
        });

        it('should reject /* Array<float> */ arr.get(1, 2)', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleType('Array', [floatType])]]),
                parseExpression('arr.get(1, 2)'))
            ).to.throw();
        });

        it('should reject /* Array<float> */ arr(1)', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [['arr', makeSimpleType('Array', [floatType])]]),
                parseExpression('arr(1)'))
            ).to.throw();
        });
    
        it('should type /* f: (Queue<float>) => boolean */ f([1, 2, 3]) as boolean', () => {
            expect(resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)]
                ]),
                parseExpression('f([1, 2, 3])')
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)),
                    [makeSequenceLiteralNode(
                        undefined,
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

        it('should reject /* f: (Queue<float>) => boolean */ f(1)', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)]
                ]),
                parseExpression('f(1)')
            )).to.throw();
        });

        it('should type /* q: Queue<float> */ q.pop as () => Option<float>', () => {
            expect(resolveExpressionTypes(types, 
                new Scope(root, [['q', makeSimpleType('Queue', [floatType])]]),
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
                    ['q', makeSimpleType('Queue', [floatType])]
                ]),
                parseExpression('q.pop.pop')
            )).to.throw();
        });

        it('should reject /* arr: Array<float> */ arr.pop', () => {
            expect(() => resolveExpressionTypes(types, 
                new Scope(root, [
                    ['arr', makeSimpleType('Array', [floatType])]
                ]),
                parseExpression('arr.pop')
            )).to.throw();
        });

        it('should type Array[1].length as int', () => {
            expect(resolveExpressionTypes(types, root, parseExpression('Array[1].length')))
                .to.deep.equal(
                    makeDereferenceNode(
                        makeSequenceLiteralNode('Array', [makeIntLiteralNode(1, intType)], makeSimpleType('Array', [intType])),
                        'length',
                        intType
                    )
                );
        });
    });

    describe('targetType', () => {
        it('can target type "abc" to string', () => {
            expect(targetType(stringType, resolveExpressionTypes(types, root, parseExpression('"abc"')))).to.deep.equal(
                makeStringLiteralNode('abc', stringType)
            );
        });

        it('can target type 1 to float', () => {
            expect(targetType(floatType, resolveExpressionTypes(types, root, parseExpression('1')))).to.deep.equal(
                makeIntLiteralNode(1, floatType)
            );
        });

        it('can target type true to boolean', () => {
            expect(targetType(booleanType, resolveExpressionTypes(types, root, parseExpression('true')))).to.deep.equal(
                makeBoolLiteralNode(true, booleanType)
            );
        });

        it('cannot target type 1 to boolean', () => {
            expect(() => targetType(booleanType, resolveExpressionTypes(types, root, parseExpression('1')))).to.throw();
        });

        it('can target -(5) to float', () => {
            expect(targetType(floatType, resolveExpressionTypes(types, root, parseExpression('-(5)')))).to.deep.equal(
                makeUnaryOpNode(
                    PrefixOperator.Minus,
                    makeIntLiteralNode(5, floatType),
                    floatType
                )
            );
        });

        it('cannot target type /* q: Queue<float> */ q.pop to () => int', () => {
            const f = makeFunctionType([], intType);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['q', makeSimpleType('Queue', [floatType])]
                ]),
                parseExpression('q.pop')
            ))).to.throw();
        });

        it('can target type /* q: Queue<int> */ q.pop to () => Option<float>', () => {
            const f = makeFunctionType([], makeSimpleType('Option', [floatType]));

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['q', makeSimpleType('Queue', [intType])]
                ]),
                parseExpression('q.pop')
            )).type).to.not.throw();
        });

        it('cannot target type /* f: (int) => int */ f to (float) => int', () => {
            const f = makeFunctionType([floatType], intType);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionType([intType], intType)]
                ]),
                parseExpression('f')
            ))).to.throw();
        });

        it('can target type /* f: (float) => int */ f to (int) => int', () => {
            const f = makeFunctionType([intType], intType);

            expect(() => targetType(f, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['f', makeFunctionType([floatType], intType)]
                ]),
                parseExpression('f')
            ))).to.not.throw();
        });
    
        it('can target type /* f: (Queue<float>) => boolean */ f([1, 2, 3])', () => {
            expect(targetType(
                booleanType,
                resolveExpressionTypes(types, 
                    new Scope(root, [
                        ['f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)]
                    ]),
                    parseExpression('f([1, 2, 3])')
                )
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeSimpleType('Queue', [floatType])], booleanType)),
                    [makeSequenceLiteralNode(
                        undefined,
                        [
                            makeIntLiteralNode(1, floatType),
                            makeIntLiteralNode(2, floatType),
                            makeIntLiteralNode(3, floatType)
                        ],
                        makeSimpleType('Queue', [floatType])
                    )],
                    booleanType
                )
            );
        });

        it('can target type /* f: (Map<int, float>) => boolean */ f({1: 1, 6: 2, 4: 3})', () => {
            expect(targetType(
                booleanType,
                resolveExpressionTypes(types, 
                    new Scope(root, [
                        ['f', makeFunctionType([makeSimpleType('Map', [intType, floatType])], booleanType)]
                    ]),
                    parseExpression('f({1: 1, 6: 2, 4: 3})')
                )
            )).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeSimpleType('Map', [intType, floatType])], booleanType)),
                    [makeMapLiteralNode(
                        undefined,
                        [
                            [makeIntLiteralNode(1, intType), makeIntLiteralNode(1, floatType)],
                            [makeIntLiteralNode(6, intType), makeIntLiteralNode(2, floatType)],
                            [makeIntLiteralNode(4, intType), makeIntLiteralNode(3, floatType)]
                        ],
                        makeSimpleType('Map', [intType, floatType])
                    )],
                    booleanType
                )
            );
        });
    
        it('can target type {} to Map<int, boolean>', () => {
            const m = makeSimpleType('Map', [intType, booleanType]);
    
            expect(targetType(m, resolveExpressionTypes(types, root, parseExpression('{}')))).to.deep.equal(
                makeMapLiteralNode(undefined, [], m)
            );
        });
    
        it('cannot target type [] to Map<int, boolean>', () => {
            const m = makeSimpleType('Map', [intType, booleanType]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('cannot target type [] to Option<int>', () => {
            const m = makeSimpleType('Option', [intType]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('cannot target type {} to Array<int>', () => {
            const m = makeSimpleType('Array', [intType]);
    
            expect(() => targetType(m, resolveExpressionTypes(types, root, parseExpression('{}')))).to.throw();
        });
    
        it('can target type [] to Stack<Map<int, boolean>>', () => {
            const s = makeSimpleType('Stack', [makeSimpleType('Map', [intType, booleanType])]);
    
            expect(targetType(s, resolveExpressionTypes(types, root, parseExpression('[]')))).to.deep.equal(
                makeSequenceLiteralNode(undefined, [], s)
            );
        });
    
        it('can target type { 1: [], 2: [1] } to Map<int, Queue<int>>', () => {
            const q = makeSimpleType('Queue', [intType]);
            const m = makeSimpleType('Map', [intType, q]);
    
            expect(targetType(
                m,
                resolveExpressionTypes(types, root, parseExpression('{ 1: [], 2: [1] }'))
            )).to.deep.equal(
                makeMapLiteralNode(
                    undefined,
                    [
                        [makeIntLiteralNode(1, intType), makeSequenceLiteralNode(undefined, [], q)],
                        [makeIntLiteralNode(2, intType), makeSequenceLiteralNode(undefined, [makeIntLiteralNode(1, intType)], q)]
                    ],
                    m
                )
            );
        });
    
        it('can target type [[[]], []] to Set<Set<Stack<int>>>', () => {
            const s3 = makeSimpleType('Stack', [intType]);
            const s2 = makeSimpleType('Set', [s3]);
            const s1 = makeSimpleType('Set', [s2]);
    
            expect(targetType(s1, resolveExpressionTypes(types, root, parseExpression('[[[]], []]')))).to.deep.equal(
                makeSequenceLiteralNode(
                    undefined,
                    [
                        makeSequenceLiteralNode(
                            undefined,
                            [makeSequenceLiteralNode(undefined, [], s3)],
                            s2
                        ),
                        makeSequenceLiteralNode(undefined, [], s2),
                    ],
                    s1
                )
            );
        });

        it('can target type Array[[]] to Array<Queue<boolean>>', () => {
            const t = makeSimpleType('Array', [makeSimpleType('Queue', [booleanType])]);
    
            expect(targetType(t, resolveExpressionTypes(types, root, parseExpression('Array[[]]'))).type).to.deep.equal(t);
        });

        it('cannot target type Queue[[]] to Array<Queue<boolean>>', () => {
            const t = makeSimpleType('Array', [makeSimpleType('Queue', [booleanType])]);
    
            expect(() => targetType(t, resolveExpressionTypes(types, root, parseExpression('Queue[[]]')))).to.throw();
        });

        it('can target type `1 + 3.` to float', () => {
            expect(targetType(floatType, resolveExpressionTypes(types, root, parseExpression('1 + 3.'))))
                .to.deep.equal(makeBinaryOpNode(
                    InfixOperator.Add,
                    makeIntLiteralNode(1, floatType),
                    makeFloatLiteralNode(3, floatType),
                    floatType
                ));
        });
    
        it('cannot target type `1 + 3.` to int', () => {
            expect(() => targetType(intType, resolveExpressionTypes(types, root, parseExpression('1 + 3.'))))
                .to.throw();
        });

        it('can target type `1 + 3` to int', () => {
            expect(targetType(intType, resolveExpressionTypes(types, root, parseExpression('1 + 3'))))
                .to.deep.equal(makeBinaryOpNode(
                    InfixOperator.Add,
                    makeIntLiteralNode(1, intType),
                    makeIntLiteralNode(3, intType),
                    intType
                ));
        });

        it('cannot target type [].length to int', () => {
            expect(() => targetType(intType, resolveExpressionTypes(types, root, parseExpression('[].length'))))
                .to.throw();
        });

        it('cannot target type Queue[].length to int', () => {
            expect(() => targetType(intType, resolveExpressionTypes(types, root, parseExpression('Queue[].length'))))
                .to.throw();
        });

        it('cannot target type {}.length to int', () => {
            expect(() => targetType(intType, resolveExpressionTypes(types, root, parseExpression('{}.length'))))
                .to.throw();
        });

        it('can target type /* arr: Array<float> */ arr.length to int', () => {
            expect(targetType(intType, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['arr', makeSimpleType('Array', [floatType])]
                ]),
                parseExpression('arr.length')
            ))).to.deep.equal(makeDereferenceNode(
                    makeVariableNode('arr', makeSimpleType('Array', [floatType])),
                    'length',
                    intType
                ));
        });

        it('can target type /* g: () => int, f: (() => int) => int */ f(g) to int', () => {
            expect(targetType(intType, resolveExpressionTypes(types, 
                new Scope(root, [
                    ['g', makeFunctionType([], intType)],
                    ['f', makeFunctionType([makeFunctionType([], intType)], intType)]
                ]),
                parseExpression('f(g)')
            ))).to.deep.equal(
                makeInvokeNode(
                    makeVariableNode('f', makeFunctionType([makeFunctionType([], intType)], intType)),
                    [makeVariableNode('g', makeFunctionType([], intType))],
                    intType
                )
            );
        });
    });

    describe('inferType', () => {
        it('should infer 1 is int', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('1'))))
                .to.deep.equal(intType);
        });

        it('should infer 1.0 is float', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('1.0'))))
                .to.deep.equal(floatType);
        });

        it('cannot infer the type of []', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('[]')))).to.throw();
        });

        it('should infer Array[1] is Array<int>', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('Array[1]'))))
                .to.deep.equal(makeSimpleType('Array', [intType]));
        });

        it('cannot infer the type of Array[]', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Array[]')))).to.throw();
        });

        it('should infer Map{ 1: 1.0 } is Map<int, float>', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('Map{ 1: 1.0 }'))))
                .to.deep.equal(makeSimpleType('Map', [intType, floatType]));
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

        it('cannot infer the type of Array[Array[]]', () => {
            expect(() => inferType(resolveExpressionTypes(types, root, parseExpression('Array[Array[]]')))).to.throw();
        });

        it('should infer Array[Queue[1]] is Array<Queue<int>>', () => {
            expect(inferType(resolveExpressionTypes(types, root, parseExpression('Array[Queue[1]]'))))
                .to.deep.equal(makeSimpleType('Array', [makeSimpleType('Queue', [intType])]));
        });
    });
});