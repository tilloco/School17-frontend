export const colors = {
  primary: '#1E3A5F',       // deep navy — more official/authoritative than generic blue
  primaryDark: '#14293F',
  primaryLight: '#2E5484',
  accent: '#D4A72C',        // warm gold — justice/achievement, makes CTAs and streak pop
  accentDark: '#B8890F',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#F59E0B',
  background: '#F7F5F0',    // warm off-white instead of cold slate — softer, less clinical
  surface: '#FFFFFF',
  border: '#E7E2D8',
  text: '#1A1A2E',
  textMuted: '#6B7280',
  hero: '#1E3A5F',
  heroText: '#FFFFFF',
  white: '#FFFFFF',
};

export const gradients = {
  hero: ['#1E3A5F', '#14293F'] as const,
  mockCard: ['#1E3A5F', '#2E5484'] as const,
  streak: ['#D4A72C', '#B8890F'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 18, xl: 24 };

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};