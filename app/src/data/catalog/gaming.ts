import type { CatalogService } from './types';

// GAMING vendor catalog: game subscription services, cloud gaming, and console
// online services. Prices verified July 2026 via web search. Currencies are the
// service's native billing currency (EUR for European storefronts, USD when the
// service prices globally in USD / a virtual currency). No conversions here —
// the app converts to the user's display currency at render time.
export const GAMING: CatalogService[] = [
  // --- Microsoft: Xbox Game Pass (rebranded/repriced April 2026) ---------------
  {
    id: 'xbox-game-pass-ultimate',
    name: 'Xbox Game Pass Ultimate',
    aliases: ['game pass', 'xbox game pass', 'gamepass', 'gp ultimate'],
    domain: 'xbox.com',
    category: 'Gaming',
    plans: [
      { name: 'Ultimate', amount: 20.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://account.microsoft.com/services',
    cancelNotes: 'Select Manage next to Game Pass, then Cancel subscription. If bought on console via a store, cancel there.',
  },
  {
    id: 'xbox-game-pass-premium',
    name: 'Xbox Game Pass Premium',
    aliases: ['game pass premium', 'xbox premium'],
    domain: 'xbox.com',
    category: 'Gaming',
    plans: [
      { name: 'Premium', amount: 12.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://account.microsoft.com/services',
    cancelNotes: 'Select Manage next to Game Pass, then Cancel subscription.',
  },
  {
    id: 'xbox-game-pass-essential',
    name: 'Xbox Game Pass Essential',
    aliases: ['game pass essential', 'xbox core', 'game pass core'],
    domain: 'xbox.com',
    category: 'Gaming',
    plans: [
      { name: 'Essential', amount: 8.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'pc-game-pass',
    name: 'PC Game Pass',
    aliases: ['pc game pass', 'game pass pc'],
    domain: 'xbox.com',
    category: 'Gaming',
    plans: [
      { name: 'PC', amount: 12.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://account.microsoft.com/services',
    cancelNotes: 'Select Manage next to Game Pass, then Cancel subscription.',
  },

  // --- Sony: PlayStation Plus ---------------------------------------------------
  {
    id: 'playstation-plus-essential',
    name: 'PlayStation Plus Essential',
    aliases: ['ps plus', 'psn', 'ps+', 'playstation plus'],
    domain: 'playstation.com',
    category: 'Gaming',
    plans: [
      { name: 'Essential (monthly)', amount: 9.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Essential (yearly)', amount: 79.99, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://www.playstation.com/en-us/support/store/cancel-ps-store-subscription/',
    cancelNotes: 'Sign in and turn off auto-renew under Subscription Management.',
  },
  {
    id: 'playstation-plus-extra',
    name: 'PlayStation Plus Extra',
    aliases: ['ps plus extra', 'ps+ extra'],
    domain: 'playstation.com',
    category: 'Gaming',
    plans: [
      { name: 'Extra (monthly)', amount: 14.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Extra (yearly)', amount: 134.99, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://www.playstation.com/en-us/support/store/cancel-ps-store-subscription/',
    cancelNotes: 'Sign in and turn off auto-renew under Subscription Management.',
  },
  {
    id: 'playstation-plus-premium',
    name: 'PlayStation Plus Premium',
    aliases: ['ps plus premium', 'ps+ premium'],
    domain: 'playstation.com',
    category: 'Gaming',
    plans: [
      { name: 'Premium (monthly)', amount: 16.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Premium (yearly)', amount: 159.99, currency: 'EUR', frequency: 'yearly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://www.playstation.com/en-us/support/store/cancel-ps-store-subscription/',
    cancelNotes: 'Sign in and turn off auto-renew under Subscription Management.',
  },

  // --- Nintendo Switch Online (annual only in EU) ------------------------------
  {
    id: 'nintendo-switch-online',
    name: 'Nintendo Switch Online',
    aliases: ['nso', 'switch online', 'nintendo online'],
    domain: 'nintendo.com',
    category: 'Gaming',
    plans: [
      { name: 'Individual', amount: 19.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Family (8 accounts)', amount: 34.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://accounts.nintendo.com/subscription',
    cancelNotes: 'Open Nintendo Switch Online and turn off automatic renewal.',
  },
  {
    id: 'nintendo-switch-online-expansion',
    name: 'Nintendo Switch Online + Expansion Pack',
    aliases: ['nso expansion pack', 'switch online expansion', 'nso plus'],
    domain: 'nintendo.com',
    category: 'Gaming',
    plans: [
      { name: 'Individual', amount: 39.99, currency: 'EUR', frequency: 'yearly', default: true },
      { name: 'Family (8 accounts)', amount: 69.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Publisher subscriptions --------------------------------------------------
  {
    id: 'ea-play',
    name: 'EA Play',
    aliases: ['ea play', 'ea access', 'origin access'],
    domain: 'ea.com',
    category: 'Gaming',
    plans: [
      { name: 'Monthly', amount: 5.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Yearly', amount: 39.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://www.ea.com/manage-membership/cancel',
    cancelNotes: 'Cancel here if billed by EA directly; Steam/PlayStation/Xbox/Epic/Amazon subscriptions must be cancelled on that platform.',
  },
  {
    id: 'ea-play-pro',
    name: 'EA Play Pro',
    aliases: ['ea play pro', 'origin access premier'],
    domain: 'ea.com',
    category: 'Gaming',
    plans: [
      { name: 'Monthly', amount: 16.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Yearly', amount: 119.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'ubisoft-plus-classics',
    name: 'Ubisoft+ Classics',
    aliases: ['ubisoft plus classics', 'ubisoft+ classics', 'uplay classics'],
    domain: 'ubisoft.com',
    category: 'Gaming',
    plans: [
      { name: 'Classics', amount: 7.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'ubisoft-plus-premium',
    name: 'Ubisoft+ Premium',
    aliases: ['ubisoft plus', 'ubisoft+', 'uplay plus'],
    domain: 'ubisoft.com',
    category: 'Gaming',
    plans: [
      { name: 'Premium', amount: 17.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://account.ubisoft.com/subscriptions',
    cancelNotes: 'Cancel here if billed by Ubisoft directly; console/store subscriptions must be cancelled on that platform.',
  },

  // --- Cloud gaming -------------------------------------------------------------
  {
    id: 'geforce-now',
    name: 'GeForce NOW',
    aliases: ['geforce now', 'gfn', 'nvidia cloud gaming'],
    domain: 'nvidia.com',
    category: 'Gaming',
    plans: [
      { name: 'Performance', amount: 10.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Ultimate', amount: 21.99, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://account.nvidia.com',
    cancelNotes: 'Cancellation is a downgrade to the Free tier under account management; Apple/Google Play plans are cancelled in the store.',
  },
  {
    id: 'amazon-luna',
    name: 'Amazon Luna',
    aliases: ['luna', 'luna premium', 'luna+', 'amazon luna'],
    domain: 'luna.amazon.com',
    category: 'Gaming',
    plans: [
      { name: 'Premium', amount: 14.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://www.amazon.com/gp/css/subscriptions',
    cancelNotes: 'Manage Luna+ under Amazon Memberships & Subscriptions.',
  },

  // --- Curated app/game catalogues ---------------------------------------------
  {
    id: 'apple-arcade',
    name: 'Apple Arcade',
    aliases: ['apple arcade', 'arcade'],
    domain: 'apple.com',
    category: 'Gaming',
    plans: [
      { name: 'Standard', amount: 6.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'store',
  },
  {
    id: 'google-play-pass',
    name: 'Google Play Pass',
    aliases: ['play pass', 'google play pass'],
    domain: 'play.google.com',
    category: 'Gaming',
    plans: [
      { name: 'Monthly', amount: 4.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Yearly', amount: 29.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://play.google.com/store/account/subscriptions',
  },
  {
    id: 'humble-choice',
    name: 'Humble Choice',
    aliases: ['humble choice', 'humble monthly', 'humble bundle'],
    domain: 'humblebundle.com',
    category: 'Gaming',
    plans: [
      { name: 'Monthly', amount: 14.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Yearly', amount: 154.99, currency: 'USD', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- MMO / game subscriptions -------------------------------------------------
  {
    id: 'world-of-warcraft',
    name: 'World of Warcraft',
    aliases: ['wow', 'battle.net', 'blizzard', 'world of warcraft'],
    domain: 'worldofwarcraft.com',
    category: 'Gaming',
    plans: [
      // Only the 1-month plan: WoW's 3/6-month bundles are billed as a lump
      // sum, which the monthly-only schema would misrepresent as a recurring
      // monthly charge of 38.97/71.94.
      { name: '1 month', amount: 12.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'web',
    cancelUrl: 'https://account.battle.net/subscriptions',
    cancelNotes: 'Under Games & Subscriptions, cancel WoW recurring billing; the account and characters are preserved.',
  },
  {
    id: 'final-fantasy-xiv',
    name: 'Final Fantasy XIV',
    aliases: ['ffxiv', 'ff14', 'final fantasy 14', 'final fantasy xiv'],
    domain: 'finalfantasyxiv.com',
    category: 'Gaming',
    plans: [
      { name: 'Entry', amount: 11.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Standard', amount: 13.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Live-service / platform memberships (USD / virtual-currency priced) ------
  {
    id: 'roblox-premium',
    name: 'Roblox Premium',
    aliases: ['roblox premium', 'roblox', 'robux'],
    domain: 'roblox.com',
    category: 'Gaming',
    plans: [
      { name: 'Premium 450', amount: 4.99, currency: 'USD', frequency: 'monthly' },
      { name: 'Premium 1000', amount: 9.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Premium 2200', amount: 19.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://www.roblox.com/my/account#!/subscriptions',
    cancelNotes: 'In Settings > Subscriptions, choose Cancel Renewal; iOS/Android purchases must be cancelled in the store.',
  },
  {
    id: 'minecraft-realms-plus',
    name: 'Minecraft Realms Plus',
    aliases: ['minecraft realms', 'realms plus', 'minecraft realms plus'],
    domain: 'minecraft.net',
    category: 'Gaming',
    plans: [
      { name: 'Realms Plus', amount: 7.99, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'discord-nitro',
    name: 'Discord Nitro',
    aliases: ['discord nitro', 'nitro', 'discord'],
    domain: 'discord.com',
    category: 'Gaming',
    plans: [
      { name: 'Nitro Basic', amount: 2.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'Nitro (monthly)', amount: 9.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Nitro (yearly)', amount: 99.99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
    billing: 'both',
    cancelUrl: 'https://discord.com/settings/subscriptions',
    cancelNotes: 'Cancel here for web/desktop-purchased Nitro; iOS/Android purchases must be cancelled in the store.',
  },
  {
    id: 'twitch-turbo',
    name: 'Twitch Turbo',
    // No bare "twitch" alias — the video lot owns that so a "twitch" search
    // surfaces the main service, not the ad-free Turbo upsell.
    aliases: ['twitch turbo', 'turbo'],
    domain: 'twitch.tv',
    category: 'Gaming',
    plans: [
      { name: 'Turbo', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'fortnite-crew',
    name: 'Fortnite Crew',
    aliases: ['fortnite crew', 'fortnite', 'crew'],
    domain: 'fortnite.com',
    category: 'Gaming',
    plans: [
      { name: 'Crew', amount: 11.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
];
