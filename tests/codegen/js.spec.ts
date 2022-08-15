import paramsSpec from './js/params.spec';
import serializeSpec from './js/serialize.spec';
import stdlibSpec from './js/stdlib.spec';

export default () => describe('js', () => {
    paramsSpec();
    serializeSpec();
    stdlibSpec();
});