CREATE OR REPLACE FUNCTION preview_next_invoice_number(p_date date)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_fy text;
  v_prefix text;
  v_last_number int;
  v_next_number int;
  v_year int;
  v_month int;
BEGIN
  -- 1. Calculate Financial Year (e.g., 25-26)
  v_year := EXTRACT(YEAR FROM p_date);
  v_month := EXTRACT(MONTH FROM p_date);
  
  IF v_month >= 4 THEN
    v_fy := to_char(v_year % 100, 'FM00') || '-' || to_char((v_year + 1) % 100, 'FM00');
  ELSE
    v_fy := to_char((v_year - 1) % 100, 'FM00') || '-' || to_char(v_year % 100, 'FM00');
  END IF;

  -- 2. Fetch Sequence
  SELECT prefix, last_number INTO v_prefix, v_last_number
  FROM invoice_sequences
  WHERE financial_year = v_fy;

  -- 3. If missing, insert default and use it
  IF NOT FOUND THEN
    v_prefix := 'KS'; -- Default prefix as per user "Take prefix from invoice_sequence" (implies manual config, but we need a default)
    v_last_number := 0;
    
    INSERT INTO invoice_sequences (financial_year, prefix, last_number)
    VALUES (v_fy, v_prefix, v_last_number);
  END IF;

  v_next_number := v_last_number + 1;
  
  -- 4. Format: KS25-26-0001 (Example format since user didn't specify exact separator, but this is common)
  -- Wait, user said "Take the prefix from the invoice_sequence... Number should be formatted to 4 number. 1 means 0001".
  -- User example: "Prefix from invoice_sequence".
  -- If prefix is 'KS', result is 'KS0001'.
  -- But typically FY is needed to be unique.
  -- "Check for current financial based on invoice date. financial year is saved like 25-26."
  -- Maybe the prefix *includes* the FY? e.g. 'KS25-26'.
  -- Let's construct a safe default: Prefix + Number.
  -- The User said: "Take the prefix from the invoice_sequence... Prefill the next number... Number should be formatted to 4 number."
  -- I will return prefix || lpad(number, 4, '0').
  
  RETURN v_prefix || lpad(v_next_number::text, 4, '0');
END;
$$;
