// Test script to verify fallback question quality
const { generateInterviewQuestions } = require('./dist/services/questionGenerator');

async function testFallbackQuestions() {
  console.log('🎯 Testing Fallback Question Quality...\n');

  // Force fallback by using invalid provider (LLM will fail)
  const testParams = [
    {
      jobRole: 'Software Engineer',
      interviewType: 'technical',
      experienceLevel: 'mid',
      duration: 30,
    },
    {
      jobRole: 'Frontend Developer',
      interviewType: 'behavioral',
      experienceLevel: 'senior',
      duration: 30,
    },
    {
      jobRole: 'Full Stack Developer',
      interviewType: 'mixed',
      experienceLevel: 'junior',
      duration: 30,
    },
  ];

  for (const params of testParams) {
    console.log(`\n📋 ${params.interviewType.toUpperCase()} Questions for ${params.jobRole}:`);
    console.log('─'.repeat(60));

    try {
      const questions = await generateInterviewQuestions(params);

      let totalWords = 0;
      let longQuestions = 0;

      questions.forEach((q, index) => {
        const wordCount = q.text.split(' ').length;
        const sentenceCount = q.text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
        totalWords += wordCount;

        if (wordCount > 20) longQuestions++;

        console.log(`${index + 1}. "${q.text}"`);
        console.log(`   📊 ${wordCount} words, ${sentenceCount} sentence(s)`);

        // Quality check
        const isGoodLength = wordCount <= 20;
        const isConcise = sentenceCount <= 2;
        const status = isGoodLength && isConcise ? '✅ CONCISE' : '⚠️  TOO LONG';
        console.log(`   ${status}\n`);
      });

      const avgWords = Math.round(totalWords / questions.length);
      console.log(`📈 SUMMARY: ${questions.length} questions, avg ${avgWords} words each`);
      console.log(
        `${longQuestions === 0 ? '✅' : '⚠️'} ${longQuestions} questions over 20 words\n`,
      );
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('🎯 Fallback Question Test Complete!');
}

testFallbackQuestions().catch(console.error);
