import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import BlackjackScreen from './screens/BlackjackScreen';

import StartSessionModal from './components/StartSessionModal';
import { COLORS } from './constants/theme';
import { SessionProvider, useSession } from './context/SessionContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Empty component placeholder for center Add button slot
function EmptyAddSlot() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;
}

function MainTabNavigator({ onOpenAddModal }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* 1. Home */}
      <Tab.Screen
        name="Home"
        children={(props) => (
          <HomeScreen {...props} onOpenAddModal={onOpenAddModal} />
        )}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Analytics */}
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Center Prominent & Perfectly Centered 'Add' Action Button */}
      <Tab.Screen
        name="AddAction"
        component={EmptyAddSlot}
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              style={styles.centerAddButtonContainer}
              activeOpacity={0.85}
              onPress={onOpenAddModal}
            >
              <View style={styles.centerAddButton}>
                <Ionicons name="add" size={30} color={COLORS.textDark} />
              </View>
            </TouchableOpacity>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            onOpenAddModal();
          },
        }}
      />

      {/* 4. History */}
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 5. Profile (Completely empty for now) */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const navigationRef = useNavigationContainerRef();

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <MainTabNavigator
                onOpenAddModal={() => setAddModalVisible(true)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Blackjack" component={BlackjackScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Center 'Add' Action Modal */}
      <StartSessionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onNavigateToBlackjack={() => {
          navigationRef.navigate('Blackjack');
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.tabBar,
    borderTopWidth: 0,
    paddingHorizontal: 8,
    paddingBottom: 0,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  centerAddButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  centerAddButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
});