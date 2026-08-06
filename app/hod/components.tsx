import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { CustomPicker } from '@/components/ui/custom-picker';

interface ProjectComponent {
  id: number;
  project_id: string;
  component_name: string;
  drawing_no: string;
  created_at: string;
}

interface Project {
  projectid: string;
  projectname: string;
}

export default function ProjectComponentsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Master lists
  const [projects, setProjects] = useState<Project[]>([]);
  const [components, setComponents] = useState<ProjectComponent[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Selection & forms
  const [selectedProject, setSelectedProject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ProjectComponent | null>(null);

  // Form states
  const [componentNameForm, setComponentNameForm] = useState('');
  const [drawingNoForm, setDrawingNoForm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedProject) {
      fetchComponents();
    } else {
      setComponents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('projectid, projectname')
        .eq('status', 'onGoing')
        .order('projectname', { ascending: true });

      if (error) throw error;
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProject(data[0].projectid);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      showAlert('Error', 'Failed to load projects: ' + err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchComponents = async () => {
    if (!selectedProject) return;
    setLoadingComponents(true);
    try {
      const { data, error } = await supabase
        .from('project_components')
        .select('*')
        .eq('project_id', selectedProject)
        .order('component_name', { ascending: true });

      if (error) throw error;
      setComponents(data || []);
    } catch (err: any) {
      console.error('Error fetching components:', err);
      showAlert('Error', 'Failed to load project components: ' + err.message);
    } finally {
      setLoadingComponents(false);
    }
  };

  const handleAddSubmit = async () => {
    const trimmedName = componentNameForm.trim();
    const trimmedDwg = drawingNoForm.trim();
    if (!trimmedName || !trimmedDwg) {
      showAlert('Input Required', 'Please enter both component name and drawing number.');
      return;
    }

    if (!selectedProject) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.from('project_components').insert([
        {
          project_id: selectedProject,
          component_name: trimmedName,
          drawing_no: trimmedDwg,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This component name already exists for this project.');
        }
        throw error;
      }

      showAlert('Success', 'Component added successfully.');
      setIsAddModalOpen(false);
      setComponentNameForm('');
      setDrawingNoForm('');
      fetchComponents();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    const trimmedName = componentNameForm.trim();
    const trimmedDwg = drawingNoForm.trim();
    if (!trimmedName || !trimmedDwg) {
      showAlert('Input Required', 'Please enter both component name and drawing number.');
      return;
    }

    if (!selectedComponent) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('project_components')
        .update({
          component_name: trimmedName,
          drawing_no: trimmedDwg,
        })
        .eq('id', selectedComponent.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This component name already exists for this project.');
        }
        throw error;
      }

      showAlert('Success', 'Component updated successfully.');
      setIsEditModalOpen(false);
      setSelectedComponent(null);
      setComponentNameForm('');
      setDrawingNoForm('');
      fetchComponents();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (comp: ProjectComponent) => {
    showAlert(
      'Confirm Delete',
      `Are you sure you want to delete the component "${comp.component_name}"?\nThis won't affect past logged tasks but will remove it from the selector.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('project_components')
                .delete()
                .eq('id', comp.id);
              if (error) throw error;
              showAlert('Success', 'Component deleted successfully.');
              fetchComponents();
            } catch (err: any) {
              showAlert('Error', 'Failed to delete component: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenEdit = (comp: ProjectComponent) => {
    setSelectedComponent(comp);
    setComponentNameForm(comp.component_name);
    setDrawingNoForm(comp.drawing_no);
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setComponentNameForm('');
    setDrawingNoForm('');
    setIsAddModalOpen(true);
  };

  const showAlert = (
    title: string,
    message: string,
    buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
  ) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed) {
          const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
          if (actionBtn && actionBtn.onPress) actionBtn.onPress();
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

  const filteredComponents = components.filter((c) =>
    c.component_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.drawing_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }]}>
        <View style={{ flex: isMobile ? undefined : 1 }}>
          <Text style={styles.title}>Project Components</Text>
          <Text style={styles.subtitle}>Configure components & drawing numbers for fabrication projects</Text>
        </View>
        <TouchableOpacity style={[styles.addButton, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={handleOpenAdd}>
          <Ionicons name="add-circle-outline" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Component</Text>
        </TouchableOpacity>
      </View>

      {/* Project Selector */}
      <View style={styles.projectSelectCard}>
        <Text style={styles.pickerLabel}>Active Project</Text>
        {loadingProjects ? (
          <ActivityIndicator size="small" color={Brand.colors.primary} />
        ) : (
          <View style={styles.pickerWrapper}>
            <CustomPicker
              selectedValue={selectedProject}
              onValueChange={setSelectedProject}
              placeholder="Select a project..."
              items={projects.map((p) => ({ label: p.projectname, value: p.projectid }))}
            />
          </View>
        )}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search components or drawing numbers..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loadingComponents ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filteredComponents.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No components configured</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try modifying your search term' : 'Add components to show them in the employee task log dropdown'}
              </Text>
            </View>
          ) : (
            filteredComponents.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Ionicons name="construct-outline" size={20} color={Brand.colors.primary} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compName}>{item.component_name}</Text>
                    <Text style={styles.drawingNo}>Drawing No: {item.drawing_no}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenEdit(item)}>
                    <Ionicons name="pencil-outline" size={18} color={Brand.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { marginLeft: 8 }]} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ADD COMPONENT MODAL */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Component</Text>
              <Pressable onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Component Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Web Plate"
                  value={componentNameForm}
                  onChangeText={setComponentNameForm}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Drawing Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. DWG-102-A"
                  value={drawingNoForm}
                  onChangeText={setDrawingNoForm}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleAddSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT COMPONENT MODAL */}
      <Modal visible={isEditModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Component</Text>
              <Pressable onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Component Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={componentNameForm}
                  onChangeText={setComponentNameForm}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Drawing Number</Text>
                <TextInput
                  style={styles.modalInput}
                  value={drawingNoForm}
                  onChangeText={setDrawingNoForm}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleEditSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save</Text>}
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
    backgroundColor: '#F4F6F9',
    width: '100%',
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
    justifyContent: 'space-between',
    width: '100%',
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
  addButton: {
    backgroundColor: Brand.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  projectSelectCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    padding: 16,
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.colors.textSecondary,
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    height: 48,
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    marginBottom: 20,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.colors.text,
    height: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  centerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  list: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  compName: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  drawingNo: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
    marginTop: 4,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text,
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Brand.colors.text,
    backgroundColor: '#F9FAFB',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    color: Brand.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: Brand.colors.primary,
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
