import type { CatalogService } from './types';

// PRODUCTIVITY / SaaS / AI tools — consumer/individual subscriptions.
// Currency = the native currency the vendor charges in Europe (EUR when they
// price in EUR at a French checkout, USD when they bill globally in USD).
// Prices are indicative "last known" figures verified 2026-07 — the wizard
// pre-selects the plan marked `default: true`.
export const PRODUCTIVITY: CatalogService[] = [
  // --- AI assistants ---
  {
    id: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    aliases: ['chatgpt', 'openai', 'gpt'],
    domain: 'openai.com',
    category: 'Productivity',
    plans: [
      { name: 'Plus', amount: 20, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Pro', amount: 200, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'claude-pro',
    name: 'Claude Pro',
    aliases: ['claude', 'anthropic'],
    domain: 'claude.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 20, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Pro (annual)', amount: 17, currency: 'USD', frequency: 'monthly' },
      { name: 'Max', amount: 100, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'google-ai-pro',
    name: 'Google AI Pro',
    aliases: ['gemini', 'gemini advanced', 'google one ai', 'google ai'],
    domain: 'google.com',
    category: 'Productivity',
    plans: [
      { name: 'AI Plus', amount: 7.99, currency: 'EUR', frequency: 'monthly' },
      { name: 'AI Pro', amount: 18.33, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'perplexity-pro',
    name: 'Perplexity Pro',
    aliases: ['perplexity'],
    domain: 'perplexity.ai',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 20, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Pro (annual)', amount: 16.67, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Office / all-in-one suites ---
  {
    id: 'microsoft-365-personal',
    name: 'Microsoft 365 Personnel',
    aliases: ['office 365', 'microsoft 365', 'office', 'm365'],
    domain: 'microsoft.com',
    category: 'Productivity',
    plans: [
      { name: 'Personnel', amount: 10, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Personnel (annuel)', amount: 99, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'microsoft-365-family',
    name: 'Microsoft 365 Famille',
    aliases: ['office 365 family', 'microsoft 365 family', 'm365 family'],
    domain: 'microsoft.com',
    category: 'Productivity',
    plans: [
      { name: 'Famille', amount: 13, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Famille (annuel)', amount: 129, currency: 'EUR', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    aliases: ['gsuite', 'g suite', 'workspace'],
    domain: 'workspace.google.com',
    category: 'Productivity',
    plans: [
      { name: 'Business Starter', amount: 6.9, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Notes / knowledge / tasks ---
  {
    id: 'notion-plus',
    name: 'Notion Plus',
    aliases: ['notion'],
    domain: 'notion.com',
    category: 'Productivity',
    plans: [
      { name: 'Plus', amount: 9.5, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Plus (annuel)', amount: 8, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'obsidian-sync',
    name: 'Obsidian Sync',
    aliases: ['obsidian'],
    domain: 'obsidian.md',
    category: 'Productivity',
    plans: [
      { name: 'Sync', amount: 5, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Publish', amount: 10, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'evernote',
    name: 'Evernote',
    aliases: ['evernote'],
    domain: 'evernote.com',
    category: 'Productivity',
    plans: [
      { name: 'Starter', amount: 99, currency: 'USD', frequency: 'yearly', default: true },
      { name: 'Advanced', amount: 249.99, currency: 'USD', frequency: 'yearly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'todoist-pro',
    name: 'Todoist Pro',
    aliases: ['todoist'],
    domain: 'todoist.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 7, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Pro (annual)', amount: 5, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Project / task management ---
  {
    id: 'trello',
    name: 'Trello',
    aliases: ['trello'],
    domain: 'trello.com',
    category: 'Productivity',
    plans: [
      { name: 'Standard', amount: 6, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Premium', amount: 12.5, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'linear',
    name: 'Linear',
    aliases: ['linear'],
    domain: 'linear.app',
    category: 'Productivity',
    plans: [
      { name: 'Basic (annual)', amount: 10, currency: 'USD', frequency: 'monthly' },
      { name: 'Basic', amount: 12, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    aliases: ['airtable'],
    domain: 'airtable.com',
    category: 'Productivity',
    plans: [
      { name: 'Team', amount: 24, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Team (annual)', amount: 20, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    aliases: ['clickup'],
    domain: 'clickup.com',
    category: 'Productivity',
    plans: [
      { name: 'Unlimited', amount: 10, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Unlimited (annual)', amount: 7, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Automation ---
  {
    id: 'zapier',
    name: 'Zapier',
    aliases: ['zapier'],
    domain: 'zapier.com',
    category: 'Productivity',
    plans: [
      { name: 'Professional', amount: 29.99, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Professional (annual)', amount: 19.99, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'make',
    name: 'Make',
    aliases: ['make', 'integromat'],
    domain: 'make.com',
    category: 'Productivity',
    plans: [
      { name: 'Core', amount: 9, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Writing / AI writing ---
  {
    id: 'grammarly-pro',
    name: 'Grammarly Pro',
    aliases: ['grammarly'],
    domain: 'grammarly.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 30, currency: 'EUR', frequency: 'monthly' },
      { name: 'Pro (annuel)', amount: 12, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Creative / design ---
  {
    id: 'figma-professional',
    name: 'Figma Professional',
    aliases: ['figma'],
    domain: 'figma.com',
    category: 'Productivity',
    plans: [
      { name: 'Professional', amount: 16, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Professional (annual)', amount: 12, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'canva-pro',
    name: 'Canva Pro',
    aliases: ['canva'],
    domain: 'canva.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 12, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    aliases: ['adobe', 'creative cloud', 'adobe cc'],
    domain: 'adobe.com',
    category: 'Productivity',
    plans: [
      { name: 'Toutes les applications', amount: 78.65, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'adobe-photography',
    name: 'Adobe Photographie',
    aliases: ['adobe photography', 'lightroom', 'photoshop'],
    domain: 'adobe.com',
    category: 'Productivity',
    plans: [
      { name: 'Formule Photo (1 To)', amount: 23.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'adobe-acrobat-pro',
    name: 'Adobe Acrobat Pro',
    aliases: ['acrobat', 'adobe acrobat', 'pdf'],
    domain: 'adobe.com',
    category: 'Productivity',
    plans: [
      { name: 'Acrobat Pro', amount: 19.99, currency: 'EUR', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Video / audio creation ---
  {
    id: 'descript',
    name: 'Descript',
    aliases: ['descript'],
    domain: 'descript.com',
    category: 'Productivity',
    plans: [
      { name: 'Creator', amount: 35, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Creator (annual)', amount: 24, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'loom',
    name: 'Loom',
    aliases: ['loom'],
    domain: 'loom.com',
    category: 'Productivity',
    plans: [
      { name: 'Business', amount: 18, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Business (annual)', amount: 12.5, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Communication / meetings / whiteboard ---
  {
    id: 'zoom-pro',
    name: 'Zoom Pro',
    aliases: ['zoom'],
    domain: 'zoom.us',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 15.99, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Pro (annuel)', amount: 13.33, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'slack-pro',
    name: 'Slack Pro',
    aliases: ['slack'],
    domain: 'slack.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 8.25, currency: 'EUR', frequency: 'monthly', default: true },
      { name: 'Pro (annuel)', amount: 6.75, currency: 'EUR', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'miro',
    name: 'Miro',
    aliases: ['miro'],
    domain: 'miro.com',
    category: 'Productivity',
    plans: [
      { name: 'Starter', amount: 10, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Starter (annual)', amount: 8, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Email / launcher ---
  {
    id: 'superhuman',
    name: 'Superhuman',
    aliases: ['superhuman'],
    domain: 'superhuman.com',
    category: 'Productivity',
    plans: [
      { name: 'Business', amount: 40, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Business (annual)', amount: 33, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'raycast-pro',
    name: 'Raycast Pro',
    aliases: ['raycast'],
    domain: 'raycast.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 10, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Pro (annual)', amount: 8, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },

  // --- Developer / hosting ---
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    aliases: ['github', 'copilot', 'github copilot'],
    domain: 'github.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 10, currency: 'USD', frequency: 'monthly', default: true },
      { name: 'Pro (annual)', amount: 8.33, currency: 'USD', frequency: 'monthly' },
      { name: 'Pro+', amount: 39, currency: 'USD', frequency: 'monthly' },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'gitlab-premium',
    name: 'GitLab Premium',
    aliases: ['gitlab'],
    domain: 'gitlab.com',
    category: 'Productivity',
    plans: [
      { name: 'Premium', amount: 29, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'vercel-pro',
    name: 'Vercel Pro',
    aliases: ['vercel'],
    domain: 'vercel.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 20, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
  {
    id: 'netlify-pro',
    name: 'Netlify Pro',
    aliases: ['netlify'],
    domain: 'netlify.com',
    category: 'Productivity',
    plans: [
      { name: 'Pro', amount: 20, currency: 'USD', frequency: 'monthly', default: true },
    ],
    pricesUpdatedAt: '2026-07',
  },
];
