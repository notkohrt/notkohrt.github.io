import { execFile } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify, parseArgs } from 'node:util';
import { buildV1 } from './build-v1.mjs';
import { PROJECT_SLUG } from '../lib/project.mjs';

export async function buildOffline(output = fileURLToPath(new URL('../dist/' + PROJECT_SLUG + '-offline', import.meta.url))) {
  try {
    await lstat(path.resolve(output) + '.zip');
    throw new Error('ZIP output already exists; choose a new output path to preserve it.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await buildV1(output);
  const archive = result.output + '.zip';
  await promisify(execFile)('python3', [fileURLToPath(new URL('./package-offline.py', import.meta.url)), result.output, archive]);
  return { ...result, archive };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { output: { type: 'string' } } });
    const result = await buildOffline(values.output);
    console.log('Built and verified offline bundle: ' + result.archive + ' (' + result.nodes + ' notes, ' + result.edges + ' links)');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
