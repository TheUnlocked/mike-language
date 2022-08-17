// @ts-check

import fs from 'fs/promises';
import path from 'path';

/**
 * @param {string} filename 
 */
async function copyFile(filename) {
    await fs.copyFile(path.join('./', filename), path.join('./dist/', filename));
    console.log(`Copied ${filename} to dist`);
}

async function processPackageJson() {
    /** @type {Partial<import('./package.json')>} */
    const packageJson = JSON.parse(await fs.readFile('./package.json', { encoding: 'utf8' }));

    delete packageJson.devDependencies;
    delete packageJson.scripts;
    delete packageJson.files;

    await fs.writeFile('./dist/package.json', JSON.stringify(packageJson, null, 4));
    console.log('Created package.json for dist')
}

const filenamesToCopy = [
    'LICENSE',
    'README.md',
];

await Promise.all([
    processPackageJson(),
    ...filenamesToCopy.map(copyFile)
]);
