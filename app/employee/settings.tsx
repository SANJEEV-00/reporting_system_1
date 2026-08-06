import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, useWindowDimensions } from 'react-native';

import { useLogout } from '@/components/auth/auth-guard';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

export default function EmployeeSettingsScreen() {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetEmpId, setResetEmpId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isFabrication = user?.department === 'Fabrication';
  const [form, setForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    designation: user?.designation || '',
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          department: form.department,
          designation: form.designation,
        })
        .eq('id', user.id);

      if (error) throw error;
      alert('Profile updated successfully!');
    } catch (error: any) {
      alert('Error updating profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmpId.trim() || !newPassword.trim()) {
      alert('Please fill in all fields (Employee ID and New Password).');
      return;
    }
    
    // First, verify if the current user matches the provided Employee ID
    if (resetEmpId.trim().toUpperCase() !== user?.employeeId?.toUpperCase()) {
      alert('The provided Employee ID does not match your current logged-in account.');
      return;
    }

    setResettingPassword(true);
    try {
      // Use updateUser to set a new password directly since they are logged in
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      alert('Password has been successfully updated!');
      setNewPassword(''); // Clear the password field
    } catch (error: any) {
      alert('Error updating password: ' + error.message);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { maxWidth: isDesktop ? 1000 : 600 }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Settings</Text>

      <View style={isDesktop ? styles.columnsContainer : styles.verticalContainer}>
        {/* Left Column: Profile info */}
        <View style={isDesktop ? styles.leftColumn : undefined}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Department</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={form.department}
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Designation</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={form.designation}
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address (Read Only)</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={user?.email}
                editable={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Column: Password reset and danger zone */}
        <View style={isDesktop ? styles.rightColumn : undefined}>
          {!isFabrication && (
            <View style={[styles.card, { marginTop: 0 }]}>
              <Text style={styles.sectionTitle}>Reset Password</Text>
              <Text style={styles.descriptionText}>
                To change your password, please verify your Employee ID, then enter a new password.
              </Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Employee ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your Employee ID"
                  placeholderTextColor="#9CA3AF"
                  value={resetEmpId}
                  onChangeText={setResetEmpId}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="#9CA3AF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity 
                style={[styles.resetBtn, (resettingPassword || !resetEmpId.trim() || !newPassword.trim()) && styles.saveBtnDisabled]} 
                onPress={handleResetPassword}
                disabled={resettingPassword || !resetEmpId.trim() || !newPassword.trim()}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>{resettingPassword ? 'Updating...' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.dangerZone}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutBtnText}>Sign Out of All Devices</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  verticalContainer: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 1.2,
  },
  rightColumn: {
    flex: 1,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.colors.text,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text,
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Brand.colors.text,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  saveBtn: {
    backgroundColor: Brand.colors.primary,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  resetBtn: {
    backgroundColor: '#4B5563', // gray-600
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  dangerZone: {
    backgroundColor: '#FEF2F2',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 15,
  },
});
