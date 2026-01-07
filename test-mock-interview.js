// Test Mock Interview Feature
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testMockInterview() {
  console.log('🎯 Testing Mock Interview Feature...\n');

  try {
    // Test 1: Generate interview questions
    console.log('1. Testing question generation...');
    const questionsResponse = await fetch(
      `${BASE_URL}/api/mock-interview/generate-interview-questions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: 'Software Engineer',
          interviewType: 'technical',
          experienceLevel: 'mid',
          duration: 30,
        }),
      },
    );

    if (questionsResponse.ok) {
      const questionsData = await questionsResponse.json();
      console.log('✅ Questions generated:', questionsData.data.length, 'questions');
      console.log('   Sample question:', questionsData.data[0]?.text);
    } else {
      console.log('❌ Question generation failed:', questionsResponse.status);
    }

    // Test 2: Create interview session
    console.log('\n2. Testing session creation...');
    const sessionResponse = await fetch(`${BASE_URL}/api/mock-interview/interview-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobRole: 'Software Engineer',
        interviewType: 'technical',
        duration: 30,
      }),
    });

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('✅ Session created:', sessionData.data.sessionToken);

      // Test 3: Upload response (mock)
      console.log('\n3. Testing response upload...');
      const uploadResponse = await fetch(
        `${BASE_URL}/api/mock-interview/upload-interview-response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: sessionData.data.sessionToken,
            questionId: 1,
            videoUrl: '/mock-video.webm',
          }),
        },
      );

      if (uploadResponse.ok) {
        console.log('✅ Response uploaded successfully');

        // Test 4: Get results
        console.log('\n4. Testing results generation...');
        const resultsResponse = await fetch(
          `${BASE_URL}/api/mock-interview/interview-results/${sessionData.data.sessionToken}`,
        );

        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          console.log('✅ Results generated:');
          console.log('   Overall Score:', resultsData.data.overallScore);
          console.log('   Strengths:', resultsData.data.strengths?.length || 0);
          console.log('   Improvements:', resultsData.data.improvements?.length || 0);
        } else {
          console.log('❌ Results generation failed:', resultsResponse.status);
        }
      } else {
        console.log('❌ Response upload failed:', uploadResponse.status);
      }
    } else {
      console.log('❌ Session creation failed:', sessionResponse.status);
    }

    console.log('\n🎯 Mock Interview test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMockInterview();
