# STS2 Stars domain plan

Compare **sts2stars.io** and **sts2stars.com** using verified registration and renewal prices before choosing. Neither name's availability nor current price has been verified. `notkohrt.pro` currently serves the working graph and is intended for the developer site later.

## What .io means

`.io` is the country-code top-level domain assigned to the British Indian Ocean Territory. Tech projects commonly use it because I/O means input/output. The suffix does not require a particular hosting provider or change what the graph can do. `.com` is the familiar commercial suffix, widely used for projects of all kinds.

The tech association makes `.io` a reasonable fit for STS2 Stars; `.com` is usually cheaper to renew. Choose after comparing current quotes, rather than judging a first-year promotion alone.

## Price and availability verification

Useful first-party sources:

- [Porkbun .io prices](https://porkbun.com/tld/io) and [.com prices](https://porkbun.com/tld/com), including registration and renewal.
- [Porkbun API documentation](https://porkbun.com/api/json/v3/documentation) and its public [pricing endpoint](https://api.porkbun.com/api/json/v3/pricing/get).
- [IANA's .io delegation](https://www.iana.org/domains/root/db/io.html) and [RDAP bootstrap](https://data.iana.org/rdap/dns.json) for registry sources.

Record the registrar, currency, standard registration fee, yearly renewal fee, applicable taxes/fees, and quote date. Check the exact name at the registrar: a standard TLD price is not an exact-name checkout quote, and a name can carry premium pricing. A missing DNS record does not establish that a domain is available.

The cloud's restricted egress policy blocked the registrar, public pricing API, and IANA requests with a proxy CONNECT 403 on 2026-10-08. No live prices are asserted here. Public read access is the missing prerequisite for an automated comparison; no registrar credentials are needed to read the public price sources.

Registration is a separate paid action after the name and price have been chosen. Keep payment and account details in the registrar's own checkout.

## Hosting and migration

GitHub Pages can continue hosting the static graph; a different suffix does not require paid hosting. Keep this repository as the source of truth. If both the project domain and developer domain use GitHub Pages, use separate Pages sites because each site has one configured custom domain.

1. Obtain verified prices, choose the exact domain, and register it.
2. Verify ownership in GitHub before pointing the domain at Pages. Use GitHub's generated verification TXT record; do not invent one.
3. Plan where the developer site will live before changing `notkohrt.pro`. The current graph can remain in this repository, with the developer site on a separate Pages site.
4. Configure the owned project domain's DNS using the current [GitHub Pages instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). For a `www` alias, the GitHub target is `notkohrt.github.io`, without a repository path. Select apex records from the current official instructions and the chosen DNS provider's supported record types.
5. Preview the repository changes with `npm run plan:domain -- sts2stars.io` (or `.com`). The command is offline and writes nothing.
6. Set the chosen bare hostname in `CNAME`, run `npm run build:site`, and run `npm run check`. The builder fills canonical and sharing URLs from `CNAME`; production checks read the same value. Review and commit the generated HTML together with `CNAME`.
7. Publish the owned domain through Pages, wait for DNS and certificate readiness, and enable HTTPS enforcement when the certificate is ready. Verify the exact deployed HTML and mobile interaction with the existing production job; TLS verification stays enabled.
8. Update the Reddit post's final website link. Complete the draft before publishing and linking the permanent release ZIP.

Domain registration, ownership verification, DNS changes, and migration have not been performed by this preparation work.
