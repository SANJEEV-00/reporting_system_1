import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Platform, Alert, ScrollView, Modal, SafeAreaView, useWindowDimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/brand';
import { fetchReports } from '@/services/reports-api';
import { DailyReport } from '@/types/report';
import { CustomPicker } from '@/components/ui/custom-picker';

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

  // Edit Modal State
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    projectId: '',
    projectName: '',
    customerName: '',
    status: 'onGoing',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Password Modal State
  const [deletingProject, setDeletingProject] = useState<any | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('status', { ascending: false })
        .order('projectid', { ascending: true });
      
      if (error) {
        console.error('Error fetching projects:', error);
      } else if (data) {
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
      const msg = "Please fill all project details.";
      if (Platform.OS === 'web') { alert(msg); } else { Alert.alert("Error", msg); }
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
          projectid: newProject.projectId.trim(),
          projectname: newProject.projectName.trim(),
          customername: newProject.customerName.trim() || null,
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

  // Open Edit Modal
  const handleOpenEdit = (project: any) => {
    setEditingProject(project);
    setEditForm({
      projectId: project.projectid || '',
      projectName: project.projectname || '',
      customerName: project.customername || '',
      status: project.status === 'onGoing' ? 'onGoing' : 'close',
    });
  };

  // Save Edit Changes
  const handleSaveEdit = async () => {
    if (!editingProject) return;
    const trimmedId = editForm.projectId.trim();
    const trimmedName = editForm.projectName.trim();

    if (!trimmedId) {
      const msg = 'Project ID is required.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
      return;
    }
    if (!trimmedName) {
      const msg = 'Project Name is required.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
      return;
    }

    setIsSavingEdit(true);
    try {
      // Check for duplicate Project ID if it was changed
      if (trimmedId !== editingProject.projectid) {
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('projectid', trimmedId);

        if (existing && existing.length > 0) {
          const msg = 'Error: Project ID must be unique. This ID already exists!';
          if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
          setIsSavingEdit(false);
          return;
        }
      }

      const { error } = await supabase
        .from('projects')
        .update({
          projectid: trimmedId,
          projectname: trimmedName,
          customername: editForm.customerName.trim() || null,
          status: editForm.status,
        })
        .eq('id', editingProject.id);

      if (error) throw error;

      const msg = 'Project updated successfully!';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Success', msg);
      setEditingProject(null);
      fetchProjects();
    } catch (err: any) {
      const msg = 'Failed to update project: ' + err.message;
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (project: any) => {
    setDeletingProject(project);
    setDeletePassword('');
  };

  // Confirm Delete with Password Verification
  const handleConfirmDelete = async () => {
    if (!deletingProject || !user?.email) return;
    const inputPassword = deletePassword.trim();
    if (!inputPassword) {
      const msg = 'Please enter your account password to confirm deletion.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
      return;
    }

    setIsDeleting(true);
    try {
      let passToVerify = inputPassword;
      // Handle HOD magic password format (e.g. EL123 -> EL123_SECURE)
      const upperPass = inputPassword.toUpperCase();
      if (user.employeeId && user.employeeId.toUpperCase().endsWith('HOD')) {
        const prefix = user.employeeId.substring(0, 2).toUpperCase();
        if (upperPass === `${prefix}123`) {
          passToVerify = `${prefix}123_SECURE`;
        }
      }

      // Re-authenticate user with Supabase Auth using entered password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passToVerify,
      });

      if (authError) {
        throw new Error('Incorrect password. Authorization failed.');
      }

      // Password verified — delete project
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', deletingProject.id);

      if (deleteError) throw deleteError;

      const msg = `Project "${deletingProject.projectname}" deleted successfully.`;
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Success', msg);
      setDeletingProject(null);
      setDeletePassword('');
      fetchProjects();
    } catch (err: any) {
      const msg = err.message || 'Failed to delete project.';
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
    } finally {
      setIsDeleting(false);
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
                <Text style={[styles.tableCol, {flex: 1, minWidth: 120, textAlign: 'center'}]}>Status</Text>
                <Text style={[styles.tableCol, {flex: 1, minWidth: 100, textAlign: 'center'}]}>Actions</Text>
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
                    
                    <View style={{flex: 1, minWidth: 120, alignItems: 'center'}}>
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

                    <View style={{flex: 1, minWidth: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10}}>
                      <TouchableOpacity 
                        style={styles.actionIconButton} 
                        onPress={() => handleOpenEdit(proj)}
                      >
                        <Ionicons name="pencil-outline" size={18} color={Brand.colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionIconButton, { backgroundColor: '#FEF2F2' }]} 
                        onPress={() => handleOpenDelete(proj)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* EDIT PROJECT MODAL */}
      <Modal visible={!!editingProject} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>Edit Project</Text>
                <Text style={styles.editModalSubtitle}>Project ID: {editingProject?.projectid}</Text>
              </View>
              <Pressable onPress={() => setEditingProject(null)}>
                <Ionicons name="close" size={24} color={Brand.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Project ID</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.projectId}
                  onChangeText={(text) => setEditForm({ ...editForm, projectId: text })}
                  placeholder="Enter project ID"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Project Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.projectName}
                  onChangeText={(text) => setEditForm({ ...editForm, projectName: text })}
                  placeholder="Enter project name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Customer Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.customerName}
                  onChangeText={(text) => setEditForm({ ...editForm, customerName: text })}
                  placeholder="Enter customer name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.pickerBorder}>
                  <CustomPicker
                    selectedValue={editForm.status}
                    onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                    items={[
                      { label: 'ONGOING', value: 'onGoing' },
                      { label: 'COMPLETED', value: 'close' }
                    ]}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingProject(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isSavingEdit && styles.saveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE PASSWORD CONFIRMATION MODAL */}
      <Modal visible={!!deletingProject} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.dangerIconContainer}>
                <Ionicons name="warning-outline" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.deleteModalTitle}>Confirm Project Deletion</Text>
                <Text style={styles.deleteModalSubtitle}>Action requires password confirmation</Text>
              </View>
              <Pressable onPress={() => setDeletingProject(null)}>
                <Ionicons name="close" size={24} color={Brand.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.deleteModalBody}>
              <Text style={styles.deleteWarningText}>
                Are you sure you want to delete project <Text style={{ fontWeight: '700', color: Brand.colors.text }}>"{deletingProject?.projectname}"</Text> (<Text style={{ fontWeight: '600' }}>{deletingProject?.projectid}</Text>)?
              </Text>
              <Text style={styles.deleteSubWarning}>This action cannot be undone. Please enter your account password to confirm.</Text>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Account Password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your account password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeletingProject(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, (isDeleting || !deletePassword.trim()) && styles.saveBtnDisabled]}
                  onPress={handleConfirmDelete}
                  disabled={isDeleting || !deletePassword.trim()}
                >
                  {isDeleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteConfirmBtnText}>Delete Project</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
  actionIconButton: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  
  // Modals Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  editModalContent: { backgroundColor: '#FFF', width: '100%', maxWidth: 500, borderRadius: 12, padding: 24 },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editModalTitle: { fontSize: 18, fontWeight: '700', color: Brand.colors.text },
  editModalSubtitle: { fontSize: 13, color: Brand.colors.textSecondary, marginTop: 2 },
  modalForm: { gap: 16 },
  formGroup: { marginBottom: 12 },
  pickerBorder: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, height: 42, justifyContent: 'center', paddingHorizontal: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelBtn: { paddingHorizontal: 16, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  cancelBtnText: { color: '#4B5563', fontWeight: '600', fontSize: 14 },
  
  deleteModalContent: { backgroundColor: '#FFF', width: '100%', maxWidth: 480, borderRadius: 12, padding: 24 },
  deleteModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dangerIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  deleteModalTitle: { fontSize: 18, fontWeight: '700', color: Brand.colors.text },
  deleteModalSubtitle: { fontSize: 12, color: Brand.colors.textSecondary, marginTop: 1 },
  deleteModalBody: { gap: 16 },
  deleteWarningText: { fontSize: 14, color: Brand.colors.text, lineHeight: 20 },
  deleteSubWarning: { fontSize: 13, color: '#DC2626', marginBottom: 8 },
  deleteConfirmBtn: { backgroundColor: '#DC2626', height: 40, paddingHorizontal: 20, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  deleteConfirmBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

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
