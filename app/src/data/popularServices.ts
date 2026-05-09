export type PopularService = {
  id: string;
  name: string;
  defaultAmount: number;
  defaultCurrency: string;
  defaultFrequency: 'monthly' | 'yearly' | 'weekly';
};

// Curated grid for the add-flow library. Order matters — most-common first
// so the grid feels relevant from the top down.
export const POPULAR_SERVICES: PopularService[] = [
  // Streaming (most-tracked category)
  {
    id: 'netflix',
    name: 'Netflix',
    defaultAmount: 15.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    defaultAmount: 10.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    defaultAmount: 11.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime',
    defaultAmount: 6.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'disney+',
    name: 'Disney+',
    defaultAmount: 8.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'hbo-max',
    name: 'HBO Max',
    defaultAmount: 9.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    defaultAmount: 9.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    defaultAmount: 10.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'paramount+',
    name: 'Paramount+',
    defaultAmount: 7.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    defaultAmount: 7.99,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    defaultAmount: 5.99,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },

  // Productivity / SaaS
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    defaultAmount: 20.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'claude',
    name: 'Claude Pro',
    defaultAmount: 20.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'github',
    name: 'GitHub Pro',
    defaultAmount: 4.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'notion',
    name: 'Notion',
    defaultAmount: 8.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'linear',
    name: 'Linear',
    defaultAmount: 8.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'figma',
    name: 'Figma',
    defaultAmount: 12.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'slack',
    name: 'Slack',
    defaultAmount: 7.25,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'adobe-cc',
    name: 'Adobe Creative Cloud',
    defaultAmount: 59.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    defaultAmount: 7.0,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'vercel',
    name: 'Vercel Pro',
    defaultAmount: 20.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },

  // Cloud / Storage
  {
    id: 'icloud',
    name: 'iCloud+ 200GB',
    defaultAmount: 2.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    defaultAmount: 11.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'google-one',
    name: 'Google One',
    defaultAmount: 1.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },

  // Privacy / Security
  {
    id: '1password',
    name: '1Password',
    defaultAmount: 2.99,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden Premium',
    defaultAmount: 10.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'yearly',
  },
  {
    id: 'nordvpn',
    name: 'NordVPN',
    defaultAmount: 11.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'protonmail',
    name: 'Proton Mail',
    defaultAmount: 4.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },

  // News / Reading
  {
    id: 'nyt',
    name: 'New York Times',
    defaultAmount: 4.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'weekly',
  },
  {
    id: 'economist',
    name: 'The Economist',
    defaultAmount: 199.0,
    defaultCurrency: 'GBP',
    defaultFrequency: 'yearly',
  },
  {
    id: 'substack',
    name: 'Substack (writer)',
    defaultAmount: 5.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },
  {
    id: 'audible',
    name: 'Audible',
    defaultAmount: 9.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'patreon',
    name: 'Patreon (creator)',
    defaultAmount: 5.0,
    defaultCurrency: 'USD',
    defaultFrequency: 'monthly',
  },

  // Wellness
  {
    id: 'gym',
    name: 'Gym',
    defaultAmount: 35.0,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'peloton',
    name: 'Peloton App',
    defaultAmount: 12.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'headspace',
    name: 'Headspace',
    defaultAmount: 12.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'calm',
    name: 'Calm',
    defaultAmount: 12.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
];
