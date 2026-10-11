export type ModelPrice = {
  input: string;
  output: string;
  cacheHit: string;
  source: string;
};
export type ModelPrices = Record<string, ModelPrice>;
export const priceKey = (provider: string, model: string) =>
  JSON.stringify([provider, model]);
