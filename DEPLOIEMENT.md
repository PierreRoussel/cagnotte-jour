# Déployer Cagnotte Jour (gratuit) + Nhost

## 1. Backend Nhost (gratuit)

1. Crée un projet sur [nhost.io](https://nhost.io) (offre gratuite : Postgres, Auth, GraphQL).
2. Note **Subdomain** et **Region** (souvent `eu-central-1`) dans *Project Settings*.
3. Récupère le **Hasura Admin Secret** (Nhost → ton projet → *Hasura* / *Settings*).
4. Applique migration + permissions Hasura en une commande :

```bash
NHOST_ADMIN_SECRET=ton-secret npm run nhost:apply
```

Sous PowerShell :

```powershell
$env:NHOST_ADMIN_SECRET="ton-secret"; npm run nhost:apply
```

Le script exécute `nhost/migrations/.../up.sql`, tracke `budget_profiles` et crée les permissions rôle `user`. Les fichiers dans `nhost/metadata/` servent aux déploiements Git Nhost (`nhost deployments new`).

5. **Auth** : active *Email + password*. Pour tester sans mail, désactive temporairement *Require email verification* dans Nhost → Authentication → Settings.

> Le CLI Nhost ne tourne pas nativement sous Windows ; `npm run nhost:apply` remplace le SQL editor.

## 2. Variables d’environnement

Copie `.env.example` vers `.env.local` :

```env
VITE_NHOST_SUBDOMAIN=abcdefgh
VITE_NHOST_REGION=eu-central-1
```

Sans ces variables, l’app reste 100 % localStorage (mode offline).

## 3. Hébergement frontend (gratuit)

### Option A — Netlify (recommandé)

1. Pousse le repo sur GitHub / GitLab.
2. [app.netlify.com](https://app.netlify.com) → **Add site** → importe le repo.
3. Build : `npm run build`, publish : `dist` (déjà dans `netlify.toml`).
4. **Pas de variables Netlify « secret »** pour `VITE_NHOST_*` : le secret scrubbing masquait le subdomain dans le JS et provoquait une fausse erreur CORS. La config publique est dans `src/lib/nhostConfig.ts`.
5. Redéploie → URL du type `https://ton-site.netlify.app`.
6. Dans Nhost → Authentication → URL Configuration, ajoute l’URL Netlify.

### Option B — Cloudflare Pages

1. **Workers & Pages** → Create → Connect Git.
2. Build command : `npm run build`, output : `dist`.
3. Variables d’environnement identiques (préfixe `VITE_` obligatoire pour Vite).
4. Le fichier `public/_redirects` gère le routing SPA.

## 4. Utilisation quotidienne

1. Ouvre l’URL déployée sur ton téléphone / PC.
2. **Connexion** → crée un compte (email + mot de passe).
3. Tes données locales existantes sont envoyées au cloud au premier login.
4. Chaque modification est synchronisée (debounce ~700 ms) + cache localStorage.

## 5. Auth : URL de production

Dans Nhost → **Authentication → URL Configuration**, ajoute l’URL Netlify / Cloudflare dans les **Site URL** et **Redirect URLs** autorisées.
