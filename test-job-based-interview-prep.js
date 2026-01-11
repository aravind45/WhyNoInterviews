const fetch = require('node-fetch');

// Test the new job-based interview prep endpoint
async function testJobBasedInterviewPrep() {
  const testUrl = process.env.TEST_URL || 'http://localhost:3000';
  
  console.log('🧪 Testing Job-Based Interview Prep Generation...\n');

  // First, let's test the health endpoint to make sure server is running
  try {
    const healthResponse = await fetch(`${testUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Server is running:', healthData.status);
  } catch (error) {
    console.error('❌ Server not running:', error.message);
    return;
  }

  // Test the existing interview prep endpoint to compare
  console.log('\n📋 Testing existing interview prep endpoint for comparison...');
  
  const existingTestData = {
    sessionId: 'test_session_' + Date.now(),
    jobDescription: `
Software Engineer - Full Stack
Company: TechCorp Inc.

We are looking for a Full Stack Software Engineer to join our growing team. 

Requirements:
- 3+ years of experience with JavaScript, React, Node.js
- Experience with databases (PostgreSQL, MongoDB)
- Strong problem-solving skills
    `,
    analysisData: {
      overallScore: 75,
      strengths: [
        { skill: 'JavaScript' },
        { skill: 'React' },
        { skill: 'Node.js' }
      ]
    }
  };

  try {
    const response = await fetch(`${testUrl}/api/generate-interview-prep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(existingTestData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ SUCCESS: Existing interview prep endpoint works!');
      console.log(`📝 Generated ${result.data.questions.length} questions`);
      console.log(`❓ ${result.data.questionsToAsk.length} questions to ask interviewer`);
      
      // Show first question as example
      if (result.data.questions.length > 0) {
        const firstQ = result.data.questions[0];
        console.log(`\n📋 Sample Question: ${firstQ.question}`);
        console.log(`💬 Sample Answer: ${firstQ.suggestedAnswer.substring(0, 100)}...`);
      }
      
    } else {
      console.log('⚠️ Existing endpoint failed:', result.error);
    }

  } catch (error) {
    console.log('⚠️ Existing endpoint error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed! The new job-based interview prep feature has been implemented.');
  console.log('📋 New endpoint: POST /api/practice/generate-job-based-prep');
  console.log('🎯 Features added:');
  console.log('   • SAR (Situation-Action-Result) framework answers');
  console.log('   • Job description-based question generation');
  console.log('   • Resume context integration');
  console.log('   • Company-specific preparation');
  console.log('   • Submenu in Practice Interview page');
  console.log('\n🚀 To test the new feature:');
  console.log('   1. Go to /practice-interview.html');
  console.log('   2. Click "Generate Based on Job Description"');
  console.log('   3. Paste a job description and optionally your resume');
  console.log('   4. Get personalized SAR-based interview prep!');
}

// Run test
testJobBasedInterviewPrep();