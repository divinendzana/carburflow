import pandas as pd
from datetime import date
from .models import (
    Rapport,
    LigneRapport,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene
)

def importer_fichier_rapport(filepath):
    """
    Lit un fichier Excel (.xlsx, .xls) ou CSV et enregistre 
    les données dans le modèle LigneRapport.
    """
    # 1. Lecture du fichier selon son extension
    if filepath.endswith('.csv'):
        # On tente avec différents séparateurs couramment utilisés (virgule ou point-virgule)
        try:
            df = pd.read_csv(filepath, sep=',')
            if len(df.columns) <= 1:
                df = pd.read_csv(filepath, sep=';')
        except Exception:
            df = pd.read_csv(filepath, sep=';')
    else:
        df = pd.read_excel(filepath)

    # Clean headers : minuscules et retrait des espaces superflus
    df.columns = df.columns.str.strip().str.lower()

    lignes_creees = 0
    erreurs = []

    # 2. Parcours ligne par ligne
    for index, row in df.iterrows():
        try:
            # Récupération / Gestion du Rapport parent (id_rapport)
            rapport = None
            if pd.notna(row.get('id_rapport')):
                try:
                    rapport = Rapport.objects.get(id=int(row['id_rapport']))
                except Rapport.DoesNotExist:
                    # Si le rapport spécifié n'existe pas, on en crée un par défaut
                    rapport = Rapport.objects.create(
                        date_debut=date.today(),
                        date_fin=date.today()
                    )
            else:
                # Si aucun id_rapport n'est fourni, on utilise ou crée un rapport par défaut
                rapport, _ = Rapport.objects.get_or_create(
                    date_debut=date.today(),
                    date_fin=date.today()
                )

            # Recherche optionnelle des équipements associés
            cuve_p = None
            if pd.notna(row.get('id_cuve_principale')):
                cuve_p = CuvePrincipale.objects.filter(id=int(row['id_cuve_principale'])).first()

            cuve_j = None
            if pd.notna(row.get('id_cuve_journaliere')):
                cuve_j = CuveJournaliere.objects.filter(id=int(row['id_cuve_journaliere'])).first()

            groupe = None
            if pd.notna(row.get('id_groupe')):
                groupe = GroupeElectrogene.objects.filter(id=int(row['id_groupe'])).first()

            # Nettoyage et conversion des valeurs numériques
            qte_cp = float(row.get('quantite_gasoil_cuve_principale', 0.0)) if pd.notna(row.get('quantite_gasoil_cuve_principale')) else 0.0
            qte_cj = float(row.get('quantite_gasoil_cuve_journaliere', 0.0)) if pd.notna(row.get('quantite_gasoil_cuve_journaliere')) else 0.0
            compteur = float(row.get('compteur_horaire', 0.0)) if pd.notna(row.get('compteur_horaire')) else 0.0
            depot = float(row.get('depotage', 0.0)) if pd.notna(row.get('depotage')) else 0.0
            etat = str(row.get('etat_fonctionnement', 'F')).strip() if pd.notna(row.get('etat_fonctionnement')) else 'F'
            obs = str(row.get('observations', '')).strip() if pd.notna(row.get('observations')) else ''

            # Création de l'enregistrement dans la BDD
            LigneRapport.objects.create(
                rapport=rapport,
                cuve_principale=cuve_p,
                cuve_journaliere=cuve_j,
                groupe=groupe,
                quantite_gasoil_cuve_principale=qte_cp,
                quantite_gasoil_cuve_journaliere=qte_cj,
                compteur_horaire=compteur,
                depotage=depot,
                etat_fonctionnement=etat,
                observations=obs
            )
            lignes_creees += 1

        except Exception as e:
            erreurs.append(f"Ligne {index + 2} : {str(e)}")

    return {
        "status": "success",
        "lignes_importees": lignes_creees,
        "erreurs": erreurs
    }