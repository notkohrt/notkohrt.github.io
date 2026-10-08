import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function siteOriginForDomain(value) {
  const domain = value.trim().toLowerCase();
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || !/^[a-z]{2,}$/.test(labels.at(-1)) ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Use a bare DNS hostname, such as sts2stars.io, without a scheme, port, path, or wildcard.');
  }
  return 'https://' + domain + '/';
}

export async function readSiteOrigin(root) {
  return siteOriginForDomain(await readFile(path.join(root, 'CNAME'), 'utf8'));
}

export function renderSiteTemplate(template, origin) {
  if (siteOriginForDomain(new URL(origin).hostname) !== origin) throw new Error('Site origin must be a canonical HTTPS root URL.');
  const html = template.replaceAll('{{SITE_ORIGIN}}', origin);
  const metadata = new Map();
  for (const tag of html.matchAll(/<(?:link|meta)\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/\b([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1], match[3]]));
    const key = attributes.rel === 'canonical' ? 'canonical' : attributes.property || attributes.name;
    if (!['canonical', 'og:url', 'og:image', 'twitter:image'].includes(key)) continue;
    if (metadata.has(key)) throw new Error('Duplicate site metadata: ' + key);
    metadata.set(key, attributes.href || attributes.content);
  }
  for (const key of ['canonical', 'og:url', 'og:image', 'twitter:image']) {
    const value = metadata.get(key);
    if (!value) throw new Error('Missing site metadata: ' + key);
    const url = new URL(value);
    if (url.origin + '/' !== origin || (['canonical', 'og:url'].includes(key) && value !== origin)) {
      throw new Error('Site metadata must match CNAME: ' + key);
    }
  }
  return html;
}
