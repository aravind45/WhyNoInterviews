import { Router, Request, Response } from 'express';
import { query } from '../database/connection';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    // 0. Enable extensions
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // 1. Create target_companies table
    await query(`
      CREATE TABLE IF NOT EXISTS target_companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
        session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE, 
        company_name VARCHAR(255) NOT NULL, 
        company_domain VARCHAR(255), 
        industry VARCHAR(100), 
        company_size VARCHAR(50), 
        priority INTEGER DEFAULT 3, 
        notes TEXT, 
        referral_contact VARCHAR(255), 
        target_roles TEXT[] DEFAULT '{}', 
        location_preference VARCHAR(255), 
        is_active BOOLEAN DEFAULT TRUE, 
        date_added DATE DEFAULT CURRENT_DATE, 
        last_searched_at TIMESTAMP WITH TIME ZONE, 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
        UNIQUE(session_id, company_name)
      )
    `);

    // 2. Create company_job_searches table
    await query(`
      CREATE TABLE IF NOT EXISTS company_job_searches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES target_companies(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        search_query VARCHAR(500) NOT NULL,
        search_platform VARCHAR(100) NOT NULL,
        search_url TEXT NOT NULL,
        jobs_found INTEGER DEFAULT 0,
        new_jobs_count INTEGER DEFAULT 0,
        searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 3. Create company_job_listings table
    await query(`
      CREATE TABLE IF NOT EXISTS company_job_listings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL REFERENCES target_companies(id) ON DELETE CASCADE,
        search_id UUID REFERENCES company_job_searches(id) ON DELETE SET NULL,
        session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        job_title VARCHAR(500) NOT NULL,
        job_url TEXT NOT NULL,
        location VARCHAR(255),
        employment_type VARCHAR(50),
        remote_type VARCHAR(50),
        description_preview TEXT,
        requirements_preview TEXT,
        salary_range VARCHAR(100),
        posted_date DATE,
        discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_new BOOLEAN DEFAULT TRUE,
        match_score INTEGER,
        applied BOOLEAN DEFAULT FALSE,
        applied_date DATE,
        bookmarked BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(company_id, job_url)
      )
    `);

    // 4. Create summary view
    await query(`
      CREATE OR REPLACE VIEW target_companies_summary AS
      SELECT
          tc.session_id,
          tc.id as company_id,
          tc.company_name,
          tc.industry,
          tc.priority,
          tc.is_active,
          tc.date_added,
          tc.last_searched_at,
          COUNT(DISTINCT cjl.id) as total_jobs_found,
          COUNT(DISTINCT cjl.id) FILTER (WHERE cjl.is_new = TRUE) as new_jobs_count,
          COUNT(DISTINCT cjl.id) FILTER (WHERE cjl.bookmarked = TRUE) as bookmarked_jobs,
          COUNT(DISTINCT cjl.id) FILTER (WHERE cjl.applied = TRUE) as applied_jobs,
          MAX(cjl.discovered_at) as latest_job_discovered,
          AVG(cjl.match_score) as avg_match_score,
          COUNT(DISTINCT cjs.id) as total_searches_performed
      FROM target_companies tc
      LEFT JOIN company_job_listings cjl ON cjl.company_id = tc.id
      LEFT JOIN company_job_searches cjs ON cjs.company_id = tc.id
      GROUP BY tc.session_id, tc.id, tc.company_name, tc.industry, tc.priority,
               tc.is_active, tc.date_added, tc.last_searched_at
    `);

    // 5. Create stats view
    await query(`
      CREATE OR REPLACE VIEW target_companies_stats AS
      SELECT
          session_id,
          COUNT(*) as total_companies,
          COUNT(*) FILTER (WHERE is_active = TRUE) as active_companies,
          COUNT(*) FILTER (WHERE priority = 1) as high_priority,
          COUNT(*) FILTER (WHERE priority = 2) as medium_high_priority,
          COUNT(*) FILTER (WHERE priority = 3) as medium_priority,
          COUNT(DISTINCT industry) as industries_targeted,
          MIN(date_added) as first_company_added,
          MAX(date_added) as latest_company_added,
          COUNT(*) FILTER (WHERE last_searched_at >= NOW() - INTERVAL '7 days') as searched_last_7_days
      FROM target_companies
      GROUP BY session_id
    `);

    // 6. Global Suggestions
    await query(
      `CREATE TABLE IF NOT EXISTS global_company_suggestions (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), company_name VARCHAR(255) NOT NULL UNIQUE, company_domain VARCHAR(255), industry VARCHAR(100), company_size VARCHAR(50), description TEXT, careers_page_url TEXT, linkedin_url TEXT, is_popular BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`,
    );

    const companies = [
      ['Revolut', 'revolut.com', 'Fintech', 'large', 'Global fintech'],
      ['Kraken', 'kraken.com', 'Cryptocurrency', 'large', 'Crypto exchange'],
      ['Teramind', 'teramind.com', 'Cybersecurity', 'medium', 'Employee monitoring'],
      ['Paylocity', 'paylocity.com', 'HR Tech', 'large', 'Payroll software'],
      ['Superside', 'superside.com', 'Design Services', 'medium', 'Design service'],
      ['HubSpot', 'hubspot.com', 'Marketing Tech', 'enterprise', 'CRM platform'],
      ['Docker Inc.', 'docker.com', 'DevOps', 'large', 'Container platform'],
      ['Canonical', 'canonical.com', 'Open Source', 'large', 'Ubuntu Linux'],
      ['Jerry', 'getjerry.com', 'Insurtech', 'startup', 'AI insurance'],
      ['Alpaca', 'alpaca.markets', 'Fintech', 'medium', 'Trading API'],
      ['Toast', 'toasttab.com', 'Restaurant Tech', 'large', 'Restaurant POS'],
      ['HackerOne', 'hackerone.com', 'Cybersecurity', 'medium', 'Bug bounty'],
      ['Coderio', 'coderio.co', 'Software Development', 'small', 'Consulting'],
      ['Socure', 'socure.com', 'Identity Verification', 'medium', 'ID verification'],
      ['Zapier', 'zapier.com', 'Automation', 'large', 'Workflow automation'],
    ];

    let inserted = 0;
    for (const [name, domain, industry, size, desc] of companies) {
      try {
        await query(
          'INSERT INTO global_company_suggestions (company_name,company_domain,industry,company_size,description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_name) DO NOTHING',
          [name, domain, industry, size, desc],
        );
        inserted++;
      } catch (e) {}
    }

    const count = await query('SELECT COUNT(*) FROM global_company_suggestions');
    res.json({
      success: true,
      message: `Migration complete! ${count.rows[0].count} companies available. Views created.`,
      inserted,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
