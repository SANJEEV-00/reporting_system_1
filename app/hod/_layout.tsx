import { Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View, useWindowDimensions, Platform } from 'react-native';

import { AuthGuard } from '@/components/auth/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopHeader } from '@/components/layout/top-header';
import { Brand } from '@/constants/brand';

export default function HodLayout() {
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 1024;

  return (
    <AuthGuard allowedRole="hod">
      <View style={[styles.container, { flexDirection: isMobile ? 'column' : 'row' }]}>
        {!isMobile && <Sidebar />}
        <View style={styles.mainContent}>
          <TopHeader subtitle="Head of Department Dashboard" />
          <View style={[styles.pageContent, isMobile && { padding: 16 }]}>
            <Slot />
          </View>
        </View>
        {isMobile && <Sidebar isMobile />}
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Brand.colors.background,
    width: '100%',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
  },
  pageContent: {
    flex: 1,
    padding: 32,
  },
});
