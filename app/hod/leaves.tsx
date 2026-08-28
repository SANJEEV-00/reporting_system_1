import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
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

interface EmployeeProfile {
  id: string;
  employee_id: string;
  name: string;
  designation: string;
  on_leave: boolean;
  leave_date: string | null;
}

export default function LeaveListScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchEmployees = async () => {
    if (!user?.department) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, employee_id, name, designation, on_leave, leave_date')
        .eq('role', 'employee')
        .eq('department', user.department)
        .eq('status', 'approved')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      showAlert('Error', 'Failed to load employee list: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleToggleLeave = async (emp: EmployeeProfile) => {
    if (togglingId) return; // Prevent double taps

    const currentlyOnLeave = !!(emp.on_leave && emp.leave_date === todayStr);
    const newOnLeave = !currentlyOnLeave;

    setTogglingId(emp.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          on_leave: newOnLeave,
          leave_date: newOnLeave ? todayStr : null,
        })
        .eq('id', emp.id);

      if (error) throw error;

      // Update local state immediately
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === emp.id
            ? { ...e, on_leave: newOnLeave, leave_date: newOnLeave ? todayStr : null }
            : e
        )
      );
    } catch (err: any) {
      console.error('Error toggling leave:', err);
      showAlert('Error', 'Failed to update leave status: ' + err.message);
    } finally {
      setTogglingId(null);
    }
  };

  // Filter list by search query
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Leave counts
  const totalCount = employees.length;
  const onLeaveCount = employees.filter((e) => e.on_leave && e.leave_date === todayStr).length;
  const presentCount = totalCount - onLeaveCount;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={[styles.header, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily Leave List</Text>
          <Text style={styles.subtitle}>Mark employees on leave. Present/leave counts automatically reset at midnight.</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={[styles.statsRow, { flexDirection: isMobile ? 'column' : 'row', gap: 12 }]}>
        <View style={[styles.statCard, styles.statCardPresent]}>
          <View style={styles.statIconContainer}>
            <Ionicons name="people" size={24} color="#059669" />
          </View>
          <View>
            <Text style={styles.statLabel}>Present Today</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>{presentCount}</Text>
          </View>
        </View>

        <View style={[styles.statCard, styles.statCardLeave]}>
          <View style={styles.statIconContainer}>
            <Ionicons name="calendar-outline" size={24} color="#DC2626" />
          </View>
          <View>
            <Text style={styles.statLabel}>On Leave Today</Text>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>{onLeaveCount}</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="people-circle-outline" size={24} color={Brand.colors.primary} />
          </View>
          <View>
            <Text style={styles.statLabel}>Total Staff</Text>
            <Text style={[styles.statValue, { color: Brand.colors.text }]}>{totalCount}</Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search employees by name, ID, or designation..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filteredEmployees.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No employees found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try modifying your search query.' : 'No approved employees in this department.'}
              </Text>
            </View>
          ) : (
            filteredEmployees.map((item) => {
              const isOnLeave = !!(item.on_leave && item.leave_date === todayStr);
              return (
                <Pressable
                  key={item.id}
                  style={[styles.card, isOnLeave && styles.cardOnLeave]}
                  onPress={() => handleToggleLeave(item)}
                >
                  <View style={styles.cardLeft}>
                    <View style={[styles.avatar, isOnLeave && styles.avatarOnLeave]}>
                      <Text style={[styles.avatarText, isOnLeave && styles.avatarTextOnLeave]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empName, isOnLeave && styles.textOnLeave]}>{item.name}</Text>
                      <View style={styles.subRow}>
                        <Text style={styles.empId}>{item.employee_id}</Text>
                        <Text style={styles.dot}>•</Text>
                        <Text style={styles.designation}>{item.designation || 'Employee'}</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      isOnLeave ? styles.checkboxChecked : styles.checkboxUnchecked,
                      togglingId === item.id && styles.checkboxDisabled,
                    ]}
                    onPress={() => handleToggleLeave(item)}
                    disabled={togglingId === item.id}
                  >
                    {togglingId === item.id ? (
                      <ActivityIndicator size="small" color={isOnLeave ? '#FFF' : Brand.colors.primary} />
                    ) : isOnLeave ? (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    ) : null}
                  </TouchableOpacity>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
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
  statsRow: {
    marginBottom: 20,
    width: '100%',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    padding: 16,
    gap: 12,
  },
  statCardPresent: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  statCardLeave: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Brand.colors.textSecondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
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
  cardOnLeave: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarOnLeave: {
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.primary,
  },
  avatarTextOnLeave: {
    color: '#9CA3AF',
  },
  empName: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.text,
  },
  textOnLeave: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  empId: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
    fontWeight: '500',
  },
  dot: {
    fontSize: 13,
    color: '#9CA3AF',
    marginHorizontal: 6,
  },
  designation: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnchecked: {
    borderColor: '#9CA3AF',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
});
