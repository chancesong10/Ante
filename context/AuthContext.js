import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

const redirectTo = Linking.createURL('');

async function exchangeCodeFromUrl(url) {
  if (!url) return null;
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (!code) return null;
  try {
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    return data ?? null;
  } catch (err) {
    // A code can arrive twice (once via openAuthSessionAsync's return value,
    // once via the OS-level deep link event) — the second exchange is
    // expected to fail since codes are single-use. Anything else is logged.
    if (!/code verifier|invalid request|already/i.test(err?.message || '')) {
      console.error('AuthContext: failed to exchange code for session', err);
    }
    return null;
  }
}

// Supabase sets both timestamps to the moment the account row is created;
// last_sign_in_at only starts diverging from created_at on the *next*
// login. A wide-ish threshold absorbs the network/redirect round-trip time
// of the OAuth flow itself without misclassifying a real second login.
const NEW_USER_WINDOW_MS = 15000;
function isNewAuthUser(user) {
  if (!user?.created_at || !user?.last_sign_in_at) return false;
  return Math.abs(new Date(user.last_sign_in_at) - new Date(user.created_at)) < NEW_USER_WINDOW_MS;
}

// The OAuth code that comes back from the Google flow gets exchanged twice —
// once from signInWithGoogle's own return value, once from the separate
// deep-link listener above that exists to catch email-confirmation links.
// Codes are single-use, so exactly one of those two exchange calls actually
// saves the session; the other fails harmlessly. That means whichever call
// signInWithGoogle itself makes can be the *loser* of that race, in which
// case trusting its own return value for isNewUser would silently and
// incorrectly report false every time it loses. Subscribing directly at the
// SDK level instead catches the SIGNED_IN event regardless of which of the
// two calls actually won.
function waitForNextSignIn(timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (settled || event !== 'SIGNED_IN' || !newSession?.user) return;
      settled = true;
      sub.subscription.unsubscribe();
      resolve(newSession.user);
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('AuthContext: failed to load profile', error);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      setIsLoading(false);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    // Catches the email-confirmation deep link (app cold-launched or
    // resumed from a tapped email link, outside the Google browser-session flow).
    Linking.getInitialURL().then(exchangeCodeFromUrl);
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      exchangeCodeFromUrl(url);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      linkingSubscription?.remove();
    };
  }, [fetchProfile]);

  const signInWithEmail = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email, password, username) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;

    // Subscribed before the exchange races start, so it can't miss the
    // SIGNED_IN event no matter which of the two exchange calls wins it.
    const signedInUserPromise = waitForNextSignIn();

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      await exchangeCodeFromUrl(result.url);
    }

    const signedInUser = await signedInUserPromise;
    return { isNewUser: isNewAuthUser(signedInUser) };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  // Supabase's updateUser({ password }) does NOT check the old password — a
  // valid session is all it asks for. That means an unlocked phone is enough
  // to take over the account, so the two functions below add the proof of
  // identity that Supabase leaves to the app.

  // Email/password accounts: re-authenticate with the current password
  // first. signInWithPassword against the same account is the supported way
  // to verify it; it refreshes the session, which is harmless here since the
  // user id doesn't change.
  const updatePasswordWithCurrent = useCallback(
    async (currentPassword, newPassword) => {
      const email = session?.user?.email;
      if (!email) throw new Error('You need to be signed in to change your password.');

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) throw new Error('That current password is not correct.');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    [session]
  );

  // Google accounts have no password to check, so identity is proved by a
  // one-time code Supabase emails to the address on the account.
  const sendPasswordChangeCode = useCallback(async () => {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
  }, []);

  const updatePasswordWithCode = useCallback(async (code, newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      nonce: code.trim(),
    });
    if (error) throw error;
  }, []);

  const updateUsername = useCallback(async (newUsername) => {
    if (!session?.user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, username: newUsername } : prev));
  }, [session]);

  // Whether this account can sign in with a password at all. A Google-only
  // account has no current password to verify, so it takes the emailed-code
  // route instead.
  const hasPasswordLogin = useMemo(
    () => (session?.user?.identities ?? []).some((i) => i.provider === 'email'),
    [session]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      hasPasswordLogin,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePasswordWithCurrent,
      sendPasswordChangeCode,
      updatePasswordWithCode,
      updateUsername,
    }),
    [
      session,
      profile,
      isLoading,
      hasPasswordLogin,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePasswordWithCurrent,
      sendPasswordChangeCode,
      updatePasswordWithCode,
      updateUsername,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
