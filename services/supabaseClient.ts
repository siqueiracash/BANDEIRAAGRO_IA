import { createClient } from '@supabase/supabase-js';

// Chaves fornecidas
const SUPABASE_URL = 'https://hqmhktqmduryhyocmqnn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbWhrdHFtZHVyeWh5b2NtcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTU1MTAsImV4cCI6MjA4MDI3MTUxMH0.yJiifkEVCkg3yFqc_vi5e7Ry1LtFQWkUVg3hWVRn3SU';

// Cria o cliente apenas se as chaves existirem
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);