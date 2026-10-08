import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readSiteOrigin, renderSiteTemplate, siteOriginForDomain } from '../lib/site-origin.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Usage: npm run plan:domain -- sts2stars.io');
  const origin = siteOriginForDomain(args[0]);
  renderSiteTemplate(await readFile(path.join(root, 'src/index.html'), 'utf8'), origin);
  console.log(JSON.stringify({
    currentOrigin: await readSiteOrigin(root),
    candidateOrigin: origin,
    availability: 'Not checked by this offline planner',
    prerequisites: ['Confirm registration and renewal price', 'Register and verify ownership', 'Choose separate hosting for the developer site'],
    repositoryChange: { file: 'CNAME', content: new URL(origin).hostname + '\n' },
    build: 'npm run build:site',
    validation: 'npm run check',
    liveVerification: 'npx playwright test --config playwright.production.config.mjs',
    effect: 'Generated canonical/sharing URLs and production checks derive from CNAME',
    dnsChanged: false,
    filesWritten: false
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
