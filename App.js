import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';

import PokerScreen from './screens/PokerScreen';
import HomeScreen from './screens/HomeScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import BlackjackScreen from './screens/BlackjackScreen';
import SportsBettingScreen from './screens/SportsBettingScreen';
import GeneralTrackerScreen from './screens/GeneralTrackerScreen';
import InsightsScreen from './screens/InsightsScreen';
import PokerInsightsScreen from './screens/PokerInsightsScreen';
import SportsBettingInsightsScreen from './screens/SportsBettingInsightsScreen';
import LifetimeInsightsScreen from './screens/LifetimeInsightsScreen';
import LegalScreen from './screens/LegalScreen';

import StartSessionModal from './components/StartSessionModal';
import ResponsibleGamingAlertModal from './components/ResponsibleGamingAlertModal';
import { COLORS } from './constants/theme';
import { moderateScale, fluidFont, TOUCH_TARGET } from './constants/layout';
import { SessionProvider, useSession } from './context/SessionContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Empty component placeholder for center Add button slot
function EmptyAddSlot() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;
}

function MainTabNavigator({ onOpenAddModal }) {
  const insets = useSafeAreaInsets();

  // Dynamic calculation for bottom floating tab bar across iOS home indicators & Android gesture/button bars
  const bottomOffset = insets.bottom > 0 ? insets.bottom + moderateScale(4) : moderateScale(16);
  const tabBarHeight = moderateScale(62);
  const iconSize = moderateScale(22);
  const addBtnSize = moderateScale(48);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            bottom: bottomOffset,
            height: tabBarHeight,
            left: moderateScale(16),
            right: moderateScale(16),
            borderRadius: tabBarHeight / 2,
          },
        ],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: [
          styles.tabBarLabel,
          {
            fontSize: fluidFont(11),
          },
        ],
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
              size={iconSize}
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
              size={iconSize}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Center Prominent & Ergonomic Action Button */}
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
              hitSlop={TOUCH_TARGET.hitSlop}
              onPress={onOpenAddModal}
              accessibilityRole="button"
              accessibilityLabel="Start New Session"
            >
              <View
                style={[
                  styles.centerAddButton,
                  {
                    width: addBtnSize,
                    height: addBtnSize,
                    borderRadius: addBtnSize / 2,
                  },
                ]}
              >
                <Ionicons name="add" size={moderateScale(28)} color={COLORS.textDark} />
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
              size={iconSize}
              color={color}
            />
          ),
        }}
      />

      {/* 5. Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={iconSize}
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
  const { activeSession, endActiveSession } = useSession();
  const {
    stopLossAlert = false,
    stopLossAmount = 250,
    currencySymbol = '$',
  } = usePreferences();

  // Responsible Gaming Alert state
  const [alertModalVisible, setAlertModalVisible] = useState(false);

  // Tracking snooze loss tiers per session
  const [alertTracking, setAlertTracking] = useState({
    sessionId: null,
    alertedLossTier: 0,
  });

  // Calculate live session metrics
  const sessionMetrics = useMemo(() => {
    if (!activeSession) {
      return { netOutcome: 0, totalBets: 0, durationMinutes: 0 };
    }

    const durationMinutes = Math.max(
      0,
      Math.floor((Date.now() - activeSession.startTime) / 60000)
    );

    let netOutcome = 0;
    let totalBets = 0;

    if (activeSession.mode === 'hands' || Array.isArray(activeSession.hands)) {
      const allHands = (activeSession.hands || []).flatMap((r) =>
        r.type === 'split' && r.hands ? r.hands : [r]
      );
      totalBets = allHands.length;
      netOutcome = allHands.reduce((sum, h) => sum + (h.netChange || 0), 0);
    } else if (activeSession.buyIn !== null) {
      totalBets = 1;
      const cashOut = activeSession.cashOut !== null ? activeSession.cashOut : 0;
      netOutcome = cashOut - activeSession.buyIn;
    }

    return { netOutcome, totalBets, durationMinutes };
  }, [activeSession]);

  // Monitor Stop-Loss limit (cumulative session loss dropping past threshold)
  useEffect(() => {
    if (!activeSession || !stopLossAlert || stopLossAmount <= 0) return;

    let tracking = alertTracking;
    if (tracking.sessionId !== activeSession.id) {
      tracking = {
        sessionId: activeSession.id,
        alertedLossTier: 0,
      };
      setAlertTracking(tracking);
    }

    const netLoss = -sessionMetrics.netOutcome;
    if (netLoss >= stopLossAmount) {
      const currentTier = Math.floor(netLoss / stopLossAmount);
      if (currentTier > tracking.alertedLossTier) {
        setAlertModalVisible(true);
      }
    }
  }, [activeSession, sessionMetrics.netOutcome, stopLossAlert, stopLossAmount, alertTracking]);

  const handleEndSession = () => {
    setAlertModalVisible(false);
    if (activeSession) {
      endActiveSession();
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs', { screen: 'History' });
      }
    }
  };

  const handleAcknowledge = () => {
    setAlertModalVisible(false);
    if (!activeSession) return;

    // Snooze to current loss tier so it only alerts if losses deepen further
    setAlertTracking(() => {
      const netLoss = -sessionMetrics.netOutcome;
      const currentLossTier =
        netLoss >= stopLossAmount ? Math.floor(netLoss / stopLossAmount) : 0;

      return {
        sessionId: activeSession.id,
        alertedLossTier: currentLossTier,
      };
    });
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <MainTabNavigator
                onOpenAddModal={() => setAddModalVisible(true)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Blackjack" component={BlackjackScreen} />
          <Stack.Screen name="Poker" component={PokerScreen} />
          <Stack.Screen name="SportsBetting" component={SportsBettingScreen} />
          <Stack.Screen name="GeneralTracker" component={GeneralTrackerScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="PokerInsights" component={PokerInsightsScreen} />
          <Stack.Screen name="SportsBettingInsights" component={SportsBettingInsightsScreen} />
          <Stack.Screen name="LifetimeInsights" component={LifetimeInsightsScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Center 'Add' Action Modal */}
      <StartSessionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onNavigateToBlackjack={() => {
          navigationRef.navigate('Blackjack');
        }}
        onNavigateToPoker={() => {
          navigationRef.navigate('Poker');
        }}
        onNavigateToSportsBetting={() => navigationRef.navigate('SportsBetting')}
        onNavigateToGeneral={() => navigationRef.navigate('GeneralTracker')}
      />

      {/* Responsible Gaming Limits In-App Safety Alert Modal */}
      <ResponsibleGamingAlertModal
        visible={alertModalVisible}
        netOutcome={sessionMetrics.netOutcome}
        durationMinutes={sessionMetrics.durationMinutes}
        totalBets={sessionMetrics.totalBets}
        thresholdAmount={stopLossAmount}
        currencySymbol={currencySymbol}
        onEndSession={handleEndSession}
        onAcknowledge={handleAcknowledge}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <SessionProvider>
            <AppContent />
          </SessionProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    position: 'absolute',
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
    borderWidth: 1,
    borderColor: COLORS.tabBarBorder,
  },
  tabBarLabel: {
    fontWeight: '600',
    marginTop: 2,
  },
  centerAddButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  centerAddButton: {
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