import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ navigation }) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Without this, Android hardware back on this screen falls through to
  // whatever BackHandler listener is still registered on a screen mounted
  // underneath it in the stack (e.g. an in-progress Poker/Blackjack session
  // reached via an Insights sign-in gate) — silently discarding that
  // session instead of just closing this screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const resetFeedback = () => {
    setError('');
    setMessage('');
  };

  const handleSubmit = async () => {
    resetFeedback();
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signUp') {
        await signUpWithEmail(email.trim(), password, username.trim() || undefined);
        setMessage('Account created — check your email to confirm before signing in.');
      } else {
        await signInWithEmail(email.trim(), password);
        navigation.goBack();
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    resetFeedback();
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigation.goBack();
    } catch (err) {
      setError(err?.message || 'Google sign-in failed. Try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    resetFeedback();
    if (!email.trim()) {
      setError('Enter your email above first, then tap "Forgot password?"');
      return;
    }
    try {
      await resetPassword(email.trim());
      setMessage('Password reset email sent — check your inbox.');
    } catch (err) {
      setError(err?.message || 'Could not send reset email.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === 'signUp' ? 'Create Account' : 'Sign In'}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={TOUCH_TARGET.hitSlop}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            {mode === 'signUp'
              ? 'Sync your session history across devices and unlock Insights.'
              : 'Welcome back. Sign in to sync and unlock Insights.'}
          </Text>

          <TouchableOpacity
            style={[styles.googleButton, SHADOWS.card]}
            activeOpacity={0.85}
            onPress={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color={COLORS.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === 'signUp' && (
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Ante Highroller"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {mode === 'signIn' && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!message && <Text style={styles.messageText}>{message}</Text>}

          <TouchableOpacity
            style={styles.submitButton}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textDark} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'signUp' ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              resetFeedback();
              setMode(mode === 'signUp' ? 'signIn' : 'signUp');
            }}
            style={styles.switchModeButton}
          >
            <Text style={styles.switchModeText}>
              {mode === 'signUp'
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: fluidFont(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.xl,
  },
  subtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(19),
    marginBottom: SPACING.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: moderateScale(13),
    marginBottom: SPACING.md,
  },
  googleButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.cardBorder,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: fluidFont(11),
    fontWeight: '700',
    marginHorizontal: SPACING.sm,
    letterSpacing: 0.5,
  },
  inputBlock: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(12),
    color: COLORS.textPrimary,
    fontSize: fluidFont(15),
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.md,
  },
  forgotLinkText: {
    color: COLORS.accentCyan,
    fontSize: fluidFont(12),
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: fluidFont(12),
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  messageText: {
    color: COLORS.success,
    fontSize: fluidFont(12),
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  submitButtonText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(15),
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  switchModeText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(13),
    fontWeight: '600',
  },
});
