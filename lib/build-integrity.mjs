import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safePath(file) {
  return typeof file === 'string' && file.length && !/[/\\]/.test(file[0]) &&
    !/[\u0000-\u001f\u007f\\:]/.test(file) && file.split('/').every(part => part && part !== '.' && part !== '..');
}

async function listFiles(directory, prefix = '') {
  if (!(await lstat(directory)).isDirectory()) throw new Error('Build directory must be an ordinary directory.');
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (!safePath(relative)) throw new Error('Unsafe build path: ' + relative);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) files.push(relative);
    else throw new Error('Build contains a symlink or special file: ' + relative);
  }
  return files.sort();
}

const hashFile = async (directory, file) => createHash('sha256').update(await readFile(path.join(directory, file))).digest('hex');

export async function writeChecksums(directory) {
  const files = (await listFiles(directory)).filter(file => file !== 'SHA256SUMS');
  const lines = await Promise.all(files.map(async file => await hashFile(directory, file) + '  ' + file));
  await writeFile(path.join(directory, 'SHA256SUMS'), lines.join('\n') + '\n');
  return files;
}

export async function verifyChecksums(directory) {
  // Enumerate before reading the manifest so no declared path can redirect a
  // read through a symlink or outside the package.
  const files = await listFiles(directory);
  const text = await readFile(path.join(directory, 'SHA256SUMS'), 'utf8');
  const declared = new Map();
  for (const line of (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !safePath(match[2]) || match[2] === 'SHA256SUMS') throw new Error('Unsafe or invalid build checksum entry.');
    if (declared.has(match[2])) throw new Error('Duplicate build checksum entry: ' + match[2]);
    declared.set(match[2], match[1]);
  }
  const expected = files.filter(file => file !== 'SHA256SUMS');
  if (expected.length !== declared.size || expected.some(file => !declared.has(file))) {
    throw new Error('Build file list differs from SHA256SUMS.');
  }
  for (const file of expected) {
    if (await hashFile(directory, file) !== declared.get(file)) throw new Error('Build checksum mismatch: ' + file);
  }
  return expected;
}
