import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { SOURCES, SOURCE_META_URL, buildEdges, createNodePaths } from '../lib/graph-model.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { verifyChecksums, writeChecksums } from '../lib/build-integrity.mjs';
import { loadSnapshot } from './load-snapshot.mjs';
import { renderPreview } from './build-preview.mjs';
import { buildVault, extractCurated, noteContent, parseCuratedLinks } from './build-vault.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const git = promisify(execFile);
const documents = ['CREDITS.md', 'vault/README.md', 'vault/Start Here.md', 'vault/.obsidian/app.json', 'vault/.obsidian/graph.json'];
const dataFiles = [...Object.values(SOURCES), SOURCE_META_URL, 'data/manual-links.json'];
const sortLinks = links => links.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.relation.localeCompare(b.relation));

function validModel(snapshot) {
  const model = validateModel(snapshot);
  if (model.errors.length) throw new Error('Invalid build graph:\n' + model.errors.join('\n'));
  return model;
}

export async function verifyV1(input) {
  const directory = path.resolve(input);
  const files = await verifyChecksums(directory);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'sts2-bubble-build-v1' || !/^1\.\d+\.\d+$/.test(manifest.version || '') ||
      manifest.source?.repository !== 'notkohrt/notkohrt.github.io' || !/^[a-f0-9]{40}$/.test(manifest.source.commit || '') ||
      typeof manifest.source.dirty !== 'boolean' || !/^\d+\.\d+\.\d+$/.test(manifest.toolchain?.node || '') ||
      !/^[a-f0-9]{64}$/.test(manifest.toolchain?.lock_sha256 || '')) {
    throw new Error('Invalid v1 build identity.');
  }
  const snapshot = await loadSnapshot(directory);
  const { nodes, edges } = validModel(snapshot);
  const paths = createNodePaths(nodes);
  const expectedFiles = ['index.html', 'README.md', 'manifest.json', ...documents, ...dataFiles,
    ...[...paths.values()].map(file => 'vault/' + file)].sort();
  if (!isDeepStrictEqual(files, expectedFiles)) throw new Error('Incomplete or unexpected v1 build files.');
  if (!isDeepStrictEqual(manifest.snapshot, snapshot.meta) || !isDeepStrictEqual(manifest.graph,
    { entities: nodes.length, relationships: edges.length, curated: snapshot.manualLinks.length })) {
    throw new Error('Build manifest differs from the pinned graph.');
  }

  const html = await readFile(path.join(directory, 'index.html'), 'utf8');
  const json = html.match(/<script id="sts2-snapshot" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json || /<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/.test(html)) throw new Error('Build HTML must contain its own scripts, stylesheet, and snapshot.');
  const embedded = JSON.parse(json);
  const expectedSnapshot = Object.fromEntries(Object.entries(SOURCES).map(([key, file]) => [file, snapshot.raw[key]]));
  expectedSnapshot[SOURCE_META_URL] = snapshot.meta;
  expectedSnapshot['data/manual-links.json'] = snapshot.manualLinks;
  if (!isDeepStrictEqual(embedded, expectedSnapshot)) throw new Error('Website snapshot differs from packaged data.');

  // Use the same renderer and curator parser as generation; check every entity,
  // rather than accepting a plausible note count or a few representative cards.
  const byId = new Map(nodes.map(node => [node.id, node]));
  const pathToId = new Map([...paths].map(([id, file]) => [file.replace(/\.md$/i, ''), id]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const edge of buildEdges(nodes, [], snapshot.raw.cardPowers)) {
    outgoing.get(edge.source).push({ edge, target: byId.get(edge.target), targetPath: paths.get(edge.target) });
  }
  const manualLinks = [];
  for (const node of nodes) {
    const text = await readFile(path.join(directory, 'vault', paths.get(node.id)), 'utf8');
    const curated = extractCurated(text);
    if (text !== noteContent(node, outgoing.get(node.id), curated)) throw new Error('Vault note differs from the pinned graph: ' + node.id);
    manualLinks.push(...parseCuratedLinks(node, curated, pathToId));
  }
  if (!isDeepStrictEqual(sortLinks(manualLinks), snapshot.manualLinks)) throw new Error('Vault curation differs from the website export.');
  return { output: directory, nodes: nodes.length, edges: edges.length, manifest, files: files.length };
}

function openingInstructions(manifest) {
  return `# STS2 Bubble v${manifest.version}

Extract the downloaded ZIP before opening its files.

- Open \`index.html\` in a browser to use the graph. The interface, libraries, and pinned data are embedded in that file.
- Open the \`vault\` folder as an Obsidian vault, then read **Start Here**. The website and all entity notes contain the same ${manifest.graph.entities} entities and ${manifest.graph.relationships} relationships.
- Read \`CREDITS.md\` for Mega Crit attribution and the pending artwork permission request. Online artwork availability is separate from the embedded interface and data.

## Reproduce or edit this build

Source: https://github.com/${manifest.source.repository}/tree/${manifest.source.commit}

${manifest.source.dirty ? 'This is a development build with local edits. The recorded commit alone will not reproduce those edits.' : 'This build uses the recorded source commit without local edits.'}

In a full checkout of that source, use Node ${manifest.toolchain.node}, run \`npm ci --ignore-scripts\`, \`npm run check\`, and \`npm run build:v1 -- --output /path/to/new-build\`. To verify this extracted package, run \`npm run verify:v1 -- /path/to/extracted-build\`. Every packaged file is listed in \`SHA256SUMS\`; \`manifest.json\` records the source, toolchain, snapshot, and graph counts. Checksums detect file changes; they do not authenticate the publisher.

The package is an export. To regenerate edited curated relationships, keep the full repository and use its vault generator, then rebuild the site. Preserve your authored notes before replacing an export. Build commands refuse existing output directories.

This package contains the website, notes, and pinned data. For complete source history and restoration, keep a separate recovery package made with \`npm run backup\`.
`;
}

export async function buildV1(output = path.join(ROOT, 'dist/sts2-bubble-v1')) {
  try {
    await lstat(path.join(ROOT, 'data/.sts2-update'));
    throw new Error('Finish or recover the snapshot transaction before building.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const snapshot = await loadSnapshot();
  const { nodes, edges } = validModel(snapshot);
  const preview = await renderPreview();
  if (await readFile(path.join(ROOT, 'index.html'), 'utf8') !== preview.html) {
    throw new Error('Generated index.html is stale. Run npm run build:site and npm run check.');
  }
  const [head, status, packageText, lock, nodePin] = await Promise.all([
    git('git', ['-C', ROOT, 'rev-parse', 'HEAD']),
    git('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=normal']),
    readFile(path.join(ROOT, 'package.json'), 'utf8'),
    readFile(path.join(ROOT, 'package-lock.json')),
    readFile(path.join(ROOT, '.nvmrc'), 'utf8')
  ]);
  const pkg = JSON.parse(packageText);
  const locked = JSON.parse(lock);
  if (!/^1\.\d+\.\d+$/.test(pkg.version || '') || locked.version !== pkg.version || locked.packages[''].version !== pkg.version ||
      !isDeepStrictEqual(pkg.devDependencies, locked.packages[''].devDependencies)) {
    throw new Error('Build version and dependencies must match package-lock.json.');
  }
  if (process.versions.node !== nodePin.trim().replace(/^v/, '')) throw new Error('Build with the exact Node version in .nvmrc.');
  const manifest = {
    format: 'sts2-bubble-build-v1', version: pkg.version,
    source: { repository: 'notkohrt/notkohrt.github.io', commit: head.stdout.trim(), dirty: Boolean(status.stdout.trim()) },
    toolchain: { node: process.versions.node, dependencies: pkg.devDependencies, lock_sha256: createHash('sha256').update(lock).digest('hex') },
    snapshot: snapshot.meta,
    graph: { entities: nodes.length, relationships: edges.length, curated: snapshot.manualLinks.length }
  };
  const destination = path.resolve(output);
  await mkdir(path.dirname(destination), { recursive: true });
  // Claim a fresh directory before writing. A rerun cannot overwrite a vault
  // someone has opened and edited; cleanup owns only this invocation's output.
  await mkdir(destination);
  try {
    for (const file of [...documents, ...dataFiles]) {
      if (!(await lstat(path.join(ROOT, file))).isFile()) throw new Error('Build input must be an ordinary file: ' + file);
      await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
      await copyFile(path.join(ROOT, file), path.join(destination, file));
    }
    const vault = await buildVault({ output: destination });
    if (!isDeepStrictEqual(vault.manualLinks, snapshot.manualLinks)) {
      throw new Error('Curated notes differ from the website export. Run npm run build:vault, npm run build:site, and npm run check.');
    }
    await writeFile(path.join(destination, 'index.html'), preview.html);
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(path.join(destination, 'README.md'), openingInstructions(manifest));
    await writeChecksums(destination);
    return await verifyV1(destination);
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { output: { type: 'string' }, verify: { type: 'string' } } });
    if (values.verify && values.output) throw new Error('Choose either --output for a new build or --verify for an existing build.');
    const result = values.verify ? await verifyV1(values.verify) : await buildV1(values.output);
    console.log((values.verify ? 'Verified' : 'Built and verified') + ' v1 package: ' + result.output +
      ' (' + result.nodes + ' notes, ' + result.edges + ' links, ' + result.files + ' checksummed files)');
    if (result.manifest.source.dirty) console.log('Development build includes local edits; its source commit alone is insufficient to reproduce it.');
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'Build output already exists. Choose a new --output directory to preserve its files.' : error.message);
    process.exitCode = 1;
  }
}
