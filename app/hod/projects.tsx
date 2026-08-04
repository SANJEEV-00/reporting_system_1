import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Platform, Alert, ScrollView, Modal, SafeAreaView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/brand';
import { fetchReports } from '@/services/reports-api';
import { DailyReport } from '@/types/report';

export default function ProjectsScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [newProject, setNewProject] = useState({
    projectId: '',
    projectName: '',
    customerName: '',
  });
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProjectReports, setSelectedProjectReports] = useState<{ project: any, reports: DailyReport[] } | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchProjects = async () => {
    if (!user?.department) return;
    try {
      setIsLoadingProjects(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('department', user.department)
        .order('status', { ascending: false }) // 'onGoing' comes before 'close' in descending alphabetical order
        .order('datetime', { ascending: false });
      
      if (!error && data) {
        setProjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.projectId || !newProject.projectName) {
      if (Platform.OS === 'web') { alert("Please fill all project details."); } else { Alert.alert("Error", "Please fill all project details."); }
      return;
    }
    
    setIsSubmittingProject(true);
    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('projects')
        .select('projectid')
        .eq('projectid', newProject.projectId);
        
      if (existing && existing.length > 0) {
        const msg = "Error: Project ID must be unique. This ID already exists!";
        if (Platform.OS === 'web') { alert(msg); } else { Alert.alert("Error", msg); }
        setIsSubmittingProject(false);
        return;
      }

      const { error } = await supabase.from('projects').insert([
        {
          projectid: newProject.projectId,
          projectname: newProject.projectName,
          customername: newProject.customerName,
          department: user?.department || '',
          status: 'onGoing',
        }
      ]);
      
      if (error) throw error;
      
      const successMsg = "Project created successfully!";
      if (Platform.OS === 'web') { alert(successMsg); } else { Alert.alert("Success", successMsg); }
      setNewProject({ projectId: '', projectName: '', customerName: '' });
      fetchProjects();
    } catch (err: any) {
      const errMsg = "Failed to create project: " + err.message;
      if (Platform.OS === 'web') { alert(errMsg); } else { Alert.alert("Error", errMsg); }
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleUpdateStatus = (projectId: string, newStatus: string) => {
    const actionText = newStatus === 'onGoing' ? 'Mark as Ongoing' : 'Mark as Completed';
    
    const updateStatus = async () => {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ status: newStatus })
          .eq('id', projectId);
        
        if (error) throw error;
        
        if (Platform.OS === 'web') {
          alert(`Project status updated to ${newStatus === 'onGoing' ? 'ONGOING' : 'COMPLETED'}`);
        }
        
        fetchProjects();
      } catch (err: any) {
        if (Platform.OS === 'web') alert('Error updating status: ' + err.message);
        else Alert.alert('Error', err.message);
      }
    };

    if (Platform.OS === 'web') {
      const confirmUpdate = window.confirm(`Are you sure you want to ${actionText}?`);
      if (confirmUpdate) {
        updateStatus();
      }
    } else {
      Alert.alert(
        "Update Status",
        `Are you sure you want to ${actionText}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes", onPress: updateStatus }
        ]
      );
    }
  };

  const handleProjectClick = async (project: any) => {
    setIsLoadingTasks(true);
    try {
      const allReports = await fetchReports();
      const projectReports = allReports.filter(r => r.task_name === project.projectname);
      setSelectedProjectReports({ project, reports: projectReports });
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'web') alert('Failed to load project tasks');
      else Alert.alert('Error', 'Failed to load project tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Brand.colors.success;
      case 'rejected': return Brand.colors.error;
      case 'submitted': return Brand.colors.warning;
      default: return Brand.colors.textSecondary;
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerIndicator} />
          <Text style={styles.headerTitle}>CREATE DEPARTMENT PROJECT</Text>
        </View>
      </View>
      <View style={styles.createProjectCard}>
        <View style={isMobile ? { flexDirection: 'column', gap: 12 } : styles.projectInputRow}>
          <View style={isMobile ? { width: '100%', gap: 6 } : styles.projectInputGroup}>
            <Text style={styles.inputLabel}>Project ID</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. PRJ-101"
              value={newProject.projectId}
              onChangeText={(text) => setNewProject({...newProject, projectId: text})}
            />
          </View>
          <View style={isMobile ? { width: '100%', gap: 6 } : styles.projectInputGroup}>
            <Text style={styles.inputLabel}>Project Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Website Redesign"
              value={newProject.projectName}
              onChangeText={(text) => setNewProject({...newProject, projectName: text})}
            />
          </View>
          <View style={isMobile ? { width: '100%', gap: 6 } : styles.projectInputGroup}>
            <Text style={styles.inputLabel}>Customer Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Acme Corp"
              value={newProject.customerName}
              onChangeText={(text) => setNewProject({...newProject, customerName: text})}
            />
          </View>
          <View style={isMobile ? { width: '100%', marginTop: 8 } : { justifyContent: 'flex-end', paddingBottom: 2 }}>
            <TouchableOpacity 
              style={[styles.saveBtn, isMobile && { width: '100%' }, isSubmittingProject && styles.saveBtnDisabled]} 
              onPress={handleCreateProject} 
              disabled={isSubmittingProject}
            >
              {isSubmittingProject ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.sectionHeader, { justifyContent: 'space-between', marginTop: 24 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerIndicator} />
          <Text style={styles.headerTitle}>DEPARTMENT PROJECTS</Text>
        </View>
      </View>

      <View style={styles.tableCard}>
        {isLoadingProjects ? (
          <ActivityIndicator size="large" color={Brand.colors.primary} style={{ margin: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.tableCol, {flex: 1, minWidth: 100}]}>Project ID</Text>
                <Text style={[styles.tableCol, {flex: 2, minWidth: 200}]}>Project Name</Text>
                <Text style={[styles.tableCol, {flex: 2, minWidth: 200}]}>Customer Name</Text>
                <Text style={[styles.tableCol, {flex: 1, minWidth: 100, textAlign: 'center'}]}>Status</Text>
              </View>
              
              {projects.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280' }}>No projects created yet.</Text>
                </View>
              ) : (
                projects.map((proj, i) => (
                  <View key={proj.id || i} style={styles.tableRow}>
                    <TouchableOpacity 
                      style={{flex: 5, flexDirection: 'row', alignItems: 'center'}} 
                      onPress={() => handleProjectClick(proj)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tableCell, {flex: 1, minWidth: 100, fontWeight: '500'}]}>{proj.projectid}</Text>
                      <Text style={[styles.tableCell, {flex: 2, minWidth: 200}]} numberOfLines={1}>{proj.projectname}</Text>
                      <Text style={[styles.tableCell, {flex: 2, minWidth: 200}]} numberOfLines={1}>{proj.customername || '-'}</Text>
                    </TouchableOpacity>
                    <View style={{flex: 1, minWidth: 130, alignItems: 'center'}}>
                      <View style={[
                        styles.pickerContainer, 
                        {backgroundColor: proj.status === 'onGoing' ? '#EBF4FF' : '#DEF7EC'}
                      ]}>
                        <Picker
                          selectedValue={proj.status === 'onGoing' ? 'onGoing' : 'close'}
                          style={[
                            styles.picker, 
                            {color: proj.status === 'onGoing' ? '#0056FF' : '#03543F'}
                          ]}
                          onValueChange={(itemValue) => {
                            if (itemValue !== proj.status) {
                              handleUpdateStatus(proj.id, itemValue);
                            }
                          }}
                        >
                          <Picker.Item label="ONGOING" value="onGoing" style={{fontSize: 12}} />
                          <Picker.Item label="COMPLETED" value="close" style={{fontSize: 12}} />
                        </Picker>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Project Tasks Modal */}
      <Modal
        visible={!!selectedProjectReports}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelectedProjectReports(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedProjectReports?.project.projectname} - Tasks</Text>
              <Text style={styles.modalSubtitle}>Project ID: {selectedProjectReports?.project.projectid} • Customer: {selectedProjectReports?.project.customername || 'N/A'}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedProjectReports(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Brand.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1, padding: 16 }}>
            {isLoadingTasks ? (
              <ActivityIndicator size="large" color={Brand.colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.modalTableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ minWidth: 650 }}>
                    <View style={styles.modalTableHeader}>
                      <Text style={[styles.modalCol, { flex: 0.5 }]}>S.No</Text>
                      <Text style={[styles.modalCol, { flex: 1.5 }]}>Employee</Text>
                      <Text style={[styles.modalCol, { flex: 2.5 }]}>Task Description</Text>
                      <Text style={[styles.modalCol, { flex: 1.5 }]}>Date</Text>
                      <Text style={[styles.modalCol, { flex: 0.8, textAlign: 'center' }]}>Hrs</Text>
                      <Text style={[styles.modalCol, { flex: 1.2, textAlign: 'right' }]}>Status</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {selectedProjectReports?.reports.length === 0 ? (
                        <Text style={{ textAlign: 'center', padding: 20, color: Brand.colors.textSecondary }}>No tasks logged for this project yet.</Text>
                      ) : (
                        selectedProjectReports?.reports.map((report, index) => (
                          <View key={report.id} style={styles.modalTableRow}>
                            <Text style={[styles.modalCell, { flex: 0.5 }]}>{index + 1}</Text>
                            <Text style={[styles.modalCell, { flex: 1.5 }]} numberOfLines={2}>{report.employee?.name || 'Unknown'}</Text>
                            <Text style={[styles.modalCell, { flex: 2.5 }]} numberOfLines={3}>{report.work_description}</Text>
                            <Text style={[styles.modalCell, { flex: 1.5 }]}>{report.report_date}</Text>
                            <Text style={[styles.modalCell, { flex: 0.8, textAlign: 'center' }]}>{report.hours_worked}</Text>
                            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: getStatusColor(report.status) }]}>
                                  {report.status.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIndicator: { width: 4, height: 16, backgroundColor: '#0056FF', marginRight: 8, borderRadius: 2 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Brand.colors.primaryDark, letterSpacing: 0.5 },
  createProjectCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 },
  projectInputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  projectInputGroup: { flex: 1, minWidth: 150 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, height: 40, fontSize: 14 },
  saveBtn: { backgroundColor: '#0056FF', height: 40, paddingHorizontal: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  tableCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  table: { minWidth: '100%' },
  tableRowHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 8 },
  tableCol: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: 'center', paddingHorizontal: 8 },
  tableCell: { fontSize: 14, color: '#1F2937' },
  pickerContainer: { borderRadius: 12, overflow: 'hidden', height: 32, justifyContent: 'center' },
  picker: { height: 32, width: 130, backgroundColor: 'transparent', borderWidth: 0, fontSize: 12, fontWeight: '600' },
  statusChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#F4F6F9' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Brand.colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Brand.colors.text },
  modalSubtitle: { fontSize: 13, color: Brand.colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 8 },
  modalTableCard: {
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: Brand.colors.border,
    flex: 1, overflow: 'hidden',
  },
  modalTableHeader: {
    flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: Brand.colors.border,
    backgroundColor: '#F9FAFB',
  },
  modalCol: { fontSize: 13, fontWeight: '600', color: Brand.colors.textSecondary },
  modalTableRow: {
    flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: 'center',
  },
  modalCell: { fontSize: 13, color: Brand.colors.text, paddingRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});
