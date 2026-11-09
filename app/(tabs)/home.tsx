/**
 * Home / command center.
 * Shows the AI's motivational line, the player card (rank + level + XP), today's
 * workout, daily quests and quick links to the coach and progress images.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Pill, Progress } from '@/components/ui';
import { colors, font, glow, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { motivate } from '@/lib/ai';
import { xpForLevel } from '@/lib/gamification';

const QUICK = [
  { icon: 'chat-processing-outline', label: 'AI Coach', to: '/(tabs)/coach', color: colors.accent },
  { icon: 'image-multiple-outline', label: 'Progress image', to: '/progress-photo', color: colors.gold },
  { icon: 'trophy-outline', label: 'Ranks', to: '/rank', color: colors.success },
  { icon: 'medal-outline', label: 'Achievements', to: '/achievements', color: colors.purple },
  { icon: 'calendar-clock', label: 'Schedule', to: '/productivity', color: '#ff9d3f' },
  { icon: 'chart-timeline-variant', label: 'Training log', to: '/history', color: colors.danger },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    program,
    sessions,
    quests,
    level,
    streak,
    toggleQuest,
    settings,
    levelProgress,
  } = useApp();

  const [motivation, setMotivation] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const todayIndex = new Date().getDay(); // 0=Sun
  const today = useMemo(() => {
    if (!program?.weeklySchedule?.length) return null;
    // map Sunday-first to program order
    const idx = (todayIndex + 6) % Math.max(1, program.weeklySchedule.length);
    return program.weeklySchedule[idx] ?? program.weeklySchedule[0];
  }, [program, todayIndex]);

  const doneToday = useMemo(() => {
    const d = new Date().toDateString();
    return sessions.some((s) => new Date(s.finishedAt ?? s.startedAt).toDateString() === d);
  }, [sessions]);

  const loadMotivation = useCallback(async () => {
    if (!profile || !settings.apiKey) {
      setMotivation(doneToday ? 'Session logged. The work compounds.' : 'Your move today.');
      return;
    }
    const line = await motivate(
      profile,
      { streak, level: level.level, rank: level.rank, todayDone: doneToday },
      { apiKey: settings.apiKey, baseUrl: settings.apiBaseUrl, chatModel: settings.chatModel },
    );
    setMotivation(line);
  }, [profile, settings, streak, level, doneToday]);

  useEffect(() => {
    loadMotivation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMotivation();
    setRefreshing(false);
  }, [loadMotivation]);

  const nextXp = xpForLevel(level.level);

  /** Days left on the user's original deadline — the whole point of the app. */
  const daysLeft = useMemo(() => {
    if (!program?.createdAt || !profile?.goalDays) return null;
    const elapsed = Math.floor((Date.now() - program.createdAt) / 86400000);
    return Math.max(0, profile.goalDays - elapsed);
  }, [program, profile]);

  const goalPct = useMemo(() => {
    if (daysLeft === null || !profile?.goalDays) return null;
    return Math.min(1, Math.max(0, 1 - daysLeft / profile.goalDays));
  }, [daysLeft, profile]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* greeting */}
      <Text style={font.small}>WELCOME BACK</Text>
      <Text style={[font.h1, { marginTop: 2 }]}>{profile?.name ?? 'Athlete'}</Text>

      {/* motivation line */}
      <GlowCard color={colors.gold} style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name="fire" size={18} color={colors.gold} />
          <Text style={[font.small, { color: colors.gold }]}>TODAY'S CALL</Text>
        </View>
        <Text style={[font.body, { marginTop: 8, lineHeight: 22, fontSize: 17, fontWeight: '600' }]}>
          {motivation || '…'}
        </Text>
      </GlowCard>

      {/* player card */}
      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.rowBetween}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{level.rank}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={font.h3}>Level {level.level}</Text>
            <Text style={font.small}>
              {level.xp} / {nextXp} XP
            </Text>
            <View style={{ marginTop: 8 }}>
              <Progress value={levelProgress} />
            </View>
          </View>
          <View style={{ alignItems: 'center' }}>
            <MaterialCommunityIcons name="fire" size={22} color={colors.danger} />
            <Text style={[font.h3, { fontSize: 16 }]}>{streak}</Text>
            <Text style={font.small}>streak</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Workouts" value={String(sessions.length)} />
          <Stat label="Program" value={program ? `${program.weeks}w` : '—'} />
          <Stat label="Days/wk" value={program ? String(program.daysPerWeek) : '—'} />
        </View>
      </Card>

      {/* deadline countdown — the question the AI asked at the start */}
      {daysLeft !== null && goalPct !== null && (
        <GlowCard color={daysLeft <= 7 ? colors.danger : colors.accent} style={{ marginTop: spacing.md }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={font.small}>YOUR DEADLINE</Text>
              <Text style={[font.h2, { marginTop: 2 }]}>
                {daysLeft === 0 ? 'Today is the day' : `${daysLeft} days left`}
              </Text>
              <Text style={[font.dim, { marginTop: 2 }]}>
                {profile?.goalDays}-day transformation · day{' '}
                {Math.max(1, profile!.goalDays - daysLeft)}
              </Text>
            </View>
            <Text style={[font.h1, { color: daysLeft <= 7 ? colors.danger : colors.accent }]}>
              {Math.round(goalPct * 100)}%
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Progress value={goalPct} color={daysLeft <= 7 ? colors.danger : colors.accent} />
          </View>
        </GlowCard>
      )}

      {/* today's workout */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Today's mission</Text>
      {today ? (
        <GlowCard color={today.isRest ? colors.purple : colors.accent}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>{today.title}</Text>
              <Text style={[font.dim, { marginTop: 4 }]}>
                {today.isRest ? 'Rest & recover' : `${today.focus} · ${today.estimatedMinutes} min`}
              </Text>
              {!today.isRest && (
                <View style={{ marginTop: 8 }}>
                  <Pill label={`${today.exercises.length} EXERCISES`} color={colors.accent} />
                </View>
              )}
            </View>
            {!today.isRest && (
              <Btn
                label={doneToday ? 'Redo' : 'Start'}
                variant={doneToday ? 'ghost' : 'primary'}
                onPress={() => router.push(`/workout/${today.day}`)}
              />
            )}
          </View>
        </GlowCard>
      ) : (
        <Card>
          <Text style={font.dim}>No program yet.</Text>
        </Card>
      )}

      {/* quests */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Daily quests</Text>
      <Card>
        {quests.map((q, i) => (
          <View key={q.id} style={[styles.questRow, i > 0 && styles.questDivider]}>
            <MaterialCommunityIcons
              name={q.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={22}
              color={q.done ? colors.success : colors.textFaint}
              onPress={() => toggleQuest(q.id)}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[font.body, q.done && { color: colors.textDim, textDecorationLine: 'line-through' }]}>
                {q.title}
              </Text>
              <Text style={font.small}>{q.description}</Text>
            </View>
            <Text style={{ color: colors.gold, fontWeight: '800' }}>+{q.xp}</Text>
          </View>
        ))}
      </Card>

      {/* quick actions */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Quick actions</Text>
      <View style={styles.quickGrid}>
        {QUICK.map((q) => (
          <Pressable key={q.label} onPress={() => router.push(q.to as any)} style={styles.quickCard}>
            <View style={[styles.quickIcon, glow(q.color, 12), { borderColor: q.color }]}>
              <MaterialCommunityIcons name={q.icon as any} size={22} color={q.color} />
            </View>
            <Text style={[font.body, { marginTop: 10, fontSize: 14 }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {program && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={font.h3}>{program.title}</Text>
          <Text style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>{program.summary}</Text>
          <Text style={[font.small, { marginTop: 10 }]}>
            Drafted by {program.generatedBy.length} models on your council
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[font.h3, { fontSize: 20 }]}>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1508',
  },
  rankText: { color: colors.gold, fontSize: 24, fontWeight: '900' },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  questRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  questDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickCard: {
    width: '48%',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
});
