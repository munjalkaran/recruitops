import { DEMO_ORGANISATION_ID, DEMO_PROFILE_IDS } from "../constants/pipeline";

const vacancy = (id, client_name, job_title, location, openings, priority, status, assigned_recruiter_id, extra = {}) => ({ id, organisation_id: DEMO_ORGANISATION_ID, client_name, job_title, location, openings, priority, status, assigned_recruiter_id, client_hr_name: extra.client_hr_name || "Client talent team", client_hr_email: extra.client_hr_email || `talent@${client_name.toLowerCase().replaceAll(" ", "")}.example`, minimum_experience: extra.minimum_experience || 2, maximum_experience: extra.maximum_experience || 7, minimum_ctc: extra.minimum_ctc || 700000, maximum_ctc: extra.maximum_ctc || 1800000, is_demo: true, candidates: [], created_at: extra.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });

export const mockVacancies = [
  vacancy("77777777-0001-4777-8777-777777777001", "HDFC Bank", "Relationship Manager", "Delhi NCR", 4, "High", "Open", DEMO_PROFILE_IDS.priya),
  vacancy("77777777-0002-4777-8777-777777777002", "Kotak Mahindra Bank", "Branch Sales Officer", "Mumbai", 3, "High", "Open", DEMO_PROFILE_IDS.arjun),
  vacancy("77777777-0003-4777-8777-777777777003", "ICICI Bank", "Credit Analyst", "Bengaluru", 2, "Medium", "Open", DEMO_PROFILE_IDS.priya),
  vacancy("77777777-0004-4777-8777-777777777004", "IDFC First Bank", "Loan Officer", "Pune", 3, "Medium", "On Hold", DEMO_PROFILE_IDS.arjun),
  vacancy("77777777-0005-4777-8777-777777777005", "Shriram Finance", "Collections Executive", "Chennai", 5, "Critical", "Open", DEMO_PROFILE_IDS.priya),
  vacancy("77777777-0006-4777-8777-777777777006", "Bajaj Finance", "Customer Service Officer", "Hyderabad", 4, "Medium", "Open", DEMO_PROFILE_IDS.arjun, { client_hr_name: "Megha Iyer", client_hr_email: "megha.iyer@bajajfinance.example", minimum_experience: 2, maximum_experience: 5, minimum_ctc: 700000, maximum_ctc: 1300000 }),
];
