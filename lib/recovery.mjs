import { readFile, writeFile, mkdir, readdir, lstat, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const backupFiles = ['repository.bundle', 'authored-state.json', 'manifest.json'];
const exists = async file => {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

function validateAuthoredFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid authored-state files.');
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== 'string' || /[\\:\0]/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
        !(file === 'data/manual-links.json' || (file.startsWith('vault/') && file.endsWith('.md')))) {
      throw new Error('Unsafe authored-state path: ' + file);
    }
  }
  if (!Object.hasOwn(files, 'data/manual-links.json')) throw new Error('Missing curated link export in backup.');
}

async function captureNotes(directory, files, prefix = 'vault') {
  if (!await exists(directory)) return;
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Vault backup cannot follow symbolic links: ' + directory);
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(directory, entry.name), relative = prefix + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error('Vault backup cannot follow symbolic links: ' + relative);
    if (entry.isDirectory()) await captureNotes(file, files, relative);
    else if (entry.isFile() && entry.name.endsWith('.md')) files[relative] = await readFile(file, 'utf8');
  }
}

export async function createBackup({ root, output, vault = path.join(root, 'vault'), date = new Date() }) {
  if (git(root, 'rev-parse', '--is-shallow-repository') !== 'false') throw new Error('A complete-history backup requires a full Git clone, not a shallow checkout.');
  const changed = new Set([
    ...git(root, 'diff', '--name-only', '-z', 'HEAD').split('\0'),
    ...git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')
  ].filter(Boolean));
  const codeChanges = [...changed].filter(file => file !== 'data/manual-links.json' && !file.startsWith('vault/'));
  if (codeChanges.length) throw new Error('Commit or separately preserve code changes before backing up: ' + codeChanges.join(', '));
  if (await exists(path.join(root, 'data/.sts2-update'))) throw new Error('Finish or recover the snapshot update before backing up.');
  const head = git(root, 'rev-parse', 'HEAD');
  const files = { 'data/manual-links.json': await readFile(path.join(root, 'data/manual-links.json'), 'utf8') };
  await captureNotes(vault, files);
  validateAuthoredFiles(files);
  let branch = null;
  try { branch = git(root, 'symbolic-ref', '--short', 'HEAD'); } catch { /* Detached CI checkout. */ }
  output = path.resolve(output || path.join(root, 'dist/backups', head.slice(0, 7) + '-' + date.toISOString().replace(/[:.]/g, '-')));
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Refuse to overwrite an earlier backup.
  try {
    git(root, 'bundle', 'create', path.join(output, 'repository.bundle'), '--all');
    git(root, 'bundle', 'verify', path.join(output, 'repository.bundle'));
    const manifest = {
      format: 'sts2-bubble-recovery-v1', head, branch, created: date.toISOString(),
      authored_files: Object.keys(files).length,
      scope: 'All committed Git history, current vault Markdown, and current manual-links.json. Dependencies, credentials, hidden vault configuration, and attachments are excluded.'
    };
    await writeFile(path.join(output, 'authored-state.json'), JSON.stringify({ files }, null, 2) + '\n');
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const sums = await Promise.all(backupFiles.map(async file => digest(await readFile(path.join(output, file))) + '  ' + file));
    await writeFile(path.join(output, 'SHA256SUMS'), sums.join('\n') + '\n');
    await verifyBackup(output);
    return { output, head, authoredFiles: manifest.authored_files };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyBackup(input) {
  const lines = (await readFile(path.join(input, 'SHA256SUMS'), 'utf8')).trim().split('\n');
  const expected = new Map();
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  ([a-z.-]+)$/);
    if (!match || !backupFiles.includes(match[2]) || expected.has(match[2])) throw new Error('Invalid backup checksum manifest.');
    expected.set(match[2], match[1]);
  }
  if (expected.size !== backupFiles.length) throw new Error('Backup checksum manifest is incomplete.');
  for (const file of backupFiles) {
    if (!(await lstat(path.join(input, file))).isFile()) throw new Error('Backup file must be a regular file: ' + file);
    if (digest(await readFile(path.join(input, file))) !== expected.get(file)) throw new Error('Backup checksum mismatch: ' + file);
  }
  const manifest = JSON.parse(await readFile(path.join(input, 'manifest.json'), 'utf8'));
  const authored = JSON.parse(await readFile(path.join(input, 'authored-state.json'), 'utf8'));
  if (manifest.format !== 'sts2-bubble-recovery-v1' || !/^[a-f0-9]{40}$/.test(manifest.head)) throw new Error('Invalid backup format or commit.');
  validateAuthoredFiles(authored.files);
  if (Object.keys(authored.files).length !== manifest.authored_files) throw new Error('Authored file count does not match backup manifest.');
  return { manifest, files: authored.files };
}

export async function restoreBackup({ input, output }) {
  input = path.resolve(input);
  output = path.resolve(output);
  if (await exists(output)) throw new Error('Restore requires a new directory; existing files will not be overwritten.');
  const { manifest, files } = await verifyBackup(input);
  await mkdir(path.dirname(output), { recursive: true });
  // Let Git create the destination. If cloning fails, leave it for inspection;
  // never remove a path this restore did not create itself.
  execFileSync('git', ['clone', '--quiet', '--', path.join(input, 'repository.bundle'), output], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(output, 'checkout', '--quiet', '--detach', manifest.head);
  git(output, 'fsck', '--full');
  // Preserve committed Obsidian defaults while restoring Markdown deletions.
  const committedNotes = {};
  await captureNotes(path.join(output, 'vault'), committedNotes);
  for (const file of Object.keys(committedNotes)) {
    if (!Object.hasOwn(files, file)) await rm(path.join(output, file));
  }
  for (const [file, content] of Object.entries(files)) {
    const destination = path.join(output, file);
    const parent = path.dirname(destination);
    // data/ came from the bundle; refuse symlinks before applying authored data.
    let directory = parent;
    while (directory !== output) {
      if (await exists(directory) && (await lstat(directory)).isSymbolicLink()) throw new Error('Restore path contains a symbolic link: ' + file);
      directory = path.dirname(directory);
    }
    if (await exists(destination) && (await lstat(destination)).isSymbolicLink()) throw new Error('Restore file is a symbolic link: ' + file);
    await mkdir(parent, { recursive: true });
    await writeFile(destination, content);
  }
  for (const [file, content] of Object.entries(files)) {
    if (await readFile(path.join(output, file), 'utf8') !== content) throw new Error('Restored authored file differs: ' + file);
  }
  return { output, head: manifest.head, authoredFiles: manifest.authored_files };
}
