import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, themed } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';

// Full-screen block shown in place of an Insights screen when the user
// isn't logged in — deliberately NOT a teaser/blur of real content the way
// the Pro paywall (components/InsightsPaywall.js) is, since there's no
// account-scoped data to mask in the first place.
export default function AuthGateScreen({ onSignIn, navigation }) {
  const handlePress = () => {
    if (onSignIn) {
      onSignIn();
    } else if (navigation) {
      navigation.navigate('Auth');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={COLORS.statusBarContent} backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.iconBadge}>
            <Ionicons name="lock-closed" size={moderateScale(26)} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Sign in to view insights</Text>
          <Text style={styles.subtitle}>
            Behavioral insights are tied to your account so they can follow you across devices. Create a free account or sign in to continue.
          </Text>
          <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85} onPress={handlePress}>
            <Ionicons name="log-in-outline" size={18} color={COLORS.textDark} style={{ marginRight: 6 }} />
            <Text style={styles.ctaButtonText}>Sign in or create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = themed(() => ({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primaryGlow,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  title: {
    fontFamily: 'display',
    fontSize: fluidFont(20),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: fluidFont(19),
    marginBottom: SPACING.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    paddingHorizontal: SPACING.lg,
  },
  ctaButtonText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
}));
