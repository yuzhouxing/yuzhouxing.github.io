// book/script.js
const SUPABASE_URL = 'https://exvsmuoyxmpnnaocoxie.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dnNtdW95eG1wbm5hb2NveGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTY5MTQsImV4cCI6MjA3MjEzMjkxNH0.0tcoiCMaIMI7tdu_Zajg0Dq4kp_qnG-K4r1Ak89g6JM'; // 从Settings -> API 获取

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
