import { expect } from 'chai';

export function createTestFunction(assertion: string, variables: { [name: string]: any }) {
    const testContext = { ...variables, expect } as { [name: string]: any };
    const args = Object.keys(testContext);
    return () => new Function(...args, assertionToJs(assertion))(...args.map(x => testContext[x]));
}

function assertionToJs(assertion: string): string {
    if (assertion.includes(',')) {
        return assertion.split(',').map(assertionToJs).join('');
    }
    if (assertion.includes('==')) {
        const [lhs, rhs] = assertion.split('==').map(x => x.trim());
        return `expect(${lhs}).to.equal(${rhs});`;
    }
    return ``;
}
