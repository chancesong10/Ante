// Single source of truth for every word of Ante's legal text.
//
// There used to be three copies of the privacy policy — one inlined in
// LegalScreen.js, one in legal/PRIVACY_POLICY.md, one in
// docs/privacy-policy.html — and they drifted. The in-app copy told users
// "Ante does not currently offer an in-app data export tool" long after
// Data & Privacy shipped one, and pointed them at an email address for
// account deletion the app could already do itself. A privacy policy that
// misdescribes the app's own behaviour is the exact shape of an FTC Act s.5
// deceptive-practice claim, so the screen now renders from here and the
// markdown/HTML copies are generated from this same text by
// `npm run legal:build` rather than hand-maintained.
//
// Change anything here, then re-run that script and bump LEGAL_VERSION.

export const CONTACT_EMAIL = 'tncante1008@gmail.com';
// The operator is a person, not a company. It said "Tnc, Inc." until
// 2026-09-20, which was not an incorporated entity — so the liability cap and
// indemnity in the Terms named a party that did not exist, and the corporate
// designation itself is restricted under BC's Business Corporations Act.
// Change this to a company name only once one actually exists; keep every
// sentence below working for either, i.e. no "which is" after it.
export const OPERATOR = 'Chance Song';

// Bumping this re-prompts every existing user for consent on next launch, so
// it moves only for a change a reasonable user would want to be told about —
// not a typo fix. LEGAL_LAST_UPDATED is the line users read, so the two are
// kept adjacent and can never disagree.
export const LEGAL_VERSION = '2026-09-20';
export const LEGAL_LAST_UPDATED = 'September 20, 2026';

// The minimum age asserted in the Terms and confirmed at the consent gate.
// Some jurisdictions set 21 for casino play; the Terms put that obligation on
// the user, because Ante has no way to know where they are.
export const MINIMUM_AGE = 18;

// National Council on Problem Gambling, US, 24/7. `tel` sits next to the
// display string so the button can dial exactly the number the label shows.
export const HELPLINE = {
  name: 'National Council on Problem Gambling',
  display: '1-800-522-4700',
  tel: '+18005224700',
  region: 'the United States',
  international:
    'Outside the US, search for your national problem-gambling helpline — most countries run one free of charge.',
};

export const PRIVACY_SECTIONS = [
  {
    heading: 'Overview',
    body: [
      'Ante ("Ante," "the app," "we," "us," or "our") is a personal bankroll and session-tracking application for Blackjack, Poker, Sports Betting, and other wagering activities you engage in independently of the app. This Privacy Policy explains what information Ante interacts with, how it is stored, and what control you have over it.',
      // Appositive rather than "who is"/"which is", so this reads correctly
      // whether OPERATOR is a person or a company.
      `Ante is operated by ${OPERATOR}, the data controller for the information described below. If you have questions about this policy, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: 'The short version',
    body: [
      'Ante stores your session and hand data locally on your device. Creating an account is optional; if you sign in, that data also syncs to our server — via Supabase, our database provider — so it is available across your devices. If you buy an Ante+ subscription, the purchase is processed by Apple or Google and managed through RevenueCat, our subscription provider. We do not sell or share your information with anyone, and we do not embed any third-party analytics or advertising software in the app.',
    ],
  },
  {
    heading: 'Information Ante stores',
    body: [
      'All of the following is stored in your device’s local app storage. Items marked "synced" are also stored on our server, but only if and while you are signed in to an account:',
    ],
    bullets: [
      'Session and hand data you enter — bet amounts, outcomes, buy-ins/cash-outs, blind structures, player labels you type in for Poker, and any other figures you log while tracking a session. Synced if you are signed in.',
      'Preferences — your selected currency, privacy mode setting, quick-chip configuration, and responsible-gaming stop-loss threshold. These stay on your device and are not synced.',
      'Account information, if you choose to sign in — your email address, the username you pick, and an authentication credential, held by our database provider, Supabase, on our behalf.',
      'Your record of accepting these documents — which version of the Terms and Privacy Policy you accepted, when you accepted it, and your confirmation that you meet the minimum age. This stays on your device and is not synced.',
      'Subscription status, if you purchase Ante+ — whether your subscription is active, the plan type (for example annual or lifetime), and its renewal or expiration date. This is reported to us by RevenueCat, which manages subscriptions on our behalf; the underlying payment is processed by Apple or Google, and we never receive your payment card number or billing address. Your subscription is tied to your account if you are signed in, or otherwise to a random identifier generated by RevenueCat.',
      'An anonymous device identifier — a randomly generated string created the first time you open the app, used to identify data you logged before signing in. It is not linked to your name or email, is not used for advertising or cross-app tracking, and is never transmitted off your device.',
    ],
  },
  {
    heading: 'Information Ante does not collect',
    body: [
      'Ante does not request or access your camera, microphone, location, contacts, photo library, or any other device permission. Creating an account is optional — Ante works fully offline without one. If you do sign in, we collect only the email address you provide for authentication and the username you choose; we do not collect your legal name, date of birth, or phone number. If you purchase an Ante+ subscription, the transaction is handled by Apple’s App Store or Google Play — we do not receive or store your payment card number, billing address, or other payment details.',
    ],
  },
  {
    heading: 'Why we process it, and on what legal basis',
    body: [
      'If you are in the EEA, the UK, or Switzerland, the GDPR requires us to name a lawful basis for each purpose. Ours are:',
    ],
    bullets: [
      'To provide the app and the features you ask for — logging sessions, calculating statistics, syncing to your account. Basis: performance of a contract with you (Art. 6(1)(b)).',
      'To create and secure your account, and to keep the service working and free of abuse. Basis: performance of a contract, and our legitimate interest in operating a secure service (Art. 6(1)(b) and (f)).',
      'To sell, validate, and restore an Ante+ subscription. Basis: performance of a contract (Art. 6(1)(b)).',
      'To keep a record that you accepted these documents and confirmed your age. Basis: compliance with a legal obligation, and our legitimate interest in being able to show that we asked (Art. 6(1)(c) and (f)).',
      'To respond to you when you contact us. Basis: our legitimate interest in answering (Art. 6(1)(f)).',
    ],
    after: [
      'We do not use your information for advertising, for profiling, or for automated decision-making that produces legal or similarly significant effects.',
    ],
  },
  {
    heading: 'Third parties',
    body: [
      'Ante relies on two service providers, each acting strictly as our data processor and not using your data for its own purposes:',
    ],
    bullets: [
      'Supabase powers sign-in and cross-device sync. If you sign in, your account and session data is stored with Supabase on our behalf.',
      'RevenueCat manages Ante+ subscriptions. When you purchase or restore a subscription, RevenueCat receives a pseudonymous app-user identifier (linked to your account if you are signed in), your device platform, and the purchase and renewal status reported by the app store. It does not receive your name or payment details. The purchase itself is processed by Apple’s App Store or Google Play under their own terms and privacy policies.',
    ],
    after: [
      'We do not sell your personal information, and we do not share it for cross-context behavioural advertising. We may disclose information where we are legally required to — for example in response to a valid subpoena or court order — or to establish or defend a legal claim. If Ante is ever acquired or merged, your information may transfer as part of that transaction, and this policy will be updated before it does.',
    ],
  },
  {
    heading: 'Analytics and advertising',
    body: [
      'Ante does not integrate any third-party analytics SDK, advertising network, or crash-reporting service.',
    ],
  },
  {
    heading: 'International data transfers',
    body: [
      'Our service providers store data on servers that may be located outside your country, including in the United States. Where we transfer personal data out of the EEA, the UK, or Switzerland, we rely on the European Commission’s Standard Contractual Clauses, and the UK Addendum where applicable, in our agreements with those providers. You can ask us for detail of the safeguards in place at the address at the end of this policy.',
    ],
  },
  {
    heading: 'How long we keep your data',
    body: ['We keep information only as long as it is doing something for you:'],
    bullets: [
      'Data on your device stays until you delete it — via Erase All Data, or by uninstalling the app.',
      'Synced session data stays on our server for as long as your account exists. Erasing it in the app, or deleting your account, removes it from the server as well — immediately, and with no archival copy beyond the backup window described below.',
      'Account records are deleted when you delete your account.',
      'Subscription records held by RevenueCat and the app stores are retained under their own schedules, which we do not control, because they are also tax and billing records.',
      'Email you send us is kept for as long as it takes to resolve what you wrote about, and for a reasonable period afterwards in case you follow up.',
    ],
    after: [
      // The account-deletion page commits to a specific window. Saying
      // "a short period" here instead would be a second, vaguer answer to the
      // same question, and the vaguer one is the one a regulator reads as
      // evasive. Keep both documents on the same number.
      'Routine encrypted backups kept by our database provider may hold a copy of deleted data for up to 30 days before they are overwritten. Those backups exist for disaster recovery and are used for nothing else.',
    ],
  },
  {
    heading: 'How we protect your data',
    body: [
      'Your Supabase session token is encrypted on your device with an AES-256 key held in the iOS Keychain or the Android Keystore. Data in transit between the app and our server travels over TLS. On the server, row-level security means a signed-in account can read and write only its own rows — there is no query that returns another user’s sessions.',
      'No system is perfectly secure, and we cannot guarantee that a determined attacker will never succeed. If a breach affecting your personal data occurs, we will notify you and the relevant supervisory authorities as and when applicable law requires.',
    ],
  },
  {
    heading: 'Your control over your data',
    body: ['Because most of your data lives on your device, you are largely in control of it:'],
    bullets: [
      'Exporting your data — Profile → Data & Privacy → Export Session History writes your full session history to a CSV file you can save or share.',
      'Erasing your session data — Profile → Data & Privacy → Erase All Data deletes every recorded session from this device, and from your account if you are signed in, while leaving the account itself intact.',
      'Deleting your account — Profile → Account → Delete Account permanently erases your account, your profile, and every session synced to it from our servers. Sessions stored on your device are not affected; use Erase All Data for those.',
      'Signing out stops further syncing but does not delete data already stored on our server.',
      'Uninstalling the app removes Ante’s locally stored data from your device. It does not cancel an Ante+ subscription, and it does not delete anything already synced to an account.',
      'Managing your subscription — you can view, cancel, or request a refund for an Ante+ subscription only through your Apple App Store or Google Play account settings; Ante cannot do this for you.',
    ],
    after: [
      `If you cannot sign in and need your account deleted, email us at ${CONTACT_EMAIL} from the address on the account and we will delete it. We answer every request within 30 days.`,
    ],
  },
  {
    heading: 'Your rights in the EEA, the UK, and Switzerland',
    body: [
      'If you are in one of these regions, the GDPR — or the UK GDPR, or the Swiss FADP — gives you the right to:',
    ],
    bullets: [
      'Access the personal data we hold about you, and get a copy of it.',
      'Have inaccurate data corrected.',
      'Have your data erased.',
      'Restrict or object to our processing, including any processing we base on legitimate interests.',
      'Receive your data in a portable, machine-readable format, and have it transmitted to another controller where that is technically feasible.',
      'Withdraw consent at any time where we rely on consent, without affecting processing that already happened.',
    ],
    after: [
      `The in-app tools above already deliver access, portability, and erasure directly and immediately. For anything else, email ${CONTACT_EMAIL} and we will respond within one month. You also have the right to lodge a complaint with your local data protection supervisory authority — in the UK, the Information Commissioner’s Office at ico.org.uk — though we would ask that you give us the chance to put it right first.`,
    ],
  },
  {
    heading: 'Your rights in California and other US states',
    body: [
      'If you are a California resident, the CCPA as amended by the CPRA gives you rights over your personal information. Residents of Colorado, Connecticut, Virginia, Utah, Texas, Oregon, Montana, and other states with comprehensive privacy laws have closely comparable rights.',
      'In the twelve months before the date at the top of this policy, the categories of personal information we collected were: identifiers (your email address, username, and the pseudonymous identifiers described above); commercial information (your Ante+ subscription status); and the session and wagering records you choose to enter. We collect these for the purposes listed under "Why we process it," from you and — for subscription status — from the app stores via RevenueCat, and we retain them for the periods listed under "How long we keep your data."',
      'We do not sell personal information and we do not share it for cross-context behavioural advertising, as those terms are defined in the CCPA. We have not done so in the preceding twelve months, and we do not sell or share the personal information of minors. We do not use or disclose sensitive personal information for any purpose that would give rise to a right to limit that use.',
    ],
    bullets: [
      'You may request to know the categories and specific pieces of personal information we have collected, and the categories of third parties we disclosed it to.',
      'You may request correction of inaccurate personal information.',
      'You may request deletion of your personal information.',
      'You may exercise any of these rights through an authorised agent.',
      'We will not discriminate against you for exercising them — the app behaves identically either way.',
    ],
    after: [
      `The in-app Export Session History, Erase All Data, and Delete Account tools satisfy these requests directly and immediately, with no waiting period. You can also email ${CONTACT_EMAIL}; we verify a request by confirming it comes from the email address on the account, and we respond within 45 days.`,
    ],
  },
  {
    heading: 'Children’s privacy',
    body: [
      `Ante is intended for users ${MINIMUM_AGE} years of age and older, consistent with our Terms of Service, and you are asked to confirm your age before the app will open. Ante is not directed at children, we do not knowingly collect information from anyone under ${MINIMUM_AGE}, and we have no actual knowledge of selling or sharing the personal information of anyone under 16. If you believe someone under ${MINIMUM_AGE} has given us information, contact us at ${CONTACT_EMAIL} and we will delete it.`,
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be reflected by an updated "Last Updated" date at the top of this page, and the app will ask you to review and accept the new version before you continue using it.',
    ],
  },
  {
    heading: 'Contact',
    body: [`Questions about this policy or your data can be sent to ${CONTACT_EMAIL}.`],
  },
];

export const TERMS_SECTIONS = [
  {
    heading: '1. Agreement to Terms',
    body: [
      // OPERATOR ends in "Inc." — keep it off the end of a sentence or the
      // generated markdown renders "Inc..".
      `These Terms of Service ("Terms") are between you and ${OPERATOR}, and they govern your access to and use of the Ante mobile application ("Ante," "the app," "we," "us," or "our").`,
      'Ante asks you to accept these Terms and our Privacy Policy, and to confirm your age, before it will open. Tapping to accept is how you agree to be bound by them. If you do not agree, do not use the app. If we materially change these Terms, the app will ask you to accept the new version before you continue.',
    ],
  },
  {
    heading: '2. Eligibility',
    body: [
      `You must be at least ${MINIMUM_AGE} years old to use Ante, and you confirm that you are when you first open the app. Some jurisdictions set a higher minimum age for the gambling activity itself — 21, in much of the United States. You are responsible for meeting whichever age applies where you are, and for ensuring that your use of the app, and any underlying gambling or wagering activity you choose to track with it, complies with the laws applicable to you in your jurisdiction. We may terminate the account of anyone we believe does not meet the age requirement.`,
    ],
  },
  {
    heading: '3. What Ante is — and is not',
    body: [
      'Ante is a personal record-keeping and analytics tool. It lets you log details of gambling or wagering sessions you participate in elsewhere — at a casino, cardroom, sportsbook, or private game — and calculates statistics from what you enter.',
      'Ante does not, at any point, facilitate, process, offer, or accept any real-money wager, bet, or gambling transaction of any kind. Ante has no affiliation, partnership, sponsorship, endorsement, or integration with any casino, sportsbook, cardroom, lottery, sports league, team, or other gambling operator, and any such name that appears in the app does so only because you typed it in. Nothing in the app constitutes an offer to gamble, and no money changes hands through Ante.',
    ],
  },
  {
    heading: '4. Not financial, legal, or gambling advice',
    body: [
      'The statistics, insights, and figures Ante generates are calculated from the information you enter and are provided for informational and entertainment purposes only. They are not financial, investment, tax, legal, medical, or gambling-strategy advice, they are not a recommendation to place or to refrain from placing any wager, and they are not a prediction or guarantee of future results. No feature of Ante — including strategy grading, odds calculation, pattern detection, or the stop-loss alert — will improve your chances of winning or reduce the house edge of any game.',
      'You are solely responsible for any decision you make, gambling or otherwise, based on information Ante provides. Ante does not guarantee the accuracy, completeness, or timeliness of any calculation, and you should independently verify any figure that matters to you. In particular, Ante is not a substitute for proper tax records: do not rely on it for any tax filing without checking the underlying numbers yourself and, if it matters, taking professional advice.',
    ],
  },
  {
    heading: '5. Responsible gambling',
    body: [
      'Ante includes optional tools — a configurable stop-loss alert, and access to problem-gambling helpline resources — intended to support more mindful play. These tools are a convenience, not a safeguard. They do not prevent you from gambling, do not limit what you can wager, and are not a substitute for professional help. They may also fail to fire, for reasons ranging from a device restart to data you did not log, and you should not rely on them to tell you when to stop.',
      `If you are concerned about your own or someone else’s gambling, contact the ${HELPLINE.name} at ${HELPLINE.display} in ${HELPLINE.region}, or the appropriate resource in your country. ${OPERATOR} is not a treatment provider, counselling service, or medical resource, and nothing in the app is a clinical assessment of anyone’s gambling.`,
    ],
  },
  {
    heading: '6. Your account and data',
    body: [
      'Ante can be used without an account, in which case your data stays local to your device. You may optionally create an account to sync your data across devices; if you do, your session data is also stored on our server as described in our Privacy Policy. You are responsible for safeguarding access to your own device and account, and for everything done through your account. Ante is not responsible for data loss resulting from device loss, damage, factory reset, app uninstallation, or loss of access to your account. Keep your own copy of anything you cannot afford to lose — Profile → Data & Privacy → Export Session History will produce one.',
    ],
  },
  {
    heading: '7. Ante+ subscriptions and payments',
    body: [
      'Ante is free to download and use. Certain features are grouped into an optional paid subscription called Ante+. The price, the billing period, and any introductory offer are shown on the purchase screen before you buy, and you should read them there — they are what governs, they differ by country, and they change over time.',
    ],
    bullets: [
      'Billing. Ante+ is sold as an in-app purchase through the Apple App Store or Google Play. Payment is charged to your App Store or Google Play account when you confirm the purchase. We do not process payments directly and never receive your payment card details.',
      'Auto-renewal. Recurring Ante+ plans renew automatically at the end of each billing period at the then-current price, and your account is charged within 24 hours before the current period ends, unless you turn off auto-renewal at least 24 hours before that point. A one-time or lifetime purchase, where offered, does not renew.',
      'Managing and cancelling. You can view, manage, or cancel your subscription, and turn off auto-renewal, at any time through your Apple App Store or Google Play account settings. Cancelling stops the next renewal; it does not refund the period you are already in. Uninstalling the app does not cancel a subscription.',
      'Refunds. Purchases are handled by Apple or Google, and refund requests are decided by them under their own policies, not by us. Nothing here limits any refund, cancellation, or withdrawal right you have under the consumer law of your country — including, for consumers in the EU and the UK, the statutory right to withdraw from a distance contract within 14 days, which you exercise through the store you bought from.',
      'Price and plan changes. We may change subscription prices or the set of features included in Ante+. A price increase to an existing recurring subscription takes effect only at a renewal, after the app store has given you the advance notice its rules require and, where required, obtained your consent; you may cancel before then.',
      'Free trials and promotions. Where a free trial is offered, its length and the price that follows it are shown before you start it, and any unused portion is forfeited when you purchase a subscription. Unless stated otherwise, promotional offers are limited to one per user.',
      'What happens when Ante+ ends. If your subscription lapses or is cancelled, Ante+ features become unavailable, but the session and hand data you recorded remains and stays accessible.',
      'Subscription provider. We use RevenueCat to manage and validate subscription entitlements. See our Privacy Policy for what information RevenueCat receives.',
    ],
  },
  {
    heading: '8. Acceptable use',
    body: ['You agree not to:'],
    bullets: [
      'Reverse engineer, decompile, or attempt to extract the source code of the app beyond what applicable law expressly permits;',
      'Use the app for any unlawful purpose, including to facilitate underage or illegal gambling, or to record or organise gambling activity you conduct as a business without the licences that activity requires;',
      'Use the app on behalf of anyone who does not meet the age requirement in section 2;',
      'Attempt to interfere with, disable, or overload the app, or to access any account or data that is not yours;',
      'Copy, resell, sublicense, or redistribute the app or its content without our written permission.',
    ],
  },
  {
    heading: '9. Intellectual property',
    body: [
      `${OPERATOR} owns Ante, including its design, branding, source code, and the specific analytics methodology it uses. Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable licence to use the app for your own personal, non-commercial purposes. All rights not expressly granted are reserved.`,
      'The session records you enter remain yours. You grant us only the licence we need to store, process, and display them back to you in order to run the app — nothing broader, and it ends when you delete the data.',
      'Ante incorporates open-source software provided under licences including the MIT and Apache 2.0 licences. Those components remain the property of their respective authors and are used under those licences; the applicable notices are reproduced in full in the THIRD_PARTY_NOTICES file published with Ante’s source, and we will send you a copy on request.',
    ],
  },
  {
    heading: '10. Disclaimer of warranties',
    body: [
      'Ante is provided "as is" and "as available," without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the app will be uninterrupted, error-free, available at any particular time, or that any calculation, alert, or piece of analysis it produces will be accurate or will fire when you expect it to.',
      'Some jurisdictions do not allow the exclusion of implied warranties, and nothing in this section excludes or limits any warranty or guarantee you have under the consumer law of your country that cannot lawfully be excluded. In those places this section applies to the fullest extent that law permits, and no further.',
    ],
  },
  {
    heading: '11. Limitation of liability',
    body: [
      `To the fullest extent permitted by law, ${OPERATOR} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, loss of profits, or gambling losses, arising out of or related to your use of the app, even if advised of the possibility of such damages. Our total liability for any claim arising from your use of the app shall not exceed the greater of the amount you paid us in the twelve months preceding the claim, or twenty US dollars.`,
      'Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be excluded or limited — including, for consumers in the EU, the UK, and other jurisdictions with mandatory consumer protections, your non-excludable statutory rights. Some jurisdictions do not allow the exclusion or limitation of certain damages, so parts of this section may not apply to you.',
    ],
  },
  {
    heading: '12. Indemnification',
    body: [
      `To the extent permitted by law, you agree to indemnify and hold harmless ${OPERATOR} from any third-party claim, loss, or demand, including reasonable attorneys’ fees, arising out of your misuse of the app or your violation of these Terms or applicable law. This does not apply to anything caused by our own breach or negligence, and it does not apply where you are a consumer and the law of your country does not permit it.`,
    ],
  },
  {
    heading: '13. Apple and Google',
    body: [
      'If you downloaded Ante from the Apple App Store, the following applies, and Apple requires us to say so:',
    ],
    bullets: [
      'These Terms are between you and us alone, not with Apple, and Apple is not responsible for Ante or its content.',
      'Apple has no obligation to provide any maintenance or support for Ante.',
      'If Ante fails to conform to any applicable warranty, you may notify Apple and Apple will refund the purchase price, if any; to the maximum extent permitted by law, Apple has no other warranty obligation of any kind with respect to Ante.',
      'Apple is not responsible for addressing any claim by you or a third party relating to Ante, including product liability claims, any claim that Ante fails to conform to a legal or regulatory requirement, and claims under consumer protection or similar legislation.',
      'Apple is not responsible for investigating, defending, settling, or discharging any third-party claim that Ante infringes that party’s intellectual property rights.',
      'You represent that you are not located in a country subject to a US Government embargo or designated as a "terrorist supporting" country, and that you are not on any US Government list of prohibited or restricted parties.',
      'Apple and its subsidiaries are third-party beneficiaries of these Terms and, upon your acceptance, have the right to enforce them against you.',
    ],
    after: [
      'If you downloaded Ante from Google Play, your use is additionally subject to the Google Play Terms of Service, and Google is not a party to these Terms.',
    ],
  },
  {
    heading: '14. Changes to the app or these Terms',
    body: [
      'We may modify, suspend, or discontinue any part of the app at any time. We may also update these Terms; material changes will be reflected by an updated "Last Updated" date, and the app will ask you to accept the new version before you continue using it. If you do not accept, your remedy is to stop using the app — and you may export and delete your data first.',
    ],
  },
  {
    heading: '15. Termination',
    body: [
      'You may stop using Ante at any time, and delete your account from Profile → Account → Delete Account. We may suspend or terminate your access if we reasonably believe you have violated these Terms or the law. Except where we are legally prevented, we will give you notice and a chance to export your data first. Sections 4, 5, 9, 10, 11, 12, and 16 survive termination.',
    ],
  },
  {
    heading: '16. Governing law and disputes',
    body: [
      `These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict-of-laws principles, and you and ${OPERATOR} submit to the jurisdiction of the courts located in British Columbia, Canada.`,
      'If you are a consumer, this does not deprive you of the protection of the mandatory consumer law of the country where you live, or of any right that law gives you to bring proceedings in your local courts. Nothing here waives any right you have to bring a claim in a small-claims court.',
      'Before filing anything, please email us — most disputes are a misunderstanding about a number, and we would rather fix it.',
    ],
  },
  {
    heading: '17. Severability and entire agreement',
    body: [
      'If any provision of these Terms is found unenforceable, it will be enforced to the greatest extent permissible and the remaining provisions will remain in full force and effect. These Terms, together with the Privacy Policy, are the entire agreement between you and us about the app, and supersede any earlier version. Our failure to enforce a provision is not a waiver of it.',
    ],
  },
  {
    heading: '18. Contact',
    body: [`Questions about these Terms can be sent to ${CONTACT_EMAIL}.`],
  },
];

export const LEGAL_DOCS = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    title: 'Terms of Service',
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: TERMS_SECTIONS,
  },
};
