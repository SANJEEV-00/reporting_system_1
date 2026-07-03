export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'modification_requested';

export interface ReportEmployee {
  id: string;
  name: string;
  employee_id: string;
  department: string;
}

export interface DailyReport {
  id: number;
  report_date: string;
  task_name: string;
  project_id?: string;
  work_description: string;
  hours_worked: number;
  challenges_faced: string | null;
  completion_percentage: number;
  evidence_url: string | null;
  status: ReportStatus;
  hod_comment: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  employee: ReportEmployee;
}

export interface ReportFormData {
  report_date: string;
  task_name: string;
  work_description: string;
  hours_worked: string;
  challenges_faced: string;
  completion_percentage: string;
  evidence_url: string;
}

export interface ReportFilters {
  status?: ReportStatus;
  dateFrom?: string;
  dateTo?: string;
}
