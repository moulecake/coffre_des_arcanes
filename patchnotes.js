// ============================================================
// PATCHNOTES — à compléter à chaque nouvelle version (la plus récente EN PREMIER).
// Format : { v: 'X.Y.Z', name: 'Titre', date: 'AAAA-MM-JJ', gift: 'texte du cadeau (facultatif)',
//            sections: [ { t: 'Titre de section', items: ['**Mot clé** : texte', ...] } ] }
// `**gras**` est pris en charge. Le patchnote de PATCHNOTES[0] s'affiche une fois à chaque joueur (après connexion), puis reste consultable via Menu › Patchnote.
// Changer PATCHNOTES[0].v suffit à le réafficher à tout le monde (penser à aligner CURRENT_VERSION de script.js et CACHE_NAME de sw.js).
// ============================================================
const PATCHNOTES = [
  {
    v: '2.2.0', name: 'L’Éveil du Grimoire', date: '2026-11-18',
    gift: 'Cadeau de mise à jour : 3 clés offertes !',
    sections: [
      { t: '🎁 Nouveautés', items: [
        '**Le Clicker** (bouton ⚡ GRIMOIRE) : le Voile d’Éther et le Grimoire aux Pages Infinies. Frappe, lis, recrute des serviteurs et rends-toi à l’Amphithéâtre. Le reste, à toi de le découvrir !',
        '**Fragments de clé** : le Clicker en produit, par ton effort comme tout seul avec le temps. Ils deviennent des clés pour le Coffre, avec une animation quand la clé arrive.',
        '**Notifications** : sois prévenu quand tes clés sont rechargées ou qu’une clé est prête dans le Clicker. Activées par défaut, modifiables dans Menu › Options.',
        '**Options** (Menu) : coupe les sons et les vibrations.',
        '**Correctifs** : de nombreux bugs ont été répertoriés grâce aux alpha-testeurs. Merci à eux !',
        '**Soutien participatif** : si tu veux soutenir le projet, rends-toi sur le bouton « Soutenir le projet » ou dans le nouveau menu aux diverses fonctionnalités.',
        '**Patchnote** : retrouve les nouveautés ici à tout moment.'
      ] },
      { t: '🛠 Améliorations', items: [
        '**Recyclage plus juste** : un doublon rapporte 1 fragment (commun), 2 (peu commun), 3 (rare), 4 (très rare) ou 5 (légendaire).',
        '**Lancement plus rapide** : plus d’écran de connexion à chaque retour.',
        '**Sauvegarde améliorée** : ta collection est protégée si tu joues sur plusieurs appareils ou hors-ligne, avec des copies de secours automatiques.',
        '**Classement** plus léger et plus rapide.',
        '**Anti-autoclic** : le Voile et le Grimoire réagiront.',
        '**Visuels** : de nombreux ajouts et ajustements visuels effectués.'
      ] },
      { t: '🐛 Corrections', items: [
        'Les objets « peu commun » sont à nouveau classés comme tels.',
        'L’installation de l’appli sur l’écran d’accueil est fiabilisée.'
      ] }
    ]
  },
  {
    v: '2.0', name: 'Le Compte des Mages', date: '',
    sections: [
      { t: 'Au programme', items: [
        'Connexion avec Google : ta progression est sauvegardée en ligne et te suit sur tous tes appareils.',
        'Un pseudo public et le classement des mages 🏆.',
        'Profil, collection avec pourcentage de complétion, recyclage des doublons en fragments, code promo.',
        'Installation possible sur l’écran d’accueil.'
      ] }
    ]
  },
  {
    v: '1.0', name: 'Le Coffre', date: '',
    sections: [
      { t: 'Au programme', items: [
        'Ouvre des coffres et découvre plus de 460 objets magiques, de Commun à Artéfact.',
        'Des clés qui se rechargent avec le temps.',
        'Un inventaire pour garder ta collection.',
        'Sauvegarde locale uniquement, sur ton appareil.'
      ] }
    ]
  }
];
