# CarburFlow

CarburFlow est une application web full-stack conçue pour le suivi et la gestion de la consommation de carburant. Elle dispose d'un backend en Django pour la gestion des données et d'une interface utilisateur réactive en React.

## Technologies utilisées

- **Backend**:
  - Python
  - Django & Django REST Framework
- **Frontend**:
  - React (avec Vite)
  - Tailwind CSS
- **Base de données**:
  - SQLite (par défaut avec Django)

---

## Prérequis

Avant de commencer, assurez-vous d'avoir les outils suivants installés sur votre machine :
- [Python 3.8+](https://www.python.org/downloads/)
- [Node.js >= 18](https://nodejs.org/) (et npm)

---

## Installation et Lancement

Suivez ces étapes pour configurer et lancer l'environnement de développement local.

### 1. Cloner le dépôt

```bash
git clone <URL_DU_DEPOT>
cd carburflow
```

### 2. Configuration du Backend

Le backend est géré avec Python et Django.

```bash
# 1. (Optionnel mais recommandé) Créez et activez un environnement virtuel
python -m venv .venv
source .venv/bin/activate  # Sur Windows, utilisez: .venv\Scripts\activate

# 2. Installez les dépendances Python
pip install -r requirements.txt

# 3. Lancez le serveur backend
# Ce script appliquera les migrations, créera des comptes de démo
# et lancera le serveur sur http://localhost:8001
./scripts/start-api.sh
```
L'API devrait maintenant être accessible à l'adresse `http://localhost:8001`.

### 3. Configuration du Frontend

Le frontend est une application React construite avec Vite.

```bash
# 1. Accédez au répertoire du frontend
cd frontend

# 2. Installez les dépendances Node.js
npm install

# 3. Lancez le serveur de développement du frontend
# Le script lancera le serveur sur http://localhost:5174
cd .. # Retourner à la racine pour utiliser le script
./scripts/start-frontend.sh
```
L'application web devrait maintenant être accessible à l'adresse `http://localhost:5174`.

---

## Lancement rapide

Pour lancer l'ensemble de l'application (backend + frontend) en une seule commande, utilisez :

```bash
./scripts/start-dev.sh
```
Cela lancera les deux services en parallèle. L'application sera accessible sur `http://localhost:5174`.

---

## Scripts détaillés

Si vous préférez lancer chaque service séparément :

-   `scripts/start-api.sh`: Démarre le serveur API Django sur le port 8001. Il exécute également les migrations de base de données et peuple la base de données avec des comptes de démonstration (`admin`/`admin123` et `user`/`user123`).
-   `scripts/start-frontend.sh`: Démarre le serveur de développement Vite pour l'application React sur le port 5174.

Vous pouvez lancer chaque script dans un terminal séparé pour faire fonctionner l'application complète.
