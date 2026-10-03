# Pangmao Web · 胖猫

Prototype installable « 我学法语 » destiné à une première validation familiale
sur iPhone et Android. Il propose un dictionnaire français–chinois
bidirectionnel, des explications chinoises, la prononciation française et des
favoris locaux. **La version publique actuelle est 0.3.3.** Le Reader permet le
collage ou l'import `.txt`, le découpage local en phrases et mots, la lecture
par phrase et l'ouverture d'une fiche au toucher.

La 0.3.3 ajoute deux profils vocaux mémorisables (« 女声 » et « 男声 »), un essai
sur une phrase française et un diagnostic copiable dans « À propos ». Ces
profils permettent de choisir parmi les voix françaises exposées par le
navigateur et le téléphone : leurs noms ne garantissent pas le genre de la voix
sélectionnée. Aucun nouveau moteur vocal n'est embarqué. Le retour du
3 octobre 2026 signale une prononciation toujours insatisfaisante ; sa cause
reste à diagnostiquer sur l'appareil concerné.

Utiliser le prototype: <https://kevindassie-ui.github.io/Pangmao-Web/>

Sur iPhone, ouvrir cette adresse dans Safari puis choisir **Partager → Sur
l'écran d'accueil**. Le dictionnaire principal est chargé au premier démarrage
et peut ensuite être réutilisé hors ligne. Une recherche chinoise absente peut
charger un seul fragment complémentaire; une proposition indirecte est
toujours indiquée comme « sens possible ».

La recherche française porte sur les formes lexicales, pas sur les mots
rencontrés fortuitement dans le texte d'une définition. Le correctif revu
`affiche → 海报 / 招贴 / 告示` est inclus; les cartes issues d'une recherche en
chinois n'affichent plus de pinyin, puisque le français est la langue étudiée.
Le code et le paquet lexical portent la même version afin qu'un ancien cache
hors ligne ne puisse plus réintroduire les résultats `gigue` ou `punaise`.
Chaque publication audite les 10 926 entrées et 15 187 équivalents, avec 26
mots témoins revus.

Cette publication familiale utilise volontairement une palette rouge et un
petit cerf. Le thème Pangmao vert global reste inchangé dans la source
canonique: l'identité personnelle est appliquée au moment du build.

Ce dépôt public contient uniquement les fichiers statiques nécessaires au
déploiement. Le développement principal et l'application Android restent dans
un dépôt privé distinct.

La version 0.3.4 (journal facultatif des recherches sans résultat) est en
préparation dans le dépôt principal et n'est pas publiée ici.
