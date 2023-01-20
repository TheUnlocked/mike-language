import { expect } from 'chai';
import { ASTNodeKind, visit } from '../../src/ast';
import MiKe from '../../src/MiKe';
import { intType, unitType } from '../../src/types/Primitives';

export default () => describe('typechecker', () => {

    it('can fetch internal types before validating', async () => {
        const mike = new MiKe();
        mike.init();

        mike.loadScript(`
        state x: int;
        
        on foo() {
            let y = x;
        }`);

        visit(mike.root, ast => {
            if (ast.kind === ASTNodeKind.Variable) {
                expect(mike.typechecker.fetchType(ast)).to.deep.equal(intType);
            }
        });
    });

    it('can fetch external types before validating', async () => {
        const mike = new MiKe();
        mike.addLibrary({
            types: [],
            values: [{ name: 'bar', type: unitType }]
        });
        mike.init();

        mike.loadScript(`
        on foo() {
            let x = bar;
        }`);

        visit(mike.root, ast => {
            if (ast.kind === ASTNodeKind.Variable) {
                expect(mike.typechecker.fetchType(ast)).to.deep.equal(unitType);
            }
        });
    });

});