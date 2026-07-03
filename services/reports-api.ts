import { supabase } from '@/lib/supabase';
import { DailyReport, ReportFilters, ReportStatus } from '@/types/report';

export interface ReportPayload {
  report_date: string;
  task_name: string;
  work_description: string;
  hours_worked: number;
  challenges_faced?: string | null;
  completion_percentage: number;
  evidence_url?: string | null;
  status?: ReportStatus;
}

export async function fetchReports(filters?: ReportFilters): Promise<DailyReport[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  // Get current user's profile to know their role and department
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', authData.user.id)
    .single();

  const userRole = currentUserProfile?.role || authData.user.user_metadata?.role;
  const userDept = currentUserProfile?.department || authData.user.user_metadata?.department;

  let query = supabase
    .from('project')
    .select('*');

  // If user is an HOD, strictly filter by their department
  if (userRole === 'hod' && userDept) {
    query = query.eq('Department', userDept);
  }

  if (filters?.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  // Fetch profiles manually to attach employee names
  const { data: profiles } = await supabase.from('profiles').select('id, name, employee_id, department');
  
  // Reshape data to match DailyReport interface so the HOD Dashboard doesn't break
  return (data || []).map((item, index) => {
    // Gracefully handle different column case variations
    const empId = item.employee_ID || item.Employee_ID || item.employee_id || item.Employee_Id;
    const dept = item.Department || item.department || item.DEPARTMENT;
    const projName = item.Project_name || item.Project_Name || item.project_name;
    const taskDesc = item.Task || item.task || item.TASK;
    const rDate = item.date || item.Date || item.DATE;
    const dur = item.duration || item.Duration || item.DURATION || '0';
    const projId = item.Project_Id || item.Project_ID || item.project_id || item.Project_id || '';

    const profile = profiles?.find(p => p.employee_id === empId);
    
    return {
      id: index,
      employee_id: profile?.id || 'unknown',
      actual_employee_id: empId,
      report_date: rDate,
      task_name: projName,
      project_id: projId,
      work_description: taskDesc,
      hours_worked: dur as any, // duration is a string like "02:30"
      completion_percentage: 100,
      status: 'submitted', // status no longer exists in project table
      department: dept,
      employee: {
        name: profile?.name || empId,
        employee_id: empId,
        department: dept
      }
    };
  }) as unknown as DailyReport[];
}

export async function fetchReport(id: number): Promise<DailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select(`
      *,
      employee:profiles(id, name, employee_id, department)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    employee: Array.isArray(data.employee) ? data.employee[0] : data.employee
  } as DailyReport;
}

export async function createReport(payload: ReportPayload): Promise<DailyReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('daily_reports')
    .insert([
      {
        ...payload,
        employee_id: user.id,
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data as DailyReport;
}

export async function updateReport(id: number, payload: Partial<ReportPayload>): Promise<DailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DailyReport;
}

export async function submitReport(id: number): Promise<DailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .update({ 
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DailyReport;
}

export async function verifyReport(id: number, status: ReportStatus, hodComment?: string): Promise<DailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .update({ 
      status, 
      hod_comment: hodComment || null,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DailyReport;
}
