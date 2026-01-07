require('dotenv').config();

console.log('--- Environment Check ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
if (process.env.GOOGLE_CLIENT_ID) {
    console.log('Value:', process.env.GOOGLE_CLIENT_ID);
}
