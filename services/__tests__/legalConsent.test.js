// The consent record is what makes Ante's Terms enforceable rather than a
// browsewrap nobody agreed to, so the two behaviours it depends on are worth
// pinning down: a stored acceptance has to survive "Erase All Data", and a
// version bump has to re-prompt.
//
// storageService is exercised for real here against a fake AsyncStorage —
// mocking it would only test the mock.

const mockStore = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k);
  }),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((k) => mockStore.delete(k));
  }),
}));

import {
  loadLegalConsent,
  saveLegalConsent,
  clearAllAppData,
  saveSessionHistory,
  loadSessionHistory,
} from '../storageService';
import { LEGAL_VERSION, LEGAL_LAST_UPDATED, MINIMUM_AGE } from '../../constants/legal';

const record = {
  version: LEGAL_VERSION,
  acceptedAt: '2026-09-20T12:00:00.000Z',
  ageConfirmed: true,
  minimumAge: MINIMUM_AGE,
};

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('legal consent storage', () => {
  it('round-trips an acceptance', async () => {
    expect(await loadLegalConsent()).toBeNull();
    await saveLegalConsent(record);
    expect(await loadLegalConsent()).toEqual(record);
  });

  it('survives Erase All Data', async () => {
    // Erasing sessions is not a withdrawal of consent, and losing the record
    // would destroy the only evidence the gate was ever answered.
    await saveLegalConsent(record);
    await saveSessionHistory([{ id: 'a' }]);

    await clearAllAppData();

    expect(await loadSessionHistory()).toEqual([]);
    expect(await loadLegalConsent()).toEqual(record);
  });

  it('treats a stale version as not accepted, so the gate re-prompts', async () => {
    await saveLegalConsent({ ...record, version: '2020-01-01' });
    const stored = await loadLegalConsent();
    expect(stored).not.toBeNull();
    // This is the comparison LegalConsentGate makes.
    expect(stored.version === LEGAL_VERSION).toBe(false);
  });

  it('treats a non-object blob as no consent at all', async () => {
    // An array or a bare string carries no version, and `undefined ===
    // LEGAL_VERSION` is false anyway — but only if the read doesn't throw
    // first. Re-prompting is the safe failure here.
    for (const junk of ['null', '"yes"', '[1,2,3]', 'not json at all']) {
      mockStore.set('ante:legalConsent', junk);
      expect(await loadLegalConsent()).toBeNull();
    }
  });
});

describe('legal constants', () => {
  it('keeps the machine-readable version and the displayed date in agreement', () => {
    // LEGAL_VERSION is an ISO date; the displayed string must name the same
    // day, or users accept "September 20" while we record a different one.
    const iso = new Date(`${LEGAL_VERSION}T00:00:00Z`);
    const shown = new Date(`${LEGAL_LAST_UPDATED} UTC`);
    expect(shown.getTime()).toBe(iso.getTime());
  });
});
