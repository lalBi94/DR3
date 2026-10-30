import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const distribution = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const project = resolve(distribution, '..')
const runtime = join(distribution, 'build/runtime')
const version = process.argv[2] ?? JSON.parse(await readFile(join(project, 'package.json'), 'utf8')).version
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Version attendue : X.Y.Z')
const output = join(distribution, `build/Dress3-${version}-windows`)
const require = createRequire(join(project, 'package.json'))
const neuRequire = createRequire(require.resolve('@neutralinojs/neu/package.json'))
const asar = neuRequire('@electron/asar')

await mkdir(output, { recursive: true })
const config = JSON.parse(await readFile(join(project, 'neutralino.config.json'), 'utf8'))
config.version = version
config.applicationIcon = 'assets/icon.png'
config.modes.window.icon = 'assets/icon.png'
config.modes.window.enableInspector = false
delete config.cli
await mkdir(join(runtime, 'assets'), { recursive: true })
await cp(join(project, 'src/assets/icon.png'), join(runtime, 'assets/icon.png'))
await writeFile(join(runtime, 'neutralino.config.json'), JSON.stringify(config, null, 2))

// Conserve les notices des dépendances distribuées, y compris les dépendances transitives.
const licenses = join(output, 'licenses')
await mkdir(licenses, { recursive: true })
const visited = new Set()
// Parcourt les dépendances navigateur ; les backends exclusivement Node ne sont pas distribués.
async function collectLicenses(name, fromRequire) {
  if (name === 'onnxruntime-node' || name === 'sharp') return
  let packagePath
  try { packagePath = fromRequire.resolve(`${name}/package.json`) } catch {
    try {
      let folder = dirname(fromRequire.resolve(name))
      while (folder !== dirname(folder)) {
        try {
          const candidate = join(folder, 'package.json')
          const metadata = JSON.parse(await readFile(candidate, 'utf8'))
          if (metadata.name === name) { packagePath = candidate; break }
        } catch { /* Remonte jusqu'à la racine du paquet. */ }
        folder = dirname(folder)
      }
    } catch { return }
  }
  if (!packagePath || visited.has(packagePath)) return
  visited.add(packagePath)
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'))
  const folder = dirname(packagePath)
  const notices = (await readdir(folder)).filter((file) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(file))
  const onnxNotice = ['onnxruntime-web', 'onnxruntime-common'].includes(name)
  const guidNotice = name === 'guid-typescript' && metadata.license === 'ISC'
  if (notices.length === 0 && !onnxNotice && !guidNotice) throw new Error(`Notice de licence absente : ${name}`)
  const destination = join(licenses, `${metadata.name.replaceAll('/', '-')}-${metadata.version}`)
  await mkdir(destination, { recursive: true })
  if (onnxNotice) await cp(join(project, 'public/licenses/onnxruntime-MIT.txt'), join(destination, 'LICENSE'))
  if (guidNotice) {
    await writeFile(join(destination, 'ATTRIBUTION.txt'), `${metadata.name} ${metadata.version}\nAuteur déclaré : ${metadata.author}\nLicence déclarée par le paquet : ISC\nSource : ${metadata.repository.url}\nLe paquet amont ne fournit pas de fichier LICENSE distinct.\n`)
    await cp(join(folder, 'README.md'), join(destination, 'README.md'))
  }
  for (const notice of notices) await cp(join(folder, notice), join(destination, notice), { recursive: true })
  const localRequire = createRequire(packagePath)
  for (const dependency of Object.keys(metadata.dependencies ?? {})) await collectLicenses(dependency, localRequire)
}
for (const name of ['react', 'react-dom', '@neutralinojs/lib', '@huggingface/transformers', 'lucide-react']) {
  await collectLicenses(name, require)
}
await cp(join(runtime, 'web-dist/licenses'), join(licenses, 'image-processing'), { recursive: true })
await cp(join(runtime, 'web-dist/models/studioludens/birefnet-lite-512/LICENSE'), join(licenses, 'BiRefNet-MIT.txt'))
const nativeLicense = await fetch('https://raw.githubusercontent.com/neutralinojs/neutralinojs/v6.10.0/LICENSE')
if (!nativeLicense.ok) throw new Error(`Licence Neutralinojs : HTTP ${nativeLicense.status}`)
await writeFile(join(licenses, 'Neutralinojs-LICENSE.txt'), await nativeLicense.text())

// Le conteneur ne contient que le frontend compilé, l'icône et la configuration de production.
await asar.createPackage(runtime, join(output, 'resources.neu'))
await cp(join(project, 'bin/neutralino-win_x64.exe'), join(output, 'Dress3.exe'))
const metadataPath = join(distribution, 'build/windows.config.json')
await writeFile(metadataPath, JSON.stringify({ ...config, applicationIcon: join(project, 'src/assets/icon.png'), cli: { binaryName: 'Dress3' } }))
neuRequire('./src/constants.js').files.configFile = metadataPath
await neuRequire('./src/modules/exepatch.js').patchWindowsExecutable(join(output, 'Dress3.exe'))
await cp(join(distribution, 'CREDITS.md'), join(output, 'CREDITS.md'))
await writeFile(join(output, 'VERSION.txt'), `${version}\n`)
await writeFile(join(output, 'LIRE-MOI.txt'), `Dress 3 — ${version} — Windows x64
Bilal Boudjemline — Threadlock Systems

INSTALLATION
Extraire tout le ZIP dans un dossier, puis lancer Dress3.exe.
Conserver resources.neu à côté de Dress3.exe et conserver le dossier licenses.
Microsoft Edge WebView2 Runtime est requis. Windows peut avertir que cet exécutable n'est pas signé.
Au premier lancement, les données sont préparées dans Documents/dress3_data.
Si ce dossier n'est pas accessible, choisir un emplacement dans Paramètres.

MISE À JOUR MANUELLE
Télécharger le ZIP depuis https://github.com/lalBi94/DR3/releases/latest
Fermer Dress 3, extraire le nouveau ZIP dans un nouveau dossier et lancer le nouvel exécutable.
Ne jamais effacer ou remplacer dress3_data. Faire une sauvegarde avant une mise à jour.
La préférence d'emplacement existante est conservée par le stockage système Neutralinojs.
Comparer le SHA-256 du ZIP avec celui de update.json via Get-FileHash -Algorithm SHA256.

MISE À JOUR INTÉGRÉE (DEPUIS LA VERSION 1.1.0)
Ouvrir Paramètres, puis Mises à jour de Dress 3.
La recherche est lancée à l'ouverture de cette page ; le bouton permet de la relancer.
Si une version plus récente est disponible, confirmer puis cliquer sur Mettre à jour et redémarrer.
L'archive est téléchargée depuis GitHub, vérifiée (taille et SHA-256), puis l'application redémarre.
Le remplacement est automatique après confirmation. Aucune installation silencieuse au démarrage.
Internet et PowerShell Windows sont requis pour cette opération, pas pour utiliser le dressing.
Le dossier d'installation doit être accessible en écriture, sans élévation administrateur.
Les fichiers existants de l'application sont sauvegardés pour restauration en cas d'échec.
Un arrêt forcé de Windows pendant le remplacement peut exiger une restauration manuelle.
Les rapports de mise à jour sont conservés dans le dossier temporaire dress3-update-<identifiant>.

FONCTIONNEMENT
Application locale, sauf la météo Open-Meteo et les mises à jour GitHub depuis Paramètres.
Les modèles de détourage sont inclus pour fonctionner sans téléchargement.
Les crédits et les licences tierces sont fournis avec cette archive.
`)
console.log(`Distribution préparée : ${output}`)
