const STORAGE_KEY = 'chat:accessibility';

export const DEFAULT_ACCESSIBILITY_PREFERENCES = {
  fontScale: 100,
  reducedMotion: false,
  highContrast: false,
  underlineLinks: false,
};

const normalizePreferences = (value = {}) => ({
  fontScale: Math.min(125, Math.max(85, Number(value.fontScale) || 100)),
  reducedMotion: Boolean(value.reducedMotion),
  highContrast: Boolean(value.highContrast),
  underlineLinks: Boolean(value.underlineLinks),
});

export function readAccessibilityPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return normalizePreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...saved });
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

export function applyAccessibilityPreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  const root = document.documentElement;
  root.style.fontSize = `${normalized.fontScale}%`;
  root.dataset.reducedMotion = String(normalized.reducedMotion);
  root.dataset.contrast = normalized.highContrast ? 'high' : 'normal';
  root.dataset.underlineLinks = String(normalized.underlineLinks);
  return normalized;
}

export function saveAccessibilityPreferences(preferences) {
  const normalized = applyAccessibilityPreferences(preferences);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
