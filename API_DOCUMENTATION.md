# Documentation de l'API CarburFlow

Cette documentation donne une vue d'ensemble de l'API backend du projet CarburFlow.

**Bonne nouvelle :** Le projet intègre `drf-spectacular`, ce qui signifie qu'une documentation détaillée et interactive de l'API est déjà disponible !

## Accéder à la Documentation Interactive (Swagger UI)

La manière la plus simple d'explorer l'API est d'utiliser l'interface Swagger UI, qui est auto-générée. Une fois le serveur backend démarré, vous pouvez y accéder à l'adresse suivante :

- **[http://localhost:8001/api/v1/docs/](http://localhost:8001/api/v1/docs/)**

Cette interface vous permet de :
- Voir tous les points de terminaison (endpoints) disponibles.
- Connaître les méthodes HTTP acceptées (GET, POST, PUT, DELETE, etc.).
- Inspecter les structures des requêtes et des réponses (schémas de données).
- **Tester directement les points de terminaison** depuis votre navigateur.

Une alternative est également disponible avec ReDoc :
- **[http://localhost:8001/api/v1/redoc/](http://localhost:8001/api/v1/redoc/)**

---

## Principes de base de l'API

### Préfixe de l'API
Tous les points de terminaison de l'API sont préfixés par `/api/v1/`.

### Authentification
L'API utilise une authentification par jeton (token). Pour accéder aux points de terminaison protégés, vous devez d'abord vous authentifier.

1.  **Récupérer un jeton** : Envoyez une requête `POST` au point de terminaison `/api/v1/auth/login` avec votre `username` et `password`.
    ```json
    {
      "username": "admin",
      "password": "admin123"
    }
    ```
    La réponse inclura un jeton (`token`).

2.  **Utiliser le jeton** : Pour les requêtes suivantes, vous devez inclure ce jeton dans l'en-tête `Authorization`.
    ```
    Authorization: Token <votre_jeton_ici>
    ```
    Dans Swagger UI, vous pouvez utiliser le bouton "Authorize" en haut à droite pour définir le jeton pour tous vos tests.

---

## Vue d'ensemble des points de terminaison

Voici un aperçu des principaux groupes de points de terminaison disponibles. Pour les détails de chaque route, veuillez vous référer à la [Swagger UI](http://localhost:8001/api/v1/docs/).

### 1. Authentification (`/auth/...`)
- `POST /auth/register`: Inscription d'un nouvel utilisateur.
- `POST /auth/login`: Connexion et récupération d'un jeton.
- `POST /auth/logout`: Déconnexion.
- `GET /auth/me`: Récupération des informations de l'utilisateur connecté.

### 2. Ressources Standard (CRUD)
Ces points de terminaison suivent les conventions REST pour la création, la lecture, la mise à jour et la suppression des objets de la base de données.
- `/cuves_principales/`
- `/cuves_journaliere/`
- `/groupes/`
- `/rapports/`
- `/lignes_rapport/`

### 3. Gestion des Rapports (`/rapports/...`)
Ce groupe contient la logique métier pour l'import et l'export des rapports.
- `POST /rapports/upload`: Pour téléverser un nouveau rapport (format `.xlsx` ou `.csv`).
- `GET /rapports/mes`: Liste les rapports visibles par l'utilisateur.
- `GET /rapports/soumissions`: Historique des soumissions.
- `GET /rapports/<id>/export.<format>`: Exporte un rapport spécifique.
- `DELETE /rapports/<id>/delete`: Supprime un rapport (réservé aux administrateurs).

### 4. Données de Dashboard (`/dashboard/...`)
Ces points de terminaison fournissent des données agrégées et calculées, spécifiquement pour les pages du tableau de bord.
- `GET /dashboard/overview`: Données clés pour la page d'accueil (KPIs, alertes).
- `GET /dashboard/sites`: Données consolidées pour la page "Sites".
- `GET /dashboard/groupes`: Données pour la page "Groupes Électrogènes".
- `GET /dashboard/cuves`: Données pour la page "Cuves".
