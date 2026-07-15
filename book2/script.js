// book/script.js - MK48/49 编年史
console.log('初始化Supabase客户端...');

const SUPABASE_URL = 'https://rjstjmxwizfxrgrwgyab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqc3RqbXh3aXpmeHJncndneWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjAxODgsImV4cCI6MjA5OTU5NjE4OH0.m44t35UhOjRuRAUB9qMiIn-1enGk3lNCKqjVe_6kPt0';

// 使用 window.supabase 调用 CDN 库，变量名改为 supabaseClient 避免冲突
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase客户端初始化完成');
