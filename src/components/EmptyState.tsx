import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, font, spacing } from '../lib/theme';

export function EmptyState({
  icon = 'ghost-outline',
  title,
  body,
  children,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name={icon} size={46} color={colors.textFaint} />
      <Text style={[font.h3, { marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {!!body && (
        <Text style={[font.dim, { marginTop: 6, textAlign: 'center', lineHeight: 20 }]}>{body}</Text>
      )}
      {children ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
