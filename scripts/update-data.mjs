import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { refreshSnapshot, recoverSnapshot } from '../lib/snapshot-update.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--recover') {
      console.log(await recoverSnapshot(root) ? 'Recovered interrupted snapshot update.' : 'No interrupted snapshot update.');
    } else if (!args.length) {
      const result = await refreshSnapshot({ root });
      console.log(result.changed ? 'Installed validated snapshot: ' + result.sourceCommit : 'Snapshot already current: ' + result.sourceCommit);
      console.log(result.nodes + ' notes, ' + result.edges + ' relationships.');
      if (result.changed) console.log('Next: review the dataset, regenerate the vault and site, and run npm run check.');
    } else {
      throw new Error('Usage: node scripts/update-data.mjs [--recover]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
