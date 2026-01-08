import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../utils/logger';
import {
  ResumeData,
  ResumeSection,
  SectionType,
  ResumeMetadata,
  ProcessingError,
  TimeoutError,
  BulletPoint,
  Achievement,
} from '../types';

// Configuration
const MAX_PAGES = parseInt(process.env.MAX_RESUME_PAGES || '10');
const PROCESSING_TIMEOUT = parseInt(process.env.UPLOAD_TIMEOUT || '30') * 1000;

export class ResumeParser {
  private SECTION_PATTERNS: Record<SectionType, RegExp[]> = {
    [SectionType.CONTACT]: [/contact/i, /personal\s*info/i, /email|phone|address/i],
    [SectionType.SUMMARY]: [/summary|profile|objective|overview|about/i],
    [SectionType.EXPERIENCE]: [/experience|history|work|employment/i],
    [SectionType.EDUCATION]: [/education|academic|degrees/i],
    [SectionType.SKILLS]: [/skills|competencies|expertise|proficiencies/i],
    [SectionType.PROJECTS]: [/projects|portfolio/i],
    [SectionType.CERTIFICATIONS]: [/certifications|licenses|credentials|training/i],
    [SectionType.OTHER]: [],
  };

  /**
   * Validate resume file before processing
   */
  public validateFile(file: Express.Multer.File): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fileInfo: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if file exists
    if (!file || (!file.path && !file.buffer)) {
      errors.push('File not found or inaccessible');
      return { isValid: false, errors, warnings, fileInfo: null };
    }

    if (file.path && !fs.existsSync(file.path)) {
      errors.push('File not found or inaccessible');
      return { isValid: false, errors, warnings, fileInfo: null };
    }

    // Check file size
    if (file.size === 0) {
      errors.push('File is empty');
    } else if (file.size > MAX_PAGES * 1.5 * 1024 * 1024) {
      // Roughly 1.5MB per page limit
      errors.push('File too large for processing');
    } else if (file.size > 5 * 1024 * 1024) {
      warnings.push('Large file may take longer to process');
    }

    // Check mime type
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`Unsupported file type: ${file.mimetype}`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const fileInfo = {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      extension: ext,
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo,
    };
  }

  /**
   * Main parsing function
   */
  public async parseResume(file: Express.Multer.File): Promise<ResumeData> {
    const startTime = Date.now();
    const filePath = file.path;

    if (!fs.existsSync(filePath)) {
      throw new Error('Resume file not found');
    }

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new TimeoutError('Resume processing timeout exceeded. Please try with a smaller file.'),
        );
      }, PROCESSING_TIMEOUT);

      try {
        const ext = path.extname(file.originalname).toLowerCase();
        let text = '';
        let pageCount = 0;

        if (ext === '.pdf') {
          const result = await this.parsePDF(filePath);
          text = result.text;
          pageCount = result.pageCount;
        } else if (ext === '.doc' || ext === '.docx') {
          const result = await this.parseWord(filePath);
          text = result.text;
          pageCount = result.pageCount;
        } else {
          throw new Error(`Unsupported file type: ${file.mimetype}`);
        }

        if (!text || text.trim().length < 5) {
          throw new Error('Failed to extract text from PDF');
        }

        const sections = this.extractSections(text);
        const processingTime = Date.now() - startTime;

        const warnings: string[] = [];
        if (text.length < 200) {
          warnings.push('Resume appears very short - may be missing content');
        }
        // Detect garbled text or non-standard characters
        if (
          /[^\x00-\x7F\u00A0-\u00FF\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u2100-\u214F\u2190-\u21FF\u2200-\u22FF\u25A0-\u25FF]/.test(
            text.replace(/[♠♣♥♦]/g, ''),
          )
        ) {
          warnings.push('Some text may not have been extracted correctly');
        }

        const metadata: ResumeMetadata = {
          pageCount: pageCount || Math.ceil(text.length / 3000) || 1, // Estimate if missing
          wordCount: text.split(/\s+/).length,
          fileName: file.originalname,
          fileType: ext.replace('.', '') as any,
          fileSize: file.size,
          processingTime,
          extractionMethod: (ext === '.pdf' ? 'pdf-parse' : 'mammoth') as any,
          warnings,
        };

        clearTimeout(timeout);
        resolve({
          rawText: text,
          sections,
          metadata,
          extractionConfidence: this.calculateConfidence(text, sections),
          extractedAt: new Date(),
        });
      } catch (error: any) {
        clearTimeout(timeout);
        if (error.message.includes('PDF parsing failed')) {
          reject(new Error('Failed to extract text from PDF'));
        } else if (error.message.includes('DOCX parsing failed')) {
          reject(new Error('Failed to extract text from DOCX'));
        } else {
          reject(error);
        }
      }
    });
  }

  private calculateConfidence(text: string, sections: ResumeSection[]): number {
    let score = 50;
    if (text.length < 100) score -= 10; // Lower confidence for very short text
    if (text.length > 500) score += 20;
    if (sections.length > 3) score += 20;
    if (sections.some((s) => s.type === SectionType.EXPERIENCE)) score += 10;
    return Math.min(score, 100);
  }

  private async parsePDF(filePath: string): Promise<{ text: string; pageCount: number }> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer, { max: MAX_PAGES });
    return { text: data.text, pageCount: data.numpages || 0 };
  }

  private async parseWord(filePath: string): Promise<{ text: string; pageCount: number }> {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value, pageCount: Math.ceil(result.value.length / 3000) };
  }

  private identifySectionType(heading: string): SectionType {
    const normalizedHeading = heading.trim().toLowerCase();

    for (const [sectionType, patterns] of Object.entries(this.SECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedHeading)) {
          return sectionType as SectionType;
        }
      }
    }
    return SectionType.OTHER;
  }

  private extractSections(text: string): ResumeSection[] {
    const sections: ResumeSection[] = [];
    const headerPattern = /^([A-Z][A-Za-z\s&]+)[\s]*[:|\n]/gm;
    const allCapsPattern = /^([A-Z][A-Z\s&]{2,})$/gm;

    const matches: Array<{ heading: string; index: number }> = [];
    let match;
    while ((match = headerPattern.exec(text)) !== null) {
      matches.push({ heading: match[1].trim(), index: match.index });
    }
    while ((match = allCapsPattern.exec(text)) !== null) {
      const heading = match[1].trim();
      if (heading.length > 3 && heading.length < 50) {
        matches.push({ heading, index: match.index });
      }
    }

    matches.sort((a, b) => a.index - b.index);
    const uniqueMatches = matches.filter((m, i) => i === 0 || m.index !== matches[i - 1].index);

    for (let i = 0; i < uniqueMatches.length; i++) {
      const current = uniqueMatches[i];
      const nextIndex = i < uniqueMatches.length - 1 ? uniqueMatches[i + 1].index : text.length;
      const sectionContent = text.substring(current.index, nextIndex).trim();

      if (sectionContent.length > 10) {
        sections.push({
          type: this.identifySectionType(current.heading),
          title: current.heading,
          content: sectionContent,
          startIndex: current.index,
          endIndex: nextIndex,
          bullets: this.extractBullets(sectionContent),
        });
      }
    }

    if (sections.length === 0) {
      sections.push({
        type: SectionType.OTHER,
        title: 'Resume Content',
        content: text,
        startIndex: 0,
        endIndex: text.length,
        bullets: this.extractBullets(text),
      });
    }

    return sections;
  }

  private extractBullets(content: string): BulletPoint[] {
    const lines = content.split('\n');
    const bullets: BulletPoint[] = [];
    const bulletPattern = /^[•\-\*]\s*(.+)$/;

    for (const line of lines) {
      const match = line.trim().match(bulletPattern);
      if (match) {
        const text = match[1].trim();
        bullets.push({
          id: Math.random().toString(36).substring(7),
          text,
          achievements: this.detectAchievements(text),
        });
      }
    }
    return bullets;
  }

  private detectAchievements(text: string): Achievement[] {
    const actionVerbs = [
      'developed',
      'implemented',
      'led',
      'optimized',
      'created',
      'increased',
      'reduced',
      'managed',
    ];
    const foundVerbs = actionVerbs.filter((v) => text.toLowerCase().includes(v));
    const hasQuantification = /\d+%|\$\d+|team of \d+/.test(text);

    if (foundVerbs.length > 0 || hasQuantification) {
      return [
        {
          text,
          hasQuantification,
          metrics: text.match(/\d+%|\$\d+|team of \d+/g) || [],
          actionVerbs: foundVerbs,
        },
      ];
    }
    return [];
  }
}

// For backward compatibility
export const parseResume = async (
  filePath: string,
  originalName: string,
  fileSize: number,
): Promise<ResumeData> => {
  const parser = new ResumeParser();
  return parser.parseResume({ path: filePath, originalname: originalName, size: fileSize } as any);
};

export const extractKeyInfo = (resumeData: ResumeData) => {
  const sections = resumeData.sections;
  return {
    hasContactInfo: sections.some((s) => s.type === SectionType.CONTACT),
    hasExperience: sections.some((s) => s.type === SectionType.EXPERIENCE),
    hasEducation: sections.some((s) => s.type === SectionType.EDUCATION),
    hasSkills: sections.some((s) => s.type === SectionType.SKILLS),
    experienceYears: null,
    skillsList: [],
  };
};

export default {
  ResumeParser,
  parseResume,
  extractKeyInfo,
};
