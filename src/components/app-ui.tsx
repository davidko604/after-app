import type { PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardShadow, maxContentWidth, palette, radii, spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
  scrollable?: boolean;
}>;

export function Screen({ children, contentContainerStyle, scrollable = true }: ScreenProps) {
  const content = <View style={[styles.content, contentContainerStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Heading({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function Body({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ActionButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID: string;
  variant?: 'primary' | 'secondary';
};

export function ActionButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  testID,
  variant = 'primary',
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.actionButtonDisabled,
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.secondaryPressed),
      ]}
      testID={testID}>
      <Text style={variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusPill({
  children,
  tone = 'sage',
}: PropsWithChildren<{ tone?: 'sage' | 'peach' }>) {
  return (
    <View style={[styles.pill, tone === 'sage' ? styles.sagePill : styles.peachPill]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ body, icon, title }: { body: string; icon: ReactNode; title: string }) {
  return (
    <Card style={styles.emptyCard}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Body style={styles.emptyBody}>{body}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  body: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    ...cardShadow,
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: spacing.lg,
    maxWidth: maxContentWidth,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    width: '100%',
  },
  emptyBody: {
    maxWidth: 410,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '800',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  eyebrow: {
    color: palette.forest,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heading: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 42,
  },
  peachPill: {
    backgroundColor: palette.peachSoft,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: palette.forest,
  },
  primaryLabel: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryPressed: {
    backgroundColor: palette.forestPressed,
  },
  safeArea: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  sagePill: {
    backgroundColor: palette.sage,
  },
  scrollContent: {
    flexGrow: 1,
  },
  secondaryButton: {
    backgroundColor: palette.card,
    borderColor: palette.forest,
    borderWidth: 1.5,
  },
  secondaryLabel: {
    color: palette.forest,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryPressed: {
    backgroundColor: palette.sage,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
});
