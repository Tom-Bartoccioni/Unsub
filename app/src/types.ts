export type Subscription = {
  id: string;
  provider: string;
  category: string | null;
  amount: number;
  currency: string;
  frequency: string;
  nextRenewalDate: string | null;
  confidence: number;
  status: string;
  sourceDate: string | null;
  updatedAt: string;
};

export type SubscriptionsResponse = { subscriptions: Subscription[] };
