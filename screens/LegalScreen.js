import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale } from '../constants/layout';

const PRIVACY_SECTIONS = [
  {
    heading: 'Overview',
    body: [
      'Ante ("Ante," "the app," "we," "us," or "our") is a personal bankroll and session-tracking application for Blackjack, Poker, Sports Betting, and other wagering activities you engage in independently of the app. This Privacy Policy explains what information Ante interacts with, how it\'s stored, and what control you have over it.',
      'Ante is operated by [OPERATOR NAME]. If you have questions about this policy, contact us at [CONTACT EMAIL].',
    ],
  },
  {
    heading: 'The short version',
    body: [
      'Ante stores everything locally, on your device. We do not operate a server that receives your session data, we do not sell or share your information with anyone, and we do not embed any third-party analytics, advertising, or tracking software in the app.',
    ],
  },
  {
    heading: 'Information Ante stores',
    body: [
      'All of the following is stored exclusively in your device\'s local app storage and is never transmitted anywhere by Ante:',
    ],
    bullets: [
      'Session and hand data you enter — bet amounts, outcomes, buy-ins/cash-outs, blind structures, player labels you type in for Poker, and any other figures you log while tracking a session.',
      'Preferences — your selected currency, privacy mode setting, quick-chip configuration, and responsible-gaming stop-loss threshold.',
      'An anonymous device identifier — a randomly generated string created the first time you open the app, used solely to give your existing local data a clean path to attach to an account if and when Ante introduces optional account sign-in and cloud sync in the future. It is not linked to your name, email, or any other personal identifier today, is not used for advertising or cross-app tracking, and is never transmitted off your device under the current version of the app.',
    ],
  },
  {
    heading: 'Information Ante does not collect',
    body: [
      'Ante does not request or access your camera, microphone, location, contacts, photo library, or any other device permission. Ante does not require you to create an account, and does not collect your name, email address, or phone number, unless and until a future version introduces optional account sign-in — at which point this policy will be updated before that feature is released.',
    ],
  },
  {
    heading: 'Third parties',
    body: [
      'Ante does not integrate any third-party analytics SDK, advertising network, or crash-reporting service that collects or transmits your data. The app has no server backend today, and no data leaves your device through Ante.',
    ],
  },
  {
    heading: 'Your control over your data',
    body: ['Because everything is local, you are always in direct control of it:'],
    bullets: [
      'Export — Profile → Data Vault → Export Session Vault lets you download your full session history as a JSON file at any time.',
      'Delete — Profile → Data Vault → Clear Vault History permanently erases all session and preference data stored by the app.',
      'Uninstalling the app removes all locally stored Ante data from your device.',
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      'Ante is intended for users 18 years of age and older, consistent with our Terms of Service. Ante is not directed at children, and we do not knowingly collect information from anyone under 18. If you believe a child has used the app in a way that concerns you, contact us at [CONTACT EMAIL].',
    ],
  },
  {
    heading: 'Future changes to how data is handled',
    body: [
      'Ante\'s roadmap includes optional features — such as account sign-in, cloud backup, and multi-device sync — that would involve a server storing some of the data described above. If and when any such feature ships, it will be opt-in, and this Privacy Policy will be updated in advance to clearly describe what changes, what\'s collected, and how it\'s protected, with the "Last Updated" date reflecting that change.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be reflected by an updated "Last Updated" date at the top of this page, and, where appropriate, an in-app notice.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about this policy or your data can be sent to [CONTACT EMAIL].'],
  },
];

const TERMS_SECTIONS = [
  {
    heading: '1. Agreement to Terms',
    body: [
      'These Terms of Service ("Terms") govern your access to and use of the Ante mobile application ("Ante," "the app," "we," "us," or "our"), operated by [OPERATOR NAME]. By downloading, installing, or using Ante, you agree to be bound by these Terms. If you do not agree, do not use the app.',
    ],
  },
  {
    heading: '2. Eligibility',
    body: [
      'You must be at least 18 years old to use Ante. By using the app, you represent that you meet this requirement and that your use of the app, and any underlying gambling or wagering activity you choose to track with it, complies with the laws applicable to you in your jurisdiction.',
    ],
  },
  {
    heading: '3. What Ante is — and is not',
    body: [
      'Ante is a personal record-keeping and analytics tool. It lets you log details of gambling or wagering sessions you participate in elsewhere — at a casino, cardroom, sportsbook, or private game — and calculates statistics from what you enter.',
      'Ante does not, at any point, facilitate, process, offer, or accept any real-money wager, bet, or gambling transaction of any kind. Ante has no affiliation, partnership, or integration with any casino, sportsbook, cardroom, lottery, or other gambling operator. Nothing in the app constitutes an offer to gamble, and no money changes hands through Ante.',
    ],
  },
  {
    heading: '4. Not financial, legal, or gambling advice',
    body: [
      'The statistics, insights, and figures Ante generates are calculated from the information you enter and are provided for informational purposes only. They are not financial advice, gambling strategy advice, or a guarantee of future results. You are solely responsible for any decisions you make, gambling or otherwise, based on information Ante provides. Ante does not guarantee the accuracy of any calculation, and you should independently verify any figure that matters to you (e.g., for tax purposes).',
    ],
  },
  {
    heading: '5. Responsible gambling',
    body: [
      'Ante includes optional tools — including a configurable stop-loss alert and access to problem-gambling helpline resources — intended to support more mindful play. These tools are provided as a convenience and are not a substitute for professional help. If you are concerned about your own or someone else\'s gambling, please contact the National Council on Problem Gambling at 1-800-522-4700, or the appropriate resource in your country. Ante is not a treatment provider, counseling service, or medical resource.',
    ],
  },
  {
    heading: '6. Your account and data',
    body: [
      'Ante currently requires no account and stores your data locally on your device, as described in our Privacy Policy. You are responsible for safeguarding access to your own device. Ante is not responsible for data loss resulting from device loss, damage, factory reset, or app uninstallation — we recommend using the in-app export feature periodically if your history matters to you.',
    ],
  },
  {
    heading: '7. Acceptable use',
    body: ['You agree not to:'],
    bullets: [
      'Reverse engineer, decompile, or attempt to extract the source code of the app beyond what applicable law expressly permits;',
      'Use the app for any unlawful purpose, including to facilitate underage or illegal gambling;',
      'Attempt to interfere with, disable, or overload the app;',
      'Copy, resell, sublicense, or redistribute the app or its content without our written permission.',
    ],
  },
  {
    heading: '8. Intellectual property',
    body: [
      'Ante, including its design, branding, source code, and the specific analytics methodology it uses, is owned by [OPERATOR NAME]. Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to use the app for your own personal, non-commercial purposes. All rights not expressly granted are reserved.',
    ],
  },
  {
    heading: '9. Disclaimer of warranties',
    body: [
      'Ante is provided "as is" and "as available," without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the app will be uninterrupted, error-free, or that any calculation will be accurate.',
    ],
  },
  {
    heading: '10. Limitation of liability',
    body: [
      'To the fullest extent permitted by law, [OPERATOR NAME] shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or gambling losses, arising out of or related to your use of the app, even if advised of the possibility of such damages. Our total liability for any claim arising from your use of the app shall not exceed the amount, if any, you paid us to use it in the twelve months preceding the claim.',
    ],
  },
  {
    heading: '11. Indemnification',
    body: [
      'You agree to indemnify and hold harmless [OPERATOR NAME] from any claim, loss, or demand, including reasonable attorneys\' fees, arising out of your misuse of the app or violation of these Terms or applicable law.',
    ],
  },
  {
    heading: '12. Changes to the app or these Terms',
    body: [
      'We may modify, suspend, or discontinue any part of the app at any time. We may also update these Terms from time to time; material changes will be reflected by an updated "Last Updated" date, and, where appropriate, an in-app notice. Continued use of the app after changes take effect constitutes acceptance of the revised Terms.',
    ],
  },
  {
    heading: '13. Termination',
    body: [
      'We may suspend or terminate your access to the app at any time if we believe you have violated these Terms.',
    ],
  },
  {
    heading: '14. Governing law',
    body: [
      'These Terms are governed by the laws of the State of [STATE], without regard to its conflict-of-laws principles, and any dispute arising from these Terms or your use of the app shall be subject to the exclusive jurisdiction of the courts located in that state.',
    ],
  },
  {
    heading: '15. Severability',
    body: [
      'If any provision of these Terms is found unenforceable, the remaining provisions will remain in full force and effect.',
    ],
  },
  {
    heading: '16. Contact',
    body: ['Questions about these Terms can be sent to [CONTACT EMAIL].'],
  },
];

const DOC_CONFIG = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'August 20, 2026',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    title: 'Terms of Service',
    lastUpdated: 'August 20, 2026',
    sections: TERMS_SECTIONS,
  },
};

export default function LegalScreen({ route, navigation }) {
  const doc = DOC_CONFIG[route?.params?.doc] || DOC_CONFIG.privacy;
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
            {section.body.map((p, pIdx) => (
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
