import { mkdir, readFile, writeFile, rename, rm, access } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { SOURCES } from './graph-model.mjs';
import { validateModel } from './validate-model.mjs';
import { loadSnapshot } from '../scripts/load-snapshot.mjs';

const repository = 'nkhoit/spire-archive';
const exists = async file => {
  try { await access(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};
const locations = root => ({
  work: path.join(root, 'data/.sts2-update'),
  target: path.join(root, 'data/sts2'),
  staged: path.join(root, 'data/.sts2-update/staged'),
  previous: path.join(root, 'data/.sts2-update/previous'),
  committed: path.join(root, 'data/.sts2-update/committed')
});

async function finishOrRollback(root, renameFile = rename) {
  const files = locations(root);
  if (await exists(files.committed)) {
    if (!await exists(files.target)) throw new Error('Committed snapshot is missing; previous data preserved at ' + files.previous);
  } else if (await exists(files.previous)) {
    if (await exists(files.target)) await renameFile(files.target, path.join(files.work, 'discarded'));
    await renameFile(files.previous, files.target);
  }
  await rm(files.work, { recursive: true, force: true });
}

// The retained old directory makes an interrupted two-rename installation
// recoverable. Never recover while another process still owns the transaction.
export async function recoverSnapshot(root) {
  const files = locations(root);
  if (!await exists(files.work)) return false;
  let owner, ownerText;
  try {
    ownerText = await readFile(path.join(files.work, 'owner.json'), 'utf8');
    owner = JSON.parse(ownerText);
  }
  catch { throw new Error('Incomplete snapshot transaction owner at ' + files.work + '; inspect the transaction before recovery.'); }
  if (owner.hostname !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0) {
    throw new Error('Cannot establish snapshot transaction ownership at ' + files.work);
  }
  let alive = true;
  try { process.kill(owner.pid, 0); }
  catch (error) { if (error.code === 'ESRCH') alive = false; else if (error.code !== 'EPERM') throw error; }
  if (alive) throw new Error('Snapshot updater is already running (PID ' + owner.pid + ').');
  try { await mkdir(path.join(files.work, 'recovering')); }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    if (error.code === 'EEXIST') throw new Error('Snapshot recovery is already in progress; transaction preserved at ' + files.work);
    throw error;
  }
  if (await readFile(path.join(files.work, 'owner.json'), 'utf8') !== ownerText) {
    throw new Error('Snapshot transaction owner changed during recovery. Retry after the current updater finishes.');
  }
  await finishOrRollback(root);
  return true;
}

export async function refreshSnapshot({ root, fetchImpl = fetch, date = new Date(), renameFile = rename }) {
  const files = locations(root);
  await mkdir(path.dirname(files.work), { recursive: true });
  await recoverSnapshot(root);
  try { await mkdir(files.work); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another snapshot updater acquired the transaction. Retry after it finishes.');
    throw error;
  }
  await writeFile(path.join(files.work, 'owner.json'), JSON.stringify({ pid: process.pid, hostname: hostname() }), { flag: 'wx' });

  try {
    const get = async url => {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': 'sts2-bubble-data-updater' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(url + ' -> ' + response.status);
      const body = await response.text();
      try { return { body: body.endsWith('\n') ? body : body + '\n', value: JSON.parse(body) }; }
      catch { throw new Error('Invalid JSON from ' + url); }
    };
    const ref = (await get('https://api.github.com/repos/' + repository + '/git/ref/heads/main')).value;
    const sha = ref?.object?.sha;
    if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('Upstream ref must identify a full commit SHA.');

    // An unchanged source commit must retain its original snapshot date rather
    // than opening a weekly PR that only changes metadata.
    let current;
    try { current = await loadSnapshot(root); }
    catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error; }
    if (current?.meta?.source_commit === sha) {
      const model = validateModel(current);
      if (!model.errors.length) {
        await finishOrRollback(root);
        return { changed: false, sourceCommit: sha, nodes: model.nodes.length, edges: model.edges.length };
      }
    }

    const base = 'https://raw.githubusercontent.com/' + repository + '/' + sha + '/data/sts2/';
    const names = [...Object.entries(SOURCES).map(([key, source]) => [key, path.basename(source)]), ['changelog', 'changelog.json']];
    const results = await Promise.allSettled(names.map(async ([key, file]) => [key, file, await get(base + file)]));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    const downloaded = results.map(result => result.value);
    const raw = Object.fromEntries(downloaded.filter(([key]) => key !== 'changelog').map(([key, , result]) => [key, result.value]));
    const changelog = downloaded.find(([key]) => key === 'changelog')[2].value;
    if (!Array.isArray(changelog) || typeof changelog[0]?.version !== 'string' || !changelog[0].version.trim()) {
      throw new Error('Upstream changelog must include a game-data version.');
    }
    const meta = {
      source_repository: repository,
      source_commit: sha,
      snapshot_date: date.toISOString().slice(0, 10),
      game_data_version: changelog[0].version,
      game_data_date: changelog[0].date || null,
      source_path: 'data/sts2',
      note: 'Pinned source snapshot used by STS2 Bubble.'
    };
    const manualLinks = current?.manualLinks ?? JSON.parse(await readFile(path.join(root, 'data/manual-links.json'), 'utf8'));
    const model = validateModel({ raw, meta, manualLinks });
    if (model.errors.length) throw new Error('Refreshed snapshot failed validation:\n' + model.errors.join('\n'));

    await mkdir(files.staged);
    const writes = await Promise.allSettled([
      ...downloaded.filter(([key]) => key !== 'changelog').map(([, file, result]) => writeFile(path.join(files.staged, file), result.body)),
      writeFile(path.join(files.staged, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
    ]);
    const failedWrite = writes.find(result => result.status === 'rejected');
    if (failedWrite) throw failedWrite.reason;
    await renameFile(files.target, files.previous);
    await renameFile(files.staged, files.target);
    await writeFile(files.committed, '');
    await finishOrRollback(root);
    return { changed: true, sourceCommit: sha, nodes: model.nodes.length, edges: model.edges.length };
  } catch (error) {
    try { await finishOrRollback(root, renameFile); }
    catch (rollbackError) {
      throw new Error(error.message + '\nRecovery could not finish: ' + rollbackError.message + '\nTransaction preserved at ' + files.work);
    }
    throw error;
  }
}
