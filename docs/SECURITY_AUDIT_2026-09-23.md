# Audit de sécurité — Float — 23 septembre 2026

## Périmètre et méthode

État initial : commit `05cccfdf63043677cd0591688e19dbda3a19caee` et les trois images réellement exécutées sur le mini PC. Audit des lockfiles frontend/MCP/Rust, des images, et des usages sensibles des bibliothèques dans les routes publiques. Les dépendances optionnelles, outils de compilation et chemins non utilisés sont distingués du code accessible en production.

Outils : `npm audit` via le registre npm officiel, `cargo-audit 0.22.2` et RustSec (révision `1e640cd56d7604993e3a9ec392060666e3b95ccc`), `Trivy 0.74.0` avec base téléchargée le jour de l'audit, tests Rust/SQLite et Playwright. Les archives des outils ont été comparées aux empreintes SHA-256 publiées dans leurs releases officielles. Les scans d'images ont été effectués sur des exports sans volumes de données ni secrets d'exécution.

Aucune tentative de traversée de fichiers ou de modification inter-utilisateurs n'a été lancée en production. Les régressions ont été reproduites sur des fixtures locales jetables. Les contrôles publics se limitent aux brouillons, aux en-têtes et au rejet d'un ancien type de jeton visant un UUID fictif. Ceci n'est ni un pentest exhaustif ni une recherche de compromission historique.

## Problèmes applicatifs corrigés

| Priorité | Constat initial | Correction et preuve |
| --- | --- | --- |
| Critique | La configuration effective de l'API utilisait la clé JWT de repli documentée. Un contrôle limité à un booléen a confirmé ce point, sans afficher la clé. | Rotation immédiate vers une clé aléatoire de 256 bits, conservée dans le `.env` de production en mode `0600`. Redémarrage de l'API pour invalider les sessions. Suppression des replis dans Compose et Rust, refus des clés de moins de 32 octets, algorithme HS256 explicite. Tests de clés faibles, signature, expiration et algorithme. |
| Haute | Les noms de pièces jointes téléchargées/supprimées pouvaient devenir des chemins après décodage des paramètres Axum. | Validation commune : refus des chemins absolus, séparateurs, `.`/`..`, caractères de contrôle et caractères dangereux pour les en-têtes. Régression HTTP locale reproduite avant correction. |
| Haute | Les opérations sur pièces jointes vérifiaient le propriétaire du projet fourni, mais pas l'appartenance de la tâche à ce projet. | Vérification conjointe tâche–projet–propriétaire avant chaque opération. Tests des quatre opérations, des UUID inexistants et des tâches d'un autre utilisateur/projet ; fichiers témoins préservés. |
| Moyenne/haute | Suppression et associations de labels insuffisamment limitées au projet authentifié. | Suppression filtrée par projet ; rattachement et détachement vérifient le projet de la tâche et du label. Tests inter-utilisateurs, inter-projets et des parcours autorisés/idempotents. |
| Moyenne | Le traçage HTTP par défaut pouvait journaliser le jeton SSE contenu dans la query string. | Les spans HTTP enregistrent uniquement méthode et chemin, jamais la query string. Niveau de journalisation par défaut réduit. `Referrer-Policy: no-referrer` en complément. |
| Moyenne | Vérification bcrypt synchrone sur les workers async et absence de limitation applicative des connexions. | Calcul bcrypt déplacé dans `spawn_blocking`, au maximum quatre vérifications en cours, sans file d'attente non bornée. Limitation à 20 tentatives par compte normalisé et par minute ; table plafonnée à 1 024 comptes et nettoyée à expiration. Réponses HTTP 429 et tests des bornes. |

Fichiers principaux : `crates/api/src/auth.rs`, `main.rs`, `login_guard.rs`, `state.rs`, `routes/auth_routes.rs`, `routes/attachment_routes.rs`, `routes/label_routes.rs`.

La rotation invalide les anciennes sessions, pas les mots de passe. Aucune preuve de compromission passée n'a été recherchée ou établie ; le seul changement de clé ne constitue pas une analyse d'incident.

## Dépendances : résultats et corrections

### Frontend et MCP

- **Frontend : zéro alerte npm** sur le lockfile, dépendances de développement incluses, à la date de cet audit. React/Vite sont compilés en fichiers statiques ; aucun serveur React Server Components n'est déployé. Les avis RSC ne s'appliquent donc pas simplement parce que React 19 est installé.
- **MCP : six paquets signalés avant correction** : `fast-uri 3.1.2` et `ip-address 10.2.0` (haute), `hono 4.12.25`, `@hono/node-server 1.19.14`, `qs 6.15.2` (moyenne), `body-parser 2.2.2` (basse).
- Le MCP utilise `StdioServerTransport`, et n'est pas un serveur HTTP public dans le Compose de Float. Les avis SSRF/traversée/DoS de ses dépendances ne prouvaient donc pas une exploitation via le site public.
- Mise à jour du lockfile MCP dans les plages compatibles, sans `--force` : **zéro alerte npm après correction**, compilation TypeScript réussie. Le lockfile conservé donne les versions exactes retenues.

### Rust

Le lockfile initial contenait trois avis de vulnérabilité : `rkyv 0.7.46` (RUSTSEC-2026-0235), `rsa 0.9.10` (RUSTSEC-2023-0071), `rustls 0.23.40` (RUSTSEC-2026-0285), ainsi que des avertissements sur `anyhow`, `event-listener`, `proc-macro-error2` et une version retirée de `spin`.

Corrections :

- `anyhow` porté à **1.0.103** et `event-listener` à **5.4.2**.
- Fonctionnalités SeaORM réduites à SQLite, Tokio, macros, UUID et dates réellement utilisés. La CLI de migration et les sérialisations optionnelles inutilisées ne sont plus activées. `rkyv` et `rustls` ont disparu du lockfile retenu : aucune connexion TLS à une base distante n'est nécessaire pour SQLite. Ce changement ne supprime pas le TLS du site, terminé en amont.
- Build de l'API avec `cargo build --locked`.

**Résiduel explicite :** `cargo audit` brut signale encore `rsa 0.9.10`, sans correctif amont disponible. Il figure dans la résolution optionnelle SQLx, mais `cargo tree --locked -p float-api -e normal,build -i rsa` ne présente aucun chemin dans le binaire actif. Les JWT utilisent HMAC, pas RSA. Ne pas activer un backend/fonctionnalité qui rendrait cette dépendance active sans refaire l'analyse. Aucun ignore global masquant ce risque n'a été ajouté.

Les avertissements `proc-macro-error2 2.0.1` non maintenu (compilation via SeaORM) et `spin 0.9.8` retiré du registre restent à suivre avec les mises à jour de leurs parents. Ils ne sont pas présentés comme des exploits distants démontrés.

### Images et Caddy

Les comptes suivants sont des **occurrences paquet–avis**, pas des exploits distincts confirmés.

| Artefact | Avant | Images candidates corrigées |
| --- | --- | --- |
| API, paquets système | Debian 12, 248 occurrences : 5 critiques, 54 hautes, 103 moyennes, 85 basses, 1 inconnue | Runtime Distroless Debian 13 non-root : 22 occurrences, **aucune haute/critique**, aucune version corrigée annoncée par la base Debian utilisée pour ces résiduels |
| Frontend, paquets Alpine | 0 | 0 |
| Proxy, paquets Alpine | 93 occurrences dans l'ancienne image Alpine 3.23.5 | Runtime partagé neuf Alpine 3.23.6, réduit aux composants nécessaires |
| Binaire Caddy, dans les deux services | 29 occurrences : 17 hautes, 7 moyennes, 4 basses, 1 inconnue | **2 occurrences : une moyenne et un avertissement inconnu**, aucune haute/critique |

Le binaire API déployé ne liait que libc/libm/libgcc selon `ldd`, pas les bibliothèques système SQLite/OpenSSL installées dans son image. La nouvelle image retire les outils inutiles (dont shell/Perl) et fonctionne en UID/GID `65532`, avec répertoires de données dédiés. Cela réduit la surface et les alertes sans prétendre corriger les bibliothèques simplement en cachant les résultats.

La dernière release stable de Caddy consultée est **2.11.4**, mais son binaire officiel embarquait Go **1.26.3** et des dépendances affectées. `deploy/caddy/` contient maintenant un petit point d'entrée utilisant les **modules standard non modifiés** de cette release, un `go.mod`/`go.sum` et les dépendances compatibles corrigées. Il est compilé avec **Go 1.27.1**. Le runtime est partagé par le proxy et le frontend : pas de plugin tiers ajouté ni de fork du code Caddy.

Les images de base sont épinglées par digest. Les deux conteneurs Caddy sont non-root, avec système de fichiers en lecture seule, stockage temporaire isolé, sans interface d'administration ; tous les services perdent les capabilities Linux et utilisent `no-new-privileges`.

Résiduels Caddy :

1. **GHSA-gcjh-h69q-9w9g — cel-go 0.28.1**, moyenne, corrigé en 0.29.0. La mise à jour casse l'API utilisée par Caddy 2.11.4 ; elle n'a pas été forcée. L'avis concerne `NativeTypes`/`ParseStructTag`, non activés dans notre configuration. Suivre une release Caddy compatible et refaire le scan.
2. **GO-2026-5932 — ancien paquet OpenPGP de x/crypto**, avertissement de conception/maintenance, sans correctif global de module. La présence du module `x/crypto` ne démontre pas l'usage du sous-paquet OpenPGP par Float. Aucune fonctionnalité OpenPGP n'est exposée dans cette configuration.

Les 22 avis système résiduels concernent principalement glibc, plus zlib. Ils sont de sévérité moyenne/basse et sans correctif Debian annoncé dans le scan. Aucun chemin exploitable n'a été établi ici ; **cela ne permet pas d'affirmer qu'ils sont tous inexploitables**. Prévoir des rescans réguliers et un renouvellement des digests lorsque des correctifs existent.

## Autres mesures et limites

- Suppression du CORS universel : frontend/API sont same-origin, y compris via le proxy Vite ; les appels serveur-à-serveur MCP ne dépendent pas de CORS.
- CSP limitant scripts/connexions à la même origine, `object-src 'none'`, protection contre l'encapsulation, `nosniff`, politique de référent et HSTS.
- Le port hôte **8888 reste inchangé**. Son exposition aux interfaces du mini PC n'a pas été réduite arbitrairement : les connecteurs Cloudflare observés utilisent des réseaux Docker bridge et le chemin réseau exact doit être vérifié avant de le restreindre. API et frontend ne publient pas de ports hôtes dans le Compose de production.
- Les sauvegardes et la rotation sont réalisées sur le serveur ; aucune nouvelle clé n'est versionnée ou affichée. Avant le passage non-root, les deux volumes de Float doivent être rendus accessibles à l'UID/GID `65532`. Conserver une sauvegarde cohérente de SQLite et un moyen de retour aux anciennes images/configurations.
- La limitation des connexions est en mémoire et par compte, adaptée à cette instance unique ; ce n'est pas une protection DDoS distribuée. Les quotas de stockage, la durée des sessions et la revalidation d'un flux SSE déjà ouvert restent des sujets complémentaires.

## Vérifications reproductibles

Exécuter les commandes frontend depuis `frontend/` et celles du MCP depuis `mcp/`.

```sh
npm audit --package-lock-only --registry=https://registry.npmjs.org
npm run check                    # frontend : lint, tests, TypeScript, build
npm run build                    # MCP
cargo test --workspace --locked
cargo clippy --locked -p float-api --all-targets --no-deps
cargo audit                     # résultat résiduel RSA documenté ci-dessus
cargo tree --locked -p float-api -e normal,build -i rsa
```

Résultats observés avant fusion : **20 tests Rust**, **13 tests frontend**, build MCP et **16 scénarios Playwright desktop/mobile** réussis. Les tests navigateur locaux utilisaient le frontend compilé derrière Caddy avec les nouveaux en-têtes, et un proxy API en lecture seule ; les créations simulées étaient interceptées. Les correctifs d'autorisation ont été vérifiés séparément contre de vraies bases SQLite de test.

Contrôle déployé non destructif : avec les identifiants de test chargés sans les afficher, exécuter `tests/e2e/smoke.spec.ts` et `tests/e2e/security.spec.ts`, avec `FLOAT_E2E_SECURITY_HEADERS=1` et l'URL du site dans `FLOAT_E2E_BASE_URL`. Le second fichier vérifie les en-têtes et le rejet de l'ancienne clé, sans accéder aux données d'un utilisateur fictif ni modifier de tâches.

## Sources primaires

- RustSec et versions corrigées : `https://rustsec.org/advisories/` ; entrées `RUSTSEC-2026-0235`, `RUSTSEC-2023-0071`, `RUSTSEC-2026-0285`, `RUSTSEC-2026-0190`, `RUSTSEC-2026-0221`, `RUSTSEC-2026-0173` dans `https://github.com/RustSec/advisory-db`.
- Fast URI : `https://github.com/fastify/fast-uri/security/advisories/GHSA-v2hh-gcrm-f6hx` ; les autres avis et versions corrigées sont fournis par le rapport npm.
- IP address : `https://github.com/beaugunderson/ip-address/security/advisories/GHSA-mwp4-54f8-5fhr`.
- Hono : `https://github.com/honojs/hono/security/advisories/GHSA-g6gw-c38x-mqfc`.
- Caddy, release et intégration standard : `https://github.com/caddyserver/caddy/releases/tag/v2.11.4` et `https://github.com/caddyserver/caddy/blob/v2.11.4/cmd/caddy/main.go`.
- Go et avis : `https://go.dev/dl/?mode=json`, `https://pkg.go.dev/vuln/`, `https://vuln.go.dev/ID/GO-2026-5932.json`.
- CEL : `https://github.com/google/cel-go/security/advisories/GHSA-gcjh-h69q-9w9g`.
- Images Distroless : `https://github.com/GoogleContainerTools/distroless` ; correctifs système : `https://security-tracker.debian.org/tracker/` et `https://secdb.alpinelinux.org/`.
- Axum, paramètres décodés : `https://docs.rs/axum/0.8.9/axum/extract/struct.Path.html` ; limite multipart : `https://docs.rs/axum/0.8.9/axum/extract/struct.Multipart.html`.
- Tokio, calculs bloquants bornés : `https://docs.rs/tokio/1.52.2/tokio/task/fn.spawn_blocking.html`.

Les versions, fonctionnalités et images doivent être réévaluées à chaque modification de dépendance ou de configuration ; les résultats sont datés, pas une garantie permanente de sécurité.
