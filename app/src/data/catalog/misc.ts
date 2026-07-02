import type { CatalogService } from './types';

// MISC RECURRING SUBSCRIPTIONS common in France / Europe that don't fit the
// streaming / music / SaaS / cloud / security / news / wellness / gaming
// buckets: e-commerce memberships, mobile / telecom SIM plans, meal & food
// boxes, mobility / transport passes, language apps and other recurring
// consumer subscriptions.
//
// Audience: French / European. Native currency (EUR where sold in Europe,
// USD for US-priced services). Prices researched for 2026-07 — see the
// "## Notes" section of the report for skips, indicative telecom prices and
// uncertain values.

export const MISC: CatalogService[] = [
  // --- E-COMMERCE / MEMBERSHIP ---------------------------------------------
  {
    id: 'amazon-prime',
    name: 'Amazon Prime',
    aliases: ['amazon prime', 'prime'],
    domain: 'amazon.fr',
    category: 'Other',
    plans: [
      { name: 'Mensuel', amount: 6.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Annuel', amount: 69.90, currency: 'EUR', frequency: 'yearly' },
      { name: 'Étudiant (Prime Student)', amount: 3.49, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'fnac-plus',
    name: 'Fnac+',
    aliases: ['fnac+', 'fnac plus', 'carte fnac'],
    domain: 'fnac.com',
    category: 'Other',
    plans: [
      { name: 'Annuel', amount: 14.99, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'cdiscount-a-volonte',
    name: 'Cdiscount à volonté',
    aliases: ['cdiscount', 'cdav', 'cdiscount a volonte'],
    domain: 'cdiscount.com',
    category: 'Other',
    plans: [
      { name: 'Annuel', amount: 29.00, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'costco',
    name: 'Costco',
    aliases: ['costco', 'costco membre privilège'],
    domain: 'costco.fr',
    category: 'Other',
    plans: [
      { name: 'Membre Privilège', amount: 36.00, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- MOBILE / TELECOM (France, SIM-only, prices INDICATIVE) --------------
  {
    id: 'free-mobile',
    name: 'Free Mobile',
    aliases: ['free', 'free mobile', 'forfait free'],
    domain: 'free.fr',
    category: 'Other',
    plans: [
      { name: 'Forfait Free 5G', amount: 19.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Forfait 2€', amount: 2.00, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'sosh',
    name: 'Sosh',
    aliases: ['sosh', 'orange sosh', 'forfait sosh'],
    domain: 'sosh.fr',
    category: 'Other',
    plans: [
      { name: 'Forfait 150 Go', amount: 13.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'red-by-sfr',
    name: 'RED by SFR',
    aliases: ['red', 'red by sfr', 'sfr red'],
    domain: 'red-by-sfr.fr',
    category: 'Other',
    plans: [
      { name: 'Forfait 130 Go 5G', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'b-and-you',
    name: 'B&You',
    aliases: ['b&you', 'byou', 'bouygues b&you', 'forfait bouygues'],
    domain: 'bouyguestelecom.fr',
    category: 'Other',
    plans: [
      { name: 'Forfait 150 Go', amount: 13.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'prixtel',
    name: 'Prixtel',
    aliases: ['prixtel', 'forfait prixtel'],
    domain: 'prixtel.com',
    category: 'Other',
    plans: [
      { name: 'Le grand (5G)', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- MEAL / FOOD BOXES & DELIVERY MEMBERSHIPS ----------------------------
  {
    id: 'hellofresh',
    name: 'HelloFresh',
    aliases: ['hellofresh', 'hello fresh'],
    domain: 'hellofresh.fr',
    category: 'Other',
    plans: [
      // No fixed subscription fee — you pay per weekly box. Indicative:
      // 2 personnes / 3 recettes ≈ 45 €/semaine + ~6 € de livraison.
      { name: '2 pers. / 3 recettes (semaine)', amount: 50.00, currency: 'EUR', frequency: 'weekly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'quitoque',
    name: 'Quitoque',
    aliases: ['quitoque', 'qui toque'],
    domain: 'quitoque.fr',
    category: 'Other',
    plans: [
      // Per-week box, no flat fee. Indicative 2 pers. / 3 recettes.
      { name: '2 pers. / 3 recettes (semaine)', amount: 45.00, currency: 'EUR', frequency: 'weekly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'uber-one',
    name: 'Uber One',
    aliases: ['uber one', 'uber eats plus', 'uberone'],
    domain: 'uber.com',
    category: 'Other',
    plans: [
      { name: 'Mensuel', amount: 5.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Annuel', amount: 59.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'deliveroo-plus',
    name: 'Deliveroo Plus',
    aliases: ['deliveroo plus', 'deliveroo'],
    domain: 'deliveroo.fr',
    category: 'Other',
    plans: [
      { name: 'Argent', amount: 2.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Or', amount: 5.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- MOBILITY / TRANSPORT ------------------------------------------------
  {
    id: 'navigo-mois',
    name: 'Navigo Mois',
    aliases: ['navigo', 'pass navigo', 'forfait navigo'],
    domain: 'iledefrance-mobilites.fr',
    category: 'Other',
    plans: [
      { name: 'Toutes zones (mensuel)', amount: 90.80, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'sncf-max-jeune',
    name: 'SNCF Max Jeune',
    aliases: ['max jeune', 'tgvmax', 'sncf max', 'abonnement max jeune'],
    domain: 'sncf-connect.com',
    category: 'Other',
    plans: [
      { name: 'Mensuel', amount: 79.00, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'sncf-avantage-jeune',
    name: 'SNCF Avantage Jeune',
    aliases: ['carte avantage', 'avantage jeune', 'carte avantage jeune'],
    domain: 'sncf-connect.com',
    category: 'Other',
    plans: [
      { name: 'Annuel (12-27 ans)', amount: 49.00, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'sncf-liberte',
    name: 'SNCF Carte Liberté',
    aliases: ['carte liberté', 'liberte', 'sncf liberté'],
    domain: 'sncf-connect.com',
    category: 'Other',
    plans: [
      { name: 'Annuel', amount: 349.00, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'velib',
    name: "Vélib'",
    aliases: ['velib', "vélib'", 'velib metropole'],
    domain: 'velib-metropole.fr',
    category: 'Other',
    plans: [
      { name: 'V-Plus (mensuel)', amount: 4.30, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'V-Max (mensuel)', amount: 9.30, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'dott',
    name: 'Dott',
    aliases: ['dott', 'pass dott', 'trottinette dott'],
    domain: 'ridedott.com',
    category: 'Other',
    plans: [
      { name: 'Pass 30 jours', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- OTHER (creator / professional / language learning) ------------------
  {
    id: 'patreon',
    name: 'Patreon',
    aliases: ['patreon'],
    domain: 'patreon.com',
    category: 'Other',
    plans: [
      // Creators set their own tier prices; a common entry membership is ~5 $/mo.
      { name: 'Adhésion (typique)', amount: 5.00, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'linkedin-premium',
    name: 'LinkedIn Premium',
    aliases: ['linkedin premium', 'linkedin', 'premium career'],
    domain: 'linkedin.com',
    category: 'Productivity',
    plans: [
      { name: 'Career (mensuel)', amount: 29.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Business (mensuel)', amount: 52.06, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'duolingo',
    name: 'Duolingo',
    aliases: ['duolingo', 'super duolingo', 'duolingo max'],
    domain: 'duolingo.com',
    category: 'Other',
    plans: [
      { name: 'Super (annuel)', amount: 110.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Super Famille (annuel)', amount: 122.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'babbel',
    name: 'Babbel',
    aliases: ['babbel'],
    domain: 'babbel.com',
    category: 'Other',
    plans: [
      { name: 'Mensuel', amount: 13.95, currency: 'EUR', frequency: 'monthly', default: true },
      { name: '12 mois (par mois)', amount: 6.65, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'busuu',
    name: 'Busuu',
    aliases: ['busuu'],
    domain: 'busuu.com',
    category: 'Other',
    plans: [
      // Premium billed for 3 months ≈ 9.99 €/mo equivalent.
      { name: 'Premium (3 mois, par mois)', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'rosetta-stone',
    name: 'Rosetta Stone',
    aliases: ['rosetta stone', 'rosetta'],
    domain: 'rosettastone.com',
    category: 'Other',
    plans: [
      { name: 'Annuel (1 langue)', amount: 150.00, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
];
