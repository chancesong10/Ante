import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { LEGAL_DOCS } from '../constants/legal';

// Renders whichever legal document the route names. The text itself lives in
// constants/legal.js, which is also what generates legal/*.md and docs/*.html
// — it used to be inlined here, and the copy drifted out of sync with the
// hosted one badly enough that the in-app policy denied the existence of an
// export feature the app had already shipped.

export default function LegalScreen({ route, navigation }) {
  const doc = LEGAL_DOCS[route?.params?.doc] || LEGAL_DOCS.privacy;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topNav}>
        <Ionicons
          name="chevron-back"
          size={22}
          color={COLORS.textPrimary}
          onPress={() => navigation.goBack()}
          style={styles.backIcon}
        />
        <Text style={styles.navTitle}>{doc.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(40) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: {doc.lastUpdated}</Text>

        {doc.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.body?.map((p, pIdx) => (
              <Text key={pIdx} style={styles.paragraph}>
                {p}
              </Text>
            ))}
            {section.bullets && (
              <View style={styles.bulletList}>
                {section.bullets.map((b, bIdx) => (
                  <View key={bIdx} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* Paragraphs that have to land after the list — the qualifier on a
                set of bullets, not another bullet in it. */}
            {section.after?.map((p, aIdx) => (
              <Text key={aIdx} style={[styles.paragraph, styles.afterParagraph]}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backIcon: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: 16 },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  afterParagraph: { marginTop: 2 },
  bulletList: {
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 4,
  },
  bulletDot: {
    fontSize: 13,
    color: COLORS.primary,
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
