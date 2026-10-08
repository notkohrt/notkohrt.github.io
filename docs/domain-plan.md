# STS2 Stars domain migration

The user confirmed the purchase of **sts2stars.com** on 2026-10-08. The intended primary URL is **https://sts2stars.com/**, with `www.sts2stars.com` redirecting to it. A live registry RDAP lookup confirmed Squarespace Domains LLC as the registrar and `nsc1` through `nsc4.squarespacedns.com` as its nameservers. Domain selection and registration are complete; price comparison is no longer needed.

`notkohrt.pro` currently serves the graph and is intended for the developer site later. This branch prepares `CNAME`, generated canonical/sharing URLs, production checks, the vault entry page, and the community draft for the new domain. Preparation does not itself change Squarespace DNS or the live Pages setting. Keep the current site live until DNS is configured and the migration can be published.

## Squarespace DNS

In the Squarespace domain dashboard, open **sts2stars.com → DNS → DNS Settings**. Replace the default website/parking records for the apex (`@`) and `www` with these custom records. Keep unrelated mail and verification records. Leave TTL at the provider's default.

| Host | Type | Value |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `notkohrt.github.io` |

IPv6 is optional. If using apex AAAA records, use GitHub's four addresses below; existing AAAA records pointing to another host must not remain alongside the Pages records.

| Host | Type | Value |
| --- | --- | --- |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |

These addresses and the `www` target were checked against [GitHub's current Pages documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) on 2026-10-08. Use the exact `www` CNAME target without a scheme or repository path. Do not add wildcard records or Squarespace URL forwarding.

## Ownership protection

GitHub recommends verifying the domain to protect its Pages association. In [personal GitHub Pages settings](https://github.com/settings/pages), choose **Add a domain**, enter `sts2stars.com`, and copy the generated TXT record into Squarespace. Its hostname is `_github-pages-challenge-notkohrt`; its value must come from GitHub. Return to GitHub and select **Verify** once the record resolves, then retain the TXT record. No verification value is invented or stored in this repository.

See [GitHub's domain verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

## Publish and verify

1. Confirm the apex A records and `www` CNAME are configured in Squarespace. DNS propagation can take up to 24 hours.
2. Run `npm run plan:domain -- sts2stars.com`, `npm run build:site`, and `npm run check`. Review `CNAME` and generated `index.html` together. Run the existing browser checks; required CI jobs must pass before merging.
3. Publish the migration to `main` and confirm the repository's Pages custom domain is `sts2stars.com`. If the CNAME commit does not update the setting automatically, save it in [repository Pages settings](https://github.com/notkohrt/notkohrt.github.io/settings/pages).
4. Wait for the Pages certificate, then enable **Enforce HTTPS**. Certificate readiness can take up to 24 hours. Never disable TLS verification to make a check pass.
5. Require the existing production job to pass against the new origin: exact deployed HTML, pinned counts, mobile search, and directed relationship tracing in Chromium and WebKit. Also check the sharing image and the `www` redirect. Until those checks succeed, the new domain is not confirmed live.
6. Complete the Reddit draft, then build and verify the release ZIP from the clean release commit and publish its permanent download link. An expiring Actions artifact is not the community download URL.

The existing GitHub Pages hosting can serve the graph without additional paid hosting. A future developer site on `notkohrt.pro` needs its own hosting destination; each Pages site has one custom domain. Reassign that domain separately after the project migration works.

The cloud can read registry and GitHub documentation HTTPS endpoints, but direct DNS resolution and requests to the project domains are currently blocked by its egress policy. This is a limitation of the local check, not evidence that the purchased domain is broken. Use the production workflow's live browser checks from GitHub's runner for deployment verification. Squarespace DNS editing and GitHub account-level domain verification require the user's account access.
