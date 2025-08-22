# Suivi Contrats – Sécurité Humaine (Static App)

Application **100% statique** (HTML/CSS/JS) – prête pour **GitHub Pages**.
- Données en **localStorage** (aucun serveur requis).
- **Pénalités intégrées** : montant fixe, % du tarif mensuel, par unité (ex. 30 min), paliers gradués, avec **plafonds** (% CA ou MAD).
- **Clauses** multiples par contrat (obligations de moyens, de résultat, mixte…).
- **SLA/KPI** liés aux déclencheurs de pénalités.

## Déploiement GitHub Pages
1. Créez un dépôt (ex. `suivi-contrats-securite`).
2. Uploadez ces fichiers : `index.html`, `styles.css`, `app.js`, `README_GitHub_Pages.txt`.
3. `Settings` → `Pages` → *Deploy from a branch* → `main` + dossier `/ (root)`.
4. Ouvrez l’URL fournie par GitHub Pages.

## Utilisation
- Onglet **Contrats** : ajoutez vos contrats (tarif, dates, préavis). Alerte **J-90** automatique.
- Onglet **Clauses** : rattachez plusieurs clauses par contrat (catégorie, code, variante, statut).
- Onglet **SLA/KPI** : définissez cibles et résultats (ex. taux de présence, délai de remplacement).
- Onglet **Pénalités** : créez des règles avec déclencheurs et plafonds ; le moteur calcule la **pénalité estimée** du mois courant.
- **Import/Export** JSON pour sauvegarder/partager la base.

## Types de pénalités pris en charge
- `Montant fixe` → ex. 5 000 MAD en cas de manquement grave.
- `% du tarif mensuel` → ex. 0,5 % si KPI < 99,5 % (avec plafond 10 % du CA mensuel).
- `Par unité` → ex. 500 MAD par tranche de 30 minutes au-delà de 120 minutes.
- `Graduée (paliers)` → ex. <95 % = 0,3 % ; <90 % = 0,6 % (appliqué au CA mensuel).
- **Plafonds** combinables (MAD et/ou % du tarif).

> Astuce : alignez vos règles sur vos clauses **Obligation de moyens / résultat / mixte** et associez des **SLA** mesurables.
