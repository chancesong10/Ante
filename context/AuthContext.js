import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

const redirectTo = Linking.createURL('');

async function exchangeCodeFromUrl(url) {
  if (!url) return;
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (!code) return;
  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch (err) {
    // A code can arrive twice (once via openAuthSessionAsync's return value,
    // once via the OS-level deep link event) — the second exchange is
    // expected to fail since codes are single-use. Anything else is logged.
    if (!/code verifier|invalid request|already/i.test(err?.message || '')) {
      console.error('AuthContext: failed to exchange code for session', err);
    }
  }
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

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      await exchangeCodeFromUrl(result.url);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
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

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      updateUsername,
    }),
    [
      session,
      profile,
      isLoading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
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
