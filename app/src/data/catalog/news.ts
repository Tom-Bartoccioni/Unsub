import type { CatalogService } from './types';

// NEWS / PRESS / READING catalog. French & European press prioritized, then
// international titles and reading/aggregator services. Prices are the vendor's
// standard (non-promotional) rate in their native currency; French/EU services
// price in EUR, US-only services in USD. No currency conversion is done here —
// money.convert() handles display. Verified via web research, 2026-07.
export const NEWS_READING: CatalogService[] = [
  // --- French press ---
  {
    id: 'le-monde',
    name: 'Le Monde',
    aliases: ['le monde', 'lemonde'],
    domain: 'lemonde.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 12.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'le-figaro',
    name: 'Le Figaro',
    aliases: ['le figaro', 'figaro'],
    domain: 'lefigaro.fr',
    category: 'News',
    plans: [
      { name: 'Premium', amount: 16.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'liberation',
    name: 'Libération',
    aliases: ['liberation', 'libe', 'libé'],
    domain: 'liberation.fr',
    category: 'News',
    plans: [
      { name: 'Numérique Duo', amount: 13.9, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Numérique Famille', amount: 17.9, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'lequipe',
    name: "L'Équipe",
    aliases: ['lequipe', "l'equipe", 'equipe'],
    domain: 'lequipe.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'mediapart',
    name: 'Mediapart',
    aliases: ['mediapart'],
    domain: 'mediapart.fr',
    category: 'News',
    plans: [
      { name: 'Mensuel', amount: 12, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Annuel', amount: 120, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'les-echos',
    name: 'Les Échos',
    aliases: ['les echos', 'lesechos', 'echos'],
    domain: 'lesechos.fr',
    category: 'News',
    plans: [
      { name: 'Access', amount: 18, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Premium', amount: 39, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'le-parisien',
    name: 'Le Parisien',
    aliases: ['le parisien', 'parisien'],
    domain: 'leparisien.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'la-croix',
    name: 'La Croix',
    aliases: ['la croix', 'lacroix'],
    domain: 'la-croix.com',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 7.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'telerama',
    name: 'Télérama',
    aliases: ['telerama', 'télérama'],
    domain: 'telerama.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 9.08, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'courrier-international',
    name: 'Courrier International',
    aliases: ['courrier international', 'courrier'],
    domain: 'courrierinternational.com',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 9.9, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'lobs',
    name: "L'Obs",
    aliases: ['lobs', "l'obs", 'nouvel obs', 'le nouvel obs'],
    domain: 'nouvelobs.com',
    category: 'News',
    plans: [
      { name: 'Essentiel', amount: 6.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Premium', amount: 9.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Intégral', amount: 12.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'le-point',
    name: 'Le Point',
    aliases: ['le point', 'lepoint'],
    domain: 'lepoint.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'alternatives-economiques',
    name: 'Alternatives Économiques',
    aliases: ['alternatives economiques', 'alter eco', 'alternatives éco'],
    domain: 'alternatives-economiques.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 9.9, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'le-canard-enchaine',
    name: 'Le Canard enchaîné',
    aliases: ['le canard enchaine', 'canard enchaine', 'le canard'],
    domain: 'lecanardenchaine.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 8.9, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'le-monde-diplomatique',
    name: 'Le Monde diplomatique',
    aliases: ['le monde diplomatique', 'diplo', 'monde diplo'],
    domain: 'monde-diplomatique.fr',
    category: 'News',
    plans: [
      { name: 'Numérique', amount: 6, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- International press ---
  {
    id: 'nyt',
    name: 'The New York Times',
    aliases: ['nyt', 'new york times', 'nytimes'],
    domain: 'nytimes.com',
    category: 'News',
    plans: [
      { name: 'All Access', amount: 25, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'All Access Family', amount: 30, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'the-economist',
    name: 'The Economist',
    aliases: ['the economist', 'economist'],
    domain: 'economist.com',
    category: 'News',
    plans: [
      { name: 'Digital', amount: 24.9, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Digital Annual', amount: 249, currency: 'USD', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'financial-times',
    name: 'Financial Times',
    aliases: ['financial times', 'ft'],
    domain: 'ft.com',
    category: 'News',
    plans: [
      { name: 'Standard Digital', amount: 468, currency: 'GBP', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'the-guardian',
    name: 'The Guardian',
    aliases: ['the guardian', 'guardian'],
    domain: 'theguardian.com',
    category: 'News',
    plans: [
      { name: 'All-access digital', amount: 16.5, currency: 'GBP', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'washington-post',
    name: 'The Washington Post',
    aliases: ['washington post', 'wapo', 'the washington post'],
    domain: 'washingtonpost.com',
    category: 'News',
    plans: [
      { name: 'Digital (4-weekly)', amount: 12, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'wsj',
    name: 'The Wall Street Journal',
    aliases: ['wsj', 'wall street journal'],
    domain: 'wsj.com',
    category: 'News',
    plans: [
      { name: 'Digital', amount: 38.99, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'wired',
    name: 'Wired',
    aliases: ['wired'],
    domain: 'wired.com',
    category: 'News',
    plans: [
      { name: 'Digital', amount: 2.99, currency: 'USD', frequency: 'monthly' },
      { name: 'Digital Annual', amount: 29.99, currency: 'USD', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'the-atlantic',
    name: 'The Atlantic',
    aliases: ['the atlantic', 'atlantic'],
    domain: 'theatlantic.com',
    category: 'News',
    plans: [
      { name: 'Digital Annual', amount: 89.99, currency: 'USD', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg',
    aliases: ['bloomberg'],
    domain: 'bloomberg.com',
    category: 'News',
    plans: [
      { name: 'Digital All Access', amount: 34.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Digital Annual', amount: 415, currency: 'USD', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Creator / aggregator / reading ---
  {
    id: 'substack',
    name: 'Substack',
    aliases: ['substack'],
    domain: 'substack.com',
    category: 'News',
    plans: [
      // Price is set per-publication by each creator; $5/mo is the common floor.
      { name: 'Paid publication', amount: 5, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'medium',
    name: 'Medium',
    aliases: ['medium'],
    domain: 'medium.com',
    category: 'News',
    plans: [
      { name: 'Membership', amount: 5, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Membership Annual', amount: 50, currency: 'USD', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'blinkist',
    name: 'Blinkist',
    aliases: ['blinkist'],
    domain: 'blinkist.com',
    category: 'News',
    plans: [
      { name: 'Premium Annual', amount: 99.99, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'readly',
    name: 'Readly',
    aliases: ['readly'],
    domain: 'readly.com',
    category: 'News',
    plans: [
      { name: 'Unlimited', amount: 14.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'cafeyn',
    name: 'Cafeyn',
    aliases: ['cafeyn', 'lekiosk'],
    domain: 'cafeyn.co',
    category: 'News',
    plans: [
      { name: 'Premium', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Duo', amount: 15.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'kindle-unlimited',
    name: 'Kindle Unlimited',
    aliases: ['kindle unlimited', 'kindle', 'abonnement kindle'],
    domain: 'amazon.fr',
    category: 'News',
    plans: [
      { name: 'Mensuel', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'kobo-plus',
    name: 'Kobo Plus',
    aliases: ['kobo plus', 'kobo'],
    domain: 'kobo.com',
    category: 'News',
    plans: [
      { name: 'Lecture', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Lecture & Écoute', amount: 12.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://www.kobo.com/account/subscriptions',
    cancelNotes: 'Manage under My Account > My Subscriptions on kobo.com (not manageable in the iOS app or on eReaders).',
  },
  {
    id: 'audible',
    name: 'Audible',
    aliases: ['audible'],
    domain: 'audible.fr',
    category: 'News',
    plans: [
      { name: 'Premium Plus', amount: 9.95, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Standard', amount: 5.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://www.audible.com/account/cancelmembership',
    cancelNotes: 'Cancel under Account Details in a browser if billed by Audible; app-store subscriptions cancel via the store.',
  },
];
