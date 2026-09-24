# Pangmao Web · 胖猫

Prototype installable « 我学法语 » destiné à une première validation familiale
sur iPhone et Android. Il propose un dictionnaire français–chinois
bidirectionnel, des explications chinoises, la prononciation française et des
favoris locaux. La version 0.3 ajoute un Reader français: collage ou import
`.txt`, découpage local en phrases et mots, TTS par phrase et ouverture d'une
fiche au toucher.

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

Cette publication familiale utilise volontairement une palette rouge et un
petit cerf. Le thème Pangmao vert global reste inchangé dans la source
canonique: l'identité personnelle est appliquée au moment du build.

Ce dépôt public contient uniquement les fichiers statiques nécessaires au
déploiement. Le développement principal et l'application Android restent dans
un dépôt privé distinct.

Version déployée depuis le commit Pangmao `f3e40d3`.
