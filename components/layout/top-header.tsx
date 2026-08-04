import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogout } from '@/components/auth/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/brand';

export function TopHeader({ subtitle }: { subtitle?: string }) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = Platform.OS !== 'web' || width < 1024;
  const router = useRouter();
  const handleLogout = useLogout();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  return (
    <View style={[styles.container, isMobile && { height: 60 + insets.top, paddingTop: insets.top, paddingHorizontal: 16 }, { zIndex: 50 }]}>
      <View style={styles.leftContainer}>
        <TouchableOpacity style={styles.supportButton} onPress={() => router.push((user?.role === 'hod' ? '/hod/support' : '/employee/support') as any)}>
          <Ionicons name="headset-outline" size={22} color={Brand.colors.primary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isMobile && { fontSize: 16 }]}>REPORTING SYSTEM</Text>
          {subtitle && !isMobile && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      <View style={{ zIndex: 100 }}>
        <TouchableOpacity style={styles.profileContainer} onPress={() => setDropdownVisible(!dropdownVisible)}>
          {!isMobile && (
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileName}>
                {user?.name || 'John Doe'} {user?.employeeId ? `(${user.employeeId})` : ''}
              </Text>
              <Text style={styles.profileRole}>
                {user?.role === 'hod' ? 'Head of Department' : 'Employee'}
                {user?.department ? ` • ${user.department}` : ''}
              </Text>
            </View>
          )}
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={Brand.colors.primary} />
          </View>
          <Ionicons name={dropdownVisible ? "chevron-up" : "chevron-down"} size={16} color={Brand.colors.textSecondary} />
        </TouchableOpacity>

        {dropdownVisible && (
          <View style={[styles.dropdown, { top: isMobile ? 40 : 50 }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                router.push((user?.role === 'hod' ? '/hod/settings' : '/employee/settings') as any);
              }}
            >
              <Ionicons name="settings-outline" size={18} color={Brand.colors.textSecondary} />
              <Text style={styles.dropdownItemText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                handleLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    backgroundColor: Brand.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    width: '100%',
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  supportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.primaryDark,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Brand.colors.textSecondary,
    marginTop: 2,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileTextContainer: {
    alignItems: 'flex-end',
    marginRight: 4,
  },
  profileRole: {
    fontSize: 12,
    color: Brand.colors.textSecondary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '500',
    color: Brand.colors.text,
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    backgroundColor: Brand.colors.card,
    borderRadius: 8,
    padding: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: Brand.colors.border,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 6,
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.colors.text,
  },
});
