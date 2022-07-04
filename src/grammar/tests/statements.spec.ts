import { expect } from 'chai';
import { makeAssignFieldNode, makeAssignVarNode, makeBlockNode, makeBoolLiteralNode_, makeDebugStatementNode, makeDeclareVarNode, makeDereferenceNode_, makeExpressionStatementNode, makeIfElseChainNode, makeIntLiteralNode_, makeInvokeNode_, makeVariableNode_ } from '../../ast/tests/util';
import { intType } from '../../types/Primitives';
import { parseStatement } from './util';

describe('parse statements', () => {
    
    describe('expression statements', () => {
        it('can parse foo();', () => {
            expect(parseStatement('foo();')).to.deep.equal(
                makeExpressionStatementNode(
                    makeInvokeNode_(makeVariableNode_('foo'), [])
                )
            );
        });

        it('should not parse foo()', () => {
            expect(() => parseStatement('foo()')).to.throw();
        });

        it('can parse 1;', () => {
            expect(parseStatement('1;')).to.deep.equal(
                makeExpressionStatementNode(
                    makeIntLiteralNode_(1)
                )
            );
        });
    });

    describe('let statements', () => {
        it('can parse `let x = 5;`', () => {
            expect(parseStatement('let x = 5;')).to.deep.equal(
                makeDeclareVarNode('x', undefined, makeIntLiteralNode_(5))
            );
        });

        it('can parse `let x: int;`', () => {
            expect(parseStatement('let x: int;')).to.deep.equal(
                makeDeclareVarNode('x', intType, undefined)
            );
        });

        it('can parse `let x: int = 5;`', () => {
            expect(parseStatement('let x: int = 5;')).to.deep.equal(
                makeDeclareVarNode('x', intType, makeIntLiteralNode_(5))
            );
        });

        it('should not parse `let x;`', () => {
            expect(() => parseStatement('let x;')).to.throw();
        });
    });

    describe('assignment statements', () => {
        it('can parse `x = 5;`', () => {
            expect(parseStatement('x = 5;')).to.deep.equal(
                makeAssignVarNode('x', makeIntLiteralNode_(5))
            );
        });

        it('can parse `a.b = 5;`', () => {
            expect(parseStatement('a.b = 5;')).to.deep.equal(
                makeAssignFieldNode(makeVariableNode_('a'), 'b', makeIntLiteralNode_(5))
            );
        });

        it('should not parse `1 = 5;`', () => {
            expect(() => parseStatement('1 = 5;')).to.throw();
        });

        it('should not parse `x.foo() = 5;`', () => {
            expect(() => parseStatement('x.foo() = 5;')).to.throw();
        });
    });

    describe('if statements', () => {
        it('can parse `if true { x.foo(); }`', () => {
            expect(parseStatement('if true { foo(); }')).to.deep.equal(
                makeIfElseChainNode(
                    [{
                        condition: makeBoolLiteralNode_(true),
                        body: makeBlockNode([makeExpressionStatementNode(
                            makeInvokeNode_(makeVariableNode_('foo'), [])
                        )]),
                    }],
                    undefined
                )
            );
        });

        it('can parse `if arr.get(0) |v| { }`', () => {
            expect(parseStatement('if arr.get(0) |v| { }')).to.deep.equal(
                makeIfElseChainNode(
                    [{
                        condition: makeInvokeNode_(
                            makeDereferenceNode_(makeVariableNode_('arr'), 'get'),
                            [makeIntLiteralNode_(0)]
                        ),
                        deconstructName: 'v',
                        body: makeBlockNode([]),
                    }],
                    undefined
                )
            );
        });

        it('can parse `if arr.get(0) |v| {} else {}`', () => {
            expect(parseStatement('if arr.get(0) |v| {} else {}')).to.deep.equal(
                makeIfElseChainNode(
                    [{
                        condition: makeInvokeNode_(
                            makeDereferenceNode_(makeVariableNode_('arr'), 'get'),
                            [makeIntLiteralNode_(0)]
                        ),
                        deconstructName: 'v',
                        body: makeBlockNode([]),
                    }],
                    makeBlockNode([])
                )
            );
        });

        it('can parse `if b {} else if arr.get(0) |v| {}`', () => {
            expect(parseStatement('if b {} else if arr.get(0) |v| {}')).to.deep.equal(
                makeIfElseChainNode(
                    [
                        { condition: makeVariableNode_('b'), body: makeBlockNode([]) },
                        {
                            condition: makeInvokeNode_(
                                makeDereferenceNode_(makeVariableNode_('arr'), 'get'),
                                [makeIntLiteralNode_(0)]
                            ),
                            deconstructName: 'v',
                            body: makeBlockNode([]),
                        }
                    ],
                    undefined
                )
            );
        });

        it('can parse `if b1 {} else if arr.get(0) |v| {} else if b2 {} else {}`', () => {
            expect(parseStatement('if b1 {} else if arr.get(0) |v| {} else if b2 {} else {}')).to.deep.equal(
                makeIfElseChainNode(
                    [
                        { condition: makeVariableNode_('b1'), body: makeBlockNode([]) },
                        {
                            condition: makeInvokeNode_(
                                makeDereferenceNode_(makeVariableNode_('arr'), 'get'),
                                [makeIntLiteralNode_(0)]
                            ),
                            deconstructName: 'v',
                            body: makeBlockNode([]),
                        },
                        { condition: makeVariableNode_('b2'), body: makeBlockNode([]) }
                    ],
                    makeBlockNode([])
                )
            );
        });
    });

    describe('debug statements', () => {
        it('can parse `debug 1;`', () => {
            expect(parseStatement('debug 1;')).to.deep.equal(
                makeDebugStatementNode([makeIntLiteralNode_(1)])
            );
        });

        it('can parse `debug x, y, z;`', () => {
            expect(parseStatement('debug x, y, z;')).to.deep.equal(
                makeDebugStatementNode([makeVariableNode_('x'), makeVariableNode_('y'), makeVariableNode_('z')])
            );
        });

        it('should not parse `debug;`', () => {
            expect(() => parseStatement('debug;')).to.throw();
        });
    });

    describe('blocks', () => {
        it('can parse `{}`', () => {
            expect(parseStatement('{}')).to.deep.equal(
                makeBlockNode([])
            );
        });

        it('can parse `{ let x = 1; if b { x = 2; } debug x; }`', () => {
            expect(parseStatement('{ let x = 1; if b { x = 2; } debug x; }')).to.deep.equal(
                makeBlockNode([
                    makeDeclareVarNode('x', undefined, makeIntLiteralNode_(1)),
                    makeIfElseChainNode(
                        [{
                            condition: makeVariableNode_('b'),
                            body: makeBlockNode([makeAssignVarNode('x', makeIntLiteralNode_(2))])
                        }],
                        undefined
                    ),
                    makeDebugStatementNode([makeVariableNode_('x')])
                ])
            );
        });
    });
});