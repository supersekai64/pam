# TODO - Revue complete PAMH

Date de revue: 2026-06-16

Objectif: rapprocher PAMH de sa promesse produit - une memoire IA locale, portable, fiable, inspectable, et utile des la premiere installation.

Validations executees pendant la revue:

- `pnpm test`: OK, 27 fichiers de tests, 152 tests.
- `pnpm lint`: OK.
- `pnpm build`: OK, avec alerte Vite sur un chunk UI de 945.86 kB minifie.
- `pnpm format:check`: OK.
- `pnpm test:coverage`: OK, couverture core globale 87.45% statements, 80.88% branches.

Etat apres traitement du 2026-06-16:

- Validations finales: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`.
- Resultat final: 30 fichiers de tests, 178 tests; couverture core 87.57% statements, 80.96% branches.
- Smoke CLI manuel: `memory init`, `memory smoke-test agent`, `memory review`, `memory status --verbose`, `memory doctor integrations` dans des dossiers temporaires.
- Les items coches sont implementes. Les items non coches restent volontairement visibles car ils demandent un chantier produit/UI plus large que le durcissement effectue ici.

Constat global:

- La base technique est saine: TypeScript strict, separation core/CLI/API/UI, tests core nombreux, stockage Markdown lisible, index SQLite reconstructible.
- Les risques principaux ne sont pas du lint: ils touchent la confiance utilisateur, les integrations agent, les chemins destructeurs, la fraicheur de l'index, et l'ecart entre "PAMH resout ma memoire IA" et "mon agent doit bien penser a appeler les outils".

## Technique

### P0 - Bloquants ou risques forts

- [x] SEC-01 - Bloquer le path traversal dans les imports.
  - Constat: `packages/core/src/import.ts` garde les IDs importes tels quels (`id: item.metadata?.id`) puis ecrit `join(dirPath, `${memory.metadata.id}.md`)`. Reproduction confirmee: un ID JSON `../../outside_pamh_escape` ecrit hors du sous-dossier attendu.
  - Impact: un backup ZIP/JSON/Markdown malveillant ou corrompu peut ecrire en dehors de `.ai-memory`, ecraser des fichiers voisins, ou polluer le projet.
  - A faire: ajouter une validation unique d'ID fichier (`/^mem_[A-Za-z0-9_-]+$/` ou equivalent), l'utiliser dans import/export/find/write, refuser ou regenerer les IDs invalides, et empecher les collisions.
  - Tests: importer JSON/ZIP/Markdown avec `../`, `..\\`, `/`, `\\`, IDs vides, IDs dupliques, IDs tres longs.

- [x] SEC-02 - Ne jamais tuer un process non-PAMH dans `memory ui`.
  - Constat: `packages/cli/src/commands/ui.ts` considere tout listener HTTP sur le port comme une UI PAMH possible, POST `/api/shutdown`, puis appelle `killProcessOnPort` si le port reste occupe.
  - Impact: lancer `memory ui` sur un port occupe peut arreter un autre serveur local de l'utilisateur.
  - A faire: verifier `/api/health` avec signature PAMH et chemin de projet attendu avant shutdown; supprimer le fallback `kill -9`/`Stop-Process` non authentifie; sinon afficher "port occupe" et proposer `--port`.
  - Tests: port occupe par un serveur non-PAMH, port occupe par PAMH, port occupe par process qui ne repond pas.

- [x] SEC-03 - Retirer le reset debug de l'UI de production.
  - Constat: `packages/ui/src/components/sidebar.tsx` expose "Reset project memory" marque DEBUG, branche sur `POST /api/debug/reset`, qui supprime tout `.ai-memory`.
  - Impact: un utilisateur final peut detruire toute la memoire projet depuis l'ecran principal.
  - A faire: masquer derriere flag dev explicite, ou remplacer par export + confirmation forte avec saisie du chemin complet; ne jamais l'afficher par defaut.
  - Tests: build production sans bouton reset; endpoint desactive hors mode debug.

- [x] SEC-04 - Ajouter une protection locale API pour les actions mutantes.
  - Constat: `pamh-api` expose sur localhost des endpoints POST/PATCH/DELETE sans token de session, dont `/api/shutdown`, `/api/debug/reset`, creation, suppression physique, recommendations.
  - Impact: un site web ou process local peut au minimum tenter un DoS sur l'UI, et les protections actuelles reposent surtout sur localhost/CORS.
  - A faire: generer un token local par instance, le servir dans la page statique, exiger header CSRF/API token pour endpoints mutables, verifier `Origin`, et limiter `/api/shutdown` a l'instance lancee.
  - Tests: requete mutante sans token refusee; UI officielle autorisee.

- [x] MCP-01 - Consolider les deux implementations MCP.
  - Constat: `memory server start` utilise `packages/cli/src/mcp/*`; `packages/mcp/src/*` expose des instructions serveur et des outils d'intelligence en plus. `docs/mcp.md` documente `recommend_memory_maintenance`, `preview_memory_distillation`, `preview_knowledge_graph`, `apply_memory_recommendation`, absents du serveur CLI.
  - Impact: les agents peuvent ne pas voir les outils promis; la doc, les tests et le package `pamh-protocol` peuvent diverger de la CLI publiee.
  - A faire: faire de `packages/mcp` la source unique, ou faire importer la CLI depuis ce package; ajouter un test de contrat qui lance le serveur CLI et verifie la liste d'outils documentee.
  - Tests: snapshot de tool list MCP pour `memory server start`.

- [x] INT-01 - Migrer les fichiers d'integration obsoletes committes.
  - Constat: `.claude/settings.json` et `.codex/hooks.json` appellent `memory hook record ... --project`, qui echoue avec `unknown option '--project'`. `.cursor/rules/pamh.mdc` et `.github/copilot-instructions.md` mentionnent aussi `memory search --project`, `memory add --project`, `memory checkpoint --project`, et un scope `global` qui n'existe plus.
  - Impact: un utilisateur qui copie ces fichiers ou utilise ce repo comme exemple obtient une integration agent cassee.
  - A faire: regenerer les fichiers depuis `configureProjectIntegrations`, supprimer toute reference a `--project` et `global`, puis ajouter un test fixture qui valide que les commandes generees existent vraiment.
  - Tests: executer les commandes hook generees avec `--help`/dry run; rechercher `--project` dans les integrations generees.

- [x] IDX-01 - Harmoniser la reconstruction d'index.
  - Constat: le MCP appelle `indexAllMemories` avant `search_memory`, l'API reconstruit si l'index est vide, mais `memory search` ouvre directement `MemoryIndex`. Apres clone/git pull d'un `.ai-memory` sans `memory.db`, la CLI peut retourner zero resultat.
  - Impact: le premier test utilisateur "memory search ..." peut donner l'impression que PAMH ne marche pas.
  - A faire: auto-reindexer sur index vide ou incoherent, ou faire de `memory search` un wrapper qui appelle `checkIndexConsistency`; afficher une correction automatique.
  - Tests: creer une memoire Markdown sans SQLite, puis verifier que `memory search` la trouve.

### P1 - Fiabilite, coherence, maintenabilite

- [x] CTX-01 - Unifier la composition de contexte core/API/UI.
  - Constat: `packages/core/src/context.ts` et `packages/api/src/server.ts` ont deux politiques de contexte differentes. L'API a exclusion reasons, sessions limitees, penalties, concepts; core compile surtout par type/recence.
  - Impact: l'agent via MCP/CLI et l'utilisateur via UI peuvent voir deux "verites" differentes de ce que le LLM lirait.
  - A faire: extraire un moteur de contexte unique dans `pamh-core`, utilise par CLI, MCP et API.
  - Tests: meme store, meme query, meme sources entre `memory context`, `compile_context` et `/api/context-preview`.

- [x] CTX-02 - Compter les tokens sur le contexte formate, pas seulement sur `memory.content`.
  - Constat: `compileContext` limite selon le contenu brut, puis ajoute titres/metadonnees/separateurs ensuite.
  - Impact: le contexte final peut depasser la limite annoncee.
  - A faire: calculer le budget sur les blocs formates, ou reserver un overhead par memoire.
  - Tests: memoires nombreuses avec tags longs; verifier que le texte final reste sous budget estime.

- [x] CTX-03 - Dedoublonner les resultats projet/recherche.
  - Constat: `compileContext` peut inclure la meme memoire dans `sources.project` et `sources.search`.
  - Impact: gaspillage de contexte, signal repete.
  - A faire: dedupe par ID avant rendu.
  - Tests: memoire active qui matche query incluse une seule fois.

- [x] STO-01 - Deplacer le fichier quand le type d'une memoire change.
  - Constat: `updateMemory` modifie `metadata.type` mais laisse le fichier dans l'ancien sous-dossier.
  - Impact: stockage Markdown incoherent, backups et revues manuelles moins fiables.
  - A faire: si `type` change, reecrire dans le sous-dossier cible et supprimer l'ancien fichier, avec rollback en cas d'echec.
  - Tests: `knowledge -> decision`, puis `findMemoryFile`, `listMemories`, export ZIP.

- [x] STO-02 - Rendre les erreurs de parsing visibles.
  - Constat: `listMemories` et `indexAllMemories` ignorent silencieusement les fichiers Markdown invalides.
  - Impact: perte de memoire invisible apres edition manuelle ou merge Git.
  - A faire: collecter warnings dans `doctor check`, journaliser les fichiers invalides, option `--strict`.
  - Tests: Markdown invalide, frontmatter invalide, ID manquant.

- [x] IMP-01 - Gerer les collisions d'import.
  - Etat 2026-06-16: le defaut est non destructif (`skip`) avec modes explicites `replace`, `rename` et `supersede`. `supersede` archive l'ancienne memoire, cree une nouvelle memoire active, et conserve la chaine d'historique.
  - Constat: importer une memoire avec un ID existant remplace le fichier et l'index.
  - Impact: un backup peut ecraser une memoire locale sans avertissement.
  - A faire: modes `skip`, `replace`, `rename`, `supersede`; mode par defaut non destructif.
  - Tests: import meme ID avec contenu different.

- [x] HOOK-01 - Appliquer redaction et retention aux observations de hooks.
  - Constat: `recordHookEvent` ecrit tout `event.data` dans `.ai-memory/observations/*.jsonl`, y compris `data.text`, `prompt`, `transcript`.
  - Impact: meme si la memoire durable ne contient pas les prompts bruts, les transcripts peuvent rester sur disque avec secrets.
  - A faire: redacter avant ecriture, configurer retention, permettre `--no-prompt-storage`, clarifier dans docs.
  - Tests: prompt avec token/API key; observation redigee.

- [x] SEM-01 - Corriger `memory semantic-search`.
  - Constat: `memory search --semantic` indexe les memoires actives avant recherche; `memory semantic-search <query>` interroge l'index vectoriel sans l'alimenter.
  - Impact: commande semantique dediee peut retourner vide sur une installation fraiche.
  - A faire: soit supprimer l'alias, soit le faire passer par le meme chemin que `search --semantic`.
  - Tests: nouvelle memoire active puis `semantic-search` la retrouve avec provider mock.

- [x] API-01 - Valider les payloads API avec schemas stricts.
  - Constat: l'API caste directement `readJson` vers `CreateMemoryInput`, `UpdateMemoryInput`, proposal de distillation, etc.
  - Impact: erreurs 500, mutations invalides, surface locale plus fragile.
  - A faire: utiliser Zod ou validateurs core partages; retourner 400 detaille.
  - Tests: type invalide, status invalide, tags non-tableau, proposal incomplet.

- [x] REL-01 - Supprimer ou restaurer le script racine casse `seed:neural-map`.
  - Constat: `package.json` reference `scripts/seed-neural-map.mjs`, absent du repo.
  - Impact: script npm mort, confusion release/dev.
  - A faire: supprimer le script ou ajouter le fichier avec tests/docs.

- [x] REL-02 - Revoir les dependances workspace/publish.
  - Constat: les packages internes utilisent des plages publiees (`pamh-core: ^0.1.6`, etc.) plutot que `workspace:*`.
  - Impact: risque de build local qui passe avec symlink mais publication/installation qui resout une version differente si les ranges ne sont pas bumpes ensemble.
  - A faire: evaluer `workspace:^` ou checks de version internes avant release.
  - Tests: `npm pack --dry-run` et installation dans projet temporaire pour le set complet.

- [x] UI-01 - Decouper le bundle UI.
  - Constat: Vite signale `assets/index-*.js` a 945.86 kB minifie.
  - Impact: demarrage UI plus lent, surtout parce que Three.js est charge meme hors carte.
  - A faire: dynamic import pour la carte 3D/Three.js et panneaux lourds; manual chunks.
  - Tests: build sans warning ou seuil justifie; smoke test UI.

- [x] TEST-01 - Etendre la couverture hors core.
  - Etat 2026-06-16: tests ajoutes sur API, MCP, CLI, integrations, hooks, imports, stockage et restauration; build UI typechecke. Playwright n'a pas ete introduit car le projet n'a pas encore de stack navigateur E2E.
  - Constat: `vitest.config.ts` seuil de couverture limite a `packages/core/src/**/*.ts`; UI non testee, CLI/API/MCP seulement par tests ponctuels.
  - Impact: les bugs d'integration utilisateur passent facilement.
  - A faire: seuils separes pour CLI/API/MCP, tests Playwright pour UI, tests de packaging global/local.
  - Tests prioritaires: first install, `memory init`, MCP tool list, UI approve/reject/delete, port occupe, import securise.

### P2 - Nettoyage et qualite

- [x] DX-01 - Reduire les duplications de types UI.
  - Etat 2026-06-16: les pages UI concernees importent les types partages depuis `@/types`; les duplications locales `StatsResponse`, `ContextPreview`, `Memory`, `SearchResult` et `ApiConceptNode` ont ete retirees.
  - Constat: `packages/ui/src/main.tsx` redefinit de nombreux types deja dans `packages/ui/src/types.ts`.
  - Impact: drift possible entre pages et conteneur principal.
  - A faire: importer depuis `@/types` partout.

- [ ] DX-02 - Extraire les panneaux UI de `main.tsx`.
  - Etat 2026-06-16: partiel. Le client HTTP local a ete extrait dans `packages/ui/src/lib/api.ts`; les grands panneaux `MemoryModal`, `GovernancePanel`, `KnowledgeGraphPanel` et `MemoryGraphView` restent dans `main.tsx`.
  - Constat: `main.tsx` porte routing, API client, modals, graph Three.js, governance, knowledge graph et helpers.
  - Impact: maintenance difficile et tests unitaires compliques.
  - A faire: extraire `api.ts`, `MemoryModal`, `GovernancePanel`, `KnowledgeGraphPanel`, `MemoryGraphView`.

- [x] DX-03 - Ajouter un mode non interactif plus complet pour les commandes dangereuses.
  - Constat: suppression physique CLI/API/UI accessible avec peu de garde-fous.
  - Impact: automation risquee.
  - A faire: flags `--yes`, confirmations par ID, dry-run, audit log visible.

## Fonctionnel

### P0 - Ce qui empeche la promesse "ma memoire IA est resolue"

- [x] FUN-01 - Creer un vrai parcours "first run success".
  - Probleme utilisateur: apres `npm install -g pamh-cli` puis `memory init`, l'utilisateur ne sait pas si son agent voit vraiment PAMH.
  - A faire: ajouter `memory doctor integrations` qui verifie CLI, `.ai-memory`, MCP config par client, commandes hook, tool list, reload necessaire, et propose les commandes exactes a executer.
  - Definition of done: un nouvel utilisateur peut obtenir un resultat vert/rouge clair en moins d'une minute.

- [x] FUN-02 - Ajouter une preuve de capture en bout en bout.
  - Probleme utilisateur: il attend que l'agent "se souvienne"; aujourd'hui il doit croire que les instructions seront suivies.
  - A faire: commande `memory smoke-test agent` ou flux UI "Test memory capture" qui demande a l'agent de proposer une memoire, puis verifie qu'elle apparait en `proposed`.
  - Definition of done: apres installation, l'utilisateur voit une memoire proposee de test, peut l'approuver, puis la retrouver via recherche et contexte.

- [x] FUN-03 - Clarifier le modele: PAMH orchestre, l'agent capture.
  - Probleme utilisateur: "automatique" peut etre compris comme "PAMH lit toutes mes conversations et decide seul"; en realite la capture durable depend surtout des appels MCP ou checkpoints de l'agent.
  - A faire: dans README/UI/docs, reformuler la promesse: "PAMH donne une memoire partagee et controlee; vos agents doivent appeler les outils ou hooks". Ajouter tableau par client: automatique, assiste, manuel, limites.
  - Definition of done: aucune ambiguite entre stockage, observations, propositions, memoires actives.

- [x] FUN-04 - Rendre les memoires proposees immanquables.
  - Probleme utilisateur: la memoire n'est utile qu'apres approbation; si les propositions restent cachees, PAMH semble ne rien faire.
  - A faire: apres `memory init` et `memory ui`, afficher une file "Review proposed memories" prioritaire, notifications CLI, commande `memory review`.
  - Definition of done: l'utilisateur voit toujours combien de propositions attendent et comment les traiter.

- [x] FUN-05 - Garantir que les integrations generees marchent vraiment.
  - Probleme utilisateur: les fichiers actuels peuvent contenir des flags obsoletes; l'agent ne capture rien.
  - A faire: tests d'installation pour Claude, Codex, Cursor, VS Code/Copilot, OpenCode; chaque config generee doit etre validee contre la CLI courante.
  - Definition of done: `memory init` produit uniquement des commandes executables par la version installee.

### P1 - Qualite memoire et confiance

- [x] FUN-06 - Ajouter un indicateur "ce que le LLM lira vraiment" dans toutes les surfaces.
  - Probleme utilisateur: UI et CLI/MCP peuvent composer des contextes differents.
  - A faire: une seule politique de contexte, visible dans UI, CLI, MCP; bouton copier; raisons d'exclusion coherentes.
  - Definition of done: un ID inclus/exclu a la meme raison partout.

- [x] FUN-07 - Ameliorer la recherche pour les questions naturelles.
  - Etat 2026-06-16: recherche exacte d'abord, puis fallback naturel partage (synonymes/tags) si aucun resultat exact. CLI annonce le fallback; MCP et API locale reutilisent le vocabulaire core.
  - Probleme utilisateur: si "database choice" ne retrouve pas "Use PostgreSQL", il conclut que la memoire est mauvaise.
  - A faire: recherche hybride par defaut ou fallback lexical + tags + synonymes; semantic search optionnelle mieux integree; message clair si embeddings manquants.
  - Definition of done: recherches paraphrasees retrouvent les decisions importantes sans configuration complexe.

- [x] FUN-08 - Ajouter un profil "memoire personnelle / globale" ou assumer explicitement le project-only.
  - Probleme utilisateur: "mon probleme de memoire IA" inclut souvent preferences personnelles cross-projets. PAMH est actuellement project-only.
  - A faire: soit ajouter un store utilisateur/global optionnel, soit rendre le partage via parent `.ai-memory` beaucoup plus visible et guide.
  - Definition of done: l'utilisateur sait ou mettre ses preferences cross-projets et comment ses agents les liront.

- [x] FUN-09 - Rendre la confidentialite lisible.
  - Probleme utilisateur: PAMH promet local et controle utilisateur, mais les observations de hook peuvent contenir prompts bruts.
  - A faire: ecran/docs "What PAMH stores": durable memories, observations, debug logs, SQLite index; retention; redaction; export warning.
  - Definition of done: aucune donnee surprise dans `.ai-memory`.

- [x] FUN-10 - Ajouter des sauvegardes/restauration avant actions destructrices.
  - Etat 2026-06-16: suppression physique sauvegardee automatiquement dans `.ai-memory/backups/*.bak`; `memory restore <id>` restaure la derniere sauvegarde si le Markdown original a ete retire.
  - Probleme utilisateur: supprimer physiquement ou reset une memoire contredit la promesse de durabilite.
  - A faire: export auto avant reset, corbeille/restauration UI, confirmations par saisie d'ID, undo temporaire.
  - Definition of done: une erreur de clic n'efface pas une memoire durable sans chemin de retour.

- [x] FUN-11 - Ajouter un onboarding UI pour store vide.
  - Etat 2026-06-16: dashboard vide ajoute avec chemin `doctor integrations`, `smoke-test agent`, `review`, puis preview du contexte.
  - Probleme utilisateur: la console vide montre des graphes/concepts absents mais pas un chemin clair.
  - A faire: empty state avec "1. Connect agent", "2. Create/test memory", "3. Approve proposal", "4. Ask agent to recall".
  - Definition of done: une premiere session sans memoires guide vers une capture reussie.

- [x] FUN-12 - Rendre la maintenance intelligence plus explicable.
  - Etat 2026-06-16: cartes de recommandations enrichies avec regle deterministe, score, preuves et preview avant/apres; docs intelligence mises a jour.
  - Probleme utilisateur: recommandations/distillation deterministic peuvent sembler "IA magique" ou arbitraires.
  - A faire: afficher score, regle appliquee, evidence, et preview avant/apres; ne pas archiver des sources sans explication forte.
  - Definition of done: accepter une recommandation ne surprend jamais l'utilisateur.

### P2 - Finition produit

- [x] FUN-13 - Ajouter un rapport `memory status --verbose`.
  - Contenu attendu: chemin store, mode capture, index status, MCP config detectee, dernier checkpoint, propositions ouvertes, hooks actifs, UI port.

- [x] FUN-14 - Ajouter des exemples par role.
  - Etat 2026-06-16: `docs/examples.md` ajoute pour developpeur solo, equipe, Codex, Claude Code et utilisateur manual-only.
  - Exemples: developpeur solo, equipe qui commit `.ai-memory`, agent Codex, Claude Code avec hooks, utilisateur sensible qui veut manual-only.

- [x] FUN-15 - Aligner le vocabulaire.
  - Etat 2026-06-16: `docs/glossary.md` ajoute et relie depuis le README.
  - Aujourd'hui: memory, observation, recommendation, distillation, knowledge graph, context preview, neural/concepts map.
  - A faire: glossaire court et coherent; eviter que l'utilisateur confonde "proposed recommendation" et "proposed memory".

- [x] FUN-16 - Documenter les limites actuelles sans affaiblir la promesse.
  - A couvrir: pas de store global par defaut, pas de comprehension automatique de toutes conversations, semantic search optionnel, hooks dependants du client, local API non destinee a exposition reseau.
