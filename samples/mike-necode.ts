import JavascriptTarget from '../src/codegen/js/JavascriptTarget';
import { createMiKeDiagnosticsManager } from '../src/diagnostics/DiagnosticCodes';
import MiKe from '../src/MiKe';
import { readFileSync } from 'fs';
import { JsLibraryImplementation } from '../src/codegen/js/LibraryImpl';
import { events, necodeLib } from './mikeconfig';

const filename = process.argv[2];

if (!filename) {
    console.log('Please choose a file.');
    process.exit();
}

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
mike.setEvents(events);
mike.init();
try {
    mike.loadScript(readFileSync(filename, { encoding: 'utf-8' }));
    const emit = mike.tryValidateAndEmit();
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