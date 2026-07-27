# Architecture du Projet CarburFlow

Ce document décrit l'architecture globale de l'application CarburFlow, en détaillant ses composants principaux : le frontend, le backend, la base de données et les flux de données.

## Vue d'ensemble

CarburFlow est une application web monolithique avec une séparation claire entre le client (frontend) et le serveur (backend).

-   **Frontend** : Une Single-Page Application (SPA) développée en **React**, responsable de toute l'interface utilisateur.
-   **Backend** : Une API RESTful développée avec **Django** et **Django REST Framework**, qui gère la logique métier, l'accès aux données et l'authentification.

---

## 1. Frontend (Client)

Le frontend est situé dans le répertoire `/frontend`.

-   **Technologie** : React 18, initialisé avec Vite.js pour un développement rapide.
-   **Style** : Tailwind CSS est utilisé pour le stylisme des composants, offrant une approche "utility-first" pour un design rapide et cohérent. Les composants de base proviennent de `shadcn/ui`.
-   **Structure des répertoires** :
    -   `src/components/`: Contient les composants React réutilisables (ex: `MetricPanel`, `Topbar`).
    -   `src/pages/`: Chaque fichier correspond à une page principale de l'application (ex: `DashboardPage`, `AuthPage`).
    -   `src/context/`: Gère l'état global, notamment l'authentification de l'utilisateur (`AuthContext.jsx`).
    -   `src/lib/` et `src/utils/`: Fonctions utilitaires, par exemple pour le formatage des données.
-   **Communication API** : Le client communique avec le backend via des requêtes HTTP (fetch) à l'API REST. Les appels sont effectués depuis les pages ou les composants pour récupérer ou modifier des données.
-   **Build** : La commande `npm run build` compile l'application en fichiers statiques (HTML, CSS, JS) qui peuvent être servis par n'importe quel serveur web.

## 2. Backend (Serveur)

Le backend est un projet Django standard.

-   **Technologie** : Django 5, avec Django REST Framework (DRF) pour la création de l'API.
-   **Applications Django** :
    -   `backend/`: Le projet Django principal, qui contient la configuration globale (`settings.py`, `urls.py`).
    -   `dashboard/`: Le cœur de l'application. Elle définit les modèles de données, les points de terminaison de l'API (vues), les sérialiseurs (transformation des données) et la logique métier.
-   **API RESTful** :
    -   L'API expose des points de terminaison pour les opérations CRUD (Create, Read, Update, Delete) sur les ressources principales (Cuves, Groupes, Rapports, etc.).
    -   Elle fournit également des points de terminaison spécifiques (`/dashboard/...`) pour des données agrégées et calculées, optimisées pour les besoins du frontend.
    -   La documentation de l'API est auto-générée par `drf-spectacular` et accessible via `/api/v1/docs/`.
-   **Scripts de gestion** :
    -   Le répertoire `dashboard/management/commands/` contient des scripts CLI personnalisés (ex: `seed_accounts`, `import_rapport_lignes`). Ces scripts sont utiles pour l'initialisation de la base de données, l'import de données en masse à partir de fichiers CSV, etc.

## 3. Base de données et Données

-   **Base de données** : Par défaut, le projet est configuré pour utiliser **SQLite**, ce qui est idéal pour le développement local. Pour la production, cela peut être facilement remplacé par une base de données plus robuste comme PostgreSQL dans le fichier `backend/settings.py`.
-   **Modèles** : Les modèles de données principaux (`Rapport`, `LigneRapport`, `CuvePrincipale`, `GroupeElectrogene`, etc.) sont définis dans `dashboard/models.py`. Ils représentent la structure des tables de la base de données.
-   **Données initiales** : Le répertoire `/data` contient des fichiers CSV d'exemple qui peuvent être utilisés avec les scripts de gestion pour peupler la base de données.

## 4. Flux de Données

### Flux 1 : Interaction Utilisateur

1.  L'utilisateur ouvre l'application dans son navigateur. Le serveur web sert l'application React (SPA).
2.  L'utilisateur s'authentifie via la `AuthPage` du frontend.
3.  Le frontend envoie les identifiants à `POST /api/v1/auth/login`.
4.  Le backend valide les informations et renvoie un jeton d'authentification.
5.  Le frontend stocke ce jeton (`AuthContext`) et l'utilise pour toutes les requêtes API futures dans l'en-tête `Authorization`.
6.  En naviguant, le frontend demande les données nécessaires aux points de terminaison du backend (ex: `GET /api/v1/dashboard/overview`) et affiche les informations reçues.

### Flux 2 : Import de Données (via l'interface)

1.  Un utilisateur authentifié (souvent un administrateur) accède à la page d'import de rapports.
2.  Il sélectionne un fichier (`.xlsx` ou `.csv`) et le soumet.
3.  Le frontend envoie le fichier au point de terminaison `POST /api/v1/rapports/upload`.
4.  Le backend traite le fichier, valide les données ligne par ligne, et crée les entrées correspondantes dans la base de données (`Rapport`, `LigneRapport`, etc.).
5.  Le backend renvoie un résumé de l'opération, que le frontend affiche à l'utilisateur.
