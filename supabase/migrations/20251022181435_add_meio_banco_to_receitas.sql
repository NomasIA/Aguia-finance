/*
  # Add meio_banco column to receitas

  1. Changes
    - Add `meio_banco` column to receitas table
    - Values: 'pix' | 'transferencia' | null
    - Only relevant when forma_recebimento = 'banco'

  2. Notes
    - Used for bank reconciliation tracking
    - Helps identify payment method for bank transactions
*/

-- Add meio_banco column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receitas' AND column_name = 'meio_banco'
  ) THEN
    ALTER TABLE receitas 
    ADD COLUMN meio_banco TEXT CHECK (meio_banco IN ('pix', 'transferencia'));
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN receitas.meio_banco IS 'Payment method for bank transactions: pix or transferencia';
