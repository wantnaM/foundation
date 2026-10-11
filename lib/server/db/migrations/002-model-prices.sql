CREATE TABLE model_prices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  currency text NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  input_price numeric(16,6) NOT NULL CHECK (input_price >= 0),
  output_price numeric(16,6) NOT NULL CHECK (output_price >= 0),
  cache_hit_price numeric(16,6) NOT NULL CHECK (cache_hit_price >= 0),
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL DEFAULT 'manual'
);
CREATE INDEX model_prices_lookup ON model_prices(provider_id, model_id, effective_at DESC, id DESC);
-- CNY per million tokens, official peak rates selected by the user.
-- The legacy v4-flash alias is billed at the current Flash rate.
-- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
INSERT INTO model_prices(provider_id,model_id,input_price,output_price,cache_hit_price,source) VALUES
('deepseek','deepseek-v4-flash',2,8,0.04,'deepseek-official-peak'),
('deepseek','deepseek-v4-pro',9,27,0.30,'deepseek-official-peak');
