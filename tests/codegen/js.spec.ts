import paramsSpec from './js/params.spec';
import stdlibSpec from './js/stdlib.spec';

export default () => describe('js', () => {
    paramsSpec();
    stdlibSpec();
});