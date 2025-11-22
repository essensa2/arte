const fs = require('fs');
const path = require('path');

// Read the example file
const examplePath = path.join(__dirname, 'ENV.example');
const envLocalPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envLocalPath)) {
  // Copy example to .env.local
  fs.copyFileSync(examplePath, envLocalPath);
  console.log('✅ Created .env.local file from ENV.example');
  console.log('\n📝 Please update the following values in .env.local:');
  console.log('');
  console.log('1. NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL');
  console.log('2. NEXT_PUBLIC_SUPABASE_ANON_KEY - Your Supabase anonymous key');
  console.log('3. SUPABASE_URL - Same as #1');
  console.log('4. SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key');
  console.log('5. SUPABASE_FUNCTIONS_URL - Your Supabase functions URL');
  console.log('6. OPENROUTER_API_KEY - Your OpenRouter API key (required for AI bot)');
  console.log('');
  console.log('🔑 Get OpenRouter API key from: https://openrouter.ai/keys');
  console.log('');
  console.log('After updating the values, restart your development server with: npm run dev');
} else {
  console.log('⚠️  .env.local file already exists');
  console.log('');
  console.log('Please check that OPENROUTER_API_KEY is set in your .env.local file');
  console.log('Current file contents:');
  console.log('');
  const content = fs.readFileSync(envLocalPath, 'utf8');
  console.log(content);
}
