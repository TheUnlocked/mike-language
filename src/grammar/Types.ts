import { FunctionTypeContext, MaybeGenericTypeContext, TypeIdentifierContext } from './generated/MiKeParser';
import { ParserRuleContext } from 'antlr4ts';
import { AstMetadata, ASTNodeKind, Type } from '../ast/Ast';
import { WithDiagnostics } from '../diagnostics/DiagnosticsMixin';
import { AbstractMiKeVisitor } from './BaseVisitor';

export class TypeAstGenVisitor extends WithDiagnostics(AbstractMiKeVisitor<Type>) {

    constructor() {
        super();
    }

    visitMaybeGenericType(ctx: MaybeGenericTypeContext): Type {
        const typeArguments = ctx.typeArguments();
        if (typeArguments) {
            return {
                kind: ASTNodeKind.GenericType,
                metadata: this.getMetadata(ctx),
                name: this.visitTypeIdentifier(ctx.typeIdentifier()),
                typeArguments: typeArguments.type().map(x => x.accept(this)),
            };
        }
        return ctx.typeIdentifier().accept(this);
    }

    visitTypeIdentifier = this._visitTypeIdentifier

    visitFunctionType(ctx: FunctionTypeContext): Type {
        return {
            kind: ASTNodeKind.FunctionType,
            metadata: this.getMetadata(ctx),
            parameters: ctx.typeList().type().map(x => x.accept(this)),
            returnType: ctx.type().accept(this),
        };
    }
}