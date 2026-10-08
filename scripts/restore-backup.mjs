import { parseArgs } from 'node:util';
import { restoreBackup } from '../lib/recovery.mjs';

try {
  const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' } } });
  if (!values.input || !values.output) throw new Error('Usage: node scripts/restore-backup.mjs --input BACKUP_DIRECTORY --output NEW_DIRECTORY');
  const result = await restoreBackup(values);
  console.log('Restored verified history and authored state: ' + result.output);
  console.log('Commit: ' + result.head + '; authored files: ' + result.authoredFiles);
  console.log('Inspect restored curations, then rebuild the vault/site and run validation before publishing.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
