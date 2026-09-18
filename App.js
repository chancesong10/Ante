import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';
import { AuthProvider } from './context/AuthContext';
import { PurchasesProvider } from './context/PurchasesContext';
import { useSyncEngine, SyncStatusProvider } from './context/SyncContext';
import { SessionEndFxProvider, useSessionEndFx } from './context/SessionEndFxContext';

import PokerScreen from './screens/PokerScreen';
import HomeScreen from './screens/HomeScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import BlackjackScreen from './screens/BlackjackScreen';
import SportsBettingScreen from './screens/SportsBettingScreen';
import RouletteScreen from './screens/RouletteScreen';
import BaccaratScreen from './screens/BaccaratScreen';
import GeneralTrackerScreen from './screens/GeneralTrackerScreen';
import InsightsScreen from './screens/InsightsScreen';
import PokerInsightsScreen from './screens/PokerInsightsScreen';
import SportsBettingInsightsScreen from './screens/SportsBettingInsightsScreen';
import TableGameInsightsScreen from './screens/TableGameInsightsScreen';
import LifetimeInsightsScreen from './screens/LifetimeInsightsScreen';
import LegalScreen from './screens/LegalScreen';
import ManageSubscriptionScreen from './screens/ManageSubscriptionScreen';
import AntePlusScreen from './screens/AntePlusScreen';
import AccountScreen from './screens/AccountScreen';
import DataPrivacyScreen from './screens/DataPrivacyScreen';
import AuthScreen from './screens/AuthScreen';

import StartSessionModal from './components/StartSessionModal';
import ResponsibleGamingAlertModal from './components/ResponsibleGamingAlertModal';
import AnimatedLoadingScreen from './components/AnimatedLoadingScreen';
import AppErrorBoundary from './components/AppErrorBoundary';
import { COLORS } from './constants/theme';
import { moderateScale, fluidFont, TOUCH_TARGET } from './constants/layout';
import { SessionProvider, useActiveSession, useSessionHistory } from './context/SessionContext';
import { hapticLight } from './utils/haptics';
import { shouldRaiseStopLossAlert, acknowledgedTier } from './utils/stopLoss';

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
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        // Mount every tab up front instead of on first visit. These screens
        // are big (Profile ~2.2k lines, History and Analytics ~1k each), so
        // lazily mounting them meant paying that cost as a visible stall the
        // first time you opened each one. Doing it eagerly moves the work
        // behind the startup loading screen, which is already waiting on
        // storage anyway — so it costs nothing the user can see, and every
        // tab switch afterwards is instant.
        lazy: false,
        // The flip side of keeping all four mounted: without this they'd all
        // re-render on every session-history change, even the three you
        // can't see. Freezing blurred tabs suspends that until they're
        // focused again.
        freezeOnBlur: true,
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
        tabBarActiveTintColor: COLORS.accentCyan,
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
        // React Navigation takes a render function through this prop. Nesting
        // it as a JSX child is a different thing and does not work here.
        // eslint-disable-next-line react/no-children-prop
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
    </View>
  );
}

// Holds the navigation ref and the end-session provider, so that everything
// below — AppContent itself, the start-session sheet, and every screen — can
// reach the transition. It used to wrap only the NavigationContainer, which
// left the sheet and the stop-loss alert outside it and unable to use it.
function AppShell() {
  const navigationRef = useNavigationContainerRef();

  // Fired once the end-session wash is opaque — History mounts and the stack
  // finishes its pop entirely out of sight, well before the wash lifts.
  const handleSessionEndNavigate = useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', { screen: 'History' });
    }
  }, [navigationRef]);

  return (
    <SessionEndFxProvider onNavigate={handleSessionEndNavigate}>
      <AppContent navigationRef={navigationRef} />
    </SessionEndFxProvider>
  );
}

function AppContent({ navigationRef }) {
  const [appReady, setAppReady] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const { endSessionWithFx } = useSessionEndFx();
  const { activeSessionList, endActiveSession, updateActiveSessionMetadata } = useActiveSession();
  const { isLoaded: isSessionLoaded } = useSessionHistory();
  useSyncEngine();
  const {
    stopLossAlert = false,
    stopLossAmount = 250,
    currencySymbol = '$',
    isLoaded: isPrefsLoaded,
  } = usePreferences();

  // Responsible Gaming Alert state. With several sessions able to run at
  // once, the alert is *about* one of them — `alertSessionId` says which.
  //
  // The snoozed loss tier is NOT tracked here. It lives on the session record
  // itself (`alertedTier`), so it survives the app being killed and comes
  // back with the session on relaunch: component state meant a session
  // already well past its threshold re-alerted from tier zero every launch,
  // for a warning the user had explicitly acknowledged minutes earlier.
  // Storing it on the session also disposes of it when the session ends,
  // rather than accumulating entries keyed on ids that no longer exist.
  const [alertSessionId, setAlertSessionId] = useState(null);

  // Live metrics for every running session, keyed by id.
  const sessionMetrics = useMemo(() => {
    const byId = {};
    activeSessionList.forEach((s) => {
      const durationMinutes = Math.max(0, Math.floor((Date.now() - s.startTime) / 60000));
      const hands = Array.isArray(s.hands) ? s.hands : [];

      let netOutcome = 0;
      let totalBets = 0;

      if (hands.length > 0) {
        const allHands = hands.flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r]));
        totalBets = allHands.length;
        netOutcome = allHands.reduce((sum, h) => sum + (h.netChange || 0), 0);
      } else if (s.buyIn !== null && s.cashOut !== null) {
        // Until cash-out is entered there's no known live balance for a
        // buy-in/cash-out session, so leave netOutcome at 0 rather than
        // treating the un-entered cash-out as a total loss of the buy-in.
        totalBets = 1;
        netOutcome = s.cashOut - s.buyIn;
      }

      byId[s.id] = { netOutcome, totalBets, durationMinutes };
    });
    return byId;
  }, [activeSessionList]);

  const alertSession = activeSessionList.find((s) => s.id === alertSessionId) || null;
  const alertMetrics = useMemo(() => {
    const base = sessionMetrics[alertSessionId] || {
      netOutcome: 0,
      totalBets: 0,
      durationMinutes: 0,
    };
    if (!alertSession) return base;
    // sessionMetrics only recomputes when a session changes, so its duration
    // is stale by the time an alert opens on it. This one is measured as the
    // alert is raised, which is the moment the figure is read.
    return {
      ...base,
      durationMinutes: Math.max(0, Math.floor((Date.now() - alertSession.startTime) / 60000)),
    };
  }, [alertSession, alertSessionId, sessionMetrics]);

  // Monitor the stop-loss limit across every running session. One alert at a
  // time — whichever session crosses a new tier first raises it.
  useEffect(() => {
    if (!stopLossAlert || stopLossAmount <= 0 || alertSessionId) return;

    const crossed = activeSessionList.find((s) =>
      shouldRaiseStopLossAlert(s, sessionMetrics[s.id], {
        enabled: stopLossAlert,
        threshold: stopLossAmount,
      })
    );

    if (crossed) setAlertSessionId(crossed.id);
  }, [activeSessionList, sessionMetrics, stopLossAlert, stopLossAmount, alertSessionId]);

  const handleEndSession = () => {
    const session = alertSession;
    setAlertSessionId(null);
    if (!session) return;
    endSessionWithFx({
      net: sessionMetrics[session.id]?.netOutcome ?? 0,
      gameType: session.gameType,
      onCommit: () => endActiveSession(session.gameType),
    });
  };

  const handleAcknowledge = () => {
    const session = alertSession;
    setAlertSessionId(null);
    if (!session) return;

    // Snooze to the current loss tier so it only alerts if this session's
    // losses deepen further. Written onto the session so the acknowledgement
    // outlives the process.
    const tier = acknowledgedTier(sessionMetrics[session.id]?.netOutcome ?? 0, stopLossAmount);
    updateActiveSessionMetadata(session.gameType, { alertedTier: tier });
  };



  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <MainTabNavigator
                onOpenAddModal={() => {
                  hapticLight();
                  setAddModalVisible(true);
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Blackjack" component={BlackjackScreen} />
          <Stack.Screen name="Poker" component={PokerScreen} />
          <Stack.Screen name="SportsBetting" component={SportsBettingScreen} />
          <Stack.Screen name="Roulette" component={RouletteScreen} />
          <Stack.Screen name="Baccarat" component={BaccaratScreen} />
          <Stack.Screen name="GeneralTracker" component={GeneralTrackerScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="PokerInsights" component={PokerInsightsScreen} />
          <Stack.Screen name="SportsBettingInsights" component={SportsBettingInsightsScreen} />
          <Stack.Screen name="TableGameInsights" component={TableGameInsightsScreen} />
          <Stack.Screen name="LifetimeInsights" component={LifetimeInsightsScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="ManageSubscription" component={ManageSubscriptionScreen} />
          <Stack.Screen name="AntePlus" component={AntePlusScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />
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
        onNavigateToRoulette={() => navigationRef.navigate('Roulette')}
        onNavigateToBaccarat={() => navigationRef.navigate('Baccarat')}
        onNavigateToGeneral={() => navigationRef.navigate('GeneralTracker')}
      />

      {/* Responsible Gaming Limits In-App Safety Alert Modal */}
      <ResponsibleGamingAlertModal
        visible={!!alertSession}
        netOutcome={alertMetrics.netOutcome}
        durationMinutes={alertMetrics.durationMinutes}
        totalBets={alertMetrics.totalBets}
        thresholdAmount={stopLossAmount}
        currencySymbol={currencySymbol}
        onEndSession={handleEndSession}
        onAcknowledge={handleAcknowledge}
      />

      {!appReady && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
          <AnimatedLoadingScreen
            isAppReady={isPrefsLoaded && isSessionLoaded}
            onFinish={() => setAppReady(true)}
          />
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Inside SafeAreaProvider so the crash screen can inset itself, but
            above every other provider so a throw in one of them is caught
            too — a malformed session record reaching SessionProvider is the
            most likely cause of a crash here, and a boundary underneath it
            would miss exactly that. */}
        <AppErrorBoundary>
          <AuthProvider>
            <PurchasesProvider>
              <PreferencesProvider>
                <SessionProvider>
                  {/* Above AppShell, which is where useSyncEngine runs, so the
                      engine can publish status and Profile can read it. */}
                  <SyncStatusProvider>
                    <AppShell />
                  </SyncStatusProvider>
                </SessionProvider>
              </PreferencesProvider>
            </PurchasesProvider>
          </AuthProvider>
        </AppErrorBoundary>
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
    borderTopWidth: 1,
    borderTopColor: COLORS.tabBarBorder,
    paddingHorizontal: 8,
    paddingBottom: 0,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});