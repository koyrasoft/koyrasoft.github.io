# Koyrasoft

Site web officiel de **Koyrasoft** — développement web, mobile et logiciels sur mesure.

- **Live** : [koyrasoft.github.io](https://koyrasoft.github.io) · [koyrasoft.net](https://koyrasoft.net)
- **Stack** : HTML, CSS, JavaScript, JSON

## Structure

```
├── index.html          # Page principale
├── admin.html          # Portail admin (lien vers Google Apps Script)
├── css/styles.css      # Styles
├── js/main.js          # Logique (i18n, formulaire, rendu)
├── data/site.json      # Contenu FR/EN
├── data/site-data.js   # Fallback hors serveur
├── images/             # Captures projets
├── logos/              # Logos Koyrasoft
└── google-apps-script/ # Analytics, admin (Admin.html + analytics.gs)
```

## Admin & statistiques

Tableau de bord privé hébergé sur **Google Apps Script** (pas de page sur le site) :

```
{analytics.scriptUrl}?action=admin
```

Fichier unique à déployer sur [script.google.com](https://script.google.com) : `analytics.gs`.

## Développement local

```bash
python3 -m http.server 8090
```

Ouvrir [http://localhost:8090](http://localhost:8090)

## Formulaire de contact

Le formulaire utilise **Google Apps Script** (`contact.formScriptUrl` dans `data/site.json`).
