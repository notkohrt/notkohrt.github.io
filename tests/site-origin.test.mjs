import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readSiteOrigin, renderSiteTemplate, siteOriginForDomain } from '../lib/site-origin.mjs';

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');

test('a domain migration updates canonical and all sharing URLs together', () => {
  const html = renderSiteTemplate(template, siteOriginForDomain('STS2Stars.io\n'));
  assert.match(html, /rel="canonical" href="https:\/\/sts2stars\.io\/"/);
  assert.match(html, /property="og:url" content="https:\/\/sts2stars\.io\/"/);
  assert.match(html, /property="og:image" content="https:\/\/sts2stars\.io\/docs\/assets\/sts2-neow\.webp"/);
  assert.match(html, /name="twitter:image" content="https:\/\/sts2stars\.io\/docs\/assets\/sts2-neow\.webp"/);
  assert.doesNotMatch(html, /notkohrt\.pro|\{\{SITE_ORIGIN\}\}/);
});

test('the current domain preserves the published canonical and sharing URLs', async () => {
  const origin = await readSiteOrigin(fileURLToPath(new URL('../', import.meta.url)));
  const html = renderSiteTemplate(template, origin);
  const deployed = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const key of ['canonical', 'og:url', 'og:image', 'twitter:image']) {
    const matchingTag = html.match(new RegExp('<(?:link|meta)\\b[^>]*["\']' + key + '["\'][^>]*>'))?.[0];
    assert.ok(matchingTag && deployed.includes(matchingTag), key);
  }
});

test('URLs, wildcard records, multiple domains, and malformed DNS labels cannot become CNAME', () => {
  for (const value of ['', 'localhost', 'https://sts2stars.io', 'sts2stars.io:443', 'sts2stars.io/path', '*.sts2stars.io',
    'sts2stars.io\nevil.com', 'name@sts2stars.io', '-bad.io', 'bad-.io', 'bad..io', 'a'.repeat(64) + '.io']) {
    assert.throws(() => siteOriginForDomain(value), /bare DNS hostname/, value);
  }
});

test('a stale canonical or sharing origin stops the build', () => {
  for (const key of ['canonical', 'og:url', 'og:image', 'twitter:image']) {
    const stale = template.replace(new RegExp('(<(?:link|meta)\\b[^>]*["\']' + key + '["\'][^>]*)(?:href|content)="\{\{SITE_ORIGIN\}\}'), '$1' + (key === 'canonical' ? 'href' : 'content') + '="https://old.example/');
    assert.notEqual(stale, template, key);
    assert.throws(() => renderSiteTemplate(stale, 'https://sts2stars.io/'), /must match CNAME/, key);
  }
});

test('missing and conflicting duplicate domain metadata stop the build', () => {
  assert.throws(() => renderSiteTemplate(template.replace(/<meta property="og:url"[^>]*>/, ''), 'https://sts2stars.io/'), /Missing site metadata/);
  assert.throws(() => renderSiteTemplate(template + '<meta content="https://old.example/" property="og:url">', 'https://sts2stars.io/'), /Duplicate site metadata/);
});

test('production checks read the chosen CNAME and reject an empty configuration', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sts2-domain-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'CNAME'), 'sts2stars.com\n');
  assert.equal(await readSiteOrigin(directory), 'https://sts2stars.com/');
  await writeFile(path.join(directory, 'CNAME'), '');
  await assert.rejects(readSiteOrigin(directory), /bare DNS hostname/);
});
