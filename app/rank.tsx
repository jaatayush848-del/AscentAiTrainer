/**
 * Rank screen — the progression ladder.
 *
 * Shows the full E → Elite progression, where the user currently stands, how
 * much XP is left to the next rank, and what each rank unlocks. Purely derived
 * from the local level state, so it works offline.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, GlowCard, Pill, Progress } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { RANKS, xpForLevel } from '@/lib/gamification';

/** Total XP a level requires, counting every level from 1. */
function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let i = 1; i < level; i += 1) sum += xpForLevel(i);
  return sum;
}

/** A one-line flavour note per rank, to give the ladder a sense of scale. */
const RANK_BLURB: Record<string, string> = {
  E: 'The start. Everyone begins here.',
  D: 'Consistent. The habits are forming.',
  C: 'Trained. People notice the change.',
  B: 'Strong. Your baseline is someone else\'s goal.',
  A: 'Elite. Diet, sleep and training all dialled in.',
  S: 'Master. Years of compounded work.',
  Contender: 'Elite-level. Top fraction of a percent.',
  Elite: 'The ceiling. There is nothing left to unlock.',
};

const RANK_COLOR: Record<string, string> = {
  E: '#7d879c',
  D: colors.success,
  C: colors.accent,
  B: colors.purple,
  A: colors.gold,
  S: '#ff9d3f',
  Contender: '#ff5470',
  Elite: '#ffffff',
};

export default function RankScreen() {
  const { level, sessions, streak } = useApp();

  const currentIndex = useMemo(
    () => Math.max(0, RANKS.map((r) => r.rank).indexOf(level.rank)),
    [level.rank],
  );

  const next = RANKS[currentIndex + 1];

  /** XP still needed before the next rank's minimum level is reached. */
  const xpToNextRank = useMemo(() => {
    if (!next) return 0;
    const earned = totalXpForLevel(level.level) + level.xp;
    const needed = totalXpForLevel(next.minLevel);
    return Math.max(0, needed - earned);
  }, [next, level]);

  /** Progress between the current rank floor and the next rank floor. */
  const rankSpanProgress = useMemo(() => {
    if (!next) return 1;
    const floor = totalXpForLevel(RANKS[currentIndex].minLevel);
    const ceiling = totalXpForLevel(next.minLevel);
    const earned = totalXpForLevel(level.level) + level.xp;
    if (ceiling <= floor) return 1;
    return Math.max(0, Math.min(1, (earned - floor) / (ceiling - floor)));
  }, [currentIndex, level, next]);

  const current = RANKS[currentIndex];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
    >
      {/* current standing */}
      <GlowCard color={RANK_COLOR[level.rank]}>
        <View style={styles.headRow}>
          <View style={[styles.bigBadge, { borderColor: RANK_COLOR[level.rank] }]}>
            <Text style={[styles.bigRank, { color: RANK_COLOR[level.rank] }]}>
              {level.rank}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text style={font.small}>CURRENT RANK</Text>
            <Text style={font.h2}>{level.rank}-Rank</Text>
            <Text style={[font.small, { marginTop: 4 }]}>
              Level {level.level} · {level.xp} / {xpForLevel(level.level)} XP
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Progress value={rankSpanProgress} color={RANK_COLOR[level.rank]} />
          <View style={styles.legendRow}>
            <Text style={font.small}>Rank {current.rank}</Text>
            <Text style={font.small}>
              {next ? `Rank ${next.rank} · ${xpToNextRank} XP away` : 'Max rank'}
            </Text>
          </View>
        </View>

        <Text style={[font.dim, { marginTop: spacing.md, lineHeight: 20 }]}>
          {RANK_BLURB[level.rank] ?? ''}
        </Text>

        <View style={styles.statRow}>
          <Stat label="Workouts" value={String(sessions.length)} />
          <Stat label="Streak" value={`${streak}d`} />
          <Stat label="Ranks up" value={String(currentIndex)} />
        </View>
      </GlowCard>

      {/* ladder */}
      <Text style={font.h3}>The ladder</Text>

      {RANKS.map((r, i) => {
        const reached = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const color = RANK_COLOR[r.rank] ?? colors.accent;
        const xpGate = totalXpForLevel(r.minLevel);
        return (
          <Card
            key={r.rank}
            style={[
              styles.rankCard,
              reached && { borderColor: color },
              isCurrent && { backgroundColor: colors.cardAlt },
            ]}
          >
            <View style={[styles.miniBadge, { borderColor: reached ? color : colors.border }]}>
              <Text style={[styles.miniRank, { color: reached ? color : colors.textFaint }]}>
                {r.rank}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.titleRow}>
                <Text style={[font.h3, !reached && { color: colors.textDim }]}>
                  {r.rank} Rank
                </Text>
                {isCurrent && <Pill label="YOU ARE HERE" color={color} />}
              </View>
              <Text style={[font.small, { marginTop: 2 }]}>
                Unlocks at level {r.minLevel}
              </Text>
              {reached ? (
                <Text style={[font.dim, { marginTop: 6, lineHeight: 19, fontSize: 13 }]}>
                  {RANK_BLURB[r.rank]}
                </Text>
              ) : (
                <Text style={[font.small, { marginTop: 6 }]}>
                  {Math.max(0, xpGate - (totalXpForLevel(level.level) + level.xp)).toLocaleString()}{' '}
                  XP remaining — roughly{' '}
                  {Math.max(
                    1,
                    Math.ceil(
                      (xpGate - (totalXpForLevel(level.level) + level.xp)) / 220,
                    ),
                  )}{' '}
                  sessions
                </Text>
              )}
            </View>
            <MaterialCommunityIcons
              name={reached ? 'check-decagram' : 'lock-outline'}
              size={20}
              color={reached ? color : colors.textFaint}
            />
          </Card>
        );
      })}

      <Text style={[font.small, { lineHeight: 18 }]}>
        XP comes from finished workouts (base + one point per completed set, plus a long-session
        bonus) and from daily quests. Nothing here is a purchase — ranks are earned only by
        training.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[font.h3, { fontSize: 19 }]}>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center' },
  bigBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  bigRank: { fontSize: 30, fontWeight: '900' },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  miniBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  miniRank: { fontSize: 17, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
