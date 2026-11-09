/**
 * Workout player.
 *
 * The screen that decides whether the app feels like a real gym app or a toy.
 * What it does:
 *   - shows last session's numbers per exercise ("you did 40kg × 8 last time")
 *   - logs every set with kg/reps, respecting the user's unit choice
 *   - runs a rest timer that starts on set completion
 *   - tracks progress live and pays XP exactly once on finish
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Pill, Progress } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { colors, font, glow, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { sessionXp } from '@/lib/gamification';
import { ExerciseLog, SetLog, WorkoutSession } from '@/types';

interface DraftSet extends SetLog {
  repsText: string;
  weightText: string;
}

const KG_PER_LB = 0.45359237;

export default function WorkoutPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { program, sessions, settings, addSession } = useApp();

  const imperial = settings.units === 'imperial';
  const unitLabel = imperial ? 'lb' : 'kg';
  const toDisplay = (kg: number) => (imperial ? kg / KG_PER_LB : kg);
  const toKg = (v: number) => (imperial ? v * KG_PER_LB : v);

  const dayNumber = Number(day);
  const plan = useMemo(
    () => program?.weeklySchedule.find((d) => d.day === dayNumber) ?? null,
    [program, dayNumber],
  );

  /** Best previous set per exercise, from the last session that trained it. */
  const lastTime = useMemo(() => {
    const map: Record<string, { weightKg: number; reps: number; when: number }> = {};
    const ordered = [...sessions].sort((a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt));
    for (const s of ordered) {
      for (const ex of s.exercises) {
        const best = ex.sets
          .filter((x) => x.completed && x.reps > 0)
          .sort((a, b) => b.weightKg * b.reps - a.weightKg * a.reps)[0];
        if (best) {
          map[ex.exerciseName] = {
            weightKg: best.weightKg,
            reps: best.reps,
            when: s.finishedAt ?? s.startedAt,
          };
        }
      }
    }
    return map;
  }, [sessions]);

  const [draft, setDraft] = useState<Record<string, DraftSet[]>>({});
  const [startedAt] = useState(() => Date.now());
  const [rest, setRest] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [note, setNote] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!plan || initialized.current) return;
    const init: Record<string, DraftSet[]> = {};
    for (const ex of plan.exercises) {
      // prefill the weight from last time so the user only confirms or bumps it
      const prev = lastTime[ex.name];
      const prevDisplay = prev ? Math.round(toDisplay(prev.weightKg) * 2) / 2 : 0;
      init[ex.name] = Array.from({ length: Math.max(1, ex.sets) }, () => ({
        reps: 0,
        weightKg: prev?.weightKg ?? 0,
        completed: false,
        repsText: '',
        weightText: prev && prevDisplay > 0 ? String(prevDisplay) : '',
      }));
    }
    setDraft(init);
    initialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  /* countdown */
  useEffect(() => {
    if (rest <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const id = setInterval(() => setRest((r) => Math.max(0, r - 1)), 1000);
    timerRef.current = id;
    return () => clearInterval(id);
  }, [rest > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Day not found"
        body="This day is not part of your program."
      >
        <Btn label="Back" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const totalSets = plan.exercises.reduce((n, e) => n + Math.max(1, e.sets), 0);
  const completedSets = Object.values(draft).reduce(
    (n, sets) => n + sets.filter((s) => s.completed).length,
    0,
  );
  const progress = totalSets ? completedSets / totalSets : 0;

  function updateSet(exName: string, idx: number, patch: Partial<DraftSet>) {
    setDraft((prev) => {
      const sets = [...(prev[exName] ?? [])];
      sets[idx] = { ...sets[idx], ...patch };
      return { ...prev, [exName]: sets };
    });
  }

  function toggleSet(exName: string, idx: number, restSeconds: number) {
    const wasComplete = draft[exName]?.[idx]?.completed;
    setDraft((prev) => {
      const sets = [...(prev[exName] ?? [])];
      const s = sets[idx];
      const reps = s.repsText ? parseInt(s.repsText, 10) || 0 : s.reps;
      const weight = s.weightText ? toKg(parseFloat(s.weightText) || 0) : s.weightKg;
      sets[idx] = { ...s, completed: !s.completed, reps, weightKg: weight };
      return { ...prev, [exName]: sets };
    });
    if (!wasComplete) {
      setRest(restSeconds);
      setRestTotal(restSeconds);
    }
  }

  /** Mirror the weight/reps a user typed into the numeric fields. */
  function collectExercises(): ExerciseLog[] {
    return plan!.exercises.map((ex) => ({
      exerciseName: ex.name,
      sets: (draft[ex.name] ?? []).map((s) => ({
        reps: s.repsText ? parseInt(s.repsText, 10) || 0 : s.reps,
        weightKg: s.weightText ? toKg(parseFloat(s.weightText) || 0) : s.weightKg,
        completed: s.completed,
      })),
    }));
  }

  const projectedXp = useMemo(() => {
    const fake: WorkoutSession = {
      id: '',
      programId: '',
      dayNumber: plan.day,
      title: plan.title,
      startedAt: 0,
      durationSeconds: 0,
      xpEarned: 0,
      exercises: Object.entries(draft).map(([exerciseName, sets]) => ({
        exerciseName,
        sets: sets.map((s) => ({
          reps: s.repsText ? parseInt(s.repsText, 10) || 0 : s.reps,
          weightKg: s.weightText ? toKg(parseFloat(s.weightText) || 0) : s.weightKg,
          completed: s.completed,
        })),
      })),
    };
    return sessionXp(fake, program?.difficulty ?? 'beginner');
  }, [draft, plan, program]);

  async function finish() {
    const exercises = collectExercises();
    const anyDone = exercises.some((e) => e.sets.some((s) => s.completed));
    if (!anyDone) {
      Alert.alert('Nothing logged', 'Tick at least one set before finishing.');
      return;
    }
    const finishedAt = Date.now();
    const session: WorkoutSession = {
      id: `sess_${finishedAt}`,
      programId: program?.id ?? 'unknown',
      dayNumber: plan!.day,
      title: plan!.title,
      startedAt,
      finishedAt,
      durationSeconds: Math.round((finishedAt - startedAt) / 1000),
      xpEarned: 0,
      exercises,
      notes: note.trim() || undefined,
    };
    session.xpEarned = sessionXp(session, program?.difficulty ?? 'beginner');

    // addSession records the completion, ticks the quest and applies XP once.
    await addSession(session);

    const doneSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
    const volume = Math.round(
      exercises.reduce(
        (n, e) => n + e.sets.filter((s) => s.completed).reduce((k, s) => k + s.reps * s.weightKg, 0),
        0,
      ),
    );
    const mins = Math.max(1, Math.round(session.durationSeconds / 60));
    Alert.alert(
      'Session complete',
      `${doneSets} sets · ${mins} min${volume > 0 ? ` · ${volume.toLocaleString()} kg moved` : ''}\n\n+${session.xpEarned} XP banked. The transformation continues.`,
      [{ text: 'Back to home', onPress: () => router.replace('/(tabs)/home') }],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 130 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={font.small}>DAY {plan.day}</Text>
            <Text style={[font.h1, { marginTop: 2 }]}>{plan.title}</Text>
            <Text style={[font.dim, { marginTop: 4 }]}>{plan.focus}</Text>
          </View>
          <Pill label={unitLabel.toUpperCase()} color={colors.textDim} />
        </View>

        <GlowCard color={completedSets > 0 ? colors.success : colors.accent} style={{ marginTop: spacing.lg }}>
          <View style={styles.rowBetween}>
            <Text style={font.small}>PROGRESS</Text>
            <Text style={[font.h3, { color: colors.success }]}>
              {completedSets} / {totalSets}
            </Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Progress value={progress} color={completedSets > 0 ? colors.success : colors.accent} />
          </View>
        </GlowCard>

        {plan.exercises.map((ex) => {
          const prev = lastTime[ex.name];
          const exSets = draft[ex.name] ?? [];
          const exDone = exSets.filter((s) => s.completed).length;
          return (
            <Card key={ex.name} style={[styles.exCard, exDone === exSets.length && exSets.length > 0 && { borderColor: colors.success }]}>
              <View style={styles.exHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{ex.name}</Text>
                  <Text style={font.small}>
                    {ex.sets} × {ex.reps} · rest {ex.restSeconds}s
                  </Text>
                  {!!ex.targetMuscles?.length && (
                    <Text style={[font.small, { marginTop: 2 }]}>
                      {ex.targetMuscles.join(' · ')}
                    </Text>
                  )}
                </View>
                {exDone > 0 && <Pill label={`${exDone}/${exSets.length}`} color={colors.success} />}
              </View>

              {prev && (
                <View style={styles.prevRow}>
                  <MaterialCommunityIcons name="history" size={13} color={colors.textFaint} />
                  <Text style={[font.small, { marginLeft: 5 }]}>
                    Last time: {Math.round(toDisplay(prev.weightKg) * 10) / 10} {unitLabel} ×{' '}
                    {prev.reps} · {new Date(prev.when).toLocaleDateString()}
                  </Text>
                </View>
              )}

              {!!ex.notes && (
                <Text style={[font.small, { marginTop: 6, lineHeight: 17 }]}>{ex.notes}</Text>
              )}

              <View style={{ marginTop: spacing.md }}>
                {exSets.map((s, i) => (
                  <View key={i} style={styles.setRow}>
                    <Text style={[styles.setLabel, s.completed && { color: colors.success }]}>
                      SET {i + 1}
                    </Text>
                    <TextInput
                      value={s.weightText}
                      onChangeText={(t) => updateSet(ex.name, i, { weightText: t })}
                      placeholder={unitLabel}
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textFaint}
                      style={[styles.setInput, { width: 74 }, s.completed && styles.setInputDone]}
                    />
                    <Text style={font.small}>×</Text>
                    <TextInput
                      value={s.repsText}
                      onChangeText={(t) => updateSet(ex.name, i, { repsText: t })}
                      placeholder={ex.reps.includes('-') ? ex.reps.split('-')[0] : 'reps'}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.textFaint}
                      style={[styles.setInput, { width: 66 }, s.completed && styles.setInputDone]}
                    />
                    <View style={{ flex: 1 }} />
                    <MaterialCommunityIcons
                      name={s.completed ? 'check-circle' : 'circle-outline'}
                      size={30}
                      color={s.completed ? colors.success : colors.textFaint}
                      onPress={() => toggleSet(ex.name, i, ex.restSeconds)}
                    />
                  </View>
                ))}
              </View>
            </Card>
          );
        })}

        {/* session note */}
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={font.h3}>Session note</Text>
          <Text style={[font.small, { marginTop: 2 }]}>
            Anything the coach should know next time — a niggle, a great set, a machine that was busy.
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.note}
          />
        </Card>
      </ScrollView>

      {/* rest timer */}
      {rest > 0 && (
        <View style={[styles.restBar, glow(colors.accent, 12)]}>
          <MaterialCommunityIcons name="timer-sand" size={20} color={colors.accent} />
          <View style={{ flex: 1, marginHorizontal: spacing.md }}>
            <Text style={[font.body, { fontWeight: '700' }]}>Rest · {rest}s</Text>
            <View style={{ marginTop: 5 }}>
              <Progress value={restTotal ? rest / restTotal : 0} color={colors.accent} />
            </View>
          </View>
          <Btn label="Skip" variant="ghost" onPress={() => setRest(0)} />
        </View>
      )}

      {/* finish bar */}
      <View style={[styles.finishBar, { paddingBottom: insets.bottom + 12 }]}>
        <Btn
          label={completedSets ? `Finish · +${projectedXp} XP` : 'Tick a set to finish'}
          onPress={finish}
          disabled={!completedSets}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exCard: { marginTop: spacing.lg },
  exHeader: { flexDirection: 'row', alignItems: 'center' },
  prevRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  setLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '800', width: 52 },
  setInput: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 9,
    textAlign: 'center',
  },
  setInputDone: { borderColor: colors.success, color: colors.success },
  note: {
    marginTop: spacing.sm,
    minHeight: 68,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  restBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  finishBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});