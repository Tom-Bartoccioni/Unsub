export type PopularService = {
  id: string;
  name: string;
  defaultAmount: number;
  defaultCurrency: string;
  defaultFrequency: 'monthly' | 'yearly' | 'weekly';
};

export const POPULAR_SERVICES: PopularService[] = [
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
    id: 'youtube-premium',
    name: 'YouTube Premium',
    defaultAmount: 11.99,
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
    id: 'icloud',
    name: 'iCloud+ 200GB',
    defaultAmount: 2.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
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
    id: 'adobe-cc',
    name: 'Adobe Creative Cloud',
    defaultAmount: 59.99,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
  {
    id: 'gym',
    name: 'Gym',
    defaultAmount: 35.0,
    defaultCurrency: 'EUR',
    defaultFrequency: 'monthly',
  },
];
