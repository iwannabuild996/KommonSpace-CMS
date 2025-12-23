CREATE OR REPLACE FUNCTION update_last_invoice_number(p_date date, p_number text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_fy text;
  v_year int;
  v_month int;
  v_prefix text;
  v_current_last int;
  v_new_number int;
  v_extracted_number int;
BEGIN
  -- 1. Calculate FY
  v_year := EXTRACT(YEAR FROM p_date);
  v_month := EXTRACT(MONTH FROM p_date);
  
  IF v_month >= 4 THEN
    v_fy := to_char(v_year % 100, 'FM00') || '-' || to_char((v_year + 1) % 100, 'FM00');
  ELSE
    v_fy := to_char((v_year - 1) % 100, 'FM00') || '-' || to_char(v_year % 100, 'FM00');
  END IF;

  -- 2. Get current state
  SELECT prefix, last_number INTO v_prefix, v_current_last
  FROM invoice_sequences
  WHERE financial_year = v_fy;

  IF NOT FOUND THEN
    -- Should have been created by preview, but safety first
    v_prefix := 'KS';
    INSERT INTO invoice_sequences (financial_year, prefix, last_number)
    VALUES (v_fy, v_prefix, 0);
    v_current_last := 0;
  END IF;

  -- 3. Extract number from p_number
  -- Assume format ends with 4 digits. Or extract all digits?
  -- Regex to get trailing digits
  v_extracted_number := (substring(p_number FROM '([0-9]+)$'))::int;
  
  -- If regex fail, default to 0
  IF v_extracted_number IS NULL THEN
     v_extracted_number := 0;
  END IF;

  -- 4. Update if greater
  IF v_extracted_number > v_current_last THEN
    UPDATE invoice_sequences
    SET last_number = v_extracted_number
    WHERE financial_year = v_fy;
  END IF;
END;
$$;
