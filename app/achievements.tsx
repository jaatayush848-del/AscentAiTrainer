/**
 * Achievements screen — every milestone, how close you are, and what is left.
 *
 * Locked ones still show a progress bar, because "you are 6 sets away" pulls
 * far harder than a padlock. Everything here is derived from recorded data.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, GlowCard, Pill, Progress } from '@/components/ui';
import { colors, font, glow, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import {
  ACHIEVEMENTS,
  AchievementContext,
  TIER_COLOR,
  totalMinutes,
  totalSets,
  totalVolumeKg,
} from '@/lib/achievements';

type Filter = 'all' | 'unlocked' | 'locked';

const TIER_ORDER = { mythic: 0, gold: 1, silver: 2, bronze: 3 } as const;

export default function AchievementsScreen() {
  const { sessions, quests, bodyLogs, photos, program, level, streak, bestStreak, achievements } =
    useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const unlockedIds = useMemo(() => new Set(achievements.map((a) => a.id)), [achievements]);

  const ctx: AchievementContext = useMemo(
    () => ({
      sessions,
      streak,
      bestStreak,
      quests,
      bodyLogs,
      photos,
      program,
      level: level.level,
    }),
    [sessions, streak, bestStreak, quests, bodyLogs, photos, program, level.level],
  );

  const rows = useMemo(() => {
    return ACHIEVEMENTS.map((def) => ({
      def,
      unlocked: unlockedIds.has(def.id),
      pct: Math.max(0, Math.min(1, def.progress(ctx))),
      at: achievements.find((a) => a.id === def.id)?.at,
    })).sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      const t = TIER_ORDER[a.def.tier] - TIER_ORDER[b.def.tier];
      if (t !== 0) return t;
      return b.pct - a.pct;
    });
  }, [ctx, unlockedIds, achievements]);

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'unlocked' ? r.unlocked : !r.unlocked,
  );

  const unlockedCount = rows.filter((r) => r.unlocked).length;
  const totalXp = rows.filter((r) => r.unlocked).reduce((n, r) => n + r.def.xp, 0);
  const availableXp = rows.filter((r) => !r.unlocked).reduce((n, r) => n + r.def.xp, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GlowCard color={colors.gold}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={font.small}>ACHIEVEMENTS</Text>
            <Text style={[font.h1, { marginTop: 2 }]}>
              {unlockedCount}
              <Text style={[font.h3, { color: colors.textDim }]}> / {rows.length}</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[font.h3, { color: colors.gold }]}>{totalXp.toLocaleString()} XP</Text>
            <Text style={font.small}>earned</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Progress value={rows.length ? unlockedCount / rows.length : 0} color={colors.gold} />
          <Text style={[font.small, { marginTop: 8 }]}>
            {availableXp.toLocaleString()} XP still on the table
          </Text>
        </View>
      </GlowCard>

      {/* lifetime stats */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={font.h3}>Lifetime</Text>
        <View style={styles.statGrid}>
          <MiniStat icon="dumbbell" value={String(sessions.length)} label="sessions" />
          <MiniStat icon="check-all" value={String(totalSets(sessions))} label="sets" />
          <MiniStat
            icon="weight-lifter"
            value={`${(totalVolumeKg(sessions) / 1000).toFixed(1)}t`}
            label="volume"
          />
          <MiniStat icon="timer-outline" value={String(totalMinutes(sessions))} label="minutes" />
          <MiniStat icon="fire" value={`${bestStreak}d`} label="best streak" />
          <MiniStat icon="image-multiple-outline" value={String(photos.length)} label="posters" />
        </View>
      </Card>

      {/* filter */}
      <View style={styles.filterRow}>
        {(['all', 'unlocked', 'locked'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text
              style={[
                styles.filterLabel,
                filter === f && { color: colors.bg, fontWeight: '800' },
              ]}
            >
              {f === 'all' ? 'All' : f === 'unlocked' ? 'Unlocked' : 'Locked'}
            </Text>
          </Pressable>
        ))}
      </View>

      {visible.map(({ def, unlocked, pct, at }) => {
        const tint = TIER_COLOR[def.tier];
        return (
          <View
            key={def.id}
            style={[
              styles.row,
              unlocked && { borderColor: tint, backgroundColor: colors.cardAlt },
            ]}
          >
            <View
              style={[
                styles.icon,
                { borderColor: unlocked ? tint : colors.border },
                unlocked && glow(tint, 10),
              ]}
            >
              <MaterialCommunityIcons
                name={def.icon as any}
                size={22}
                color={unlocked ? tint : colors.textFaint}
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.titleRow}>
                <Text style={[font.body, { flex: 1 }, !unlocked && { color: colors.textDim }]}>
                  {def.title}
                </Text>
                {unlocked && <Pill label={def.tier.toUpperCase()} color={tint} />}
              </View>
              <Text style={font.small}>{def.description}</Text>
              {unlocked ? (
                <Text style={[font.small, { color: tint, marginTop: 4 }]}>
                  +{def.xp} XP{at ? ` · ${new Date(at).toLocaleDateString()}` : ''}
                </Text>
              ) : (
                <View style={{ marginTop: 6 }}>
                  <Progress value={pct} color={tint} />
                  <Text style={[font.small, { marginTop: 4 }]}>
                    {Math.round(pct * 100)}% · +{def.xp} XP when unlocked
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {visible.length === 0 && (
        <Text style={[font.dim, { textAlign: 'center', marginTop: spacing.xl }]}>
          Nothing here yet. Train, log and come back.
        </Text>
      )}
    </ScrollView>
  );
}

function MiniStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.accent} />
      <Text style={[font.h3, { fontSize: 17, marginTop: 4 }]}>{value}</Text>
      <Text style={[font.small, { fontSize: 10 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  miniStat: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterLabel: { color: colors.textDim, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});