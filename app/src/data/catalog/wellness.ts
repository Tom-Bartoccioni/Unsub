import type { CatalogService } from './types';

// WELLNESS / FITNESS / HEALTH (fitness apps, meditation, gym chains, yoga,
// nutrition) plus DATING apps (grouped under 'Wellness').
// Audience: French / European. Native currency (EUR where sold in Europe,
// USD for US-only services). Prices researched for 2026-07 — see NOTES at the
// bottom of the associated report for skips and uncertain values.

export const WELLNESS: CatalogService[] = [
  // ---------------------------------------------------------------- MEDITATION
  {
    id: 'headspace',
    name: 'Headspace',
    aliases: ['headspace'],
    domain: 'headspace.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 69.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 12.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Étudiant', amount: 8.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'calm',
    name: 'Calm',
    aliases: ['calm'],
    domain: 'calm.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 79.99, currency: 'USD', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 16.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  // ------------------------------------------------------------- FITNESS APPS
  {
    id: 'apple-fitness-plus',
    name: 'Apple Fitness+',
    aliases: ['apple fitness', 'fitness+', 'fitness plus'],
    domain: 'apple.com',
    category: 'Wellness',
    plans: [
      { name: 'Mensuel', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Annuel', amount: 79.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'strava',
    name: 'Strava',
    aliases: ['strava'],
    domain: 'strava.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 79.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 11.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'fitbit-premium',
    name: 'Fitbit Premium',
    aliases: ['fitbit', 'fitbit premium', 'google health premium'],
    domain: 'fitbit.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 79.99, currency: 'GBP', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 7.99, currency: 'GBP', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'whoop',
    name: 'Whoop',
    aliases: ['whoop'],
    domain: 'whoop.com',
    category: 'Wellness',
    plans: [
      { name: 'One', amount: 199, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Peak', amount: 264, currency: 'EUR', frequency: 'yearly' },
      { name: 'Life', amount: 399, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'garmin-connect-plus',
    name: 'Garmin Connect+',
    aliases: ['garmin', 'garmin connect', 'connect+'],
    domain: 'garmin.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 89.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 8.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal Premium',
    aliases: ['myfitnesspal', 'mfp'],
    domain: 'myfitnesspal.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 79.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 19.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'peloton-app',
    name: 'Peloton App',
    aliases: ['peloton', 'peloton app'],
    domain: 'onepeloton.com',
    category: 'Wellness',
    plans: [
      { name: 'App One (annuel)', amount: 129, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'App One (mensuel)', amount: 12.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'App+ (mensuel)', amount: 24, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'freeletics',
    name: 'Freeletics',
    aliases: ['freeletics'],
    domain: 'freeletics.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 99.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 34.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'centr',
    name: 'Centr',
    aliases: ['centr'],
    domain: 'centr.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel', amount: 179.99, currency: 'USD', frequency: 'yearly', default: true },
      // Dropped the "Trimestriel" (quarterly) plan: the schema only supports
      // monthly/yearly/weekly, and storing 79.99/quarter as monthly would
      // triple the tracked cost. Monthly + annual cover the useful cases.
      { name: 'Mensuel', amount: 29.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  // ------------------------------------------------------------------- YOGA
  {
    id: 'down-dog',
    name: 'Down Dog',
    aliases: ['down dog', 'downdog'],
    domain: 'downdogapp.com',
    category: 'Wellness',
    plans: [
      { name: 'Annuel (web)', amount: 39.99, currency: 'USD', frequency: 'yearly', default: true },
      { name: 'Mensuel', amount: 9.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  // -------------------------------------------------- FRENCH / EU GYM CHAINS
  {
    id: 'basic-fit',
    name: 'Basic-Fit',
    aliases: ['basic-fit', 'basic fit', 'basicfit'],
    domain: 'basic-fit.com',
    category: 'Wellness',
    plans: [
      { name: 'Comfort', amount: 24.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Premium', amount: 29.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Ultimate', amount: 34.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'fitness-park',
    name: 'Fitness Park',
    aliases: ['fitness park', 'fitnesspark'],
    domain: 'fitnesspark.fr',
    category: 'Wellness',
    plans: [
      { name: 'Classic', amount: 30, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Access+', amount: 45, currency: 'EUR', frequency: 'monthly' },
      { name: 'Ultimate', amount: 50, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'neoness',
    name: 'Neoness',
    aliases: ['neoness'],
    domain: 'neoness.fr',
    category: 'Wellness',
    plans: [
      { name: 'Standard', amount: 14.90, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Prime', amount: 34.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'keep-cool',
    name: 'Keep Cool',
    aliases: ['keep cool', 'keepcool'],
    domain: 'keepcool.fr',
    category: 'Wellness',
    plans: [
      { name: 'Premium', amount: 29.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Prime', amount: 34.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Sans engagement', amount: 44.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'on-air-fitness',
    name: 'On Air',
    aliases: ['on air', 'onair', 'on air fitness'],
    domain: 'onair-fitness.fr',
    category: 'Wellness',
    plans: [
      { name: 'Formule 1', amount: 31.96, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Formule 2', amount: 39.96, currency: 'EUR', frequency: 'monthly' },
      { name: 'Formule 3', amount: 43.96, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  // ------------------------------------------------------------------ DATING
  {
    id: 'tinder',
    name: 'Tinder',
    aliases: ['tinder'],
    domain: 'tinder.com',
    category: 'Wellness',
    plans: [
      { name: 'Plus', amount: 14.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Gold', amount: 24.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Platinum', amount: 30.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'bumble',
    name: 'Bumble',
    aliases: ['bumble'],
    domain: 'bumble.com',
    category: 'Wellness',
    plans: [
      { name: 'Boost', amount: 19.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Premium', amount: 39.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'hinge',
    name: 'Hinge',
    aliases: ['hinge'],
    domain: 'hinge.co',
    category: 'Wellness',
    plans: [
      { name: 'Hinge+', amount: 34.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'HingeX', amount: 49.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'happn',
    name: 'Happn',
    aliases: ['happn'],
    domain: 'happn.com',
    category: 'Wellness',
    plans: [
      { name: 'Premium', amount: 24.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'meetic',
    name: 'Meetic',
    aliases: ['meetic'],
    domain: 'meetic.fr',
    category: 'Wellness',
    plans: [
      { name: 'Essentiel', amount: 29.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Prestige', amount: 29.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'grindr',
    name: 'Grindr',
    aliases: ['grindr'],
    domain: 'grindr.com',
    category: 'Wellness',
    plans: [
      { name: 'Xtra', amount: 19.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Unlimited', amount: 39.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'fruitz',
    name: 'Fruitz',
    aliases: ['fruitz'],
    domain: 'fruitz.io',
    category: 'Wellness',
    plans: [
      { name: 'Premium', amount: 12.49, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Golden', amount: 29.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
];
