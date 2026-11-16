export type TPlanPackage = {
  price: string;
  priceMicros: number;
  hasFreeTrial: boolean;
  trialDays: number | null;
};

export type TPlanOffer = {
  monthly: TPlanPackage | null;
  annual: TPlanPackage | null;
};
