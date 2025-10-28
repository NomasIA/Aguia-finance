/*
  # Adicionar campo valor_diaria à tabela maquinas
  
  1. Changes
    - Add `valor_diaria` column to `maquinas` table for daily rental rate
    - This will be used for rental contract calculations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maquinas' AND column_name = 'valor_diaria'
  ) THEN
    ALTER TABLE maquinas ADD COLUMN valor_diaria numeric DEFAULT 0;
  END IF;
END $$;
