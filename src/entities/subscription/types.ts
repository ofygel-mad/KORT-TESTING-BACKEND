// Subscription & plan — the data-driven replacement for the bare Organization.mode string.

export interface Plan {
  code: string;
  name: string;
  description: string;
  rank: number;
  max_users: number | null; // null = unlimited
  features: string[];
}

export type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'cancelled';

export interface Subscription {
  id: string;
  plan_code: string;
  status: SubscriptionStatus;
  period_start: string;
  period_end: string | null;
  trial_ends_at: string | null;
  plan: Plan;
}
