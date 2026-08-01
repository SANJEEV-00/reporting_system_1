import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Platform, Alert, SafeAreaView } from 'react-native';
import * as XLSX from 'xlsx-js-style';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { CustomPicker } from '@/components/ui/custom-picker';

export default function HodDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  

  
  // Department Stats
  const [stats, setStats] = useState({
    totalEmployees: 0,
    reportsSubmitted: 0,
    pendingReports: 0,
    completedReports: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Employee Search
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedEmployee, setSearchedEmployee] = useState<any>(null);
  const [employeeReports, setEmployeeReports] = useState<any[]>([]);
  const [departmentEmployees, setDepartmentEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchDepartmentStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle incoming search requests from the search screen
  useEffect(() => {
    if (params.searchEmployeeId && departmentEmployees.length > 0) {
      const incomingId = params.searchEmployeeId as string;
      setSearchId(incomingId);
      handleSearch(incomingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.searchEmployeeId, departmentEmployees]);

  const fetchDepartmentStats = async () => {
    if (!user?.department) return;
    try {
      setLoadingStats(true);
      // 1. Total employees in department
      const { count: empCount, data: emps } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('department', user.department)
        .eq('role', 'employee')
        .eq('status', 'approved')
        .order('name');
        
      if (emps) {
        setDepartmentEmployees(emps);
      }

      // 2. Fetch all reports for these employees to aggregate
      const { data: reports } = await supabase
        .from('project')
        .select('*')
        .eq('Department', user.department);

      let submitted = 0;
      let pending = 0;
      let completed = 0;
      
      if (reports) {
        submitted = reports.length;
        completed = 0; // Statuses were removed
        pending = 0;
      }

      setStats({
        totalEmployees: empCount || 0,
        reportsSubmitted: submitted,
        pendingReports: pending,
        completedReports: completed,
      });
    } catch (err) {
      console.error("Failed to fetch department stats", err);
    } finally {
      setLoadingStats(false);
    }
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

  const handleSearch = async (overrideId?: string) => {
    const idToSearch = typeof overrideId === 'string' ? overrideId : searchId;
    if (!idToSearch.trim() || !user?.department) return;
    setIsSearching(true);
    try {
      // Find employee
      const { data: emp, error: empErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('employee_id', idToSearch.trim().toUpperCase())
        .eq('department', user.department)
        .single();
        
      if (empErr || !emp) {
        alert('Employee not found in your department');
        setSearchedEmployee(null);
        setEmployeeReports([]);
        return;
      }
      
      setSearchedEmployee(emp);
      
      // Fetch their reports from the new project table
      const { data: reports } = await supabase
        .from('project')
        .select('*')
        .eq('employee_ID', emp.employee_id)
        .order('date', { ascending: false });
        
      setEmployeeReports(reports || []);
    } catch(err: any) {
      alert('Search failed: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!searchedEmployee) return;
    
    if (typeof window !== 'undefined') {
      if (!window.confirm(`Are you sure you want to delete ${searchedEmployee.name} (${searchedEmployee.employee_id})? This action cannot be undone.`)) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', searchedEmployee.id);
        
      if (error) {
        throw error;
      }
      
      alert('Employee account deleted successfully.');
      setSearchedEmployee(null);
      setEmployeeReports([]);
      setSearchId('');
      fetchDepartmentStats(); // Refresh stats
    } catch (err: any) {
      alert('Failed to delete employee: ' + err.message + '\n\nNote: You may need to add a DELETE policy for profiles in Supabase.');
    }
  };

  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Summary calculations for searched employee
  const searchedSubmitted = employeeReports.length;
  const searchedPending = 0; // status deleted
  const searchedTotalHours = employeeReports.reduce((sum, r) => sum + parseHours(r.duration || r.Duration || r.DURATION), 0);

  const getWeeklyEfficiency = () => {
    if (!employeeReports || employeeReports.length === 0) return [];
    
    // Group reports by week
    const weeks: Record<string, { hours: number, targetHours: number }> = {};
    
    employeeReports.forEach(report => {
      const rDate = report.date || report.Date || report.DATE;
      if (!rDate) return;
      const date = new Date(rDate);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday
      const weekKey = startOfWeek.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        // 6 working days * 7 hours/day = 42 hours per week target
        weeks[weekKey] = { hours: 0, targetHours: 6 * 7 }; 
      }
      weeks[weekKey].hours += parseHours(report.duration || report.Duration || report.DURATION);
    });
    
    return Object.keys(weeks).sort((a,b) => b.localeCompare(a)).map(key => {
      const eff = Math.round((weeks[key].hours / weeks[key].targetHours) * 100);
      return {
        weekStart: key,
        efficiency: eff > 100 ? 100 : eff,
        count: weeks[key].hours.toFixed(1)
      };
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return styles.statusCompleted;
      case 'rejected': return { backgroundColor: '#FEE2E2' };
      default: return styles.statusProgress;
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'approved': return styles.statusCompletedText;
      case 'rejected': return { color: '#991B1B' };
      default: return styles.statusProgressText;
    }
  };

  const handleDownloadExcel = async () => {
    if (!searchedEmployee || !employeeReports || employeeReports.length === 0) {
      Alert.alert("Notice", "No reports available to download.");
      return;
    }

    try {
      const wsData = employeeReports.map((report) => ({
        Date: report.date || report.Date || report.DATE || '',
        Task: report.Project_name || report.project_name || '',
        Description: report.Task || report.task || '',
        'Hours Worked': parseHours(report.duration || report.Duration || report.DURATION).toFixed(1),
        Status: 'SUBMITTED',
      }));
      
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
      
      const sanitizedName = searchedEmployee.name ? searchedEmployee.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Employee';
      const sanitizedMonth = currentMonthName ? currentMonthName.replace(/[^a-zA-Z0-9]/g, '_') : 'Month';
      const fileName = `${sanitizedName}_Report_${sanitizedMonth}.xlsx`;
      
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
        const uri = FileSystem.cacheDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: 'base64'
        });
        
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download Employee Report',
          UTI: 'com.microsoft.excel.xls'
        });
      }
      
    } catch (error: any) {
      console.error("Error generating Excel:", error);
      Alert.alert("Error", `Failed to generate Excel file: ${error?.message || JSON.stringify(error)}`);
    }
  };

  const handleDownloadDepartmentExcel = async () => {
    try {
      if (!user?.department) return;
      
      const { data: reports, error } = await supabase
        .from('project')
        .select('*')
        .eq('Department', user.department)
        .order('date', { ascending: false });
        
      if (error) throw error;
      
      if (!reports || reports.length === 0) {
        Alert.alert("Notice", "No reports available for this department.");
        return;
      }
      
      const { data: profiles } = await supabase.from('profiles').select('employee_id, name');
      
      const wsData = reports.map((report) => {
        const empId = report.employee_ID || report.Employee_ID || report.employee_id || '';
        const profile = profiles?.find(p => p.employee_id === empId);
        
        return {
          'Employee ID': empId,
          'Employee Name': profile?.name || empId || 'Unknown',
          Date: report.date || report.Date || report.DATE || '',
          Task: report.Project_name || report.project_name || '',
          Description: report.Task || report.task || report.TASK || '',
          'Hours Worked': parseHours(report.duration || report.Duration || report.DURATION).toFixed(1),
          Status: 'SUBMITTED',
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Department Report");
      
      const sanitizedDept = user.department.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedMonth = currentMonthName ? currentMonthName.replace(/[^a-zA-Z0-9]/g, '_') : 'Month';
      const fileName = `${sanitizedDept}_Overall_Report_${sanitizedMonth}.xlsx`;
      
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
        const uri = FileSystem.cacheDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: 'base64'
        });
        
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download Department Report',
          UTI: 'com.microsoft.excel.xls'
        });
      }
    } catch (error: any) {
      console.error("Error generating overall Excel:", error);
      Alert.alert("Error", `Failed to generate Excel file: ${error?.message || JSON.stringify(error)}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6F9' }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Top Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#EBF4FF' }]}>
            <Ionicons name="people-outline" size={24} color="#0056FF" />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Total Employees</Text>
            {loadingStats ? <ActivityIndicator size="small" /> : <Text style={[styles.statValue, { color: '#0056FF' }]}>{stats.totalEmployees}</Text>}
            <TouchableOpacity onPress={() => router.push('/hod/search')}><Text style={styles.viewAll}>View all →</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="clipboard-outline" size={24} color="#2E7D32" />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Reports Submitted</Text>
            {loadingStats ? <ActivityIndicator size="small" /> : <Text style={[styles.statValue, { color: '#2E7D32' }]}>{stats.reportsSubmitted}</Text>}
            <TouchableOpacity onPress={() => router.push('/hod/reports')}><Text style={styles.viewAll}>View all →</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="time-outline" size={24} color="#ED6C02" />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Pending Reports</Text>
            {loadingStats ? <ActivityIndicator size="small" /> : <Text style={[styles.statValue, { color: '#ED6C02' }]}>{stats.pendingReports}</Text>}
            <TouchableOpacity onPress={() => router.push('/hod/reports')}><Text style={styles.viewAll}>View all →</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#9C27B0" />
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Completed Reports</Text>
            {loadingStats ? <ActivityIndicator size="small" /> : <Text style={[styles.statValue, { color: '#9C27B0' }]}>{stats.completedReports}</Text>}
            <TouchableOpacity onPress={() => router.push('/hod/reports')}><Text style={styles.viewAll}>View all →</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Employee Search */}
      <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerIndicator} />
          <Text style={styles.headerTitle}>EMPLOYEE SEARCH</Text>
        </View>
        <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#F0F9FF', borderColor: '#0056FF' }]} onPress={handleDownloadDepartmentExcel}>
          <Ionicons name="download-outline" size={16} color="#0056FF" />
          <Text style={styles.downloadBtnText}>Overall Report</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Employee ID</Text>
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { paddingHorizontal: 0, minHeight: 50 }]}>
            <CustomPicker
              selectedValue={searchId}
              onValueChange={(itemValue) => setSearchId(itemValue)}
              style={{ width: '100%', height: 50, minHeight: 50, margin: 0, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 8, fontSize: 15 }}
              placeholder="Select Employee"
              items={departmentEmployees.map((emp) => ({
                label: `${emp.name} (${emp.employee_id})`,
                value: emp.employee_id
              }))}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch()} disabled={isSearching}>
            {isSearching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={16} color="#FFF" />}
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.searchHint}>ⓘ Enter Employee ID to view monthly task report</Text>
      </View>


      {/* Employee Monthly Report */}
      {searchedEmployee && (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.headerIndicator} />
            <Text style={styles.headerTitle}>EMPLOYEE MONTHLY REPORT</Text>
          </View>

          <View style={styles.reportRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>MONTHLY SUMMARY</Text>
              <View style={styles.monthBadge}>
                <Ionicons name="calendar-outline" size={16} color="#0056FF" />
                <Text style={styles.monthBadgeText}>{currentMonthName}</Text>
              </View>
              <View style={styles.summaryList}>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconRow}><Ionicons name="calendar-outline" size={16} color="#6B7280" /><Text style={styles.summaryLabel}>Total Working Days</Text></View>
                  <Text style={styles.summaryVal}>26</Text>
                </View>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconRow}><Ionicons name="clipboard-outline" size={16} color="#6B7280" /><Text style={styles.summaryLabel}>Reports Submitted</Text></View>
                  <Text style={styles.summaryVal}>{searchedSubmitted}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconRow}><Ionicons name="time-outline" size={16} color="#6B7280" /><Text style={styles.summaryLabel}>Pending Reports</Text></View>
                  <Text style={[styles.summaryVal, {color: '#ED6C02'}]}>{searchedPending}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconRow}><Ionicons name="time-outline" size={16} color="#6B7280" /><Text style={styles.summaryLabel}>Total Hours Worked</Text></View>
                  <Text style={[styles.summaryVal, {color: '#0056FF'}]}>{searchedTotalHours.toFixed(1)}</Text>
                </View>
              </View>

              <Text style={[styles.summaryTitle, { marginTop: 24 }]}>WEEKLY EFFICIENCY</Text>
              <View style={styles.summaryList}>
                {getWeeklyEfficiency().length === 0 ? (
                   <Text style={{color: '#6B7280', fontSize: 13, marginTop: 8}}>No data for efficiency.</Text>
                ) : (
                   getWeeklyEfficiency().map((wk, idx) => (
                     <View key={idx} style={styles.summaryItem}>
                       <View style={styles.summaryIconRow}>
                         <Ionicons name="trending-up-outline" size={16} color="#0056FF" />
                         <Text style={styles.summaryLabel}>Week of {wk.weekStart}</Text>
                       </View>
                       <View style={{alignItems: 'flex-end'}}>
                         <Text style={[styles.summaryVal, {color: wk.efficiency >= 80 ? '#2E7D32' : (wk.efficiency >= 50 ? '#ED6C02' : '#991B1B')}]}>
                           {wk.efficiency}%
                         </Text>
                         <Text style={{fontSize: 10, color: '#6B7280'}}>{wk.count} hrs</Text>
                       </View>
                     </View>
                   ))
                )}
              </View>
            </View>

            <View style={styles.tableCard}>
              <View style={styles.tableHeaderSection}>
                <View>
                  <Text style={styles.metaText}><Text style={styles.metaLabel}>Employee Name</Text> : {searchedEmployee.name}</Text>
                  <Text style={styles.metaText}><Text style={styles.metaLabel}>Department</Text>    : {searchedEmployee.department}</Text>
                  <Text style={styles.metaText}><Text style={styles.metaLabel}>Month</Text>         : <Text style={{color: '#0056FF', fontWeight: '600'}}>{currentMonthName}</Text></Text>
                </View>
                <View style={{ gap: 10, alignItems: 'flex-end' }}>
                  <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadExcel}>
                    <Ionicons name="download-outline" size={16} color="#0056FF" />
                    <Text style={styles.downloadBtnText}>Download Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteEmployee}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.deleteBtnText}>Delete Employee</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                <View style={[styles.table, { minWidth: 600 }]}>
                  <View style={styles.tableRowHeader}>
                    <Text style={[styles.tableCol, {flex: 1}]}>Date</Text>
                    <Text style={[styles.tableCol, {flex: 2}]}>Task Description</Text>
                    <Text style={[styles.tableCol, {flex: 1, textAlign: 'center'}]}>Hours Worked</Text>
                    <Text style={[styles.tableCol, {flex: 1, textAlign: 'center'}]}>Status</Text>
                  </View>
                  {employeeReports.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#6B7280' }}>No reports found for this employee this month.</Text>
                    </View>
                  ) : (
                    employeeReports.slice(0, 5).map((row, i) => {
                      const rowProjId = row.Project_Id || row.Project_ID || row.project_id || row.Project_id;
                      return (
                        <View key={row.id || i} style={styles.tableRow}>
                          <Text style={[styles.tableCell, {flex: 1}]}>{row.date || row.Date}</Text>
                          <View style={{flex: 2, justifyContent: 'center'}}>
                            <Text style={styles.tableCell} numberOfLines={1}>
                              {rowProjId ? `${rowProjId} - ${(row.Project_name || row.project_name)}` : (row.Project_name || row.project_name)}
                            </Text>
                            {(row.Coil_Ref_1 || row.Coil_Ref_2 || row.Coil_Ref_3 || row.Coil_Ref_4) ? (
                              <Text style={{ fontSize: 11, color: '#0056FF', marginTop: 2, fontWeight: '600' }}>
                                Coils: {[row.Coil_Ref_1, row.Coil_Ref_2, row.Coil_Ref_3, row.Coil_Ref_4].filter(Boolean).join(', ')}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.tableCell, {flex: 1, textAlign: 'center'}]}>{parseHours(row.duration || row.Duration).toFixed(1)} hrs</Text>
                          <View style={{flex: 1, alignItems: 'center'}}>
                            <View style={[styles.statusChip, getStatusColor('submitted')]}>
                              <Text style={[styles.statusText, getStatusTextColor('submitted')]}>
                                SUBMITTED
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                )}
                  {employeeReports.length > 5 && (
                    <TouchableOpacity style={styles.viewAllTasks} onPress={() => router.push('/hod/monthly')}>
                      <Text style={styles.viewAllTasksText}>View all tasks →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </>
      )}


      <View style={{height: 40}} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 4,
  },
  viewAll: {
    fontSize: 12,
    color: '#0056FF',
    alignSelf: 'flex-end',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIndicator: {
    width: 4,
    height: 16,
    backgroundColor: '#0056FF',
    marginRight: 8,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.colors.primaryDark,
    letterSpacing: 0.5,
  },
  searchCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
  },
  searchBtn: {
    backgroundColor: '#0056FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 6,
    gap: 8,
  },
  searchBtnText: {
    color: '#FFF',
    fontWeight: '500',
  },
  searchHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
  },
  reportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  tableCard: {
    flex: 2,
    minWidth: 320,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeaderSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  metaText: {
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 4,
  },
  metaLabel: {
    fontWeight: '600',
    color: '#4B5563',
    width: 100,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0056FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  downloadBtnText: {
    color: '#0056FF',
    fontWeight: '500',
    fontSize: 13,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  deleteBtnText: {
    color: '#DC2626',
    fontWeight: '500',
    fontSize: 13,
  },
  table: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCol: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
    color: '#1F2937',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: { backgroundColor: '#DEF7EC' },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusCompletedText: { color: '#03543F' },
  statusProgressText: { color: '#92400E' },
  viewAllTasks: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllTasksText: {
    color: '#0056FF',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'center',
  },
  monthBadge: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 24,
  },
  monthBadgeText: {
    color: '#0056FF',
    fontWeight: '600',
    fontSize: 13,
  },
  summaryList: {
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },

});
