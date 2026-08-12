import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const files = {
  intakeDocker: read("apps/intake/Dockerfile"),
  landingDocker: read("apps/landing/Dockerfile"),
  intakeNginx: read("apps/intake/nginx.conf"),
  landingNginx: read("apps/landing/nginx.conf"),
  intakeCompose: read("apps/intake/compose.yml"),
  landingCompose: read("apps/landing/compose.yml"),
};

const failures = [];
let assertions = 0;

function present(label, content, expected) {
  assertions += 1;
  if (!content.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
}

function absent(label, content, unexpected) {
  assertions += 1;
  if (content.includes(unexpected)) failures.push(`${label}: unexpected ${JSON.stringify(unexpected)}`);
}

function presentInBoth(label, expected) {
  present(`intake ${label}`, files.intakeDocker, expected);
  present(`landing ${label}`, files.landingDocker, expected);
}

const staticDockerContracts = [
  ["Node build stage", "FROM node:${NODE_VERSION} AS build"],
  ["pinned pnpm bootstrap", "RUN npm install -g pnpm@11.21.0"],
  ["frozen dependency installation", "RUN pnpm install --frozen-lockfile"],
  ["Nginx static runtime", "FROM nginx:${NGINX_VERSION}"],
  ["default Nginx config removal", "RUN rm -f /etc/nginx/conf.d/default.conf"],
  ["static healthcheck", "HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1"],
  ["HTTP port", "EXPOSE 80"],
];

for (const [label, expected] of staticDockerContracts) presentInBoth(label, expected);

for (const app of ["intake", "landing"]) {
  const dockerfile = files[`${app}Docker`];
  present(`${app} Nginx config copy`, dockerfile, `COPY apps/${app}/nginx.conf /etc/nginx/conf.d/default.conf`);
  present(`${app} static output copy`, dockerfile, `COPY --from=build /repo/apps/${app}/dist /usr/share/nginx/html`);
}

const staticNginxContracts = [
  ["default listener", "listen 80 default_server;"],
  ["absolute redirect policy", "absolute_redirect off;"],
  ["content-type protection", "add_header X-Content-Type-Options"],
  ["frame protection", "add_header X-Frame-Options"],
  ["referrer policy", "add_header Referrer-Policy"],
  ["permissions policy", "add_header Permissions-Policy"],
  ["content security policy", "add_header Content-Security-Policy"],
  ["gzip", "gzip on;"],
  ["gzip variation", "gzip_vary on;"],
  ["asset cache location", "location ~* \\.(?:js|css|woff2?|ttf|eot|otf)$"],
  ["image cache location", "location ~* \\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$"],
  ["HTML cache location", "location ~* \\.html$"],
  ["robots content type", "location = /robots.txt"],
  ["sitemap content type", "location = /sitemap.xml"],
  ["sitemap index content type", "location = /sitemap-index.xml"],
  ["llms content type", "location = /llms.txt"],
  ["humans content type", "location = /humans.txt"],
  ["security content type", "location = /.well-known/security.txt"],
  ["fallback route", "location / {"],
  ["static try-files policy", "try_files $uri $uri/ $uri.html =404;"],
  ["404 page", "error_page 404 /404.html;"],
];

for (const [label, expected] of staticNginxContracts) {
  present(`intake ${label}`, files.intakeNginx, expected);
  present(`landing ${label}`, files.landingNginx, expected);
}

const staticComposeContracts = [
  ["pull policy", "pull_policy: always"],
  ["restart policy", "restart: unless-stopped"],
  ["proxy network", "networks: [proxy]"],
  ["Traefik enablement", "traefik.enable=true"],
  ["proxy network label", "traefik.docker.network=proxy"],
  ["HTTPS entrypoint", "entrypoints=websecure"],
  ["TLS certificate resolver", "tls.certresolver=letsencrypt"],
  ["HSTS middleware", "middlewares=hsts@docker"],
  ["static service port", "loadbalancer.server.port=80"],
  ["bounded logging", "max-size: \"20m\""],
  ["bounded log retention", "max-file: \"5\""],
];

for (const [label, expected] of staticComposeContracts) {
  present(`intake ${label}`, files.intakeCompose, expected);
  present(`landing ${label}`, files.landingCompose, expected);
}

present("intake digest-pinned image", files.intakeCompose, "image: ghcr.io/optidigi/siteinabox-intake@${SIAB_INTAKE_IMAGE_DIGEST:?required}");
present("landing digest-pinned image", files.landingCompose, "image: ghcr.io/optidigi/siteinabox-site@${SIAB_SITE_IMAGE_DIGEST:?required}");

// These variances are product behavior, not drift. Their presence makes the
// allowlist executable and keeps future parity changes reviewable.
const allowedVariances = [
  "intake owns /intake path rewriting and priority 300; landing owns host-root priority 100",
  "landing CSP includes Turnstile, PostHog, Google Tag Manager, and Google Analytics destinations",
  "landing build includes legal-content and public analytics/Turnstile inputs; intake does not",
  "service, container, image repository, and digest variable names are app-specific",
];

present("intake /intake redirect", files.intakeNginx, "location = /intake");
present("intake /intake prefix route", files.intakeNginx, "location ^~ /intake/");
present("intake /intake rewrite", files.intakeNginx, "rewrite ^/intake/(.*)$ /$1 break;");
present("landing analytics/security CSP", files.landingNginx, "https://challenges.cloudflare.com");
present("landing Google Tag Manager CSP", files.landingNginx, "https://www.googletagmanager.com");
present("landing Google Analytics CSP", files.landingNginx, "https://www.google-analytics.com");
absent("intake must not own landing Turnstile CSP", files.intakeNginx, "https://challenges.cloudflare.com");
absent("landing must not own intake Nginx route", files.landingNginx, "location = /intake");
absent("landing must not claim intake path", files.landingCompose, "Path(`/intake`)");
present("intake router priority", files.intakeCompose, "priority=300");
present("landing router priority", files.landingCompose, "priority=100");

if (failures.length > 0) {
  console.error("Static deployment parity failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Static deployment parity OK: ${assertions} invariants; ${allowedVariances.length} explicit app variances.`);
