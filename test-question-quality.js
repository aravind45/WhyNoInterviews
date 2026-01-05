// Test script to verify question quality improvements
const { generateInterviewQuestions } = require('./dist/services/questionGenerator');

async function testQuestionQuality() {
    console.log('🎯 Testing Question Quality Improvements...\n');

    const testParams = [
        {
            jobRole: 'Software Engineer',
            interviewType: 'technical',
            experienceLevel: 'mid',
            duration: 30
        },
        {
            jobRole: 'Frontend Developer',
            interviewType: 'behavioral',
            experienceLevel: 'senior',
            duration: 45
        },
        {
            jobRole: 'Full Stack Developer',
            interviewType: 'mixed',
            experienceLevel: 'junior',
            duration: 60
        }
    ];

    for (const params of testParams) {
        console.log(`\n📋 Testing ${params.interviewType} questions for ${params.jobRole} (${params.experienceLevel} level):`);
        console.log(`Duration: ${params.duration} minutes\n`);

        try {
            const questions = await generateInterviewQuestions(params);
            
            questions.forEach((q, index) => {
                const wordCount = q.text.split(' ').length;
                const sentenceCount = q.text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
                
                console.log(`${index + 1}. "${q.text}"`);
                console.log(`   📊 ${wordCount} words, ${sentenceCount} sentence(s), ${q.expectedDuration}s duration`);
                
                // Check if question meets quality criteria
                const isGoodLength = wordCount <= 20; // Reasonable word limit
                const isConcise = sentenceCount <= 2; // Max 2 sentences
                const status = isGoodLength && isConcise ? '✅ GOOD' : '⚠️  NEEDS WORK';
                console.log(`   ${status}\n`);
            });

        } catch (error) {
            console.error(`❌ Error generating questions: ${error.message}`);
        }
    }

    console.log('🎯 Question Quality Test Complete!');
}

testQuestionQuality().catch(console.error);