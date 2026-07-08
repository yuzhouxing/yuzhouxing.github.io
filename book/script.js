// book/script.js
console.log('初始化Supabase客户端...');

const SUPABASE_URL = 'https://seijdhrrdpojbkuwddmq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlaWpkaHJyZHBvamJrdXdkZG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDE3OTEsImV4cCI6MjA5OTA3Nzc5MX0.0E1QZXiPS203lltmW6XwrnG4Dd0MhxJpwpI-RDRgqG4';

// 使用 window.supabase 调用 CDN 库，变量名改为 supabaseClient 避免冲突
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase客户端初始化完成');
