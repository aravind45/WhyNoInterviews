import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fetch from 'node-fetch';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory storage
const sessions: Record<string, any> = {};

/**
 * Parse resume file
 */
async function parseResume(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  
  if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text;
  }
  
  if (mimeType.includes('word') || filePath.endsWith('.docx') || filePath.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  
  throw new Error('Unsupported file format');
}

// ============================================================
// FEATURE 1: RESUME ANALYSIS (Deep Diagnosis)
// ============================================================

app.post('/api/analyze-match', upload.single('resume'), async (req, res) => {
  let filePath = '';
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resume file is required' });
    }
    
    const jobDescription = req.body.jobDescription;
    if (!jobDescription || jobDescription.length < 50) {
      return res.status(400).json({ success: false, error: 'Job description is required (minimum 50 characters)' });
    }
    
    filePath = req.file.path;
    const resumeText = await parseResume(filePath, req.file.mimetype);
    
    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ success: false, error: 'Could not extract text from resume' });
    }

    // Store for later use
    const sessionId = req.body.sessionId || 'sess_' + Math.random().toString(36).substring(2);
    sessions[sessionId] = sessions[sessionId] || {};
    sessions[sessionId].resumeText = resumeText;

    const prompt = `You are a brutally honest career coach who has reviewed 10,000+ resumes and knows exactly why people don't get interviews.

RESUME:
${resumeText.substring(0, 5000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 4000)}

Analyze like you're the hiring manager with 200 applications to review. Be specific, honest, helpful.

Return ONLY this JSON:
{
  "overallScore": <0-100>,
  "verdict": "STRONG MATCH|MODERATE MATCH|WEAK MATCH|LONG SHOT|NOT A FIT",
  "summary": "<2-3 sentences - brutal truth about their chances>",
  
  "sixSecondScan": {
    "firstImpression": "<what recruiter notices in first 6 seconds>",
    "standoutElements": ["<what's good>"],
    "immediateRedFlags": ["<what makes them move to next resume>"],
    "wouldReadMore": true/false,
    "whyOrWhyNot": "<explanation>"
  },
  
  "atsAnalysis": {
    "score": <0-100>,
    "likelyToPass": true/false,
    "keywordsFound": ["<matches from JD>"],
    "criticalKeywordsMissing": ["<will auto-reject>"],
    "suggestionToPassATS": "<specific fix>"
  },
  
  "qualificationGap": {
    "experienceRequired": "<what JD asks>",
    "experienceYouHave": "<what resume shows>",
    "gapAssessment": "OVER_QUALIFIED|GOOD_MATCH|SLIGHTLY_UNDER|SIGNIFICANTLY_UNDER",
    "yearsGap": "<e.g., 'JD wants 5+, you show ~3'>",
    "howToCloseGap": "<if possible>"
  },
  
  "dealbreakers": [
    {"requirement": "<from JD>", "status": "MISSING|WEAK", "urgentFix": "<what to do>"}
  ],
  
  "strengths": [
    {"skill": "<what you have>", "howItHelps": "<why matters>", "howToHighlight": "<make visible>"}
  ],
  
  "hiddenRedFlags": [
    {"issue": "<concern>", "whatRecruiterThinks": "<assumption>", "howToAddress": "<fix>"}
  ],
  
  "competitorAnalysis": {
    "typicalWinningCandidate": "<who gets this job>",
    "howYouCompare": "<honest comparison>",
    "yourCompetitiveAdvantage": "<what you have>",
    "yourBiggestDisadvantage": "<where you fall short>"
  },
  
  "applicationStrategy": {
    "shouldYouApply": true/false,
    "confidenceLevel": "HIGH|MEDIUM|LOW",
    "bestApproach": "APPLY_NOW|CUSTOMIZE_HEAVILY|GET_REFERRAL|SKIP",
    "timeWorthInvesting": "<how much time>"
  },
  
  "resumeRewrites": [
    {"section": "<part>", "currentText": "<weak>", "rewrittenText": "<better>", "whyBetter": "<reason>"}
  ],
  
  "prioritizedActionPlan": {
    "before_applying": ["<must do>"],
    "quick_wins": ["<easy fixes>"],
    "worth_the_effort": ["<harder but valuable>"],
    "long_term": ["<for future>"]
  },
  
  "interviewProbability": {
    "percentage": <0-100>,
    "reasoning": "<why>",
    "whatWouldIncreaseOdds": "<specific change>"
  },
  
  "bottomLine": {
    "honestAssessment": "<real talk>",
    "oneThingToFix": "<most important>",
    "encouragement": "<something positive>"
  }
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to analyze');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: analysis, sessionId });

  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// ============================================================
// FEATURE 2: PROFILE EXTRACTION (for Job Search)
// ============================================================

app.post('/api/extract-profile', upload.single('resume'), async (req, res) => {
  let filePath = '';
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resume file required' });
    }
    
    filePath = req.file.path;
    const resumeText = await parseResume(filePath, req.file.mimetype);

    const prompt = `Extract a structured profile from this resume. Return ONLY JSON:

RESUME:
${resumeText.substring(0, 6000)}

{
  "name": "<full name>",
  "email": "<email>",
  "location": "<city, state>",
  "currentTitle": "<most recent job title>",
  "yearsExperience": <number>,
  "experienceLevel": "ENTRY|MID|SENIOR|LEAD",
  "targetTitles": ["<job titles they could apply for>"],
  "hardSkills": ["<technical skills>"],
  "softSkills": ["<soft skills>"],
  "education": {"degree": "<degree>", "field": "<field>", "school": "<school>"},
  "summary": "<2-3 sentence professional summary>",
  "searchKeywords": ["<keywords for job search>"]
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('Failed to parse profile');

    const profile = JSON.parse(jsonMatch[0]);
    const sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions[sessionId] = { profile, resumeText, jobs: [], savedJobs: [] };

    res.json({ success: true, data: { sessionId, profile, resumeText } });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// ============================================================
// FEATURE 3: JOB SEARCH - Smart Links + Optional Real API
// ============================================================

// Generate smart job board search URLs
function generateJobSearchLinks(profile: any, customQuery?: string, customLocation?: string) {
  const title = customQuery || profile.targetTitles?.[0] || profile.currentTitle || 'software engineer';
  const location = customLocation || profile.location || '';
  const skills = (profile.hardSkills || []).slice(0, 3).join(' ');
  
  const encode = encodeURIComponent;
  
  return {
    primary: [
      {
        name: 'LinkedIn',
        icon: '💼',
        url: `https://www.linkedin.com/jobs/search/?keywords=${encode(title)}&location=${encode(location)}`,
        description: 'Most professional jobs'
      },
      {
        name: 'Indeed',
        icon: '🔍',
        url: `https://www.indeed.com/jobs?q=${encode(title)}&l=${encode(location)}`,
        description: 'Largest job board'
      },
      {
        name: 'Glassdoor',
        icon: '🚪',
        url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encode(title)}&locT=C&locKeyword=${encode(location)}`,
        description: 'Jobs + salary info'
      }
    ],
    secondary: [
      {
        name: 'Google Jobs',
        icon: '🔎',
        url: `https://www.google.com/search?q=${encode(title + ' jobs ' + location)}&ibp=htl;jobs`
      },
      {
        name: 'ZipRecruiter',
        icon: '⚡',
        url: `https://www.ziprecruiter.com/jobs-search?search=${encode(title)}&location=${encode(location)}`
      },
      {
        name: 'Dice (Tech)',
        icon: '🎲',
        url: `https://www.dice.com/jobs?q=${encode(title)}&location=${encode(location)}`
      },
      {
        name: 'Wellfound (Startups)',
        icon: '🚀',
        url: `https://wellfound.com/jobs?query=${encode(title)}`
      }
    ],
    bySkill: (profile.hardSkills || []).slice(0, 4).map((skill: string) => ({
      skill,
      url: `https://www.linkedin.com/jobs/search/?keywords=${encode(skill + ' ' + profile.experienceLevel)}&location=${encode(location)}`
    })),
    byTitle: (profile.targetTitles || []).slice(0, 4).map((t: string) => ({
      title: t,
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encode(t)}&location=${encode(location)}`,
      indeed: `https://www.indeed.com/jobs?q=${encode(t)}&l=${encode(location)}`
    }))
  };
}

app.post('/api/search-jobs', async (req, res) => {
  try {
    const { sessionId, searchQuery, location, useRealApi } = req.body;
    const session = sessions[sessionId];
    
    if (!session) {
      return res.status(400).json({ success: false, error: 'Session not found. Upload resume first.' });
    }

    // Generate smart search links (always available)
    const searchLinks = generateJobSearchLinks(session.profile, searchQuery, location);
    
    // If JSearch API key is provided and useRealApi is true, fetch real jobs
    const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY;
    let realJobs: any[] = [];
    
    if (JSEARCH_API_KEY && useRealApi !== false) {
      try {
        const query = searchQuery || session.profile.targetTitles?.[0] || session.profile.currentTitle;
        const loc = location || session.profile.location || '';
        
        const response = await fetch(
          `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' in ' + loc)}&num_pages=1`,
          {
            headers: {
              'X-RapidAPI-Key': JSEARCH_API_KEY,
              'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
          }
        );
        
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          // Score each real job against profile
          realJobs = await Promise.all(data.data.slice(0, 8).map(async (job: any) => {
            const score = quickMatchScore(session.profile, job);
            return {
              id: job.job_id,
              title: job.job_title,
              company: job.employer_name,
              location: job.job_city ? `${job.job_city}, ${job.job_state}` : job.job_country,
              salary: job.job_min_salary && job.job_max_salary 
                ? `$${job.job_min_salary.toLocaleString()} - $${job.job_max_salary.toLocaleString()}`
                : null,
              postedDate: job.job_posted_at_datetime_utc ? getRelativeTime(job.job_posted_at_datetime_utc) : 'Recently',
              description: job.job_description?.substring(0, 200) + '...',
              applyUrl: job.job_apply_link,
              companyLogo: job.employer_logo,
              employmentType: job.job_employment_type,
              isRemote: job.job_is_remote,
              ...score
            };
          }));
          
          realJobs.sort((a, b) => b.matchScore - a.matchScore);
        }
      } catch (apiErr) {
        console.error('JSearch API error:', apiErr);
        // Continue without real jobs - links will still work
      }
    }
    
    // If no API or API failed, generate AI suggestions
    if (realJobs.length === 0 && process.env.GROQ_API_KEY) {
      try {
        const query = searchQuery || session.profile.targetTitles?.[0] || session.profile.currentTitle;
        const skills = (session.profile.hardSkills || []).slice(0, 5).join(', ');
        
        const prompt = `Suggest 5 specific job titles and companies that would be good matches for someone with these skills: ${skills}, looking for: ${query}

Return ONLY JSON array:
[{"title":"<specific job title>","company":"<real company name>","matchScore":<70-95>,"reason":"<why good match>"}]`;

        const completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        });

        const responseText = completion.choices[0]?.message?.content || '';
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          realJobs = suggestions.map((s: any, i: number) => ({
            id: 'sug_' + i,
            title: s.title,
            company: s.company,
            matchScore: s.matchScore,
            quickTake: s.reason,
            isSuggestion: true,
            searchUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(s.title + ' ' + s.company)}`
          }));
        }
      } catch (aiErr) {
        console.error('AI suggestion error:', aiErr);
      }
    }
    
    session.jobs = realJobs;
    session.searchLinks = searchLinks;

    res.json({ 
      success: true, 
      data: { 
        jobs: realJobs,
        searchLinks,
        hasRealApi: !!process.env.JSEARCH_API_KEY
      } 
    });

  } catch (error: any) {
    console.error('Job search error:', error);
    res.status(500).json({ success: false, error: error.message || 'Search failed' });
  }
});

// Quick match score without AI (fast)
function quickMatchScore(profile: any, job: any) {
  const jobText = (job.job_title + ' ' + job.job_description + ' ' + (job.job_required_skills || []).join(' ')).toLowerCase();
  const profileSkills = (profile.hardSkills || []).map((s: string) => s.toLowerCase());
  
  let matched = 0;
  let matchingSkills: string[] = [];
  
  profileSkills.forEach((skill: string) => {
    if (jobText.includes(skill.toLowerCase())) {
      matched++;
      matchingSkills.push(skill);
    }
  });
  
  const score = Math.min(95, Math.round((matched / Math.max(profileSkills.length, 1)) * 100) + 30);
  
  return {
    matchScore: score,
    matchingSkills,
    recommendation: score >= 80 ? 'APPLY_NOW' : score >= 60 ? 'WORTH_APPLYING' : 'CUSTOMIZE_FIRST',
    quickTake: score >= 80 ? 'Strong match for your skills!' : score >= 60 ? 'Good potential - worth applying' : 'Consider customizing your resume'
  };
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ============================================================
// FEATURE 6: BULK JOB URL ANALYSIS
// Paste Indeed/LinkedIn search URL → Extract jobs → Score all
// ============================================================

app.post('/api/analyze-job-url', async (req, res) => {
  try {
    const { sessionId, searchUrl } = req.body;
    const session = sessions[sessionId];
    
    if (!session) {
      return res.status(400).json({ success: false, error: 'Session not found. Upload resume first.' });
    }
    
    if (!searchUrl) {
      return res.status(400).json({ success: false, error: 'Job search URL is required' });
    }

    // Fetch the search results page
    let html = '';
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      html = await response.text();
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return res.status(400).json({ success: false, error: 'Could not fetch URL. The site may be blocking requests.' });
    }

    // Extract jobs based on the source
    let extractedJobs: any[] = [];
    
    if (searchUrl.includes('indeed.com')) {
      extractedJobs = extractIndeedJobs(html, searchUrl);
    } else if (searchUrl.includes('linkedin.com')) {
      extractedJobs = extractLinkedInJobs(html, searchUrl);
    } else if (searchUrl.includes('glassdoor.com')) {
      extractedJobs = extractGlassdoorJobs(html, searchUrl);
    } else {
      // Generic extraction
      extractedJobs = extractGenericJobs(html, searchUrl);
    }

    if (extractedJobs.length === 0) {
      // Try AI extraction as fallback
      extractedJobs = await extractJobsWithAI(html, searchUrl);
    }

    if (extractedJobs.length === 0) {
      return res.json({ 
        success: true, 
        data: { jobs: [], message: 'No jobs found. The site may require login or have anti-bot protection.' }
      });
    }

    // Score each job against resume
    const profileSkills = (session.profile.hardSkills || []).map((s: string) => s.toLowerCase());
    const profileTitle = (session.profile.currentTitle || '').toLowerCase();
    const profileExp = session.profile.yearsExperience || 0;

    const scoredJobs = extractedJobs.map((job, index) => {
      const jobText = `${job.title} ${job.company} ${job.description || ''}`.toLowerCase();
      
      // Calculate match score
      let matchedSkills: string[] = [];
      profileSkills.forEach((skill: string) => {
        if (jobText.includes(skill.toLowerCase())) {
          matchedSkills.push(skill);
        }
      });
      
      // Title similarity bonus
      let titleBonus = 0;
      const titleWords = profileTitle.split(' ');
      titleWords.forEach(word => {
        if (word.length > 3 && job.title.toLowerCase().includes(word)) {
          titleBonus += 10;
        }
      });
      
      const skillScore = profileSkills.length > 0 
        ? (matchedSkills.length / profileSkills.length) * 60 
        : 30;
      const score = Math.min(98, Math.round(skillScore + titleBonus + 20));
      
      return {
        ...job,
        id: `job_${index}_${Date.now()}`,
        matchScore: score,
        matchingSkills: matchedSkills,
        recommendation: score >= 80 ? 'APPLY_NOW' : score >= 60 ? 'WORTH_APPLYING' : score >= 40 ? 'CUSTOMIZE_FIRST' : 'LONG_SHOT',
        quickTake: score >= 80 
          ? 'Strong match! Your skills align well with this role.' 
          : score >= 60 
          ? 'Good potential - worth applying with tailored resume.'
          : score >= 40
          ? 'Some overlap - customize your application.'
          : 'Stretch role - focus on transferable skills.'
      };
    });

    // Sort by score
    scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

    // Store in session
    session.urlAnalysisJobs = scoredJobs;

    res.json({ 
      success: true, 
      data: { 
        jobs: scoredJobs,
        source: new URL(searchUrl).hostname,
        totalFound: scoredJobs.length
      }
    });

  } catch (error: any) {
    console.error('URL analysis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Analysis failed' });
  }
});

// Extract jobs from Indeed HTML
function extractIndeedJobs(html: string, baseUrl: string): any[] {
  const jobs: any[] = [];
  
  // Indeed uses data in script tags and specific class patterns
  // Try to extract from jobcard divs
  const jobCardRegex = /<div[^>]*class="[^"]*job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  const titleRegex = /<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i;
  const companyRegex = /<span[^>]*data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/i;
  const locationRegex = /<div[^>]*data-testid="text-location"[^>]*>([\s\S]*?)<\/div>/i;
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*class="[^"]*jcs-JobTitle[^"]*"/i;
  const snippetRegex = /<div[^>]*class="[^"]*job-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i;

  // Alternative: Look for job data in script tags
  const scriptDataRegex = /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]*?\});/;
  const scriptMatch = html.match(scriptDataRegex);
  
  if (scriptMatch) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      if (data.metaData?.mosaicProviderJobCardsModel?.results) {
        data.metaData.mosaicProviderJobCardsModel.results.forEach((job: any) => {
          jobs.push({
            title: job.title || job.displayTitle || 'Unknown Title',
            company: job.company || 'Unknown Company',
            location: job.formattedLocation || job.jobLocationCity || '',
            description: job.snippet || job.jobSnippet || '',
            salary: job.salarySnippet?.text || job.estimatedSalary?.formattedRange || '',
            applyUrl: job.link ? `https://www.indeed.com${job.link}` : job.jobKey ? `https://www.indeed.com/viewjob?jk=${job.jobKey}` : '',
            postedDate: job.formattedRelativeTime || '',
            source: 'Indeed'
          });
        });
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  // Fallback: regex extraction
  if (jobs.length === 0) {
    // Try simpler patterns
    const simpleTitleRegex = /<a[^>]*class="[^"]*jcs-JobTitle[^"]*"[^>]*>[\s\S]*?<span[^>]*title="([^"]*)"[^>]*>/gi;
    let match;
    while ((match = simpleTitleRegex.exec(html)) !== null) {
      jobs.push({
        title: match[1],
        company: '',
        location: '',
        description: '',
        applyUrl: '',
        source: 'Indeed'
      });
    }
  }

  return jobs;
}

// Extract jobs from LinkedIn HTML
function extractLinkedInJobs(html: string, baseUrl: string): any[] {
  const jobs: any[] = [];
  
  // LinkedIn job cards
  const cardRegex = /<div[^>]*class="[^"]*base-card[^"]*job-search-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  const titleRegex = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i;
  const companyRegex = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
  const locationRegex = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
  const linkRegex = /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"/i;
  
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const card = match[1];
    const title = card.match(titleRegex)?.[1]?.trim().replace(/<[^>]*>/g, '') || '';
    const company = card.match(companyRegex)?.[1]?.trim().replace(/<[^>]*>/g, '') || '';
    const location = card.match(locationRegex)?.[1]?.trim().replace(/<[^>]*>/g, '') || '';
    const link = card.match(linkRegex)?.[1] || '';
    
    if (title) {
      jobs.push({
        title,
        company,
        location,
        description: '',
        applyUrl: link,
        source: 'LinkedIn'
      });
    }
  }

  return jobs;
}

// Extract jobs from Glassdoor
function extractGlassdoorJobs(html: string, baseUrl: string): any[] {
  const jobs: any[] = [];
  // Similar pattern extraction for Glassdoor
  return jobs;
}

// Generic job extraction
function extractGenericJobs(html: string, baseUrl: string): any[] {
  const jobs: any[] = [];
  
  // Look for common job listing patterns
  const titlePatterns = [
    /<h[23][^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h[23]>/gi,
    /<a[^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    /<div[^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  ];
  
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const title = match[1].replace(/<[^>]*>/g, '').trim();
      if (title && title.length > 5 && title.length < 100) {
        jobs.push({
          title,
          company: '',
          location: '',
          description: '',
          applyUrl: baseUrl,
          source: 'Web'
        });
      }
    }
    if (jobs.length > 0) break;
  }

  return jobs;
}

// Use AI to extract jobs from HTML
async function extractJobsWithAI(html: string, url: string): Promise<any[]> {
  if (!process.env.GROQ_API_KEY) return [];
  
  // Truncate HTML to avoid token limits
  const truncatedHtml = html.substring(0, 15000);
  
  const prompt = `Extract job listings from this HTML. Return ONLY a JSON array:

URL: ${url}
HTML (truncated):
${truncatedHtml}

Return format:
[{"title":"<job title>","company":"<company>","location":"<location>","description":"<brief description if visible>"}]

Extract up to 10 jobs. If no jobs found, return [].`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const jobs = JSON.parse(jsonMatch[0]);
      return jobs.map((j: any) => ({
        ...j,
        applyUrl: url,
        source: 'AI Extracted'
      }));
    }
  } catch (e) {
    console.error('AI extraction error:', e);
  }
  
  return [];
}

// ============================================================
// FEATURE 4: COVER LETTER GENERATION
// ============================================================

app.post('/api/generate-cover-letter', async (req, res) => {
  try {
    const { sessionId, jobId, jobDescription, companyName, jobTitle } = req.body;
    const session = sessions[sessionId];
    
    if (!session) {
      return res.status(400).json({ success: false, error: 'Session not found' });
    }

    const job = session.jobs?.find((j: any) => j.id === jobId);
    const company = companyName || job?.company || 'the company';
    const title = jobTitle || job?.title || 'the position';
    const jd = jobDescription || (job?.description + '\n' + job?.requirements?.join('\n'));

    const prompt = `Write a compelling cover letter.

CANDIDATE:
${session.resumeText.substring(0, 3000)}

JOB: ${title} at ${company}
${jd?.substring(0, 2000) || 'Position at company'}

Write a cover letter that:
1. Opens with a hook (NOT "I am writing to apply...")
2. Connects specific experience to job requirements
3. Includes 2-3 achievements with numbers
4. Shows genuine interest in company
5. Ends with confident call to action
6. Is 250-350 words

Return ONLY the cover letter text.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });

    const coverLetter = completion.choices[0]?.message?.content || '';
    res.json({ success: true, data: { coverLetter: coverLetter.trim(), company, jobTitle: title } });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// FEATURE 5: JOB TRACKER
// ============================================================

app.post('/api/save-job', async (req, res) => {
  try {
    const { sessionId, job, status } = req.body;
    const session = sessions[sessionId];
    
    if (!session) {
      return res.status(400).json({ success: false, error: 'Session not found' });
    }

    if (!session.savedJobs) session.savedJobs = [];
    
    const existingIndex = session.savedJobs.findIndex((j: any) => j.id === job.id);
    if (existingIndex >= 0) {
      session.savedJobs[existingIndex] = { ...session.savedJobs[existingIndex], ...job, status, updatedAt: Date.now() };
    } else {
      session.savedJobs.push({ ...job, status: status || 'SAVED', savedAt: Date.now() });
    }

    res.json({ success: true, data: { savedJobs: session.savedJobs } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/saved-jobs', (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions[sessionId];
  res.json({ success: true, data: { savedJobs: session?.savedJobs || [] } });
});

app.post('/api/update-job-status', async (req, res) => {
  try {
    const { sessionId, jobId, status } = req.body;
    const session = sessions[sessionId];
    
    if (!session?.savedJobs) {
      return res.status(400).json({ success: false, error: 'No saved jobs' });
    }

    const job = session.savedJobs.find((j: any) => j.id === jobId);
    if (job) {
      job.status = status;
      job.updatedAt = Date.now();
      if (status === 'APPLIED') job.appliedAt = Date.now();
    }

    res.json({ success: true, data: { job } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health & Static
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;
module.exports = app;
