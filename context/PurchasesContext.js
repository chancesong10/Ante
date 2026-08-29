import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useAuth } from './AuthContext';
import {
  ANTE_PRO_ENTITLEMENT_ID,
  configurePurchases,
  isPurchasesConfigured,
  hasActiveProEntitlement,
  getStandardPackages,
  fetchCustomerInfo,
  fetchOfferings,
  restorePurchases as restorePurchasesRequest,
  identifyUser,
  resetUser,
  addCustomerInfoListener,
  isUserCancelledError,
} from '../services/purchasesService';

const PurchasesContext = createContext();

export function PurchasesProvider({ children }) {
  const { user, isLoading: authIsLoading } = useAuth();
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  const identifiedUserId = useRef(null);

  // Configure the SDK once and load the current customer/offerings state.
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    configurePurchases();
    if (!isPurchasesConfigured()) {
      setIsLoading(false);
      return;
    }

    const removeListener = addCustomerInfoListener((info) => setCustomerInfo(info));

    (async () => {
      try {
        const [info, offeringsResult] = await Promise.all([fetchCustomerInfo(), fetchOfferings()]);
        setCustomerInfo(info);
        setOfferings(offeringsResult);
      } catch (err) {
        console.error('PurchasesContext: failed to load initial purchase state', err);
      } finally {
        setIsLoading(false);
      }
    })();

    return removeListener;
  }, []);

  // Keep RevenueCat's app user id in sync with Supabase auth, so purchases
  // are attributed to the signed-in account rather than an anonymous id.
  // Waits for AuthContext to finish its own initial session lookup so a
  // cold start doesn't momentarily read `user` as null and log out a
  // customer who's actually signed in.
  useEffect(() => {
    if (!hasInitialized.current || !isPurchasesConfigured() || authIsLoading) return;

    (async () => {
      try {
        if (user?.id) {
          if (identifiedUserId.current !== user.id) {
            const info = await identifyUser(user.id);
            identifiedUserId.current = user.id;
            setCustomerInfo(info);
          }
        } else if (identifiedUserId.current) {
          const info = await resetUser();
          identifiedUserId.current = null;
          setCustomerInfo(info);
        }
      } catch (err) {
        console.error('PurchasesContext: failed to sync RevenueCat identity', err);
      }
    })();
  }, [user?.id, authIsLoading]);

  // Dev aid: whenever CustomerInfo changes, log which entitlement
  // identifiers RevenueCat actually returned so a mismatch with
  // ANTE_PRO_ENTITLEMENT_ID is obvious. Remove once the entitlement
  // wiring is confirmed.
  useEffect(() => {
    if (!__DEV__ || !customerInfo) return;
    console.log(
      'PurchasesContext: active entitlements =',
      Object.keys(customerInfo.entitlements?.active ?? {}),
      '| all entitlements =',
      Object.keys(customerInfo.entitlements?.all ?? {}),
      '| looking for =',
      ANTE_PRO_ENTITLEMENT_ID
    );
  }, [customerInfo]);

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await fetchCustomerInfo();
      setCustomerInfo(info);
      return info;
    } catch (err) {
      console.error('PurchasesContext: failed to refresh customer info', err);
      return null;
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      return { success: false, isPro: false, error: new Error('Purchases not configured') };
    }
    try {
      const info = await restorePurchasesRequest();
      setCustomerInfo(info);
      return { success: true, isPro: hasActiveProEntitlement(info) };
    } catch (err) {
      console.error('PurchasesContext: restore purchases failed', err);
      return { success: false, isPro: false, error: err };
    }
  }, []);

  // Always shows the paywall — use for an explicit "See plans" / "Upgrade"
  // entry point.
  const presentPaywall = useCallback(async (offering) => {
    if (!isPurchasesConfigured()) return PAYWALL_RESULT.NOT_PRESENTED;
    try {
      const result = await RevenueCatUI.presentPaywall({
        displayCloseButton: true,
        ...(offering ? { offering } : {}),
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshCustomerInfo();
      }
      return result;
    } catch (err) {
      if (!isUserCancelledError(err)) {
        console.error('PurchasesContext: failed to present paywall', err);
      }
      return PAYWALL_RESULT.ERROR;
    }
  }, [refreshCustomerInfo]);

  // Only shows the paywall if the user doesn't already have ante_pro — use
  // this to gate a feature at the point of use.
  const presentPaywallIfNeeded = useCallback(async (offering) => {
    if (!isPurchasesConfigured()) return PAYWALL_RESULT.NOT_PRESENTED;
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ANTE_PRO_ENTITLEMENT_ID,
        displayCloseButton: true,
        ...(offering ? { offering } : {}),
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshCustomerInfo();
      }
      return result;
    } catch (err) {
      if (!isUserCancelledError(err)) {
        console.error('PurchasesContext: failed to present paywall', err);
      }
      return PAYWALL_RESULT.ERROR;
    }
  }, [refreshCustomerInfo]);

  const presentCustomerCenter = useCallback(async () => {
    if (!isPurchasesConfigured()) return;
    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: ({ customerInfo: info }) => setCustomerInfo(info),
        },
      });
      // Cancellations, refund requests, and plan changes made inside the
      // Customer Center don't all fire onRestoreCompleted, so refetch on
      // close to make sure `isPro` reflects whatever the user just did.
      await refreshCustomerInfo();
    } catch (err) {
      console.error('PurchasesContext: failed to present customer center', err);
    }
  }, [refreshCustomerInfo]);

  const isPro = hasActiveProEntitlement(customerInfo);
  const packages = useMemo(() => getStandardPackages(offerings?.current), [offerings]);

  const value = useMemo(
    () => ({
      customerInfo,
      offerings,
      packages,
      isPro,
      isLoading,
      refreshCustomerInfo,
      restorePurchases,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    }),
    [
      customerInfo,
      offerings,
      packages,
      isPro,
      isLoading,
      refreshCustomerInfo,
      restorePurchases,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    ]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases() {
  const context = useContext(PurchasesContext);
  if (!context) {
    throw new Error('usePurchases must be used within a PurchasesProvider');
  }
  return context;
}
