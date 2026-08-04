import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/auth';

export default function EmployeeManagementScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1200 ? 3 : (width >= 768 ? 2 : 1);
  const isMobile = width < 768;
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Selected employee for Edit/Password Reset/Delete
  const [selectedEmp, setSelectedEmp] = useState<User | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    designation: '',
    password: '',
    employeeId: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    designation: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Cross-platform Alert helper to handle React Native Web fallback
  const showAlert = (
    title: string,
    message: string,
    buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
  ) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        // Confirmation dialog
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed) {
          const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
          if (actionBtn && actionBtn.onPress) actionBtn.onPress();
        } else {
          const cancelBtn = buttons.find((b) => b.style === 'cancel');
          if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
        if (buttons && buttons[0] && buttons[0].onPress) {
          buttons[0].onPress();
        }
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const loadEmployees = useCallback(async () => {
    if (!user?.department) return;
    
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('department', user.department)
        .eq('status', activeTab)
        .eq('role', 'employee')
        .order('name');

      if (fetchError) throw fetchError;

      const formattedEmployees = (data || []).map((d) => ({
        id: d.id,
        employeeId: d.employee_id,
        name: d.name,
        email: d.email,
        role: d.role,
        department: d.department,
        designation: d.designation,
        status: d.status,
      }));

      setEmployees(formattedEmployees);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.department, activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEmployees();
    }, [loadEmployees, activeTab])
  );

  const handleUpdateStatus = async (employeeId: string, status: 'approved' | 'rejected') => {
    setProcessingId(employeeId);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', employeeId);

      if (updateError) throw updateError;
      
      // Remove from the local list immediately
      setEmployees((prev) => prev.filter((emp) => emp.id !== employeeId));
    } catch (err: any) {
      showAlert('Error', err.message || `Failed to ${status} employee`);
    } finally {
      setProcessingId(null);
    }
  };

  const getDeptPrefix = (dept: string): string => {
    const map: Record<string, string> = {
      'Machine shop': 'MS',
      'Assembly': 'AS',
      'Production': 'PR',
      'Electrical': 'EL',
      'Fabrication': 'FA',
      'Design': 'DE',
      'HR': 'HR',
      'maintenance': 'MA',
    };
    return map[dept] || 'EMP';
  };

  const handleOpenAddModal = async () => {
    if (!user) return;
    
    setAddForm({
      name: '',
      email: '',
      designation: '',
      password: '',
      employeeId: '',
    });
    
    setIsAddModalOpen(true);
    
    // Auto-generate employee ID
    try {
      const prefix = getDeptPrefix(user.department);
      const { data, error: idError } = await supabase
        .from('profiles')
        .select('employee_id')
        .like('employee_id', `${prefix}%`)
        .not('employee_id', 'ilike', '%HOD')
        .order('employee_id', { ascending: false })
        .limit(1);

      if (idError) throw idError;

      let nextNum = 1;
      if (data && data.length > 0) {
        const lastId = data[0].employee_id;
        const numPart = lastId.substring(prefix.length);
        const parsedNum = parseInt(numPart, 10);
        if (!isNaN(parsedNum)) {
          nextNum = parsedNum + 1;
        }
      }
      const generatedId = `${prefix}${nextNum.toString().padStart(3, '0')}`;
      setAddForm((prev) => ({ ...prev, employeeId: generatedId }));
    } catch (err) {
      console.error('Error generating employee ID:', err);
    }
  };

  const handleAddEmployee = async () => {
    const { name, email, designation, password, employeeId } = addForm;
    if (!name.trim() || !email.trim() || !designation.trim() || !password.trim() || !employeeId.trim()) {
      showAlert('Validation Error', 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      showAlert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      const { data, error: createError } = await supabase.rpc('create_user_by_hod', {
        new_designation: designation.trim(),
        new_email: email.trim().toLowerCase(),
        new_employee_id: employeeId.trim().toUpperCase(),
        new_name: name.trim(),
        new_password: password,
      });

      if (createError) throw createError;

      showAlert('Success', 'Employee created successfully!');
      setIsAddModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      showAlert('Error', 'Failed to create employee: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (emp: User) => {
    setSelectedEmp(emp);
    setEditForm({
      name: emp.name,
      designation: emp.designation || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditEmployee = async () => {
    if (!selectedEmp) return;
    const { name, designation } = editForm;
    if (!name.trim() || !designation.trim()) {
      showAlert('Validation Error', 'Name and Designation cannot be empty.');
      return;
    }

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          designation: designation.trim(),
        })
        .eq('id', selectedEmp.id);

      if (updateError) throw updateError;

      showAlert('Success', 'Employee updated successfully!');
      setIsEditModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      showAlert('Error', 'Failed to update employee: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPasswordModal = (emp: User) => {
    setSelectedEmp(emp);
    setPasswordForm({
      newPassword: '',
      confirmPassword: '',
    });
    setIsPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedEmp) return;
    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword || !confirmPassword) {
      showAlert('Validation Error', 'Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Validation Error', 'Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('change_user_password', {
        new_password: newPassword,
        target_user_id: selectedEmp.id,
      });

      if (rpcError) throw rpcError;

      showAlert('Success', 'Password reset successfully!');
      setIsPasswordModalOpen(false);
    } catch (err: any) {
      showAlert('Error', 'Failed to reset password: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEmployee = async (emp: User) => {
    showAlert(
      'Confirm Delete',
      `Are you sure you want to delete ${emp.name} (${emp.employeeId})? This will delete all their reports and account history permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error: rpcError } = await supabase.rpc('delete_user_by_hod', {
                target_user_id: emp.id,
              });

              if (rpcError) throw rpcError;

              showAlert('Success', 'Employee deleted successfully.');
              loadEmployees();
            } catch (err: any) {
              showAlert('Error', 'Failed to delete employee: ' + err.message);
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }]}>
        <View style={{ flex: isMobile ? undefined : 1 }}>
          <Text style={styles.title}>Employee Management</Text>
          <Text style={styles.subtitle}>Review and manage employees for {user?.department}</Text>
        </View>
        {activeTab === 'approved' && (
          <TouchableOpacity style={[styles.addButton, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={handleOpenAddModal}>
            <Ionicons name="person-add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>Add Employee</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => {
            setActiveTab('pending');
            setSearchQuery('');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending Approvals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'approved' && styles.activeTab]}
          onPress={() => {
            setActiveTab('approved');
            setSearchQuery('');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'approved' && styles.activeTabText]}>
            Approved
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'approved' && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search approved employees by name, ID, or designation..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Brand.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadEmployees}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
          data={filteredEmployees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadEmployees();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name={activeTab === 'pending' ? 'checkmark-circle-outline' : 'people-outline'}
                size={48}
                color={activeTab === 'pending' ? Brand.colors.success : Brand.colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'pending' ? 'All caught up' : 'No employees'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'pending'
                  ? 'No pending employee registrations.'
                  : searchQuery
                  ? 'No employees match your search.'
                  : 'No approved employees found.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.empId}>{item.employeeId}</Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{item.email}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Designation</Text>
                  <Text style={styles.detailValue}>{item.designation || 'Employee'}</Text>
                </View>
              </View>

              {activeTab === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.rejectBtn,
                      processingId === item.id && styles.disabledBtn,
                    ]}
                    disabled={processingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, 'rejected')}
                  >
                    <Ionicons name="close" size={16} color={Brand.colors.error} style={{ marginRight: 4 }} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.approveBtn,
                      processingId === item.id && styles.disabledBtn,
                    ]}
                    disabled={processingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, 'approved')}
                  >
                    {processingId === item.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={styles.approveText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.crudActions}>
                  <TouchableOpacity
                    style={[styles.crudBtn, styles.editBtn]}
                    onPress={() => handleOpenEditModal(item)}
                  >
                    <Ionicons name="pencil-outline" size={15} color={Brand.colors.primary} />
                    <Text style={styles.editBtnText}>Edit Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.crudBtn, styles.passBtn]}
                    onPress={() => handleOpenPasswordModal(item)}
                  >
                    <Ionicons name="key-outline" size={15} color="#D97706" />
                    <Text style={styles.passBtnText}>Change Password</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.crudBtn, styles.deleteBtn]}
                    onPress={() => handleDeleteEmployee(item)}
                  >
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* ADD EMPLOYEE MODAL */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Employee</Text>
              <Pressable onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Employee ID</Text>
                  <TextInput
                    style={[styles.modalInput, styles.inputDisabled]}
                    value={addForm.employeeId}
                    editable={false}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.label}>Designation</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Machinist"
                    value={addForm.designation}
                    onChangeText={(text) => setAddForm({ ...addForm, designation: text })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter full name"
                  value={addForm.name}
                  onChangeText={(text) => setAddForm({ ...addForm, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="employee@barani.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={addForm.email}
                  onChangeText={(text) => setAddForm({ ...addForm, email: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Min. 6 characters"
                  secureTextEntry
                  value={addForm.password}
                  onChangeText={(text) => setAddForm({ ...addForm, password: text })}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleAddEmployee}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT EMPLOYEE MODAL */}
      <Modal visible={isEditModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Details</Text>
              <Pressable onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Employee ID</Text>
                <TextInput
                  style={[styles.modalInput, styles.inputDisabled]}
                  value={selectedEmp?.employeeId}
                  editable={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Designation</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editForm.designation}
                  onChangeText={(text) => setEditForm({ ...editForm, designation: text })}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleEditEmployee}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={isPasswordModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => setIsPasswordModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <Text style={styles.modalDescription}>
                Setting a new password for **{selectedEmp?.name}** ({selectedEmp?.employeeId}).
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Min. 6 characters"
                  secureTextEntry
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Re-enter password"
                  secureTextEntry
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, confirmPassword: text })}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPasswordModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: '#D97706' }, actionLoading && styles.btnDisabled]}
                  onPress={handleResetPassword}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Update</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: Brand.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: Brand.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: Brand.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.textSecondary,
  },
  activeTabText: {
    color: '#FFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Brand.colors.text,
    height: '100%',
  },
  list: {
    paddingBottom: 24,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 10,
    marginTop: 60,
  },
  errorText: {
    color: Brand.colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Brand.colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  rowWrapper: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  empId: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginBottom: 16,
    gap: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Brand.colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  rejectText: {
    color: Brand.colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  approveBtn: {
    backgroundColor: Brand.colors.success,
  },
  approveText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  crudActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 14,
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  crudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
  },
  editBtn: {
    borderColor: '#D1E9FF',
    backgroundColor: '#F0F9FF',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.primary,
  },
  passBtn: {
    borderColor: '#FEF3C7',
    backgroundColor: '#FFFBEB',
  },
  passBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  deleteBtn: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  modalDescription: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    color: Brand.colors.text,
    backgroundColor: '#FFF',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
    borderColor: '#E5E7EB',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Brand.colors.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  submitBtn: {
    backgroundColor: Brand.colors.primary,
    paddingHorizontal: 16,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
