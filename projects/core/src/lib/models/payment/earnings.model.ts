export interface TopClient {
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  totalPaidCents: number;
}

export interface EarningsSummary {
  currency: string;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  nextPayoutDate: string | null;
  monthToDateRevenueCents: number;
  outstandingInvoicesCents: number;
  topClients: TopClient[];
}
