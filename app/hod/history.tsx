import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export default function ClientHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 2 : 1;

  useEffect(() => {
    if (user?.department) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      // Fetch all projects globally
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading client history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Client History</Text>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.colors.primary} />
        </View>
      ) : (
        <FlatList
          key={numColumns}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.rowWrapper : undefined}
          data={history}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No client records found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.iconContainer}>
                <Ionicons name="briefcase" size={24} color={Brand.colors.primary} />
              </View>
              <View style={styles.content}>
                <View style={styles.contentHeader}>
                  <Text style={styles.projectName} numberOfLines={1}>{item.projectname}</Text>
                  <Text style={styles.timeText}>{item.datetime ? new Date(item.datetime).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={styles.detailsText}>
                  Project ID: <Text style={{fontWeight: '700'}}>{item.projectid}</Text>
                </Text>
                <Text style={styles.detailsText}>
                  Client/Customer: {item.customername}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: Brand.colors.text, marginBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: {
    paddingBottom: 24,
    gap: 16,
  },
  rowWrapper: {
    flexDirection: 'row',
    gap: 16,
  },
  itemCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text,
    flex: 1,
    paddingRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: Brand.colors.textSecondary,
  },
  detailsText: {
    fontSize: 14,
    color: Brand.colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: Brand.colors.textSecondary,
    padding: 40,
  },
});
