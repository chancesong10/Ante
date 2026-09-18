import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { createClient } from '@supabase/supabase-js';

// expo-secure-store caps values at ~2048 bytes, too small for a Supabase
// session (access + refresh token + user object). So the session itself
// stays in AsyncStorage, but encrypted with an AES-256 key that lives only
// in SecureStore (iOS Keychain / Android Keystore) — a stolen AsyncStorage
// blob is useless without that key.
class LargeSecureStore {
  // Returns the ciphertext and the key that encrypted it without writing
  // either. setItem persists the ciphertext first and the key second, so a
  // process death mid-write leaves a blob whose key is still the previous
  // one — which fails the JSON check below and is discarded cleanly. Writing
  // the key first would instead pair a fresh key with stale ciphertext and
  // hand the SDK plausible-looking garbage.
  async _encrypt(value) {
    const encryptionKey = aesjs.utils.hex.fromBytes(await Crypto.getRandomBytesAsync(32));
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKey),
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    return { encryptionKey, ciphertext: aesjs.utils.hex.fromBytes(encryptedBytes) };
  }

  // CTR decryption never throws on a wrong key — it XORs whatever it is
  // given and returns bytes. The only way to know the key matched is to
  // check the result is still the JSON that was stored. Anything else is
  // dropped, turning corruption into a clean re-login rather than a parse
  // throw inside the Supabase SDK on every launch.
  async _decrypt(key, value) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    try {
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(encryptionKeyHex),
        new aesjs.Counter(1)
      );
      const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
      const decrypted = aesjs.utils.utf8.fromBytes(decryptedBytes);
      JSON.parse(decrypted);
      return decrypted;
    } catch {
      await this.removeItem(key);
      return null;
    }
  }

  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this._decrypt(key, encrypted);
  }

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key, value) {
    const { encryptionKey, ciphertext } = await this._encrypt(value);
    await AsyncStorage.setItem(key, ciphertext);
    await SecureStore.setItemAsync(key, encryptionKey);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// RN doesn't pause JS timers on backgrounding the way a browser tab does,
// so auto-refresh has to be driven explicitly off app state.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
