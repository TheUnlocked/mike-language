import { expect } from 'chai';
import { parseExpression } from './util';
import { makeBinaryOpNode_, makeBoolLiteralNode_, makeDereferenceNode_, makeFloatLiteralNode_, makeIntLiteralNode_, makeInvokeNode_, makeMapLiteralNode_, makeSequenceLiteralNode_, makeStringLiteralNode, makeStringLiteralNode_, makeUnaryOpNode, makeUnaryOpNode_, makeVariableNode_ } from '../../ast/tests/util';
import { InfixOperator, PrefixOperator } from '../../ast/Ast';

describe('parse expressions', () => {

    describe('number types', () => {
        it('should parse 1 as an integer', () => {
            expect(parseExpression('1')).to.deep.equal(
                makeIntLiteralNode_(1)
            );
        });

        it('should parse -1 as an integer', () => {
            expect(parseExpression('-1')).to.deep.equal(
                makeIntLiteralNode_(-1)
            );
        });

        it('should parse +1 as an integer', () => {
            expect(parseExpression('+1')).to.deep.equal(
                makeIntLiteralNode_(1)
            );
        });

        it('should parse 01234567089000 as an integer', () => {
            expect(parseExpression('01234567089000')).to.deep.equal(
                makeIntLiteralNode_(1234567089000)
            );
        });

        it('should parse 1.2 as a float', () => {
            expect(parseExpression('1.2')).to.deep.equal(
                makeFloatLiteralNode_(1.2)
            );
        });

        it('should parse +1.2 as a float', () => {
            expect(parseExpression('+1.2')).to.deep.equal(
                makeFloatLiteralNode_(1.2)
            );
        });

        it('should parse -1.2 as a float', () => {
            expect(parseExpression('-1.2')).to.deep.equal(
                makeFloatLiteralNode_(-1.2)
            );
        });

        it('should parse 0. as a float', () => {
            expect(parseExpression('0.')).to.deep.equal(
                makeFloatLiteralNode_(0)
            );
        });

        it('should parse .0 as a float', () => {
            expect(parseExpression('.0')).to.deep.equal(
                makeFloatLiteralNode_(0)
            );
        });

        it('cannot parse -', () => {
            expect(() => parseExpression('-')).to.throw();
        });

        it('cannot parse .', () => {
            expect(() => parseExpression('.')).to.throw();
        });

        it('should parse 1e3 as a float', () => {
            expect(parseExpression('1e3')).to.deep.equal(
                makeFloatLiteralNode_(1000)
            );
        });

        it('should parse 1e+3 as a float', () => {
            expect(parseExpression('1e+3')).to.deep.equal(
                makeFloatLiteralNode_(1000)
            );
        });

        it('should parse 1E-3 as a float', () => {
            expect(parseExpression('1E-3')).to.deep.equal(
                makeFloatLiteralNode_(0.001)
            );
        });

    });

    it('can parse `1 + 2`', () => {
        expect(parseExpression('1 + 2')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Add,
                makeIntLiteralNode_(1),
                makeIntLiteralNode_(2)
            )
        );
    });

    it('can parse `1 - 2 * 6 / 3 - 5`', () => {
        expect(parseExpression('1 - 2 * 6 / 3 - 5')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Subtract,
                makeIntLiteralNode_(1),
                makeBinaryOpNode_(
                    InfixOperator.Subtract,
                    makeBinaryOpNode_(
                        InfixOperator.Multiply,
                        makeIntLiteralNode_(2),
                        makeBinaryOpNode_(
                            InfixOperator.Divide,
                            makeIntLiteralNode_(6),
                            makeIntLiteralNode_(3)
                        )
                    ),
                    makeIntLiteralNode_(5)
                )
            )
        );
    });

    it('can parse `(1 - 2) * 6`', () => {
        expect(parseExpression('(1 - 2) * 6')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Multiply,
                makeBinaryOpNode_(
                    InfixOperator.Subtract,
                    makeIntLiteralNode_(1),
                    makeIntLiteralNode_(2)
                ),
                makeIntLiteralNode_(6)
            )
        );
    });

    it('can parse !true', () => {
        expect(parseExpression('!true')).to.deep.equal(
            makeUnaryOpNode_(PrefixOperator.Not, makeBoolLiteralNode_(true))
        );
    });

    it('can parse !!x', () => {
        expect(parseExpression('!!x')).to.deep.equal(
            makeUnaryOpNode_(PrefixOperator.Not, makeUnaryOpNode_(PrefixOperator.Not, makeVariableNode_('x')))
        );
    });

    it('can parse -(a + b)', () => {
        expect(parseExpression('-(a + b)')).to.deep.equal(
            makeUnaryOpNode_(
                PrefixOperator.Minus,
                makeBinaryOpNode_(InfixOperator.Add, makeVariableNode_('a'), makeVariableNode_('b'))
            )
        );
    });

    it('can parse `-a + b`', () => {
        expect(parseExpression('-a + b')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Add,
                makeUnaryOpNode_(PrefixOperator.Minus, makeVariableNode_('a')),
                makeVariableNode_('b')
            )
        );
    });

    it('can parse x1', () => {
        expect(parseExpression('x1')).to.deep.equal(
            makeVariableNode_('x1')
        );
    });

    it('should not parse `1x`', () => {
        expect(() => parseExpression('1x')).to.throw();
    });

    it('can parse `x > 2`', () => {
        expect(parseExpression('x > 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.GreaterThan, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `x >= 2`', () => {
        expect(parseExpression('x >= 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.GreaterThanEqual, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `x < 2`', () => {
        expect(parseExpression('x < 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.LessThan, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `x <= 2`', () => {
        expect(parseExpression('x <= 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.LessThanEqual, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `x == 2`', () => {
        expect(parseExpression('x == 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.Equals, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `x != 2`', () => {
        expect(parseExpression('x != 2')).to.deep.equal(
            makeBinaryOpNode_(InfixOperator.NotEquals, makeVariableNode_('x'), makeIntLiteralNode_(2))
        );
    });

    it('can parse `false || 1 + 1 == 2`', () => {
        expect(parseExpression('false || 1 + 1 == 2')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Or,
                makeBoolLiteralNode_(false),
                makeBinaryOpNode_(
                    InfixOperator.Equals,
                    makeBinaryOpNode_(InfixOperator.Add, makeIntLiteralNode_(1), makeIntLiteralNode_(1)),
                    makeIntLiteralNode_(2)
                )
            )
        );
    });

    it('should not parse `a && b || c`', () => {
        expect(() => parseExpression('a && b || c')).to.throw();
    });

    it('can parse `a && (b || c || d)`', () => {
        expect(parseExpression('a && (b || c || d)')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.And,
                makeVariableNode_('a'),
                makeBinaryOpNode_(
                    InfixOperator.Or,
                    makeVariableNode_('b'),
                    makeBinaryOpNode_(
                        InfixOperator.Or,
                        makeVariableNode_('c'),
                        makeVariableNode_('d')
                    )
                )
            )
        );
    });

    it('can parse `foo()`', () => {
        expect(parseExpression('foo()')).to.deep.equal(
            makeInvokeNode_(makeVariableNode_('foo'), [])
        );
    });

    it('can parse `foo(1, 2)`', () => {
        expect(parseExpression('foo(1, 2)')).to.deep.equal(
            makeInvokeNode_(makeVariableNode_('foo'), [
                makeIntLiteralNode_(1),
                makeIntLiteralNode_(2)
            ])
        );
    });

    it('can parse `a.b.c()`', () => {
        expect(parseExpression('a.b.c()')).to.deep.equal(
            makeInvokeNode_(
                makeDereferenceNode_(
                    makeDereferenceNode_(
                        makeVariableNode_('a'),
                        'b'
                    ),
                    'c'
                ),
                []
            )
        );
    });

    it('can parse `a + b.foo`', () => {
        expect(parseExpression('a + b.foo')).to.deep.equal(
            makeBinaryOpNode_(
                InfixOperator.Add,
                makeVariableNode_('a'),
                makeDereferenceNode_(makeVariableNode_('b'), 'foo')
            )
        );
    });

    it('can parse double quoted strings', () => {
        expect(parseExpression('"abc"')).to.deep.equal(
            makeStringLiteralNode_('abc')
        );
    });

    it('can parse single quoted strings', () => {
        expect(parseExpression("'abc'")).to.deep.equal(
            makeStringLiteralNode_('abc')
        );
    });

    it('can parse empty strings', () => {
        expect(parseExpression('""')).to.deep.equal(
            makeStringLiteralNode_('')
        );
        expect(parseExpression("''")).to.deep.equal(
            makeStringLiteralNode_('')
        );
    });

    it('can parse escaped quotes in strings', () => {
        expect(parseExpression("'it\\'s a test'")).to.deep.equal(
            makeStringLiteralNode_("it's a test")
        );
        expect(parseExpression('"they said \\"hi\\""')).to.deep.equal(
            makeStringLiteralNode_('they said "hi"')
        );
    });

    it('can parse escaped backslashes in strings', () => {
        expect(parseExpression("'\\\\'")).to.deep.equal(
            makeStringLiteralNode_("\\")
        );
    });

    it('cannot parse "\\"', () => {
        expect(() => parseExpression('"\\"')).to.throw();
    });

    it('cannot parse escaped quotes of the wrong kind', () => {
        expect(() => parseExpression('"it\\\'s a test"')).to.throw();
        expect(() => parseExpression("'they said \\\"hi\\\"'")).to.throw();
    });

    it('should normalize newlines in strings', () => {
        expect(parseExpression('"Hello,\r\nWorld!"')).to.deep.equal(
            makeStringLiteralNode_('Hello,\nWorld!')
        );
        expect(parseExpression('"Hello,\rWorld!"')).to.deep.equal(
            makeStringLiteralNode_('Hello,\nWorld!')
        );
        expect(parseExpression('"Hello,\nWorld!"')).to.deep.equal(
            makeStringLiteralNode_('Hello,\nWorld!')
        );
    });

    it('can parse [1, 2, 3]', () => {
        expect(parseExpression('[1, 2, 3]')).to.deep.equal(
            makeSequenceLiteralNode_(undefined, [
                makeIntLiteralNode_(1),
                makeIntLiteralNode_(2),
                makeIntLiteralNode_(3)
            ])
        );
    });

    it('can parse {1: a, b: c, d: 2}', () => {
        expect(parseExpression('{1: a, b: c, d: 2}')).to.deep.equal(
            makeMapLiteralNode_(
                undefined,
                [
                    [makeIntLiteralNode_(1), makeVariableNode_('a')],
                    [makeVariableNode_('b'), makeVariableNode_('c')],
                    [makeVariableNode_('d'), makeIntLiteralNode_(2)]
                ]
            )
        );
    });

    it('cannot parse open mismatched parens', () => {
        expect(() => parseExpression('(1 + 2')).to.throw();
        expect(() => parseExpression(')1 + 2')).to.throw();
        expect(() => parseExpression('1 + 2)')).to.throw();
    });

    it('cannot parse open mismatched square brackets', () => {
        expect(() => parseExpression('[1, 2')).to.throw();
        expect(() => parseExpression('1, 2]')).to.throw();
        expect(() => parseExpression('[1 + 2')).to.throw();
        expect(() => parseExpression('1 + 2]')).to.throw();
        expect(() => parseExpression(']1 + 2')).to.throw();
    });

    it('cannot parse open mismatched curly braces', () => {
        expect(() => parseExpression('{a: 1')).to.throw();
        expect(() => parseExpression('a: 1}')).to.throw();
        expect(() => parseExpression('{1 + 2')).to.throw();
        expect(() => parseExpression('1 + 2}')).to.throw();
        expect(() => parseExpression('}1 + 2')).to.throw();
    });

    it('can parse `true`', () => {
        expect(parseExpression('true')).to.deep.equal(
            makeBoolLiteralNode_(true)
        );
    });

    it('can parse `false`', () => {
        expect(parseExpression('false')).to.deep.equal(
            makeBoolLiteralNode_(false)
        );
    });
});