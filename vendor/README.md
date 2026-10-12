# Pinned browser libraries

PixiJS 7.4.2 (MIT) and d3 7.9.0 (ISC) are copied byte-for-byte from the exact npm distributions in `package-lock.json`. Their licenses are included here. No CDN is used by the source template or deployed app.

`npm run check:security` compares both the distributions and licenses against the locked installed packages and verifies the template's SHA-384 integrity attributes. To update a library, review the dependency change, copy its minified distribution and license here, update the template's local path/integrity, and regenerate the site and service worker. Test graph behavior before merging.

The generated app embeds its libraries; these local copies also support source-mode development without a CDN.
