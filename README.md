# Dress 3

Application desktop de dressing par **Bilal Boudjemline — Threadlock Systems**.

Ce dépôt public sert uniquement à distribuer les versions compilées. Le dépôt de développement, les photos personnelles et les données utilisateur ne sont pas publiés ici.

## Téléchargements

Télécharger la dernière version Windows x64 depuis [GitHub Releases](https://github.com/lalBi94/DR3/releases/latest). Extraire tout le ZIP puis lancer `Dress3.exe` ; conserver `resources.neu` à côté de l'exécutable.

## Versionnement et mises à jour

- Versions sémantiques `MAJEURE.MINEURE.CORRECTIF` et tags `vX.Y.Z`.
- Chaque release contient une archive Windows, ses notices de licences et `update.json` : version, plateforme, URL de téléchargement, taille et SHA-256.
- Manifeste de la dernière version stable : `https://github.com/lalBi94/DR3/releases/latest/download/update.json` (disponible après la première publication).
- Les préversions utilisent une version telle que `1.0.0-beta.1` et ne remplacent pas la dernière version stable.
- Depuis **v1.1.0**, Paramètres vérifie les releases stables et propose **Mettre à jour et redémarrer** : téléchargement, SHA-256 et remplacement automatique après confirmation. Les versions v1.0.x doivent être remplacées manuellement une dernière fois pour recevoir ce mécanisme.
- Les fichiers persistants `dress3_data` doivent rester séparés de l'application et ne doivent jamais être remplacés lors d'une mise à jour.

## Publier une version

Pour préparer une version depuis le projet de développement privé :

```powershell
pnpm exec vite build --outDir DR3/build/runtime/web-dist
node DR3/scripts/Build-Windows.mjs 1.2.0
```

Le script prend la version `X.Y.Z` en argument et prépare le conteneur Neutralinojs de production (inspecteur désactivé), le binaire Windows et les notices tierces sous `DR3/build/Dress3-X.Y.Z-windows`. Il ne copie aucune donnée utilisateur. Tester ce dossier puis le compresser en ZIP avant publication. Incrémenter le dernier nombre pour un correctif (par exemple `1.0.0` → `1.0.1`).

Depuis ce dossier, dans PowerShell :

```powershell
.\scripts\Publish-Release.ps1 -Version 1.2.0 -Archive C:\releases\Dress3-windows.zip -Notes C:\releases\notes.md
```

Pour une préversion, ajouter `-Prerelease`. Le script utilise `GITHUB_TOKEN` ou les identifiants du gestionnaire Git, sans les écrire dans le dépôt. Il crée une release en brouillon, charge l'archive et son manifeste, puis publie seulement après réussite des transferts. En cas d'échec, le brouillon reste disponible pour diagnostic.

Préparer une archive **testée** contenant uniquement les fichiers nécessaires à l'exécution, les ressources compilées, les modèles embarqués et leurs licences. Ne jamais archiver tout le projet. Le script refuse les chemins de développement et données personnelles courants, mais ne remplace pas une inspection du contenu. Le JavaScript compilé reste inspectable ; ce n'est pas une garantie de confidentialité du code exécuté.

Les modèles ONNX volumineux doivent être joints à la release, pas ajoutés à l'historique Git. Pour commencer, l'archive embarque les ressources nécessaires au fonctionnement hors ligne ; une distribution différentielle des modèles n'est pas encore implémentée.

Voir [CREDITS.md](CREDITS.md). Aucun droit de redistribution du code propriétaire n'est accordé par la publication de ce dépôt.
