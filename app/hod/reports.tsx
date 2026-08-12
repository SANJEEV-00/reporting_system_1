import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, SafeAreaView, TextInput, Pressable, FlatList, useWindowDimensions, Linking } from 'react-native';
import * as XLSX from 'xlsx-js-style';

import { Brand } from '@/constants/brand';
import { fetchReports } from '@/services/reports-api';
import { DailyReport, ReportStatus } from '@/types/report';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

let tamilFontBase64 = '';

export default function ReportsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const numColumns = width >= 1200 ? 3 : (width >= 768 ? 2 : 1);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [reportType, setReportType] = useState<'projects' | 'employees' | ''>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Default date range: last 7 days
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const defaultEnd = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const [customStartDate, setCustomStartDate] = useState(defaultStart);
  const [customEndDate, setCustomEndDate] = useState(defaultEnd);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<{ employee: any, reports: DailyReport[] } | null>(null);
  const [departmentEmployees, setDepartmentEmployees] = useState<any[]>([]);
  const [departmentProjects, setDepartmentProjects] = useState<any[]>([]);
  const [modalPage, setModalPage] = useState(1);
  const [yesterdaySubTab, setYesterdaySubTab] = useState<'reported' | 'not_reported'>('reported');
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const emailInputRef = React.useRef<any>(null);

  useEffect(() => {
    setModalPage(1);
  }, [selectedEmployeeDetails]);

  useEffect(() => {
    if (emailModalVisible) {
      if (Platform.OS === 'web') {
        window.focus();
      }
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [emailModalVisible]);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadReports = async (isManualCustomFetch = false) => {
    if (filter === 'custom' && !isManualCustomFetch) {
      setReports([]);
      setHasFetched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch all employees in this department
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: profile } = await supabase.from('profiles').select('department').eq('id', authData.user.id).single();
        const dept = profile?.department || authData.user.user_metadata?.department;
        if (dept) {
          const { data: emps } = await supabase.from('profiles').select('*').eq('department', dept).eq('role', 'employee').eq('status', 'approved');
          setDepartmentEmployees(emps || []);

          const { data: projs } = await supabase
            .from('projects')
            .select('projectname, projectid')
            .eq('status', 'onGoing')
            .order('projectname', { ascending: true });
          setDepartmentProjects(projs || []);
        }
      }

      // 2. Fetch the reports
      let fetchParams: any = undefined;
      const today = new Date();
      if (filter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        fetchParams = { dateFrom: yesterdayStr, dateTo: yesterdayStr };
      } else if (filter === 'weekly') {
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        fetchParams = { dateFrom: lastWeek.toISOString().split('T')[0] };
      } else if (filter === 'monthly') {
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        fetchParams = { dateFrom: lastMonth.toISOString().split('T')[0] };
      } else if (filter === 'custom') {
        if (!customStartDate || !customEndDate) {
          Alert.alert("Date Required", "Please enter both From and To dates.");
          setLoading(false);
          return;
        }
        fetchParams = { dateFrom: customStartDate, dateTo: customEndDate };
      } else if (filter === 'reports') {
        // No date filter, fetches all time for this department
      }
      const data = await fetchReports(fetchParams);
      setReports(data || []);
      if (filter === 'custom') {
        setHasFetched(true);
      }
      setSelectedEmployees(new Set());
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'approved': return Brand.colors.success;
      case 'rejected': return Brand.colors.error;
      case 'submitted': return Brand.colors.warning;
      default: return Brand.colors.textSecondary;
    }
  };

  const renderFilter = (status: string, label: string) => (
    <Pressable
      style={({ hovered, pressed }) => [
        styles.filterChip,
        filter === status && styles.filterChipActive,
        hovered && styles.filterChipHovered,
        pressed && { opacity: 0.7 }
      ] as any}
      onPress={() => {
        setFilter(status);
        setHasFetched(false);
        if (status !== 'reports' && status !== 'custom') {
          setReportType('');
          setSelectedProjectId('');
          setSelectedEmployeeId('');
          setCustomStartDate(defaultStart);
          setCustomEndDate(defaultEnd);
        }
      }}
    >
      <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  const toggleSelection = (empId: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(empId)) {
      newSet.delete(empId);
    } else {
      newSet.add(empId);
    }
    setSelectedEmployees(newSet);
  };

  const uniqueProjects = useMemo(() => {
    const projects = new Set<string>();
    reports.forEach(r => {
      if (r.task_name) projects.add(r.task_name);
    });
    return Array.from(projects).sort();
  }, [reports]);

  const filteredReportsForDisplay = useMemo(() => {
    let filtered = reports;
    if (filter === 'reports') {
      if (reportType === 'projects' && selectedProjectId) {
        filtered = filtered.filter(r => r.task_name === selectedProjectId);
        if (customStartDate) {
          filtered = filtered.filter(r => r.report_date >= customStartDate);
        }
        if (customEndDate) {
          filtered = filtered.filter(r => r.report_date <= customEndDate);
        }
      } else if (reportType === 'employees') {
        if (selectedEmployeeId) {
          filtered = filtered.filter(r => (r as any).employee_id === selectedEmployeeId || (r as any).actual_employee_id === selectedEmployeeId);
        }
        if (customStartDate) {
          filtered = filtered.filter(r => r.report_date >= customStartDate);
        }
        if (customEndDate) {
          filtered = filtered.filter(r => r.report_date <= customEndDate);
        }
      }
    }
    return filtered;
  }, [reports, filter, reportType, selectedProjectId, selectedEmployeeId, customStartDate, customEndDate]);

  const groupedReports = useMemo(() => {
    // Start with all employees in the department (defaulting to 0 reports)
    const groups: Record<string, { employee: any, reports: DailyReport[] }> = {};

    let employeesToGroup = departmentEmployees;
    if (filter === 'reports' && reportType === 'employees' && selectedEmployeeId) {
      employeesToGroup = employeesToGroup.filter(emp => emp.id === selectedEmployeeId || emp.employee_id === selectedEmployeeId);
    }

    employeesToGroup.forEach(emp => {
      groups[emp.id] = {
        employee: emp,
        reports: [],
      };
    });

    // Merge in the actual reports
    filteredReportsForDisplay.forEach((report) => {
      const empId = (report as any).employee_id || report.employee?.id || 'unknown';
      if (!groups[empId]) {
        groups[empId] = {
          employee: report.employee || { id: 'unknown', name: 'Unknown', employee_id: 'N/A', department: '' },
          reports: [],
        };
      }
      groups[empId].reports.push(report);
    });

    return Object.values(groups).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  }, [filteredReportsForDisplay, departmentEmployees, filter, reportType, selectedEmployeeId]);

  const getCurrentDateRangeStr = (): string => {
    if (filter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    } else if (filter === 'weekly') {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return `${lastWeek.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`;
    } else if (filter === 'monthly') {
      const today = new Date();
      const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return `${lastMonth.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`;
    } else if (filter === 'custom') {
      return `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
    } else {
      return 'All Time';
    }
  };

  const yesterdayReported = useMemo(() => {
    return groupedReports.filter(g => g.reports.length > 0);
  }, [groupedReports]);

  const yesterdayNotReported = useMemo(() => {
    return groupedReports.filter(g => g.reports.length === 0);
  }, [groupedReports]);

  const loadJsPDFLibrary = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).jspdf) {
        resolve((window as any).jspdf);
        return;
      }

      // Try loading from HTTPS CDNs first (essential for HTTPS vercel deployments)
      const jsPdfUrl = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      const autotableUrl = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js";
      const ttfUrl = "https://cdn.jsdelivr.net/gh/googlefonts/catamaran@main/fonts/ttf/Catamaran-Regular.ttf";

      const loadFontAndResolve = async () => {
        try {
          if (!tamilFontBase64) {
            const fontRes = await fetch(ttfUrl);
            if (fontRes.ok) {
              const arrayBuffer = await fontRes.arrayBuffer();
              let binary = '';
              const bytes = new Uint8Array(arrayBuffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              tamilFontBase64 = window.btoa(binary);
            }
          }
        } catch (err) {
          console.warn("Could not load Catamaran bilingual font, falling back to default Helvetica.", err);
        }
        resolve((window as any).jspdf);
      };

      const loadFromLocalFallback = () => {
        const serverHost = Platform.OS === 'web' ? window.location.hostname : 'localhost';
        const fallbackJsPdf = `http://${serverHost}:8001/public/jspdf.umd.min.js`;
        const fallbackAutotable = `http://${serverHost}:8001/public/jspdf.plugin.autotable.min.js`;

        const script = document.createElement('script');
        script.src = fallbackJsPdf;
        script.onload = () => {
          const scriptAutoTable = document.createElement('script');
          scriptAutoTable.src = fallbackAutotable;
          scriptAutoTable.onload = () => {
            loadFontAndResolve();
          };
          scriptAutoTable.onerror = () => reject(new Error("Failed to load local jsPDF autotable."));
          document.body.appendChild(scriptAutoTable);
        };
        script.onerror = () => reject(new Error("Failed to load jsPDF library from both cloud CDN and local server. Ensure internet or local service is running."));
        document.body.appendChild(script);
      };

      const script = document.createElement('script');
      script.src = jsPdfUrl;
      script.onload = () => {
        const scriptAutoTable = document.createElement('script');
        scriptAutoTable.src = autotableUrl;
        scriptAutoTable.onload = () => {
          loadFontAndResolve();
        };
        scriptAutoTable.onerror = () => {
          loadFromLocalFallback();
        };
        document.body.appendChild(scriptAutoTable);
      };
      script.onerror = () => {
        loadFromLocalFallback();
      };
      document.body.appendChild(script);
    });
  };

  const generatePDFBase64 = (jspdfModule: any): string => {
    const jsPDFConstructor = jspdfModule.jsPDF || (window as any).jspdf?.jsPDF;
    if (!jsPDFConstructor) {
      throw new Error("jsPDF constructor not found in global namespace");
    }

    const doc = new jsPDFConstructor();

    // Register bilingual Latin & Tamil font if loaded successfully
    if (tamilFontBase64) {
      doc.addFileToVFS("Catamaran.ttf", tamilFontBase64);
      doc.addFont("Catamaran.ttf", "Catamaran", "normal");
      doc.setFont("Catamaran", "normal");
    }

    const dateStr = getCurrentDateRangeStr();

    // Document Header
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Dark blue
    if (tamilFontBase64) {
      doc.setFont("Catamaran", "normal");
    } else {
      doc.setFont("helvetica", "bold");
    }
    doc.text("BARANI REPORTING SYSTEM", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55); // Dark grey
    doc.text("Consolidated Daily Work Report", 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text(`DATE: ${dateStr}`, 150, 20);

    // Meta Section
    doc.setDrawColor(0, 0, 0); // Black
    doc.line(14, 34, 196, 34);

    const totalEmployees = yesterdayReported.length + yesterdayNotReported.length;

    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0); // Black for maximum legibility

    // Column 1: Department (printed dynamically using getTextWidth to prevent overlapping)
    const labelDept = "Department: ";
    const valDept = user?.department || 'Unknown Department';
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "bold");
    doc.text(labelDept, 14, 40);
    const wDept = doc.getTextWidth(labelDept);
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "normal");
    doc.text(valDept, 14 + wDept, 40);

    // Column 2: Reported Employees
    const labelRep = "Reported Employees: ";
    const valRep = `${yesterdayReported.length}/${totalEmployees}`;
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "bold");
    doc.text(labelRep, 76, 40);
    const wRep = doc.getTextWidth(labelRep);
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "normal");
    doc.text(valRep, 76 + wRep, 40);

    // Column 3: Backlogged Employees
    const labelBack = "Backlogged Employees: ";
    const valBack = `${yesterdayNotReported.length}/${totalEmployees}`;
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "bold");
    doc.text(labelBack, 134, 40);
    const wBack = doc.getTextWidth(labelBack);
    doc.setFont(tamilFontBase64 ? "Catamaran" : "helvetica", "normal");
    doc.text(valBack, 134 + wBack, 40);

    doc.line(14, 46, 196, 46);

    // Sort backlog employees alphabetically
    const sortedBacklog = [...yesterdayNotReported].sort((a, b) => 
      (a.employee?.name || '').localeCompare(b.employee?.name || '')
    );

    let currentY = 48;

    if (sortedBacklog.length > 0 && filter !== 'custom') {
      const backlogNames = sortedBacklog.map(item => `- ${item.employee?.name || 'Unknown'}`);
      
      // Organize into 3 columns (increased space per column to prevent text wrapping/misalignment)
      const backlogTableBody: any[] = [];
      for (let i = 0; i < backlogNames.length; i += 3) {
        backlogTableBody.push([
          backlogNames[i] || '',
          backlogNames[i + 1] || '',
          backlogNames[i + 2] || ''
        ]);
      }

      (doc as any).autoTable({
        startY: 48,
        head: [[{ content: 'PENDING SUBMISSIONS (NOT REPORTED EMPLOYEES)', colSpan: 3 }]],
        body: backlogTableBody,
        theme: 'plain',
        headStyles: { 
          fillColor: [254, 242, 242], 
          textColor: [220, 38, 38], 
          fontStyle: tamilFontBase64 ? 'normal' : 'bold',
          font: tamilFontBase64 ? 'Catamaran' : 'helvetica',
          halign: 'left',
          fontSize: 11
        },
        bodyStyles: { 
          textColor: [220, 38, 38],
          font: tamilFontBase64 ? 'Catamaran' : 'helvetica',
          fontSize: 11
        },
        styles: { 
          cellPadding: 3,
          font: tamilFontBase64 ? 'Catamaran' : 'helvetica'
        },
        columnStyles: {
          0: { cellWidth: 60.6 },
          1: { cellWidth: 60.6 },
          2: { cellWidth: 60.6 }
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Table Data
    const tableBody: any[] = [];
    let sNo = 1;
    yesterdayReported.forEach((group) => {
      const empName = cleanText(group.employee.name);
      const empId = cleanText(group.employee.employee_id);

      // Group projects
      const projectsText = group.reports.map(r => cleanText(`- ${r.project_id ? `${r.project_id} - ` : ''}${r.task_name}`)).join('\n\n');

      // Group task descriptions
      const tasksText = group.reports.map(r => {
        let desc = extractTaskDescription(r.work_description);
        // Replace unsupported unicode bullets with standard hyphens for jsPDF compatibility
        desc = desc.replace(/[●•\u25CF\u2022]/g, '-');
        
        const fab = parseFabricationDetails(r.work_description);
        let extraInfo = '';
        if (fab.component) {
          extraInfo += `\nComponent: ${fab.component}${fab.drawing ? ` (DWG: ${fab.drawing})` : ''}`;
        }
        if (fab.coil) {
          extraInfo += `\nCoil Ref: ${fab.coil}`;
        } else if (r.Coil_Ref_1) {
          extraInfo += `\nCoil Ref: ${r.Coil_Ref_1}`;
        }
        if (fab.rod) {
          extraInfo += `\nRod: ${fab.rod}`;
        }
        
        const projHeader = r.project_id ? `${r.project_id} - ${r.task_name}` : r.task_name;
        return cleanText(`[${projHeader}]${extraInfo}\n${desc}`);
      }).join('\n\n');

      // Group durations
      const groupTotal = group.reports.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);
      const durationsText = group.reports.map(r => `${r.hours_worked} hrs`).join('\n\n') + `\n\n-----------------\nTotal: ${groupTotal.toFixed(1)} hrs`;

      tableBody.push([
        sNo++,
        `${empName}\n(${empId})`,
        projectsText,
        tasksText,
        durationsText
      ]);
    });

    (doc as any).autoTable({
      startY: currentY,
      head: [['S.No', 'Employee', 'Project', 'Task Description', 'Duration']],
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [59, 130, 246], 
        textColor: [255, 255, 255], 
        fontStyle: tamilFontBase64 ? 'normal' : 'bold',
        font: tamilFontBase64 ? 'Catamaran' : 'helvetica',
        fontSize: 11.5
      },
      styles: { 
        fontSize: 11, 
        cellPadding: 4, 
        overflow: 'linebreak', 
        lineColor: [0, 0, 0], 
        lineWidth: 0.15,
        font: tamilFontBase64 ? 'Catamaran' : 'helvetica',
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22 }
      }
    });

    const pdfDataUri = doc.output('datauristring');
    const base64Str = pdfDataUri.split(',')[1];
    return base64Str;
  };

  const generateReportHtml = (): string => {
    const dateStr = getCurrentDateRangeStr();
    const title = `Consolidated_Report_${dateStr.replace(/ /g, '_')}`;

    let rowsHtml = "";
    let sNo = 1;
    yesterdayReported.forEach((group) => {
      const empName = group.employee.name;
      const empId = group.employee.employee_id;
      
      const projectsHtml = group.reports.map(r => `<div style="margin-bottom: 6px; font-weight: 600;">&bull; ${r.project_id ? `${r.project_id} - ` : ''}${r.task_name}</div>`).join('');

      const tasksHtml = group.reports.map(r => {
        const desc = extractTaskDescription(r.work_description);
        const fab = parseFabricationDetails(r.work_description);
        let extraHtml = '';
        if (fab.component) {
          extraHtml += `<div style="font-size: 12px; color: #4B5563; margin-top: 4px;"><strong>Component:</strong> ${fab.component}${fab.drawing ? ` (DWG: ${fab.drawing})` : ''}</div>`;
        }
        if (fab.coil) {
          extraHtml += `<div style="font-size: 12px; color: #1D4ED8; margin-top: 4px;"><strong>Coil Ref:</strong> ${fab.coil}</div>`;
        } else if (r.Coil_Ref_1) {
          extraHtml += `<div style="font-size: 12px; color: #1D4ED8; margin-top: 4px;"><strong>Coil Ref:</strong> ${r.Coil_Ref_1}</div>`;
        }
        if (fab.rod) {
          extraHtml += `<div style="font-size: 12px; color: #047857; margin-top: 4px;"><strong>Rod:</strong> ${fab.rod}</div>`;
        }
        
        const projHeader = r.project_id ? `${r.project_id} - ${r.task_name}` : r.task_name;
        return `<div style="margin-bottom: 12px;"><strong style="color: #1E3A8A; font-size: 13px;">[${projHeader}]</strong>${extraHtml}<div style="white-space: pre-wrap; margin-top: 6px; line-height: 1.4; color: #374151;">${desc}</div></div>`;
      }).join('');

      const durationsHtml = group.reports.map(r => `<div style="margin-bottom: 6px;">${r.hours_worked} hrs</div>`).join('');

      const groupTotalHours = group.reports.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);

      rowsHtml += `
        <tr style="border-bottom: 1px solid #000000; vertical-align: top;">
          <td style="padding: 10px; text-align: center; font-size: 13px;">${sNo++}</td>
          <td style="padding: 10px; font-weight: 600; font-size: 13px;">
            ${empName}<br><span style="font-size: 11px; font-weight: 400; color: #6B7280;">${empId}</span>
          </td>
          <td style="padding: 10px; font-size: 13px;">
            ${projectsHtml}
          </td>
          <td style="padding: 10px; text-align: left; font-size: 13px;">
            ${tasksHtml}
          </td>
          <td style="padding: 10px; text-align: center; font-size: 13px;">
            ${durationsHtml}
            <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #D1D5DB; font-weight: 700; color: #1F2937;">
              Total:<br>${groupTotalHours.toFixed(1)} hrs
            </div>
          </td>
        </tr>
      `;
    });

    const totalHours = yesterdayReported.reduce((sum, g) => sum + g.reports.reduce((subSum, r) => subSum + parseHours(r.hours_worked), 0), 0);
    const totalEmployees = yesterdayReported.length;
    const totalCount = yesterdayReported.length + yesterdayNotReported.length;

    const htmlSortedBacklog = [...yesterdayNotReported].sort((a, b) => 
      (a.employee?.name || '').localeCompare(b.employee?.name || '')
    );

    let backlogBlockHtml = "";
    if (htmlSortedBacklog.length > 0 && filter !== 'custom') {
      backlogBlockHtml = `
        <div style="margin-bottom: 25px; border: 1.5px solid #FCA5A5; background-color: #FEF2F2; padding: 14px; border-radius: 8px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; color: #DC2626; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Pending Submissions (Not Reported Employees):
          </h3>
          <div style="display: flex; flex-flow: row wrap; gap: 8px 20px; color: #DC2626; font-size: 13px; font-weight: 600;">
            ${htmlSortedBacklog.map(item => `
              <div style="white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                <span style="color: #EF4444; font-size: 14px;">&bull;</span>
                <span>${item.employee?.name || 'Unknown'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1F2937;
            padding: 20px;
            background-color: #FFFFFF;
            margin: 0;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2px solid #3B82F6;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .college-title {
            font-size: 20px;
            font-weight: 800;
            color: #1E3A8A;
            margin: 0;
          }
          .report-title {
            font-size: 22px;
            font-weight: 700;
            color: #1F2937;
            margin-top: 5px;
            margin-bottom: 0;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .meta-table td {
            padding: 8px 12px;
            border: 1px solid #000000;
            font-size: 13px;
          }
          .meta-label {
            font-weight: 700;
            background-color: #F9FAFB;
            width: 25%;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .data-table, .data-table th, .data-table td {
            border: 1px solid #000000;
          }
          .data-table th {
            background-color: #3B82F6;
            color: #FFFFFF;
            padding: 10px;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: left; padding: 0 0 10px 0; border: none;">
              <h1 class="college-title">BARANI REPORTING SYSTEM</h1>
              <h2 class="report-title">${filter === 'yesterday' ? 'Consolidated Daily Work Report' : 'Consolidated Work Report'}</h2>
            </td>
            <td style="text-align: right; vertical-align: bottom; padding: 0 0 10px 0; border: none;">
              <div style="font-size: 14px; font-weight: 700; color: #3B82F6; letter-spacing: 0.5px;">DATE: ${dateStr}</div>
            </td>
          </tr>
        </table>

        <table class="meta-table">
          <tr>
            <td class="meta-label" style="width: 12%;">Department</td>
            <td style="width: 20%;">${user?.department || 'Unknown Department'}</td>
            <td class="meta-label" style="width: 20%;">Reported Employees</td>
            <td style="width: 14%;">${totalEmployees}/${totalCount}</td>
            <td class="meta-label" style="width: 20%;">Backlogged Employees</td>
            <td style="width: 14%;">${yesterdayNotReported.length}/${totalCount}</td>
          </tr>
        </table>

        ${backlogBlockHtml}

        <table class="data-table" border="1" borderColor="#000000">
          <thead>
            <tr>
              <th style="width: 6%;">S.No</th>
              <th style="width: 20%;">Employee</th>
              <th style="width: 20%;">Project</th>
              <th>Task Description</th>
              <th style="width: 15%;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  const handleSendEmail = (target: 'reminder' | 'consolidated', arg1?: string, arg2?: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    if (target === 'consolidated') {
      setRecipientEmails('');
      setEmailModalVisible(true);
      return;
    } else {
      const employeeName = arg1 || "";
      const recipientEmail = arg2 || "";
      const subject = `REMINDER: Daily Work Report Missing (${dateStr})`;
      const body = `Hi ${employeeName},\n\nOur records show that you have not submitted your daily work report for yesterday (${dateStr}).\n\nPlease submit your report using the daily task tracker as soon as possible.\n\nBest regards,\nDepartment Head`;
      
      const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      Linking.openURL(mailtoUrl).catch((err) => {
        console.error("Failed to open email client:", err);
        Alert.alert("Error", "Could not open your default email app. Please ensure you have an email client configured.");
      });
    }
  };

  const sendConsolidatedEmailDirectly = async () => {
    if (!recipientEmails.trim()) {
      Alert.alert("Input Error", "Please enter at least one recipient email address.");
      return;
    }

    setEmailSending(true);
    try {
      const jspdfModule = await loadJsPDFLibrary();
      const dateStr = getCurrentDateRangeStr();
      const body = `Hi,\n\nPlease find attached the consolidated work report for ${dateStr}.\n\nBest regards,\nDepartment Head`;
      const pdfBase64 = generatePDFBase64(jspdfModule);

      const { data, error } = await supabase.functions.invoke('send-consolidated-report', {
        body: {
          recipients: recipientEmails.split(',').map(e => e.trim()),
          date: dateStr.replace(/ /g, '_'),
          pdfBase64,
          subject: `Consolidated Work Report (${dateStr})`,
          body
        }
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to send email');
      }

      if (Platform.OS === 'web') {
        alert("Success: Consolidated PDF report has been emailed directly via Supabase!");
      } else {
        Alert.alert("Success", "Consolidated PDF report has been emailed directly via Supabase!");
      }
      setEmailModalVisible(false);
      setRecipientEmails('');
    } catch (error: any) {
      console.error("Error sending direct email:", error);
      const errorMsg = error?.message || "Ensure you have deployed the Edge Function and set up SMTP configurations in Supabase.";
      if (Platform.OS === 'web') {
        alert("Direct Send Failed:\n" + errorMsg);
      } else {
        Alert.alert("Direct Send Failed", errorMsg);
      }
    } finally {
      setEmailSending(false);
    }
  };

  const handleExportPDF = () => {
    const htmlContent = generateReportHtml();
    const printHtml = htmlContent + `
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    `;

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
      } else {
        Alert.alert("Blocked", "Print window was blocked by your browser. Please allow popups for this site.");
      }
    } else {
      Alert.alert("Web Only", "PDF printing is supported directly on Web browser. For mobile devices, please export to Excel.");
    }
  };

  const groupedEmployeeTasks = useMemo(() => {
    if (!selectedEmployeeDetails) return [];
    const groups: Record<string, DailyReport[]> = {};
    selectedEmployeeDetails.reports.forEach(report => {
      const projName = report.task_name || 'Unknown Project';
      if (!groups[projName]) {
        groups[projName] = [];
      }
      groups[projName].push(report);
    });
    return Object.entries(groups).map(([project, tasks]) => {
      const projId = tasks[0]?.project_id;
      return { project, tasks, project_id: projId };
    });
  }, [selectedEmployeeDetails]);

  const ITEMS_PER_PAGE = 3;
  const totalModalPages = Math.ceil(groupedEmployeeTasks.length / ITEMS_PER_PAGE) || 1;

  const paginatedTasks = useMemo(() => {
    return groupedEmployeeTasks.slice((modalPage - 1) * ITEMS_PER_PAGE, modalPage * ITEMS_PER_PAGE);
  }, [groupedEmployeeTasks, modalPage]);

  const cleanText = (str: string): string => {
    if (!str) return '';
    
    // Replace superscript and subscript numbers with standard numbers (fixes tiny digit/subscript display issues)
    let cleaned = str
      .replace(/[\u2070\u2080]/g, '0')
      .replace(/[\u00B9\u2081]/g, '1')
      .replace(/[\u00B2\u2082]/g, '2')
      .replace(/[\u00B3\u2083]/g, '3')
      .replace(/[\u2074\u2084]/g, '4')
      .replace(/[\u2075\u2085]/g, '5')
      .replace(/[\u2076\u2086]/g, '6')
      .replace(/[\u2077\u2087]/g, '7')
      .replace(/[\u2078\u2088]/g, '8')
      .replace(/[\u2079\u2089]/g, '9');

    // Replace common non-ASCII characters with safe alternatives
    let sanitized = cleaned
      .replace(/[●•\u25CF\u2022]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2122/g, 'TM')
      .replace(/\u00AE/g, '(R)')
      .replace(/\u00A9/g, '(C)');

    // Allow ASCII range AND Tamil unicode characters (U+0B80 to U+0BFF)
    sanitized = sanitized.split('').map(char => {
      const code = char.charCodeAt(0);
      if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
        return char;
      }
      if (code >= 0x0B80 && code <= 0x0BFF) {
        return char;
      }
      return ' '; // Replace other unsupported non-ascii characters with space
    }).join('');

    const cleanLine = (line: string): string => {
      const isGarbled = /([a-zA-Z0-9]\s*&\s*){3,}/.test(line) || (line.match(/&/g) || []).length > 5;
      if (isGarbled) {
        let clean = line.replace(/&/g, '');
        clean = clean.replace(/^%[^a-zA-Z0-9]*/, '');
        clean = clean.replace(/^[^\x20-\x7E]+/, '');
        clean = clean.replace(/\s+/g, ' ');
        return clean.trim();
      }
      return line;
    };

    return sanitized
      .split('\n')
      .map(cleanLine)
      .filter(line => line.length > 0)
      .join('\n');
  };

  const parseFabricationDetails = (fullDesc: string) => {
    if (!fullDesc) return { component: '', drawing: '', coil: '', rod: '' };
    
    let component = '';
    let drawing = '';
    let coil = '';
    let rod = '';
    
    const lines = fullDesc.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Component:')) {
        const compText = trimmedLine.substring(10).trim();
        const dwgIdx = compText.indexOf('(DWG:');
        if (dwgIdx !== -1) {
          component = compText.substring(0, dwgIdx).trim();
          drawing = compText.substring(dwgIdx + 5, compText.length - 1).trim();
        } else {
          component = compText;
        }
      } else if (trimmedLine.startsWith('Coil Ref 1:')) {
        coil = trimmedLine.substring(11).trim();
      } else if (trimmedLine.startsWith('Rod Type:')) {
        const rodText = trimmedLine.substring(9).trim();
        const qtyIdx = rodText.indexOf('(Qty:');
        if (qtyIdx !== -1) {
          rod = rodText.substring(0, qtyIdx).trim() + ` (Qty: ` + rodText.substring(qtyIdx + 5, rodText.length - 1).trim() + `)`;
        } else {
          rod = rodText;
        }
      }
    }
    return { component, drawing, coil, rod };
  };

  const extractTaskDescription = (fullDesc: string) => {
    if (!fullDesc) return '';
    const taskMarker = 'Task:\n';
    const idx = fullDesc.indexOf(taskMarker);
    let desc = fullDesc;
    if (idx !== -1) {
      desc = fullDesc.substring(idx + taskMarker.length).trim();
    } else {
      desc = fullDesc.trim();
    }
    return cleanText(desc);
  };

  const renderFabricationDetails = (task: any) => {
    const fab = parseFabricationDetails(task.work_description);
    return (
      <View style={{ gap: 2 }}>
        {fab.component ? (
          <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>
            Component: <Text style={{ fontWeight: '600' }}>{fab.component}</Text>
            {fab.drawing ? ` (DWG: ${fab.drawing})` : ''}
          </Text>
        ) : null}

        {fab.coil ? (
          <Text style={{ fontSize: 12, color: '#0056FF', marginTop: 4, fontWeight: '600' }}>
            Coil Ref: {fab.coil}
          </Text>
        ) : (task.Coil_Ref_1 || task.Coil_Ref_2 || task.Coil_Ref_3 || task.Coil_Ref_4) ? (
          <Text style={{ fontSize: 12, color: '#0056FF', marginTop: 4, fontWeight: '600' }}>
            Coil Ref: {[task.Coil_Ref_1, task.Coil_Ref_2, task.Coil_Ref_3, task.Coil_Ref_4].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {fab.rod ? (
          <Text style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: '600' }}>
            Rod: {fab.rod}
          </Text>
        ) : null}
      </View>
    );
  };

  const parseHours = (durationStr: any): number => {
    if (!durationStr) return 0;
    if (typeof durationStr === 'number') return durationStr;
    const str = String(durationStr).trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      const hrs = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      return hrs + (mins / 60);
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const selectedEmployeeEfficiency = useMemo(() => {
    if (reportType !== 'employees' || !selectedEmployeeId) return null;
    const totalWorked = filteredReportsForDisplay.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);
    
    let targetDays = 26; // Default to monthly if no date range
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      targetDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (customStartDate) {
      const start = new Date(customStartDate);
      const end = new Date();
      const diffTime = Math.abs(end.getTime() - start.getTime());
      targetDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    const targetHours = targetDays * 8;
    return targetHours > 0 ? ((totalWorked / targetHours) * 100).toFixed(1) : '0.0';
  }, [reportType, selectedEmployeeId, filteredReportsForDisplay, customStartDate, customEndDate]);

  const handleExport = async () => {
    // Group by employee for the export to match the cards
    const exportData = selectedEmployees.size > 0
      ? groupedReports.filter(g => selectedEmployees.has(g.employee.id))
      : groupedReports;

    if (exportData.length === 0) {
      Alert.alert('Notice', 'No employees available to export.');
      return;
    }

    try {
      const wsData = exportData.map((group) => {
        const uniqueDays = new Set(group.reports.map(r => r.report_date)).size;
        const totalReports = group.reports.length;
        const totalHours = group.reports.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);
        const targetDays = filter === 'weekly' ? 6 : 26;
        const targetHours = targetDays * 7;
        const efficiency = ((totalHours / targetHours) * 100).toFixed(1) + '%';

        return {
          'Employee Name': group.employee?.name || '',
          'Employee ID': group.employee?.employee_id || '',
          'Department': group.employee?.department || '',
          'No. of Days': `${uniqueDays} / ${targetDays}`,
          'Reports Submitted': totalReports,
          'Total Hours': parseFloat(totalHours.toFixed(1)),
          'Efficiency': efficiency,
        };
      });

      const ws = XLSX.utils.json_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 25 }, // Employee Name
        { wch: 15 }, // Employee ID
        { wch: 20 }, // Department
        { wch: 15 }, // No. of Days
        { wch: 20 }, // Reports Submitted
        { wch: 15 }, // Total Hours
        { wch: 15 }, // Efficiency
      ];

      // Apply styles: Center everything except values (D, E, F, G) which are right-aligned
      for (const key in ws) {
        if (key[0] === '!') continue;
        const col = key[0];
        const row = key.substring(1);

        let hAlign = 'center';
        if (row !== '1' && ['D', 'E', 'F', 'G'].includes(col)) {
          hAlign = 'right'; // Values on the right
        }

        ws[key].s = {
          font: row === '1' ? { bold: true, color: { rgb: "000000" } } : undefined,
          alignment: {
            vertical: 'center',
            horizontal: hAlign,
            wrapText: true
          }
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reports");

      const fileName = `HOD_Reports_${new Date().toISOString().split('T')[0]}.xlsx`;

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const uri = (FileSystem as any).documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: 'base64'
        });

        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download Reports',
          UTI: 'com.microsoft.excel.xls'
        });
      }
    } catch (error: any) {
      console.error("Error generating Excel:", error);
      Alert.alert("Error", `Failed to generate Excel file: ${error?.message || JSON.stringify(error)}`);
    }
  };

  const handleModalExport = async () => {
    if (!selectedEmployeeDetails) return;

    const reportsToExport = selectedEmployeeDetails.reports;

    if (reportsToExport.length === 0) {
      Alert.alert('Notice', 'No reports available to export.');
      return;
    }

    try {
      const wsData = reportsToExport.map((report) => ({
        'Employee Name': report.employee?.name || '',
        'Employee ID': report.employee?.employee_id || '',
        'Project': report.task_name || '',
        'Task Description': extractTaskDescription(report.work_description || ''),
        'Date': report.report_date || '',
        'Hours Worked': report.hours_worked || '',
        'Status': report.status ? String(report.status).replace('_', ' ').toUpperCase() : 'UNKNOWN',
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 20 }, // Employee Name
        { wch: 15 }, // Employee ID
        { wch: 25 }, // Project
        { wch: 50 }, // Task Description
        { wch: 15 }, // Date
        { wch: 15 }, // Hours Worked
        { wch: 15 }, // Status
      ];

      // Apply styles: Center everything except values (F: Hours Worked)
      for (const key in ws) {
        if (key[0] === '!') continue;
        const col = key[0];
        const row = key.substring(1);

        let hAlign = 'center';
        if (row !== '1' && col === 'F') {
          hAlign = 'right'; // Hours Worked on the right
        } else if (row !== '1' && col === 'D') {
          hAlign = 'left'; // Task Description left-aligned
        }

        ws[key].s = {
          font: row === '1' ? { bold: true, color: { rgb: "000000" } } : undefined,
          alignment: {
            vertical: 'center',
            horizontal: hAlign,
            wrapText: true
          }
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employee Reports");

      const fileName = `${selectedEmployeeDetails.employee.employee_id || 'Emp'}_Reports_${new Date().toISOString().split('T')[0]}.xlsx`;

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const uri = (FileSystem as any).documentDirectory + fileName;

        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: 'base64'
        });

        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download Employee Reports',
          UTI: 'com.microsoft.excel.xls'
        });
      }
    } catch (error: any) {
      console.error("Error generating Excel:", error);
      Alert.alert("Error", `Failed to generate Excel file: ${error?.message || JSON.stringify(error)}`);
    }
  };

  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 16 }]}>
        <View style={{ marginRight: 16 }}>
          <Text style={styles.title}>Employee Reports</Text>
          <Text style={styles.subtitle}>Review reports for {user?.department || 'Unknown Department'}</Text>
        </View>
        <View style={[styles.headerActions, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', width: isMobile ? '100%' : 'auto', gap: 12 }]}>
          {isMobile ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.filtersInline, { paddingRight: 16 }]}
              style={{ width: '100%', marginBottom: 4 }}
            >
              {renderFilter('all', 'All')}
              {renderFilter('yesterday', 'Yesterday')}
              {renderFilter('custom', 'Custom Range')}
              {renderFilter('reports', 'Reports')}
              {renderFilter('weekly', 'Weekly')}
              {renderFilter('monthly', 'Monthly')}
            </ScrollView>
          ) : (
            <View style={styles.filtersInline}>
              {renderFilter('all', 'All')}
              {renderFilter('yesterday', 'Yesterday')}
              {renderFilter('custom', 'Custom Range')}
              {renderFilter('reports', 'Reports')}
              {renderFilter('weekly', 'Weekly')}
              {renderFilter('monthly', 'Monthly')}
            </View>
          )}
          <Pressable
            style={({ hovered, pressed }) => [
              styles.exportBtn,
              isMobile && { width: '100%', justifyContent: 'center', height: 44 },
              hovered && styles.exportBtnHovered,
              pressed && { opacity: 0.7 }
            ] as any}
            onPress={handleExport}
          >
            <Ionicons name="download-outline" size={16} color="#FFF" />
            <Text style={styles.exportBtnText}>
              Export {selectedEmployees.size > 0 ? `(${selectedEmployees.size} Emp)` : 'All'}
            </Text>
          </Pressable>
        </View>
      </View>

      {filter === 'reports' && (
        <View style={styles.filtersContainer}>
          <View style={styles.customDateContainer}>
            {/* Wireframe format: Two large dropdowns side by side, then a Search button */}
            <View style={styles.filterRow}>
              <View style={styles.pickerWrapperLarge}>
                <Picker
                  selectedValue={reportType}
                  onValueChange={(itemValue) => {
                    setReportType(itemValue as any);
                    setSelectedProjectId('');
                    setSelectedEmployeeId('');
                  }}
                  style={styles.pickerLarge}
                >
                  <Picker.Item label="Select Type" value="" />
                  <Picker.Item label="Projects" value="projects" />
                  <Picker.Item label="Employees" value="employees" />
                </Picker>
              </View>

              <View style={styles.pickerWrapperLarge}>
                {reportType === 'projects' ? (
                  <Picker
                    selectedValue={selectedProjectId}
                    onValueChange={(itemValue) => setSelectedProjectId(itemValue)}
                    style={styles.pickerLarge}
                  >
                    <Picker.Item label="Select Project" value="" />
                    {departmentProjects.map(p => (
                      <Picker.Item key={p.projectid} label={`${p.projectid} - ${p.projectname}`} value={p.projectname} />
                    ))}
                  </Picker>
                ) : reportType === 'employees' ? (
                  <Picker
                    selectedValue={selectedEmployeeId}
                    onValueChange={(itemValue) => setSelectedEmployeeId(itemValue)}
                    style={styles.pickerLarge}
                  >
                    <Picker.Item label="Select Employee" value="" />
                    {departmentEmployees.map(emp => (
                      <Picker.Item key={emp.id} label={`${emp.name} (${emp.employee_id})`} value={emp.id} />
                    ))}
                  </Picker>
                ) : (
                  <Picker enabled={false} selectedValue="" onValueChange={() => {}} style={styles.pickerLarge}>
                    <Picker.Item label="Select Sub-Type" value="" />
                  </Picker>
                )}
              </View>

              <Pressable
                style={({ hovered, pressed }) => [
                  styles.applyBtnLarge,
                  hovered && styles.applyBtnLargeHovered,
                  pressed && { opacity: 0.7 }
                ] as any}
                onPress={() => { }}
              >
                <Text style={styles.applyBtnTextLarge}>Search</Text>
              </Pressable>
            </View>

            {reportType === 'employees' && (
              <View style={styles.filterRow}>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="calendar-outline" size={16} color={Brand.colors.textSecondary} />
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: Brand.colors.text,
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        width: '100%',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.dateInput}
                      placeholder="Start Date (YYYY-MM-DD)"
                      value={customStartDate}
                      onChangeText={setCustomStartDate}
                      placeholderTextColor={Brand.colors.textSecondary}
                    />
                  )}
                </View>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="calendar-outline" size={16} color={Brand.colors.textSecondary} />
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: Brand.colors.text,
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        width: '100%',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <TextInput
                      style={styles.dateInput}
                      placeholder="End Date (YYYY-MM-DD)"
                      value={customEndDate}
                      onChangeText={setCustomEndDate}
                      placeholderTextColor={Brand.colors.textSecondary}
                    />
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {filter === 'custom' && (
        <View style={styles.filtersContainer}>
          <View style={styles.customDateContainer}>
            <View style={isMobile ? { flexDirection: 'column', gap: 12, width: '100%' } : styles.filterRow}>
              <View style={[styles.dateInputWrapper, { flex: undefined, width: isMobile ? '100%' : 180, height: 40, paddingHorizontal: 12 }]}>
                <Ionicons name="calendar-outline" size={14} color={Brand.colors.textSecondary} />
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: Brand.colors.text,
                      height: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '100%',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <TextInput
                    style={[styles.dateInput, { fontSize: 13 }]}
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                    placeholderTextColor={Brand.colors.textSecondary}
                  />
                )}
              </View>
              <View style={[styles.dateInputWrapper, { flex: undefined, width: isMobile ? '100%' : 180, height: 40, paddingHorizontal: 12 }]}>
                <Ionicons name="calendar-outline" size={14} color={Brand.colors.textSecondary} />
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: Brand.colors.text,
                      height: '100%',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '100%',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <TextInput
                    style={[styles.dateInput, { fontSize: 13 }]}
                    placeholder="End Date (YYYY-MM-DD)"
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholderTextColor={Brand.colors.textSecondary}
                  />
                )}
              </View>
              <Pressable
                style={({ hovered, pressed }) => [
                  styles.applyBtnLarge,
                  { height: 40, paddingHorizontal: 16, borderRadius: 6, width: isMobile ? '100%' : 'auto', justifyContent: 'center' },
                  hovered && styles.applyBtnLargeHovered,
                  pressed && { opacity: 0.7 }
                ] as any}
                onPress={() => loadReports(true)}
              >
                <Text style={[styles.applyBtnTextLarge, { fontSize: 14 }]}>Fetch Reports</Text>
              </Pressable>

              {hasFetched && (
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.applyBtnLarge,
                    { height: 40, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#DC2626', shadowColor: '#DC2626', width: isMobile ? '100%' : 'auto', justifyContent: 'center' },
                    hovered && { opacity: 0.9 },
                    pressed && { opacity: 0.7 }
                  ] as any}
                  onPress={handleExportPDF}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Ionicons name="document-text-outline" size={14} color="#FFF" />
                    <Text style={[styles.applyBtnTextLarge, { fontSize: 14 }]}>Export Consolidated PDF</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : filter === 'reports' ? (
        <ScrollView contentContainerStyle={styles.reportListContainer}>
          {reportType === 'employees' && selectedEmployeeId && (
            <View style={styles.employeeDetailsSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.reportHeading, { marginBottom: 0 }]}>
                  {departmentEmployees.find(e => e.id === selectedEmployeeId)?.name || 'Unknown Employee'}
                </Text>
                {selectedEmployeeEfficiency !== null && (
                  <View style={[styles.statusBadge, { backgroundColor: Number(selectedEmployeeEfficiency) >= 100 ? Brand.colors.success + '20' : Brand.colors.warning + '20' }]}>
                    <Text style={[styles.statusText, { color: Number(selectedEmployeeEfficiency) >= 100 ? Brand.colors.success : Brand.colors.warning }]}>
                      Efficiency: {selectedEmployeeEfficiency}%
                    </Text>
                  </View>
                )}
              </View>

              {Object.entries(
                filteredReportsForDisplay.reduce((acc, report) => {
                  const proj = report.task_name || 'Unknown Project';
                  if (!acc[proj]) acc[proj] = [];
                  acc[proj].push(report);
                  return acc;
                }, {} as Record<string, DailyReport[]>)
              ).map(([project, tasks]) => (
                <View key={project} style={styles.projectGroup}>
                  <Text style={styles.projectHeading}>
                    {tasks[0]?.project_id ? `${tasks[0].project_id} - ${project}` : project}
                  </Text>
                  {tasks.map((task, idx) => (
                    <View key={task.id || idx} style={styles.taskRow}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 14, color: Brand.colors.textSecondary }} numberOfLines={2}>
                          {extractTaskDescription(task.work_description)}
                        </Text>
                        {renderFabricationDetails(task)}
                      </View>
                      <Text style={styles.taskDate}>
                        {task.report_date}
                      </Text>
                      <Text style={styles.taskDuration}>
                        {task.hours_worked} {String(task.hours_worked).includes(':') ? '' : 'hrs'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}

              {filteredReportsForDisplay.length === 0 && (
                <Text style={styles.emptyText}>No reports found for this employee in the selected date range.</Text>
              )}
            </View>
          )}

          {reportType === 'projects' && selectedProjectId && (
            <View style={styles.employeeDetailsSection}>
              <Text style={styles.reportHeading}>
                Project: {(() => {
                  const pObj = departmentProjects.find(p => p.projectname === selectedProjectId);
                  return pObj ? `${pObj.projectid} - ${selectedProjectId}` : selectedProjectId;
                })()}
              </Text>

              {Object.entries(
                filteredReportsForDisplay.reduce((acc, report) => {
                  const empName = departmentEmployees.find(e => e.id === (report as any).employee_id || e.id === (report as any).actual_employee_id)?.name || 'Unknown Employee';
                  if (!acc[empName]) acc[empName] = [];
                  acc[empName].push(report);
                  return acc;
                }, {} as Record<string, DailyReport[]>)
              ).map(([empName, tasks]) => (
                <View key={empName} style={styles.projectGroup}>
                  <Text style={styles.projectHeading}>{empName}</Text>
                  {tasks.map((task, idx) => (
                    <View key={task.id || idx} style={styles.taskRow}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 14, color: Brand.colors.textSecondary }} numberOfLines={2}>
                          {extractTaskDescription(task.work_description)}
                        </Text>
                        {renderFabricationDetails(task)}
                      </View>
                      <Text style={styles.taskDate}>
                        {task.report_date}
                      </Text>
                      <Text style={styles.taskDuration}>
                        {task.hours_worked} {String(task.hours_worked).includes(':') ? '' : 'hrs'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}

              {filteredReportsForDisplay.length === 0 && (
                <Text style={styles.emptyText}>No reports found for this project.</Text>
              )}
            </View>
          )}
        </ScrollView>
      ) : filter === 'yesterday' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.yesterdayTabs, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 12 : 0 }]}>
            <View style={{ flexDirection: 'row', gap: 12, width: isMobile ? '100%' : 'auto' }}>
              <Pressable
                style={({ hovered }) => [
                  styles.yesterdayTab,
                  { flex: isMobile ? 1 : undefined, alignItems: 'center' },
                  yesterdaySubTab === 'reported' && styles.yesterdayTabActive,
                  hovered && { backgroundColor: '#F3F4F6' }
                ] as any}
                onPress={() => setYesterdaySubTab('reported')}
              >
                <Text style={[styles.yesterdayTabText, yesterdaySubTab === 'reported' && styles.yesterdayTabTextActive]}>
                  Reported ({yesterdayReported.length})
                </Text>
              </Pressable>
              <Pressable
                style={({ hovered }) => [
                  styles.yesterdayTab,
                  { flex: isMobile ? 1 : undefined, alignItems: 'center' },
                  yesterdaySubTab === 'not_reported' && styles.yesterdayTabActive,
                  hovered && { backgroundColor: '#F3F4F6' }
                ] as any}
                onPress={() => setYesterdaySubTab('not_reported')}
              >
                <Text style={[styles.yesterdayTabText, yesterdaySubTab === 'not_reported' && styles.yesterdayTabTextActive]}>
                  Not Reported ({yesterdayNotReported.length})
                </Text>
              </Pressable>
            </View>

            {yesterdaySubTab === 'reported' && (
              <View style={{ flexDirection: 'row', gap: 12, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 4 : 0, justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                {filter === 'yesterday' && (
                  <Pressable
                    style={({ hovered, pressed }) => [
                      styles.actionBtn,
                      styles.emailBtn,
                      isMobile && { flex: 1, justifyContent: 'center' },
                      hovered && styles.emailBtnHovered,
                      pressed && { opacity: 0.7 }
                    ] as any}
                    onPress={() => handleSendEmail('consolidated')}
                  >
                    <Ionicons name="mail-outline" size={14} color="#FFF" />
                    <Text style={styles.actionBtnText}>Consolidated Email</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.actionBtn,
                    styles.pdfBtn,
                    isMobile && { flex: 1, justifyContent: 'center' },
                    hovered && styles.pdfBtnHovered,
                    pressed && { opacity: 0.7 }
                  ] as any}
                  onPress={handleExportPDF}
                >
                  <Ionicons name="document-text-outline" size={14} color="#FFF" />
                  <Text style={styles.actionBtnText}>Export Consolidated PDF</Text>
                </Pressable>
              </View>
            )}
          </View>

          {yesterdaySubTab === 'reported' ? (
            <View style={{ flex: 1 }}>

              <FlatList
                key={numColumns}
                numColumns={numColumns}
                columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
                data={yesterdayReported}
                keyExtractor={(item) => item.employee.id}
                contentContainerStyle={styles.gridContainer}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {filter === 'yesterday' ? 'No reports submitted yesterday.' : 'No reports submitted in this date range.'}
                  </Text>
                }
                renderItem={({ item: group }) => {
                  const emp = group.employee;
                  const totalHours = group.reports.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);

                  return (
                    <View key={emp.id} style={[styles.card, { minHeight: 200 }]}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardEmpName} numberOfLines={1}>{emp.name}</Text>
                          <Text style={styles.cardEmpId}>{emp.employee_id} • {emp.department}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: Brand.colors.success + '20' }]}>
                          <Text style={[styles.statusText, { color: Brand.colors.success }]}>
                            REPORTED
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <Text style={[styles.cardLabel, { marginBottom: 6 }]}>Submitted Reports:</Text>
                        {group.reports.map((r, idx) => (
                          <View key={r.id || idx} style={{ borderBottomWidth: idx < group.reports.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: Brand.colors.text }}>
                              {r.project_id ? `${r.project_id} - ${r.task_name}` : r.task_name}
                            </Text>
                            <Text style={{ fontSize: 13, color: Brand.colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                              {extractTaskDescription(r.work_description)}
                            </Text>
                            {renderFabricationDetails(r)}
                            <Text style={{ fontSize: 12, fontWeight: '700', color: Brand.colors.textSecondary, marginTop: 4 }}>
                              Hours Worked: {r.hours_worked} hrs
                            </Text>
                          </View>
                        ))}
                        <View style={[styles.fieldRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: Brand.colors.border, paddingTop: 8 }]}>
                          <Text style={styles.cardLabel}>Total Hours Worked:</Text>
                          <Text style={styles.cardValue}>{totalHours.toFixed(1)} hrs</Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          ) : (
            <FlatList
              key={numColumns}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
              data={yesterdayNotReported}
              keyExtractor={(item) => item.employee.id}
              contentContainerStyle={styles.gridContainer}
              ListEmptyComponent={
                <Text style={styles.emptyText}>All employees submitted their reports yesterday.</Text>
              }
              renderItem={({ item: group }) => {
                const emp = group.employee;

                return (
                  <View key={emp.id} style={[styles.card, { flex: 1, minHeight: 'auto', paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.cardEmpName, { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 }]} numberOfLines={1}>
                        {emp.name}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: Brand.colors.error + '15', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 }]}>
                        <Text style={[styles.statusText, { color: Brand.colors.error, fontSize: 10, fontWeight: '700' }]}>
                          PENDING
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        filter === 'custom' && !hasFetched ? (
          <View style={[styles.center, { padding: 40, minHeight: 200, backgroundColor: Brand.colors.card, borderRadius: 12 }]}>
            <Ionicons name="calendar-outline" size={48} color={Brand.colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: Brand.colors.textSecondary, textAlign: 'center' }}>
              Please enter the date range and click "Fetch Reports" to load the work reports.
            </Text>
          </View>
        ) : (
          <FlatList
            key={numColumns}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
            data={groupedReports}
            keyExtractor={(item) => item.employee.id}
            contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No reports found.</Text>
          }
          renderItem={({ item: group }) => {
            const emp = group.employee;
            const uniqueDays = new Set(group.reports.map(r => r.report_date)).size;
            const totalReports = group.reports.length;
            const totalHours = group.reports.reduce((sum, r) => sum + parseHours(r.hours_worked), 0);
            
            let targetDays = filter === 'weekly' ? 6 : 26;
            if (filter === 'custom' && customStartDate && customEndDate) {
              const start = new Date(customStartDate);
              const end = new Date(customEndDate);
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
              targetDays = diffDays;
            }
            
            const targetHours = targetDays * 8;
            const efficiency = ((totalHours / targetHours) * 100).toFixed(1);

            return (
              <Pressable
                key={emp.id}
                style={({ hovered }) => [
                  styles.card,
                  selectedEmployees.has(emp.id) && styles.cardSelected,
                  hovered && styles.cardHovered
                ] as any}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardEmpName} numberOfLines={1}>{emp.name}</Text>
                    <Text style={styles.cardEmpId}>{emp.employee_id} • {emp.department}</Text>
                  </View>
                  <Pressable
                    style={({ hovered, pressed }) => [
                      styles.checkbox,
                      selectedEmployees.has(emp.id) && styles.checkboxSelected,
                      hovered && styles.checkboxHovered,
                      pressed && { opacity: 0.7 }
                    ] as any}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleSelection(emp.id);
                    }}
                  >
                    {selectedEmployees.has(emp.id) && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </Pressable>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.cardLabel}>No. of Days:</Text>
                    <Text style={styles.cardValue}>{uniqueDays} / {targetDays}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.cardLabel}>Reporting Submission:</Text>
                    <Text style={styles.cardValue}>{totalReports} Reports</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.cardLabel}>Efficiency:</Text>
                    <Text style={[styles.cardValue, { color: Number(efficiency) >= 100 ? Brand.colors.success : Brand.colors.warning }]}>
                      {efficiency}%
                    </Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.cardLabel}>Total Hrs:</Text>
                    <Text style={styles.cardValue}>{totalHours.toFixed(1)} hrs</Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
                  <Pressable
                    style={({ hovered, pressed }) => [
                      styles.viewDetailsBtn,
                      hovered && styles.viewDetailsBtnHovered,
                      pressed && { opacity: 0.7 }
                    ] as any}
                    onPress={() => setSelectedEmployeeDetails(group)}
                  >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )
    )}

      {/* Employee Working Details Modal */}
      <Modal
        visible={!!selectedEmployeeDetails}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedEmployeeDetails(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={[styles.modalContainer, { borderRadius: 12, overflow: 'hidden', flex: undefined, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedEmployeeDetails?.employee.name}'s Working Details</Text>
                <Text style={styles.modalSubtitle}>{selectedEmployeeDetails?.employee.employee_id} • {selectedEmployeeDetails?.employee.department}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.exportBtn,
                    { paddingVertical: 8, paddingHorizontal: 12 },
                    hovered && styles.exportBtnHovered,
                    pressed && { opacity: 0.7 }
                  ] as any}
                  onPress={handleModalExport}
                >
                  <Ionicons name="download-outline" size={16} color="#FFF" />
                  <Text style={styles.exportBtnText}>Export</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedEmployeeDetails(null)}
                  style={({ hovered, pressed }) => [
                    styles.closeBtn,
                    hovered && styles.closeBtnHovered,
                    pressed && { opacity: 0.7 }
                  ] as any}
                >
                  <Ionicons name="close" size={24} color={Brand.colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={{ flex: 1, padding: 16 }}>
              <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ minWidth: 750 }}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.col, { flex: 0.5 }]}>S.No</Text>
                      <Text style={[styles.col, { flex: 1.5 }]}>Project</Text>
                      <Text style={[styles.col, { flex: 2 }]}>Task Description</Text>
                      <Text style={[styles.col, { flex: 1.5 }]}>Date and Time</Text>
                      <Text style={[styles.col, { flex: 0.8, textAlign: 'center' }]}>Hrs</Text>
                      <Text style={[styles.col, { flex: 1, textAlign: 'right' }]}>Status</Text>
                    </View>
                    <ScrollView>
                      {paginatedTasks.map((group, index) => (
                        <View key={group.project} style={[styles.tableRow, { paddingVertical: 0, paddingHorizontal: 0, alignItems: 'stretch' }]}>
                          <View style={{ flex: 2, flexDirection: 'row', padding: 16, borderRightWidth: 1, borderRightColor: '#F3F4F6' }}>
                            <Text style={[styles.cell, { flex: 0.5, fontWeight: '700' }]}>{(modalPage - 1) * ITEMS_PER_PAGE + index + 1}</Text>
                            <Text style={[styles.cell, styles.projectHighlight, { flex: 1.5, paddingRight: 8 }]} numberOfLines={2}>
                              {group.project_id ? `${group.project_id} - ${group.project}` : group.project}
                            </Text>
                          </View>
                          <View style={{ flex: 5.3, flexDirection: 'column' }}>
                            {group.tasks.map((task, tIndex) => (
                              <View key={task.id} style={{
                                flexDirection: 'row',
                                padding: 16,
                                borderBottomWidth: tIndex < group.tasks.length - 1 ? 1 : 0,
                                borderBottomColor: '#F3F4F6',
                                alignItems: 'center'
                              }}>
                                <View style={{ flex: 2, gap: 4, paddingRight: 8 }}>
                                  <Text style={styles.cell} numberOfLines={3}>{extractTaskDescription(task.work_description)}</Text>
                                  {renderFabricationDetails(task)}
                                </View>
                                <Text style={[styles.cell, { flex: 1.5 }]}>{task.report_date}</Text>
                                <Text style={[styles.cell, { flex: 0.8, textAlign: 'center' }]}>{task.hours_worked}</Text>
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) + '20' }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                                      {task.status.toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>

              {/* Modal Pagination Controls */}
              {totalModalPages > 1 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity 
                    style={[styles.pageBtn, modalPage === 1 && styles.pageBtnDisabled]} 
                    disabled={modalPage === 1}
                    onPress={() => setModalPage(prev => Math.max(prev - 1, 1))}
                  >
                    <Ionicons name="chevron-back" size={16} color={modalPage === 1 ? '#9CA3AF' : Brand.colors.primary} />
                    <Text style={[styles.pageBtnText, modalPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.pageIndicator}>
                    Page {modalPage} of {totalModalPages}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.pageBtn, modalPage === totalModalPages && styles.pageBtnDisabled]} 
                    disabled={modalPage === totalModalPages}
                    onPress={() => setModalPage(prev => Math.min(prev + 1, totalModalPages))}
                  >
                    <Text style={[styles.pageBtnText, modalPage === totalModalPages && styles.pageBtnTextDisabled]}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color={modalPage === totalModalPages ? '#9CA3AF' : Brand.colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Recipient Email Input Modal */}
      <Modal
        visible={emailModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (!emailSending) setEmailModalVisible(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', padding: 24, borderRadius: 12, width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Brand.colors.text, marginBottom: 8 }}>Send Consolidated Email</Text>
            <Text style={{ fontSize: 13, color: Brand.colors.textSecondary, marginBottom: 20 }}>
              Enter receiver email addresses (use commas to separate multiple emails). The consolidated PDF will be generated and attached automatically.
            </Text>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: Brand.colors.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: Brand.colors.text,
                backgroundColor: '#F9FAFB',
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 20,
              }}
              placeholder="e.g. principal@barani.com, admin@barani.com"
              placeholderTextColor={Brand.colors.textSecondary}
              multiline={true}
              value={recipientEmails}
              onChangeText={setRecipientEmails}
              editable={!emailSending}
              ref={emailInputRef}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Pressable
                style={({ hovered }) => [
                  { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center' },
                  hovered && { backgroundColor: '#F3F4F6' }
                ] as any}
                onPress={() => setEmailModalVisible(false)}
                disabled={emailSending}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: Brand.colors.textSecondary }}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ hovered, pressed }) => [
                  { backgroundColor: Brand.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
                  hovered && { backgroundColor: Brand.colors.primaryDark || '#0041CC' },
                  pressed && { opacity: 0.7 },
                  emailSending && { opacity: 0.6 }
                ] as any}
                onPress={sendConsolidatedEmailDirectly}
                disabled={emailSending}
              >
                {emailSending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send-outline" size={14} color="#FFF" />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>
                  {emailSending ? 'Sending...' : 'Send'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  filtersInline: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  exportBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  filtersContainer: { gap: 24, marginBottom: 20 },
  filters: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Brand.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipHovered: {
    backgroundColor: '#F9FAFB',
    borderColor: Brand.colors.primary,
  },
  filterChipActive: {
    backgroundColor: Brand.colors.primary,
    borderColor: Brand.colors.primary,
  },
  filterText: { fontSize: 14, fontWeight: '600', color: Brand.colors.textSecondary },
  filterTextActive: { color: '#FFF' },
  customDateContainer: {
    gap: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  pickerWrapperLarge: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    height: 56,
    flex: 1,
    minWidth: 240,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerLarge: {
    height: 56,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: Brand.colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 56,
    gap: 8,
    minWidth: 240,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: Brand.colors.text,
    height: '100%',
  },
  applyBtnLarge: {
    backgroundColor: Brand.colors.primary,
    paddingHorizontal: 32,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  applyBtnLargeHovered: {
    backgroundColor: Brand.colors.primaryDark || '#0041CC',
    opacity: 0.9,
  },
  applyBtnTextLarge: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  reportListContainer: {
    paddingBottom: 24,
  },
  employeeDetailsSection: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    marginTop: 8,
    maxWidth: 900, // Prevents the card from stretching too wide on large screens
  },
  reportHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.colors.text,
    marginBottom: 16,
  },
  projectGroup: {
    marginBottom: 16,
    marginLeft: 16,
  },
  projectHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.text,
    marginBottom: 8,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginLeft: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    maxWidth: 600, // Brings the duration much closer to the task description
  },
  taskDesc: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    flex: 1,
    paddingRight: 16,
  },
  taskDate: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    width: 100,
    textAlign: 'center',
    paddingRight: 16,
  },
  taskDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.colors.text,
    width: 80,
    textAlign: 'left', // Aligned left so it sits nicely next to the description
  },
  projectTableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: Brand.colors.border,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  projectTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  projectTableCell: {
    fontSize: 14,
    color: Brand.colors.text,
  },
  projectTableCellDesc: {
    color: Brand.colors.textSecondary,
    paddingRight: 16,
  },
  projectTableCellDuration: {
    fontWeight: '600',
  },
  gridContainer: {
    paddingBottom: 24,
    gap: 16,
  },
  rowWrapper: {
    flexDirection: 'row',
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Brand.colors.border,
    padding: 16,
    minHeight: 200,
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  cardHovered: {
    borderColor: Brand.colors.primary,
    shadowColor: Brand.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    transform: [{ translateY: -2 }],
  },
  cardSelected: {
    borderColor: Brand.colors.primary,
    backgroundColor: '#F8FAFC',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  cardEmpName: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  cardEmpId: {
    fontSize: 12,
    color: Brand.colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Brand.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxHovered: {
    borderColor: Brand.colors.primary,
  },
  checkboxSelected: {
    backgroundColor: Brand.colors.primary,
    borderColor: Brand.colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 8,
    paddingTop: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.colors.textSecondary,
  },
  cardValue: {
    fontSize: 14,
    color: Brand.colors.text,
    fontWeight: '700',
  },
  viewDetailsBtn: {
    backgroundColor: '#FEF3C7', // Light yellow/orange like the 1st image
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewDetailsBtnHovered: {
    backgroundColor: '#FDE68A', // Slightly darker yellow on hover
  },
  viewDetailsText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: Brand.colors.textSecondary, padding: 40, width: '100%' },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnHovered: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  exportBtnHovered: {
    backgroundColor: Brand.colors.primaryDark || '#0041CC',
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    flex: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: Brand.colors.border,
    backgroundColor: '#F3F4F6',
  },
  col: { fontSize: 13, fontWeight: '800', color: '#111827', textTransform: 'uppercase' },
  projectHighlight: { fontSize: 14, fontWeight: '800', color: '#111827' },
  tableRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  cell: { fontSize: 13, color: Brand.colors.text, paddingRight: 8 },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 4,
    backgroundColor: '#FFF',
  },
  pageBtnDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  pageBtnText: {
    color: Brand.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.textSecondary,
  },
  yesterdayTabs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
    paddingBottom: 8,
  },
  yesterdayTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  yesterdayTabActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  yesterdayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.textSecondary,
  },
  yesterdayTabTextActive: {
    color: '#1D4ED8',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  emailBtn: {
    backgroundColor: '#3B82F6',
  },
  emailBtnHovered: {
    backgroundColor: '#2563EB',
  },
  pdfBtn: {
    backgroundColor: '#10B981',
  },
  pdfBtnHovered: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
