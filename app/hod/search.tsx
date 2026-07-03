import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/auth';

export default function EmployeeSearch() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1200 ? 3 : (width >= 768 ? 2 : 1);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.department) {
      fetchEmployees('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchEmployees = async (searchQuery: string) => {
    setLoading(true);
    try {
      let supabaseQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .eq('status', 'approved')
        .eq('department', user?.department);
        
      if (searchQuery.trim()) {
        supabaseQuery = supabaseQuery.or(`employee_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await supabaseQuery;
        
      if (error) throw error;
      
      setResults((data || []).map(d => ({
        id: d.id,
        employeeId: d.employee_id,
        name: d.name,
        email: d.email,
        role: d.role,
        department: d.department,
        designation: d.designation,
      })));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchEmployees(query);
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employee Search</Text>
      
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Search by Name or Employee ID..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
          <Ionicons name="search" size={20} color="#FFF" />
          <Text style={styles.searchBtnText}>{loading ? 'Searching...' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={numColumns}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && query ? <Text style={styles.emptyText}>No employees found.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.empId}>{item.employeeId}</Text>
              </View>
            </View>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Department</Text>
                <Text style={styles.detailValue}>{item.department}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Designation</Text>
                <Text style={styles.detailValue}>{item.designation}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.viewBtn} 
              onPress={() => router.push({ pathname: '/hod', params: { searchEmployeeId: item.employeeId } })}
            >
              <Text style={styles.viewBtnText}>View Monthly Report</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.colors.text,
    marginBottom: 24,
  },
  searchBox: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Brand.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: Brand.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  searchBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  list: {
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
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
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
  viewBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewBtnText: {
    color: Brand.colors.primaryDark,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: Brand.colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
});
