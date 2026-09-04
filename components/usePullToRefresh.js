import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { COLORS } from '../constants/theme';
import { useCloudRefresh } from '../context/SyncContext';

// Pull-to-refresh for the history-backed screens.
//
// Returns `null` when there's nothing to refresh — signed out, the data is
// already the only copy that exists, and a spinner that pulls from nowhere is
// a lie. Screens spread the result onto their ScrollView/FlatList, so the
// gesture simply isn't attached in that case.
export default function usePullToRefresh() {
  const refresh = useCloudRefresh();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!refresh) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  if (!refresh) return null;

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.textSecondary}
      colors={[COLORS.primary]}
      progressBackgroundColor={COLORS.card}
    />
  );
}
