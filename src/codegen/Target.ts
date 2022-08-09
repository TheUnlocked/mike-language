import { Program } from '../ast/Ast';
import { LibraryImplementation } from '../library/Library';
import { Typechecker } from '../semantics/Typechecker';

export interface Target {
    generate(program: Program): ArrayBuffer;
}

export interface TargetFactory {
    readonly defaultImplementations?: readonly Partial<LibraryImplementation>[];
    create(typechecker: Typechecker, impl: LibraryImplementation): Target;
} 
