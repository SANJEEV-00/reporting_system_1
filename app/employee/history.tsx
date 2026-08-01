import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

type Task = {
  employee_ID: string;
  Department: string;
  Project_name: string;
  Project_Id: string;
  Task: string;
  date: string;
  duration: string;
  Coil_Ref_1?: string | null;
  Coil_Ref_2?: string | null;
  Coil_Ref_3?: string | null;
  Coil_Ref_4?: string | null;
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project')
        .select('*')
        .eq('employee_ID', user.employeeId)
        .order('date', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#3B82F6'; // blue
      case 'approved': return '#10B981'; // green
      case 'rejected': return '#EF4444'; // red
      case 'modification_requested': return '#F59E0B'; // orange
      default: return '#6B7280'; // gray for draft
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskName}>
          {item.Project_Id ? `${item.Project_Id} - ${item.Project_name}` : item.Project_name}
        </Text>
      </View>
      <Text style={styles.taskDesc}>{item.Task}</Text>
      
      {/* Display Coil Reference Numbers if present */}
      {(item.Coil_Ref_1 || item.Coil_Ref_2 || item.Coil_Ref_3 || item.Coil_Ref_4) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <Ionicons name="pricetags-outline" size={14} color="#0056FF" />
          <Text style={{ fontSize: 13, color: '#0056FF', fontWeight: '600' }}>
            Coils: {[item.Coil_Ref_1, item.Coil_Ref_2, item.Coil_Ref_3, item.Coil_Ref_4].filter(Boolean).join(', ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.taskFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.footerText}>{item.date}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.footerText}>{item.duration} duration</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Task History</Text>
        <Text style={styles.subtitle}>Your past submitted reports</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={Brand.colors.primary} style={styles.loader} />
      ) : tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No tasks found</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.colors.card,
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    maxWidth: 800,
    flex: 1, // Needed so FlatList can scroll within it
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Brand.colors.primaryDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Brand.colors.textSecondary,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    paddingBottom: 20,
  },
  taskCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text,
    flex: 1,
    marginRight: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  taskFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
});
