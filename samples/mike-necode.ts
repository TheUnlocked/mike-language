import JavascriptTarget from '../src/codegen/js/JavascriptTarget';
import { createMiKeDiagnosticsManager } from '../src/diagnostics/DiagnosticCodes';
import MiKe from '../src/MiKe';
import { readFileSync } from 'fs';
import { functionOf, optionOf, SimpleType, TypeKind } from '../src/types/KnownType';
import { unitType } from '../src/types/Primitives';
import { suggestType } from '../src/utils/types';
import { LibraryInterface } from '../src/library/Library';
import { JsLibraryImplementation } from '../src/codegen/js/LibraryImpl';
import { TypeAttributeKind } from '../src/types/Attribute';

const filename = process.argv[2];

if (!filename) {
    console.log('Please choose a file.');
    process.exit();
}

const userType: SimpleType = { kind: TypeKind.Simple, name: 'User', typeArguments: [] };
const policyType: SimpleType = { kind: TypeKind.Simple, name: 'Policy', typeArguments: [] };
const groupType: SimpleType = { kind: TypeKind.Simple, name: 'Group', typeArguments: [] };

const necodeLib = suggestType<LibraryInterface>()({
    types: [
        { name: 'User', numParameters: 0, quantify: () => ({ attributes: [], members: {} }) },
        { name: 'Policy', numParameters: 0, quantify: () => ({ attributes: [{ kind: TypeAttributeKind.IsLegalParameter }], members: {} }) },
        { name: 'Group', numParameters: 0, quantify: () => ({ attributes: [], members: {
            join: functionOf([userType], unitType),
            leave: functionOf([userType], unitType),
            forget: functionOf([userType], unitType),
        } }) },
    ],
    values: [
        { name: 'link', type: functionOf([userType, userType], unitType) },
        { name: 'unlink', type: functionOf([userType, userType], unitType) },
        { name: 'Group', type: functionOf([policyType], groupType) },
    ]
} as const);

const externals = 'externals';

const necodeLibImpl: JsLibraryImplementation<typeof necodeLib> = {
    types: {
        User: () => ({ serialize: 'x=>x', deserialize: 'x=>x', }),
        Policy: () => ({ serialize: 'x=>x', deserialize: 'x=>x', }),
        Group: () => ({ serialize: 'x=>x._id', deserialize: `id=>${externals}.fetchGroupById(id)`}),
    },
    values: {
        link: () => ({ emit: `${externals}.link` }),
        unlink: () => ({ emit: `${externals}.unlink` }),
        Group: () => ({ emit: `${externals}.makeGroup` }),
    },
};

const diagnostics = createMiKeDiagnosticsManager();
const mike = new MiKe();
mike.setDiagnosticsManager(diagnostics);
mike.setTarget(JavascriptTarget);
mike.addLibrary(necodeLib);
mike.addLibraryImplementation(necodeLibImpl);
mike.setEvents([
    { name: 'join', required: false, argumentTypes: [userType] },
    { name: 'leave', required: false, argumentTypes: [userType] },
])
mike.init();
try {
    mike.loadScript(filename, readFileSync(filename, { encoding: 'utf-8' }));
    const emit = mike.tryValidateAndEmit(filename);
    if (emit) {
        process.stdout.write(new Uint8Array(emit));
    }
    else {
        for (const diagnostic of diagnostics.getDiagnostics()) {
            console.error(diagnostic.toString());
        }
    }
}
catch (e) {
    for (const diagnostic of diagnostics.getDiagnostics()) {
        console.error(diagnostic.toString());
    }
    console.error(e);
}