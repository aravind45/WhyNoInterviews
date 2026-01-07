# Mock Interview Feature - Detailed Implementation Plan

## 🎯 Feature Overview

AI-powered mock interview system that:

- Generates role-specific interview questions using Llama
- Records candidate responses via webcam
- Analyzes video responses using HuggingFace SmolVLM
- Provides comprehensive feedback and improvement suggestions

## 🏗️ Architecture Overview

### Frontend Components

```
Mock Interview Tab
├── Interview Setup
│   ├── Job Role Selection
│   ├── Interview Type (Technical/Behavioral/Mixed)
│   ├── Duration Selection (15/30/45 min)
│   └── Camera/Mic Test
├── Interview Session
│   ├── Question Display
│   ├── Video Recording Interface
│   ├── Timer & Progress
│   └── Session Controls
└── Results & Feedback
    ├── Performance Analysis
    ├── Video Playback
    ├── Improvement Suggestions
    └── Practice Recommendations
```

### Backend Services

```
Mock Interview API
├── Question Generation (/api/generate-interview-questions)
├── Session Management (/api/interview-session)
├── Video Processing (/api/analyze-interview-video)
├── Feedback Generation (/api/generate-interview-feedback)
└── Results Storage (/api/interview-results)
```

## 📋 Detailed Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Database Schema

```sql
-- Interview Sessions
CREATE TABLE interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    session_id VARCHAR(255) UNIQUE,
    job_role VARCHAR(255),
    interview_type VARCHAR(50), -- 'technical', 'behavioral', 'mixed'
    duration_minutes INTEGER,
    status VARCHAR(50), -- 'setup', 'in_progress', 'completed', 'analyzed'
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Interview Questions
CREATE TABLE interview_questions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES interview_sessions(session_id),
    question_number INTEGER,
    question_text TEXT,
    question_type VARCHAR(50), -- 'technical', 'behavioral', 'situational'
    expected_duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Interview Responses
CREATE TABLE interview_responses (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES interview_sessions(session_id),
    question_id INTEGER REFERENCES interview_questions(id),
    video_url VARCHAR(500),
    response_duration_seconds INTEGER,
    transcript TEXT,
    analysis_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Interview Results
CREATE TABLE interview_results (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES interview_sessions(session_id),
    overall_score INTEGER, -- 1-100
    communication_score INTEGER,
    technical_score INTEGER,
    confidence_score INTEGER,
    body_language_score INTEGER,
    feedback_summary TEXT,
    improvement_suggestions JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 1.2 Frontend UI Structure

```html
<!-- Add to main navigation -->
<div class="main-tab" data-tab="mock-interview">Mock Interview</div>

<!-- Mock Interview Section -->
<section class="section" id="tab-mock-interview">
  <!-- Interview Setup -->
  <div id="interview-setup" class="card">
    <!-- Setup form -->
  </div>

  <!-- Interview Session -->
  <div id="interview-session" class="card" style="display: none;">
    <!-- Recording interface -->
  </div>

  <!-- Results -->
  <div id="interview-results" class="card" style="display: none;">
    <!-- Feedback display -->
  </div>
</section>
```

### Phase 2: Question Generation (Week 1-2)

#### 2.1 Llama Integration for Question Generation

```typescript
// Backend: Question Generation Service
interface QuestionGenerationRequest {
  jobRole: string;
  interviewType: 'technical' | 'behavioral' | 'mixed';
  experienceLevel: 'entry' | 'mid' | 'senior';
  duration: number; // minutes
  resumeData?: any;
  jobDescription?: string;
}

app.post('/api/generate-interview-questions', async (req, res) => {
  const { jobRole, interviewType, experienceLevel, duration, resumeData, jobDescription } =
    req.body;

  const questionCount = Math.floor(duration / 3); // ~3 minutes per question

  const prompt = `Generate ${questionCount} ${interviewType} interview questions for a ${experienceLevel} ${jobRole} position.
  
  Job Description: ${jobDescription || 'General role'}
  Candidate Background: ${resumeData ? JSON.stringify(resumeData) : 'Not provided'}
  
  Requirements:
  - Mix of difficulty levels appropriate for ${experienceLevel}
  - Questions should be answerable in 2-4 minutes each
  - Include both technical and soft skill assessment
  - Provide expected answer guidelines for evaluation
  
  Return JSON format:
  {
    "questions": [
      {
        "id": 1,
        "text": "Question text",
        "type": "technical|behavioral|situational",
        "expectedDuration": 180,
        "evaluationCriteria": ["criteria1", "criteria2"],
        "sampleAnswer": "Brief sample answer outline"
      }
    ]
  }`;

  // Call Llama via Groq
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  // Parse and store questions
  // Return to frontend
});
```

#### 2.2 Question Types & Templates

```typescript
const questionTemplates = {
  technical: {
    entry: [
      'Explain the difference between {concept1} and {concept2}',
      'How would you approach solving {technical_problem}?',
      'Walk me through your process for {technical_task}',
    ],
    mid: [
      'Design a system for {system_requirement}',
      'How would you optimize {performance_scenario}?',
      'Explain a challenging technical problem you solved',
    ],
    senior: [
      'How would you architect {complex_system}?',
      'Describe your approach to technical leadership',
      'How do you make technology decisions for a team?',
    ],
  },
  behavioral: [
    'Tell me about a time when you had to work under pressure',
    'Describe a situation where you had to learn something new quickly',
    'How do you handle conflicts with team members?',
    'Give an example of when you took initiative',
  ],
};
```

### Phase 3: Video Recording & Processing (Week 2-3)

#### 3.1 Frontend Video Recording

```javascript
// Video Recording Component
class InterviewRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
  }

  async initializeCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });

      const videoElement = document.getElementById('interview-video');
      videoElement.srcObject = this.stream;

      return true;
    } catch (error) {
      console.error('Camera initialization failed:', error);
      return false;
    }
  }

  startRecording() {
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.processRecording();
    };

    this.mediaRecorder.start();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  async processRecording() {
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('video', blob, `response_${Date.now()}.webm`);
    formData.append('sessionId', currentSessionId);
    formData.append('questionId', currentQuestionId);

    // Upload to backend for processing
    const response = await fetch('/api/upload-interview-response', {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
}
```

#### 3.2 Video Upload & Storage

```typescript
// Backend: Video Upload Handler
import multer from 'multer';
import path from 'path';

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/interview-videos/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.body.sessionId}_${req.body.questionId}_${Date.now()}.webm`;
    cb(null, uniqueName);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

app.post('/api/upload-interview-response', videoUpload.single('video'), async (req, res) => {
  try {
    const { sessionId, questionId } = req.body;
    const videoPath = req.file.path;

    // Store video reference in database
    await storeVideoResponse(sessionId, questionId, videoPath);

    // Queue for analysis
    await queueVideoAnalysis(sessionId, questionId, videoPath);

    res.json({ success: true, videoId: req.file.filename });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Phase 4: AI Analysis Integration (Week 3-4)

#### 4.1 HuggingFace SmolVLM Integration

```typescript
// Video Analysis Service
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

interface VideoAnalysisResult {
  transcript: string;
  visualAnalysis: {
    eyeContact: number; // 0-100
    bodyLanguage: number; // 0-100
    facialExpressions: string[];
    confidence: number; // 0-100
  };
  audioAnalysis: {
    clarity: number; // 0-100
    pace: number; // words per minute
    fillerWords: number;
    volume: number; // 0-100
  };
}

async function analyzeInterviewVideo(
  videoPath: string,
  questionText: string,
): Promise<VideoAnalysisResult> {
  try {
    // 1. Extract frames for visual analysis
    const frames = await extractVideoFrames(videoPath, 5); // 5 frames

    // 2. Analyze each frame with SmolVLM
    const visualAnalyses = await Promise.all(
      frames.map((frame) => analyzeFrameWithSmolVLM(frame, questionText)),
    );

    // 3. Extract audio for speech analysis
    const audioPath = await extractAudio(videoPath);
    const transcript = await transcribeAudio(audioPath);

    // 4. Combine analyses
    const result: VideoAnalysisResult = {
      transcript,
      visualAnalysis: aggregateVisualAnalysis(visualAnalyses),
      audioAnalysis: await analyzeAudio(audioPath, transcript),
    };

    return result;
  } catch (error) {
    console.error('Video analysis failed:', error);
    throw error;
  }
}

async function analyzeFrameWithSmolVLM(frameBuffer: Buffer, questionText: string) {
  const prompt = `Analyze this interview response frame. The candidate is answering: "${questionText}"
  
  Evaluate:
  1. Eye contact (looking at camera vs looking away)
  2. Body language (posture, gestures, confidence)
  3. Facial expressions (engaged, nervous, confident)
  4. Overall professionalism
  
  Return JSON: {
    "eyeContact": 0-100,
    "bodyLanguage": 0-100,
    "facialExpression": "description",
    "confidence": 0-100,
    "notes": "brief observation"
  }`;

  const response = await hf.visualQuestionAnswering({
    model: 'HuggingFaceTB/SmolVLM-Instruct',
    inputs: {
      image: frameBuffer,
      question: prompt,
    },
  });

  return JSON.parse(response.answer);
}
```

#### 4.2 Speech-to-Text & Audio Analysis

```typescript
// Audio Processing
import ffmpeg from 'fluent-ffmpeg';
import speech from '@google-cloud/speech'; // or OpenAI Whisper

async function extractAudio(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace('.webm', '.wav');

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .on('end', () => resolve(audioPath))
      .on('error', reject)
      .run();
  });
}

async function transcribeAudio(audioPath: string): Promise<string> {
  // Using OpenAI Whisper via Groq (if available) or Google Speech-to-Text
  const audioBuffer = fs.readFileSync(audioPath);

  // Option 1: OpenAI Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: audioBuffer,
    model: 'whisper-1',
  });

  return transcription.text;
}

async function analyzeAudio(audioPath: string, transcript: string) {
  // Analyze speech patterns
  const words = transcript.split(' ');
  const duration = await getAudioDuration(audioPath);
  const wordsPerMinute = (words.length / duration) * 60;

  // Count filler words
  const fillerWords = ['um', 'uh', 'like', 'you know', 'so'].reduce((count, filler) => {
    return count + (transcript.toLowerCase().match(new RegExp(filler, 'g')) || []).length;
  }, 0);

  return {
    clarity: calculateClarity(transcript),
    pace: wordsPerMinute,
    fillerWords,
    volume: await analyzeVolume(audioPath),
  };
}
```

### Phase 5: Feedback Generation (Week 4)

#### 4.1 Comprehensive Feedback System

```typescript
// Feedback Generation Service
interface InterviewFeedback {
  overallScore: number; // 0-100
  categoryScores: {
    communication: number;
    technical: number;
    confidence: number;
    bodyLanguage: number;
  };
  strengths: string[];
  improvements: string[];
  detailedFeedback: {
    questionId: number;
    score: number;
    feedback: string;
    suggestions: string[];
  }[];
  nextSteps: string[];
}

async function generateInterviewFeedback(sessionId: string): Promise<InterviewFeedback> {
  // Get all responses for the session
  const responses = await getSessionResponses(sessionId);
  const questions = await getSessionQuestions(sessionId);

  // Analyze each response
  const questionFeedbacks = await Promise.all(
    responses.map(async (response, index) => {
      const question = questions[index];
      return await generateQuestionFeedback(response, question);
    }),
  );

  // Generate overall feedback using Llama
  const overallFeedback = await generateOverallFeedback(questionFeedbacks, responses);

  return {
    overallScore: calculateOverallScore(questionFeedbacks),
    categoryScores: calculateCategoryScores(questionFeedbacks),
    strengths: extractStrengths(questionFeedbacks),
    improvements: extractImprovements(questionFeedbacks),
    detailedFeedback: questionFeedbacks,
    nextSteps: overallFeedback.nextSteps,
  };
}

async function generateQuestionFeedback(response: any, question: any) {
  const prompt = `Analyze this interview response and provide detailed feedback.

QUESTION: ${question.text}
QUESTION TYPE: ${question.type}
EXPECTED DURATION: ${question.expectedDuration} seconds

CANDIDATE RESPONSE:
Transcript: ${response.transcript}
Duration: ${response.duration} seconds
Visual Analysis: ${JSON.stringify(response.visualAnalysis)}
Audio Analysis: ${JSON.stringify(response.audioAnalysis)}

Provide feedback on:
1. Content quality and relevance
2. Communication clarity
3. Technical accuracy (if applicable)
4. Confidence and presentation
5. Areas for improvement

Return JSON format:
{
  "score": 0-100,
  "contentScore": 0-100,
  "deliveryScore": 0-100,
  "feedback": "detailed feedback paragraph",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "suggestions": ["specific suggestion1", "specific suggestion2"]
}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1000,
  });

  return JSON.parse(completion.choices[0].message.content);
}
```

### Phase 6: Frontend Results Interface (Week 4-5)

#### 6.1 Results Dashboard

```html
<!-- Interview Results Section -->
<div id="interview-results" class="card">
  <div class="card-header">
    <h2 class="card-title">🎯 Interview Performance Analysis</h2>
    <p class="card-subtitle">Comprehensive feedback and improvement suggestions</p>
  </div>

  <!-- Overall Score -->
  <div class="score-hero">
    <div class="score-ring">
      <div class="score-number" id="overall-score">85</div>
      <div class="score-label">Overall</div>
    </div>
    <div class="verdict-badge">Strong Performance</div>
  </div>

  <!-- Category Scores -->
  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-number" id="communication-score">88</div>
      <div class="stat-label">Communication</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" id="technical-score">82</div>
      <div class="stat-label">Technical</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" id="confidence-score">90</div>
      <div class="stat-label">Confidence</div>
    </div>
    <div class="stat-card">
      <div class="stat-number" id="body-language-score">85</div>
      <div class="stat-label">Body Language</div>
    </div>
  </div>

  <!-- Detailed Feedback -->
  <div id="detailed-feedback">
    <!-- Question-by-question feedback -->
  </div>

  <!-- Action Items -->
  <div class="card">
    <h3>🎯 Next Steps</h3>
    <ul id="next-steps-list">
      <!-- Generated suggestions -->
    </ul>
  </div>
</div>
```

#### 6.2 Video Playback with Annotations

```javascript
// Video Review Component
class InterviewVideoReview {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.responses = [];
    this.currentVideo = 0;
  }

  async loadSession() {
    const response = await fetch(`/api/interview-session/${this.sessionId}`);
    const data = await response.json();
    this.responses = data.responses;
    this.renderVideoReview();
  }

  renderVideoReview() {
    const container = document.getElementById('video-review-container');

    this.responses.forEach((response, index) => {
      const videoCard = document.createElement('div');
      videoCard.className = 'video-review-card';
      videoCard.innerHTML = `
        <div class="video-header">
          <h4>Question ${index + 1}</h4>
          <span class="score-badge">${response.score}/100</span>
        </div>
        <div class="video-container">
          <video controls src="${response.videoUrl}"></video>
          <div class="video-annotations">
            ${this.renderAnnotations(response.analysis)}
          </div>
        </div>
        <div class="feedback-text">
          ${response.feedback}
        </div>
      `;
      container.appendChild(videoCard);
    });
  }

  renderAnnotations(analysis) {
    return `
      <div class="annotation eye-contact">
        Eye Contact: ${analysis.visualAnalysis.eyeContact}%
      </div>
      <div class="annotation body-language">
        Body Language: ${analysis.visualAnalysis.bodyLanguage}%
      </div>
      <div class="annotation speech-pace">
        Speech Pace: ${analysis.audioAnalysis.pace} WPM
      </div>
    `;
  }
}
```

## 🔧 Technical Requirements

### Dependencies to Add

```json
{
  "dependencies": {
    "@huggingface/inference": "^2.6.4",
    "fluent-ffmpeg": "^2.1.2",
    "@google-cloud/speech": "^6.0.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

### Environment Variables

```env
HUGGINGFACE_API_KEY=your_hf_api_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

### File Storage Structure

```
/tmp/interview-videos/
├── session_123/
│   ├── question_1_response.webm
│   ├── question_1_audio.wav
│   ├── question_1_frames/
│   │   ├── frame_001.jpg
│   │   └── frame_002.jpg
│   └── analysis_results.json
```

## 📊 Success Metrics

### User Experience Metrics

- Session completion rate > 80%
- Average session duration matches expected time
- User satisfaction score > 4.0/5.0

### Technical Performance Metrics

- Video upload success rate > 95%
- Analysis completion time < 5 minutes per session
- Feedback accuracy (validated through user feedback)

### Business Metrics

- Feature adoption rate
- User retention after using mock interview
- Correlation with job application success

## 🚀 Implementation Timeline

**Week 1**: Core infrastructure, database setup, basic UI
**Week 2**: Question generation, video recording
**Week 3**: AI analysis integration (SmolVLM + audio processing)
**Week 4**: Feedback generation and results interface
**Week 5**: Testing, optimization, and deployment

## 🔒 Privacy & Security Considerations

1. **Video Storage**: Temporary storage with automatic cleanup after 30 days
2. **Data Encryption**: Encrypt video files at rest and in transit
3. **User Consent**: Clear consent for video recording and AI analysis
4. **GDPR Compliance**: Right to deletion, data portability
5. **Access Control**: User can only access their own interview data

This comprehensive plan provides a solid foundation for implementing the mock interview feature. Would you like me to start with any specific phase or component?
