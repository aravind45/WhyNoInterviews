const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

async function testSessionFix() {
  console.log('🧪 Testing session token fix...\n');
  
  try {
    // Create a simple test resume file
    const testResumeContent = `
John Doe
Software Engineer
Email: john@example.com
Phone: (555) 123-4567

EXPERIENCE:
Software Engineer at Tech Corp (2020-2023)
- Developed web applications using React and Node.js
- Improved system performance by 30%

SKILLS:
JavaScript, React, Node.js, Python, SQL
`;
    
    fs.writeFileSync('test-resume.txt', testResumeContent);
    
    // Test analyze-match endpoint (this should trigger session creation)
    console.log('1. Testing analyze-match endpoint...');
    const form = new FormData();
    form.append('resume', fs.createReadStream('test-resume.txt'));
    form.append('targetJobTitle', 'Software Engineer');
    form.append('jobDescription', 'Looking for a skilled software engineer with React experience');
    
    try {
      const response = await axios.post(`${BASE_URL}/api/analyze-match`, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 30000
      });
      
      console.log('✅ Analyze-match successful!');
      console.log('Response status:', response.status);
      console.log('Session ID:', response.data.sessionId);
      
      if (response.data.sessionId) {
        console.log('✅ Session creation working correctly');
      } else {
        console.log('⚠️  No session ID returned');
      }
      
    } catch (error) {
      if (error.response) {
        console.log('❌ Analyze-match failed with status:', error.response.status);
        console.log('Error data:', error.response.data);
        
        if (error.response.data && error.response.data.includes && error.response.data.includes('session_token')) {
          console.log('❌ STILL HAS SESSION_TOKEN ERROR - fix incomplete');
        } else {
          console.log('✅ No session_token error - fix appears successful');
        }
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    
    // Clean up
    fs.unlinkSync('test-resume.txt');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  }
}

testSessionFix();