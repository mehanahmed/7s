import { LeadCategory } from "@/types";

export const LEAD_CATEGORY_LABELS: Record<LeadCategory, string> = {
  'POP': 'New Lead',
  'APPOINTMENT': 'Appointment',
  'PROSPECT': 'Prospect',
  'POG': 'Proposal Sent',
  'OC': 'Sales',
  'BUDGET_ISSUE': 'Budget Issue',
  'CANCELLED': 'Cancelled',
};

export const LEAD_TEMPERATURES = [0, 30, 50, 70, 100] as const;
