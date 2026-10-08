import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pinnedLibraries, validateSourceScripts } from '../lib/build-security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  if (!/^1\.\d+\.\d+$/.test(manifest.version || '') || lock.version !== manifest.version || lock.packages[''].version !== manifest.version) {
    throw new Error('Package version must match the locked v1 build version.');
  }
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    if (!/^\d+\.\d+\.\d+$/.test(version) || lock.packages[''].devDependencies[name] !== version || lock.packages['node_modules/' + name]?.version !== version) {
      throw new Error('Development dependency must match its exact locked version: ' + name);
    }
  }
  validateSourceScripts(await readFile(path.join(root, 'src/index.html'), 'utf8'), await pinnedLibraries(root, manifest));
  const directory = path.join(root, '.github/workflows');
  for (const file of await readdir(directory)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = await readFile(path.join(directory, file), 'utf8');
    const actions = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)];
    if (actions.length !== [...text.matchAll(/\buses\s*:/g)].length) throw new Error(file + ': use block YAML for auditable action pins.');
    for (const match of actions) {
      const action = match[1].replace(/^['"]|['"]$/g, '');
      if (!/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(action)) throw new Error(file + ': action must be pinned to a full commit: ' + action);
    }
  }
  // Renaming a CI job without updating the ruleset leaves main waiting for a
  // check that can never arrive. Validate the portable policy against CI.
  const ruleset = JSON.parse(await readFile(path.join(root, '.github/main-ruleset.json'), 'utf8'));
  const workflow = await readFile(path.join(directory, 'validate.yml'), 'utf8');
  const jobNames = new Set([...workflow.matchAll(/^  ([\w-]+):\s*$/gm)].map(match => match[1]));
  const statusRule = ruleset.rules.find(rule => rule.type === 'required_status_checks');
  if (ruleset.target !== 'branch' || ruleset.enforcement !== 'active' || ruleset.bypass_actors.length ||
      ruleset.conditions.ref_name.exclude.length || ruleset.conditions.ref_name.include.length !== 1 ||
      ruleset.conditions.ref_name.include[0] !== 'refs/heads/main' ||
      !['deletion', 'non_fast_forward'].every(type => ruleset.rules.some(rule => rule.type === type)) ||
      !statusRule?.parameters.strict_required_status_checks_policy || !statusRule.parameters.required_status_checks.length) {
    throw new Error('Main ruleset must target only main, require up-to-date checks, and prevent bypass, deletion, and force pushes.');
  }
  for (const check of statusRule.parameters.required_status_checks) {
    if (check.integration_id !== 15368 || !jobNames.has(check.context)) {
      throw new Error('Main ruleset requires a missing GitHub Actions job: ' + check.context);
    }
  }
  console.log('Security policy checked: exact locked dependencies, source-script integrity, immutable CI actions, and ruleset/check consistency.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
