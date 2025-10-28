// Configurável: ajuste os nomes abaixo para casar com suas tabelas Supabase
export const FINANCE_TABLES = {
  transactions: 'finance_transactions',   // id, type('IN'|'OUT'), method('BANK'|'CASH'), date, original_date, description, amount, matched, matched_id, deleted_at
  bankStatements: 'bank_statements',      // id, op_date, description, amount, balance, source_file, hash_key, matched, matched_tx_id, deleted_at
  employeesDaily: 'employees_daily',      // id, name, diaria_semana, diaria_fimsemana, active
  holidays: 'holidays'                    // id, date, name
} as const;
