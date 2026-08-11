import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Image, StyleSheet, Text, View, ScrollView } from 'react-native';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { useSidebar } from '@/contexts/sidebar-context';

const EMPLOYEE_NAV_ITEMS = [
  { name: 'Home', path: '/employee', icon: 'home' as const },
  { name: 'History', path: '/employee/history', icon: 'time-outline' as const },
  { name: 'Settings', path: '/employee/settings', icon: 'settings-outline' as const },
  { name: 'Support', path: '/employee/support', icon: 'headset-outline' as const },
];

const HOD_NAV_ITEMS = [
  { name: 'Dashboard', path: '/hod', icon: 'home' as const },
  { name: 'Employee Management', path: '/hod/employee-management', icon: 'people-circle-outline' as const },
  { name: 'Employee Search', path: '/hod/search', icon: 'people-outline' as const },
  { name: 'Reports', path: '/hod/reports', icon: 'bar-chart-outline' as const },
  { name: 'Monthly Reports', path: '/hod/monthly', icon: 'calendar-outline' as const },
  { name: 'Client History', path: '/hod/history', icon: 'time-outline' as const },
  { name: 'Projects', path: '/hod/projects', icon: 'folder-open-outline' as const },
  { name: 'Predefined Tasks', path: '/hod/tasks', icon: 'list-outline' as const },
  { name: 'Settings', path: '/hod/settings', icon: 'settings-outline' as const },
  { name: 'Support', path: '/hod/support', icon: 'headset-outline' as const },
];

export function Sidebar({ isMobile }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  
  const navItems = React.useMemo(() => {
    if (user?.role === 'hod') {
      const items = [...HOD_NAV_ITEMS];
      if (user?.department === 'Fabrication') {
        const idx = items.findIndex(item => item.name === 'Settings');
        if (idx !== -1) {
          items.splice(idx, 0, 
            { name: 'Project Components', path: '/hod/components', icon: 'cube-outline' as any },
            { name: 'Coil References', path: '/hod/coils', icon: 'git-commit-outline' as any },
            { name: 'Rod Types', path: '/hod/rods', icon: 'git-commit-outline' as any }
          );
        } else {
          items.push(
            { name: 'Project Components', path: '/hod/components', icon: 'cube-outline' as any },
            { name: 'Coil References', path: '/hod/coils', icon: 'git-commit-outline' as any },
            { name: 'Rod Types', path: '/hod/rods', icon: 'git-commit-outline' as any }
          );
        }
      }
      return items;
    }
    return EMPLOYEE_NAV_ITEMS;
  }, [user]);

  // Helper to determine if a route is active
  const isActive = (path: string) => {
    // If we're at the root of the area
    if (path === '/hod' || path === '/employee') {
      return pathname === path || pathname === path + '/';
    }
    return pathname.startsWith(path);
  };

  if (isMobile) {
    return (
      <View style={styles.mobileContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.mobileScrollContainer}
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link href={item.path as any} key={item.name} asChild>
                <Pressable style={styles.mobileNavItem}>
                  <Ionicons
                    name={active && item.icon.endsWith('-outline') ? (item.icon.replace('-outline', '') as any) : item.icon}
                    size={24}
                    color={active ? Brand.colors.primary : Brand.colors.textSecondary}
                  />
                  <Text style={StyleSheet.flatten([styles.mobileNavText, active && styles.navTextActive])} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={StyleSheet.flatten([styles.container, isCollapsed && styles.containerCollapsed])}>
      <View style={StyleSheet.flatten([styles.logoContainer, isCollapsed && styles.logoContainerCollapsed])}>
        {!isCollapsed ? (
          <>
            <Image
              source={require('@/assets/images/barani-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Pressable style={styles.collapseButton} onPress={toggleSidebar}>
              <Ionicons name="chevron-back" size={20} color={Brand.colors.textSecondary} />
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.collapseButtonCollapsed} onPress={toggleSidebar}>
            <Ionicons name="menu-outline" size={24} color={Brand.colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={StyleSheet.flatten([styles.navContainer, isCollapsed && styles.navContainerCollapsed])}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link href={item.path as any} key={item.name} asChild>
              <Pressable 
                style={StyleSheet.flatten([
                  styles.navItem, 
                  active && styles.navItemActive,
                  isCollapsed && styles.navItemCollapsed,
                  isCollapsed && active && styles.navItemActiveCollapsed
                ])}
              >
                <Ionicons
                  name={active && item.icon.endsWith('-outline') ? (item.icon.replace('-outline', '') as any) : item.icon}
                  size={22}
                  color={active ? Brand.colors.primary : Brand.colors.textSecondary}
                  style={isCollapsed ? undefined : styles.icon}
                />
                {!isCollapsed && (
                  <Text style={StyleSheet.flatten([styles.navText, active && styles.navTextActive])}>
                    {item.name}
                  </Text>
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: Brand.colors.card,
    borderRightWidth: 1,
    borderRightColor: Brand.colors.border,
    height: '100%',
  },
  containerCollapsed: {
    width: 80,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
    height: 80, // Match header height
  },
  logoContainerCollapsed: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Brand.colors.border,
    height: 80,
  },
  logo: {
    width: 140,
    height: 40,
  },
  collapseButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  collapseButtonCollapsed: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navContainer: {
    padding: 16,
    gap: 8,
  },
  navContainerCollapsed: {
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  navItemCollapsed: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: '#F0F5FF', // Light blue background for active
    borderLeftWidth: 4,
    borderLeftColor: Brand.colors.primary,
    paddingLeft: 12, // Adjust padding to account for border
  },
  navItemActiveCollapsed: {
    borderLeftWidth: 0,
    backgroundColor: '#F0F5FF',
  },
  icon: {
    marginRight: 12,
  },
  navText: {
    fontSize: 15,
    fontWeight: '500',
    color: Brand.colors.textSecondary,
  },
  navTextActive: {
    color: Brand.colors.primary,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  logoutContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Brand.colors.border,
  },
  mobileContainer: {
    backgroundColor: Brand.colors.card,
    borderTopWidth: 1,
    borderTopColor: Brand.colors.border,
    paddingBottom: 24, // Safe area for modern phones
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mobileScrollContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 12,
  },
  mobileNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80, // Equal width for consistent horizontal scrolling
    gap: 4,
  },
  mobileNavText: {
    fontSize: 10,
    color: Brand.colors.textSecondary,
    textAlign: 'center',
  },
});
