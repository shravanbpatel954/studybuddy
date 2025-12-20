// Test Google OAuth Configuration
require('dotenv').config();

console.log('=== Google OAuth Configuration Test ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('Expected Callback URL: http://localhost:8080/api/v1/auth/google/callback');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('\n❌ ERROR: Google OAuth environment variables are not set!');
    console.log('Please create a .env file in the backend directory with:');
    console.log('GOOGLE_CLIENT_ID=your_client_id_here');
    console.log('GOOGLE_CLIENT_SECRET=your_client_secret_here');
} else {
    console.log('\n✅ Google OAuth environment variables are configured');
}

console.log('\n=== Google Cloud Console Configuration Required ===');
console.log('Authorized redirect URIs:');
console.log('✅ http://localhost:8080/api/v1/auth/google/callback');
console.log('✅ http://localhost:3000/success');
console.log('\nAuthorized JavaScript origins:');
console.log('✅ http://localhost:8080');
console.log('✅ http://localhost:3000');
