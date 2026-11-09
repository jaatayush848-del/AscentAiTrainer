/**
 * The transformation poster, rendered with plain React Native views.
 *
 * The AI illustration is optional (the images endpoint may not be enabled on
 * every account), so this is the guaranteed visual: it is built only from the
 * user's real numbers and needs no network, no SVG renderer and no extra
 * dependency. It mirrors `buildPosterSvg()` in src/lib/progressImage.ts, which
 * stays available for high-resolution export and sharing.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import type { PosterStats } from '@/lib/progressImage';

export function PosterCard({ stats, compact = false }: { stats: PosterStats; compact?: boolean }) {
  const lost = stats.startWeightKg - stats.currentWeightKg;
  const progress = Math.max(0, Math.min(1, stats.dayNumber / Math.max(1, stats.totalDays)));

  return (
    <View style={[styles.card, compact && styles.compact]}>
        <Text style={styles.eyebrow}>ASCENT · TRANSFORMATION</Text>
      <Text style={styles.name} numberOfLines={1}>
        {stats.name}
      </Text>
      <Text style={styles.day}>
        Day {stats.dayNumber} of {stats.totalDays}
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <View style={styles.tileRow}>
        <Tile label="WEIGHT" value={`${stats.currentWeightKg.toFixed(1)}`} unit="kg">
          <Text style={styles.delta}>
            {lost >= 0 ? '−' : '+'}
            {Math.abs(lost).toFixed(1)} kg
          </Text>
        </Tile>
        <Tile label="RANK" value={stats.rank} valueColor={colors.gold} />
        <Tile label="STREAK" value={String(stats.streak)} unit="d" valueColor={colors.accent} />
      </View>

      {!compact && (
        <View style={styles.aiBox}>
          <Text style={styles.aiTag}>AI COACH · SCORE {stats.score}/100</Text>
          <Text style={styles.headline}>{stats.headline}</Text>
          <Text style={styles.encouragement}>{stats.encouragement}</Text>
        </View>
      )}

      <Text style={styles.footer}>
          Target {stats.targetWeightKg.toFixed(1)} kg · Level {stats.level} · Made with Ascent
      </Text>
    </View>
  );
}

function Tile({
  label,
  value,
  unit,
  valueColor = colors.text,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: valueColor }]} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0b1024',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  compact: { padding: spacing.md },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 6 },
  day: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  fill: { height: 8, backgroundColor: colors.accent },
  tileRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    minHeight: 76,
    justifyContent: 'center',
  },
  tileLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  tileValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  tileUnit: { fontSize: 13, fontWeight: '600' },
  delta: { color: colors.success, fontSize: 12, marginTop: 2, fontWeight: '700' },
  aiBox: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    padding: spacing.md,
  },
  aiTag: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  headline: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 6, lineHeight: 25 },
  encouragement: { color: colors.textDim, fontSize: 13, marginTop: 8, lineHeight: 19 },
  footer: { color: colors.textFaint, fontSize: 11, marginTop: spacing.md },
});
