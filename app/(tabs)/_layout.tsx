/**
 * Trace — Tab Navigator
 *
 * Five tabs: Home, Scan, Check, Map, Report
 */

import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { T } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.textMuted,
        tabBarStyle: {
          backgroundColor: T.card,
          borderTopColor: T.border,
          height: 88,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: T.card,
        },
        headerTitleStyle: {
          color: T.text,
          fontWeight: '700',
          fontSize: T.fontLg,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Trace',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          headerTitle: 'Bite Scanner',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="photo-camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="check"
        options={{
          title: 'Check',
          headerTitle: 'Symptom Check',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="fact-check" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerTitle: 'NH Lyme Map',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          headerTitle: 'Your Report',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="description" size={size} color={color} />
          ),
        }}
      />
      {/* Timeline is still a valid route but hidden from tabs — accessed from Home/Report */}
      <Tabs.Screen
        name="timeline"
        options={{
          href: null,
          title: 'Timeline',
          headerTitle: 'Symptom Timeline',
        }}
      />
    </Tabs>
  );
}
