import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import {
  LEGAL_VERSION,
  LEGAL_LAST_UPDATED,
  MINIMUM_AGE,
  HELPLINE,
  LEGAL_DOCS,
} from '../constants/legal';
import { loadLegalConsent, saveLegalConsent } from '../services/storageService';
import { hapticLight } from '../utils/haptics';

// Blocks the app until the user has affirmatively accepted the current Terms
// and Privacy Policy and confirmed their age.
//
// This exists because "by using the app you agree to our Terms" — a browsewrap
// — is routinely held unenforceable against consumers (Nguyen v. Barnes &
// Noble; Berman v. Freedom Financial Network, 9th Cir. 2022). Every protective
// clause Ante has, the disclaimer of warranties, the limitation of liability,
// the indemnity and the choice of forum, is worth nothing if the agreement
// containing them never bound the user. What those cases ask for is what this
// screen does: conspicuous notice of the terms, and an unambiguous act of
// assent that does nothing else.
//
// So the checkboxes start unticked and the button stays disabled until both
// are ticked. Do not "helpfully" default them to true — a pre-ticked box is
// not assent, and it would put us back where we started.
//
// It is also the only place the app asks for age at all, which matters for a
// gambling-adjacent product on both stores.

const CONSENT_POINTS = [
  {
    key: 'age',
    icon: 'person-outline',
    label: `I am at least ${MINIMUM_AGE} years old`,
    detail:
      'Some places set a higher minimum for gambling itself — 21, in much of the US. Meeting whichever applies where you are is on you.',
  },
  {
    key: 'terms',
    icon: 'document-text-outline',
    label: 'I have read and agree to the Terms of Service and Privacy Policy',
    detail: `Last updated ${LEGAL_LAST_UPDATED}. Tap either one to read it in full before you accept.`,
  },
];

export default function LegalConsentGate({ children }) {
  // null while we are still reading storage — rendering either branch before
  // that resolves would flash the gate at users who accepted months ago.
  const [consent, setConsent] = useState(null);
  const [checked, setChecked] = useState({ age: false, terms: false });
  const [reading, setReading] = useState(null); // 'privacy' | 'terms' | null
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadLegalConsent();
      setConsent(stored);
      setLoaded(true);
    })();
  }, []);

  const accepted = !!consent && consent.version === LEGAL_VERSION;
  const isUpdate = !!consent && consent.version !== LEGAL_VERSION;
  const canAccept = checked.age && checked.terms && !saving;

  const toggle = useCallback((key) => {
    hapticLight();
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAccept = useCallback(async () => {
    if (!canAccept) return;
    setSaving(true);
    const record = {
      version: LEGAL_VERSION,
      acceptedAt: new Date().toISOString(),
      ageConfirmed: true,
      minimumAge: MINIMUM_AGE,
    };
    // Show the app even if the write failed. A device with full storage would
    // otherwise be stuck on this screen forever, and the user did accept —
    // we just could not record it, and will ask again next launch.
    await saveLegalConsent(record);
    setConsent(record);
    setSaving(false);
  }, [canAccept]);

  // Hold everything back until storage has answered, rather than mounting the
  // app and yanking it away a frame later.
  if (!loaded) return null;
  if (accepted) return children;

  if (reading) {
    const doc = LEGAL_DOCS[reading];
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.docNav}>
          <TouchableOpacity
            onPress={() => setReading(null)}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back to the consent screen"
            style={styles.docBack}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.docNavTitle}>{doc.title}</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.docScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.docUpdated}>Last Updated: {doc.lastUpdated}</Text>
          {doc.sections.map((section, i) => (
            <View key={i} style={styles.docSection}>
              <Text style={styles.docHeading}>{section.heading}</Text>
              {section.body?.map((p, j) => (
                <Text key={j} style={styles.docParagraph}>
                  {p}
                </Text>
              ))}
              {section.bullets?.map((b, j) => (
                <View key={j} style={styles.docBulletRow}>
                  <Text style={styles.docBulletDot}>•</Text>
                  <Text style={styles.docBulletText}>{b}</Text>
                </View>
              ))}
              {section.after?.map((p, j) => (
                <Text key={j} style={styles.docParagraph}>
                  {p}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandMark}>
          <Ionicons name="shield-checkmark-outline" size={moderateScale(28)} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>{isUpdate ? 'We updated our terms' : 'Before you start'}</Text>
        <Text style={styles.subtitle}>
          {isUpdate
            ? 'The Terms of Service and Privacy Policy have changed since you last accepted them. Please review and accept the new version to continue.'
            : 'Ante is a private record of gambling you do elsewhere. It never places a bet, never touches real money, and has no connection to any casino or sportsbook.'}
        </Text>

        <View style={styles.checkList}>
          {CONSENT_POINTS.map((point) => {
            const on = checked[point.key];
            return (
              <TouchableOpacity
                key={point.key}
                style={[styles.checkRow, on && styles.checkRowOn]}
                activeOpacity={0.8}
                onPress={() => toggle(point.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={point.label}
              >
                <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                  {on && <Ionicons name="checkmark" size={moderateScale(15)} color={COLORS.textDark} />}
                </View>
                <View style={styles.checkTextGroup}>
                  <Text style={styles.checkLabel}>{point.label}</Text>
                  <Text style={styles.checkDetail}>{point.detail}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.docLinks}>
          <TouchableOpacity
            onPress={() => setReading('terms')}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityRole="link"
            accessibilityLabel="Read the Terms of Service"
          >
            <Text style={styles.docLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.docLinkDivider}>·</Text>
          <TouchableOpacity
            onPress={() => setReading('privacy')}
            hitSlop={TOUCH_TARGET.hitSlop}
            accessibilityRole="link"
            accessibilityLabel="Read the Privacy Policy"
          >
            <Text style={styles.docLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.acceptBtn, !canAccept && styles.acceptBtnOff, SHADOWS.card]}
          activeOpacity={0.85}
          onPress={handleAccept}
          disabled={!canAccept}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAccept }}
          accessibilityLabel="Agree and continue"
        >
          {saving ? (
            <ActivityIndicator color={COLORS.textDark} />
          ) : (
            <Text style={[styles.acceptBtnText, !canAccept && styles.acceptBtnTextOff]}>
              Agree & Continue
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpline}>
          Ante is not gambling or financial advice. If gambling is causing you harm, call the{' '}
          {HELPLINE.name} at {HELPLINE.display} in {HELPLINE.region}. {HELPLINE.international}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.xl,
  },
  brandMark: {
    alignSelf: 'center',
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(22),
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(19),
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },

  checkList: { gap: SPACING.xs },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  checkRowOn: { borderColor: COLORS.primaryGlow },
  checkBox: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkTextGroup: { flex: 1 },
  checkLabel: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: fluidFont(18),
  },
  checkDetail: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(16),
    marginTop: 3,
  },

  docLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
    marginTop: SPACING.md,
  },
  docLink: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.accentCyan,
    textDecorationLine: 'underline',
  },
  docLinkDivider: { color: COLORS.textMuted, fontSize: fluidFont(12) },

  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    minHeight: TOUCH_TARGET.minSize,
  },
  acceptBtnOff: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  acceptBtnText: { color: COLORS.textDark, fontWeight: '700', fontSize: fluidFont(15) },
  acceptBtnTextOff: { color: COLORS.textMuted },

  helpline: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    lineHeight: fluidFont(15),
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  docNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  docBack: { padding: 4 },
  docNavTitle: { fontSize: fluidFont(16), fontWeight: '700', color: COLORS.textPrimary },
  docScroll: { padding: SPACING.pageHorizontal, paddingBottom: moderateScale(40) },
  docUpdated: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 18,
  },
  docSection: { marginBottom: 20 },
  docHeading: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  docParagraph: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(20),
    marginBottom: 8,
  },
  docBulletRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 4 },
  docBulletDot: {
    fontSize: fluidFont(13),
    color: COLORS.primary,
    marginRight: 8,
    lineHeight: fluidFont(20),
  },
  docBulletText: {
    flex: 1,
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(20),
  },
});
