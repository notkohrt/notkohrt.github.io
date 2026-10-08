import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createBackup } from '../lib/recovery.mjs';

try {
  const { values } = parseArgs({ options: { output: { type: 'string' }, vault: { type: 'string' } } });
  const result = await createBackup({ root: fileURLToPath(new URL('../', import.meta.url)), ...values });
  console.log('Verified recovery package: ' + result.output);
  console.log('Commit: ' + result.head + '; authored files: ' + result.authoredFiles);
  console.log('Copy the entire package outside this workspace. See DEVELOPMENT.md for restoration.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
