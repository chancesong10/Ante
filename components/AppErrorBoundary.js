import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { loadSessionHistory, clearAllAppData } from '../services/storageService';
import { exportSessionsCsv } from '../utils/exportSessions';
import { Tappable } from './ui';

// What the user sees when the tree has thrown.
//
// Kept as its own function component so it can use hooks — the boundary itself
// has to be a class, since getDerivedStateFromError/componentDidCatch have no
// hook equivalent. It deliberately reads history straight from storage rather
// than from context: by the time this renders, the provider tree is the thing
// that just failed, so nothing in it can be trusted to still be mounted.
function CrashScreen({ error, attempts, onRetry }) {
  const [busy, setBusy] = React.useState(null); // 'export' | 'reset'
  const [notice, setNotice] = React.useState(null);
  // Erasing is a real escape hatch, but it's also irreversible, so it takes a
  // second deliberate tap rather than sitting one tap away on a panic screen.
  const [confirmingReset, setConfirmingReset] = React.useState(false);

  // A crash that survives a retry is almost always a bad persisted record
  // being re-read on mount, which will keep happening. Say so, rather than
  // letting someone tap Try Again forever.
  const repeating = attempts > 0;

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    setNotice(null);
    try {
      const sessions = await loadSessionHistory();
      const { message } = await exportSessionsCsv(sessions);
      if (message) setNotice(message);
    } catch {
      setNotice('Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setBusy('reset');
    try {
      await clearAllAppData();
      onRetry();
    } catch {
      setBusy(null);
      setNotice('Could not erase data. Reinstalling the app will clear it.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconBadge}>
          <Ionicons
            name="warning-outline"
            size={moderateScale(28)}
            color={COLORS.warning}
          />
        </View>

        <Text style={styles.title}>Ante hit a problem</Text>
        <Text style={styles.body}>
          {repeating
            ? 'That went wrong again, which usually means a saved session is the cause. Export your data first — then erasing it should get the app running.'
            : 'Something went wrong and the screen had to stop. Your sessions are still saved on this device.'}
        </Text>

        <Tappable
          style={styles.primaryButton}
          onPress={onRetry}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Tappable>

        <Tappable
          style={styles.secondaryButton}
          onPress={handleExport}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Export my sessions as a CSV file"
        >
          {busy === 'export' ? (
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
          ) : (
            <>
              <Ionicons
                name="download-outline"
                size={moderateScale(18)}
                color={COLORS.textPrimary}
              />
              <Text style={styles.secondaryButtonText}>Export My Data</Text>
            </>
          )}
        </Tappable>

        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        <Tappable
          style={styles.resetButton}
          onPress={handleReset}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel={
            confirmingReset
              ? 'Confirm erasing all saved data'
              : 'Erase saved data to recover the app'
          }
        >
          {busy === 'reset' ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <Text style={styles.resetButtonText}>
              {confirmingReset ? 'Tap again to erase everything' : 'Erase Saved Data'}
            </Text>
          )}
        </Tappable>

        {!!error?.message && (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>WHAT HAPPENED</Text>
            <Text style={styles.detailText}>{String(error.message).slice(0, 300)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Catches a render throw anywhere below it so one bad record can't take the
// whole app to a blank screen.
//
// This sits high — above the providers, not just around the navigator —
// because a malformed session reaching SessionProvider or a failure inside
// PurchasesProvider would otherwise escape a boundary placed further down.
// The stakes are higher here than in most apps: the only move left on a blank
// screen is a force-quit, and a force-quit is exactly what a live session has
// to survive, so an uncaught throw and lost session data are the same bug.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempts: 0 };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary: caught a render error', error, info?.componentStack);
  }

  handleRetry() {
    this.setState((prev) => ({ error: null, attempts: prev.attempts + 1 }));
  }

  render() {
    const { error, attempts } = this.state;
    if (error) {
      return <CrashScreen error={error} attempts={attempts} onRetry={this.handleRetry} />;
    }
    // Keyed on the retry count so a retry remounts the tree from scratch
    // rather than resuming whatever half-built state threw the first time.
    return <View key={attempts} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: moderateScale(28),
    paddingVertical: moderateScale(40),
  },
  iconBadge: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: COLORS.warningMuted,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: fluidFont(24),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  body: {
    fontSize: fluidFont(14),
    lineHeight: fluidFont(21),
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET.minSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  primaryButtonText: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textDark,
  },
  secondaryButton: {
    flexDirection: 'row',
    gap: moderateScale(8),
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorderHighlight,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET.minSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: fluidFont(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  notice: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resetButton: {
    minHeight: TOUCH_TARGET.minSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  resetButtonText: {
    fontSize: fluidFont(13),
    fontWeight: '600',
    color: COLORS.danger,
  },
  detailBox: {
    marginTop: SPACING.xl,
    padding: moderateScale(14),
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
  },
  detailLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  detailText: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
  },
});
