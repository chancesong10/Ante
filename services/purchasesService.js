import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// The one entitlement that gates every Pro feature in the app. Must match
// the entitlement *identifier* in the RevenueCat dashboard exactly, and be
// attached there to all three products (monthly / annual / lifetime).
export const ANTE_PRO_ENTITLEMENT_ID = 'Ante+';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

let hasConfigured = false;

// Idempotent by design — safe to call from more than one place (e.g. a
// fast-refresh remount during dev) without double-initializing the native SDK.
export function configurePurchases(appUserID) {
  if (hasConfigured) return;
  if (!REVENUECAT_API_KEY) {
    console.warn(
      'purchasesService: EXPO_PUBLIC_REVENUECAT_API_KEY is not set — RevenueCat will not be configured, Pro will stay locked.'
    );
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
  }

  Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID: appUserID || null,
  });
  hasConfigured = true;
}

export function isPurchasesConfigured() {
  return hasConfigured;
}

// True if the given CustomerInfo carries an active Pro entitlement,
// regardless of which of the three products (lifetime/yearly/monthly)
// unlocked it.
export function hasActiveProEntitlement(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[ANTE_PRO_ENTITLEMENT_ID];
}

// Picks the lifetime/yearly/monthly packages off an Offering using
// RevenueCat's predefined package identifiers ($rc_lifetime, $rc_annual,
// $rc_monthly). Configure the products in the dashboard using those
// package types so this mapping works without any product-id string
// matching on our end.
export function getStandardPackages(offering) {
  if (!offering) return { lifetime: null, yearly: null, monthly: null };
  return {
    lifetime: offering.lifetime ?? null,
    yearly: offering.annual ?? null,
    monthly: offering.monthly ?? null,
  };
}

export async function fetchCustomerInfo() {
  return Purchases.getCustomerInfo();
}

export async function fetchOfferings() {
  return Purchases.getOfferings();
}

export async function restorePurchases() {
  return Purchases.restorePurchases();
}

// Links the RevenueCat app user id to our Supabase user id so purchases
// made while signed in are tied to that account instead of an anonymous
// per-device id. Safe to call repeatedly; RevenueCat treats logIn with the
// same id as a no-op fetch of current CustomerInfo.
export async function identifyUser(userId) {
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

// Reverts RevenueCat to a new anonymous id. Call this on sign-out so a
// subsequent sign-in (possibly as a different account on a shared device)
// doesn't inherit the previous user's purchase state.
export async function resetUser() {
  return Purchases.logOut();
}

export function addCustomerInfoListener(listener) {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

// Whether a purchase/restore error was the user backing out, vs. a real
// failure worth surfacing (network, billing unavailable, etc).
export function isUserCancelledError(error) {
  return !!error?.userCancelled;
}
