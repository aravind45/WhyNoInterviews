import { Router, Request, Response } from 'express';
import { query } from '../database/connection';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS target_companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL, company_name VARCHAR(255) NOT NULL, company_domain VARCHAR(255), industry VARCHAR(100), company_size VARCHAR(50), priority INTEGER DEFAULT 3, notes TEXT, referral_contact VARCHAR(255), target_roles TEXT[] DEFAULT '{}', location_preference VARCHAR(255), is_active BOOLEAN DEFAULT TRUE, date_added DATE DEFAULT CURRENT_DATE, last_searched_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(session_id, company_name))`);

    await query(`CREATE TABLE IF NOT EXISTS global_company_suggestions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_name VARCHAR(255) NOT NULL UNIQUE, company_domain VARCHAR(255), industry VARCHAR(100), company_size VARCHAR(50), description TEXT, careers_page_url TEXT, linkedin_url TEXT, is_popular BOOLEAN DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);

    const companies = [['Revolut','revolut.com','Fintech','large','Global fintech'],['Kraken','kraken.com','Cryptocurrency','large','Crypto exchange'],['Teramind','teramind.com','Cybersecurity','medium','Employee monitoring'],['Paylocity','paylocity.com','HR Tech','large','Payroll software'],['Superside','superside.com','Design Services','medium','Design service'],['HubSpot','hubspot.com','Marketing Tech','enterprise','CRM platform'],['Docker Inc.','docker.com','DevOps','large','Container platform'],['Canonical','canonical.com','Open Source','large','Ubuntu Linux'],['Jerry','getjerry.com','Insurtech','startup','AI insurance'],['Alpaca','alpaca.markets','Fintech','medium','Trading API'],['Toast','toasttab.com','Restaurant Tech','large','Restaurant POS'],['HackerOne','hackerone.com','Cybersecurity','medium','Bug bounty'],['Coderio','coderio.co','Software Development','small','Consulting'],['Socure','socure.com','Identity Verification','medium','ID verification'],['Zapier','zapier.com','Automation','large','Workflow automation']];

    let inserted = 0;
    for (const [name,domain,industry,size,desc] of companies) {
      try {
        await query('INSERT INTO global_company_suggestions (company_name,company_domain,industry,company_size,description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_name) DO NOTHING', [name,domain,industry,size,desc]);
        inserted++;
      } catch(e) {}
    }

    const count = await query('SELECT COUNT(*) FROM global_company_suggestions');
    res.json({success:true,message:`Migration complete! ${count.rows[0].count} companies available`,inserted});
  } catch (error: any) {
    res.status(500).json({success:false,error:error.message});
  }
});

export default router;
