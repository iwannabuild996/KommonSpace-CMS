CREATE TABLE IF NOT EXISTS invoice_sequences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    financial_year text NOT NULL,
    prefix text NOT NULL,
    last_number int NOT NULL DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT invoice_sequences_pkey PRIMARY KEY (id),
    CONSTRAINT invoice_sequences_fy_key UNIQUE (financial_year)
);

-- RLS
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users on invoice_sequences"
ON invoice_sequences FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
