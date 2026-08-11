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

interface FabricationRod {
  id: number;
  rod_type: string;
  status: string;
  created_at: string;
}

export default function ProjectRodsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Master lists
  const [rods, setRods] = useState<FabricationRod[]>([]);
  const [loadingRods, setLoadingRods] = useState(false);

  // Selection & forms
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRod, setSelectedRod] = useState<FabricationRod | null>(null);

  // Form states
  const [rodTypeForm, setRodTypeForm] = useState('');
  const [statusForm, setStatusForm] = useState('Active');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRods = async () => {
    setLoadingRods(true);
    try {
      const { data, error } = await supabase
        .from('fabrication_rods')
        .select('*')
        .order('rod_type', { ascending: true });

      if (error) throw error;
      setRods(data || []);
    } catch (err: any) {
      console.error('Error fetching rods:', err);
      showAlert('Error', 'Failed to load rod types: ' + err.message);
    } finally {
      setLoadingRods(false);
    }
  };

  const handleAddSubmit = async () => {
    const trimmedRodType = rodTypeForm.trim();
    if (!trimmedRodType) {
      showAlert('Input Required', 'Please enter a rod type.');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.from('fabrication_rods').insert([
        {
          rod_type: trimmedRodType,
          status: statusForm,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This rod type already exists.');
        }
        throw error;
      }

      showAlert('Success', 'Rod type added successfully.');
      setIsAddModalOpen(false);
      setRodTypeForm('');
      setStatusForm('Active');
      fetchRods();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    const trimmedRodType = rodTypeForm.trim();
    if (!trimmedRodType) {
      showAlert('Input Required', 'Please enter a rod type.');
      return;
    }

    if (!selectedRod) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('fabrication_rods')
        .update({
          rod_type: trimmedRodType,
          status: statusForm,
        })
        .eq('id', selectedRod.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This rod type already exists.');
        }
        throw error;
      }

      showAlert('Success', 'Rod type updated successfully.');
      setIsEditModalOpen(false);
      setSelectedRod(null);
      setRodTypeForm('');
      setStatusForm('Active');
      fetchRods();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (rod: FabricationRod) => {
    showAlert(
      'Confirm Delete',
      `Are you sure you want to delete the rod type "${rod.rod_type}"?\nThis won't affect past logged tasks but will remove it from the selector.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('fabrication_rods')
                .delete()
                .eq('id', rod.id);
              if (error) throw error;
              showAlert('Success', 'Rod type deleted successfully.');
              fetchRods();
            } catch (err: any) {
              showAlert('Error', 'Failed to delete rod type: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenEdit = (rod: FabricationRod) => {
    setSelectedRod(rod);
    setRodTypeForm(rod.rod_type);
    setStatusForm(rod.status);
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setRodTypeForm('');
    setStatusForm('Active');
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

  const filteredRods = rods.filter((r) =>
    r.rod_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }]}>
        <View style={{ flex: isMobile ? undefined : 1 }}>
          <Text style={styles.title}>Rod Types</Text>
          <Text style={styles.subtitle}>Configure types of rods for fabrication department</Text>
        </View>
        <TouchableOpacity style={[styles.addButton, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={handleOpenAdd}>
          <Ionicons name="add-circle-outline" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Rod Type</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rod types..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loadingRods ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filteredRods.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Ionicons name="git-commit-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No rod types configured</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try modifying your search term' : 'Add rod types to show them in the employee task log dropdown'}
              </Text>
            </View>
          ) : (
            filteredRods.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Ionicons name="git-commit-outline" size={20} color={Brand.colors.primary} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rodType}>{item.rod_type}</Text>
                    <View style={styles.badgeContainer}>
                      <View style={[styles.badge, item.status === 'Active' ? styles.badgeActive : styles.badgeInactive]}>
                        <Text style={[styles.badgeText, item.status === 'Active' ? styles.badgeActiveText : styles.badgeInactiveText]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
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

      {/* ADD ROD MODAL */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Rod Type</Text>
              <Pressable onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Rod Type</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. E6013"
                  value={rodTypeForm}
                  onChangeText={setRodTypeForm}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerBorder}>
                  <CustomPicker
                    selectedValue={statusForm}
                    onValueChange={setStatusForm}
                    items={[
                      { label: 'Active', value: 'Active' },
                      { label: 'Inactive', value: 'Inactive' }
                    ]}
                  />
                </View>
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

      {/* EDIT ROD MODAL */}
      <Modal visible={isEditModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Rod Type</Text>
              <Pressable onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={Brand.colors.text} />
              </Pressable>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Rod Type</Text>
                <TextInput
                  style={styles.modalInput}
                  value={rodTypeForm}
                  onChangeText={setRodTypeForm}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerBorder}>
                  <CustomPicker
                    selectedValue={statusForm}
                    onValueChange={setStatusForm}
                    items={[
                      { label: 'Active', value: 'Active' },
                      { label: 'Inactive', value: 'Inactive' }
                    ]}
                  />
                </View>
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
  rodType: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 6,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: '#DEF7EC',
  },
  badgeInactive: {
    backgroundColor: '#FDE8E8',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeActiveText: {
    color: '#03543F',
  },
  badgeInactiveText: {
    color: '#9B1C1C',
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
  pickerBorder: {
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    height: 48,
    justifyContent: 'center',
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
