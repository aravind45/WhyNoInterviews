const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const clientId = process.env.GOOGLE_CLIENT_ID;
console.log('Client ID from env:', clientId);
console.log('Client ID length:', clientId ? clientId.length : 0);

const googleClient = new OAuth2Client(clientId);

// Test verification setup
console.log('\n--- OAuth2Client Configuration ---');
console.log('Client initialized:', !!googleClient);
console.log('Expected audience:', clientId);

// Note: We can't actually test verification without a real token from Google
console.log(
  '\nTo debug further, we need to see the actual error from the server logs when OAuth fails.',
);
console.log('The error is likely in the token verification step at auth.ts line 144-147');
