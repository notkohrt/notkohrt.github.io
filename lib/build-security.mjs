import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function pinnedLibraries(root, manifest) {
  return Promise.all(['pixi.js', 'd3'].map(async name => {
    const version = manifest.devDependencies[name];
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(name + ' must have an exact version.');
    const file = 'dist/' + (name === 'pixi.js' ? 'pixi' : name) + '.min.js';
    const bytes = await readFile(path.join(root, 'node_modules', name, file));
    return {
      url: 'https://cdn.jsdelivr.net/npm/' + name + '@' + version + '/' + file,
      integrity: 'sha384-' + createHash('sha384').update(bytes).digest('base64')
    };
  }));
}

export function validateSourceScripts(template, libraries) {
  const scripts = [...template.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g)];
  const openings = [...template.matchAll(/<script\b/gi)];
  if (scripts.length !== libraries.length + 1 || openings.length !== scripts.length) {
    throw new Error('Unexpected runtime script in the source template; use the pinned external scripts with quoted attributes and no inline code.');
  }
  const source = script => {
    const attributes = [...script[0].matchAll(/\ssrc="([^"]+)"/g)];
    if (attributes.length !== 1) throw new Error('Source scripts must have exactly one quoted src attribute.');
    return attributes[0][1];
  };
  for (const library of libraries) {
    const script = scripts.find(match => source(match) === library.url);
    if (!script || script[0].match(/\sintegrity="([^"]+)"/)?.[1] !== library.integrity || script[0].match(/\scrossorigin="([^"]+)"/)?.[1] !== 'anonymous') {
      throw new Error('Source script must match the locked version and integrity: ' + library.url);
    }
  }
  if (!scripts.some(match => /^\.\/app\.js(?:\?|$)/.test(source(match)))) throw new Error('Missing application source script.');
}
