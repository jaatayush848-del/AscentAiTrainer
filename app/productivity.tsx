/**
 * Schedule — weekly training rhythm and habit tracking.
 *
 * Shows which day of the week each program slot lands on, what is already done
 * this week, and gives the user a place to write down the times they can train
 * (the "when are you going to do this?" question that makes a plan actually
 * stick). Everything is stored in the profile's free notes, on-device.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, Chip, GlowCard, Pill, Progress } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { dayOfYear } from '@/lib/gamification';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Suggested slot times, offered as one-tap chips. */
const TIME_SLOTS = ['Early morning', 'Lunch', 'After work', 'Evening'];

export default function ScheduleScreen() {
  const router = useRouter();
  const { program, profile, setProfile, sessions, completions, quests } = useApp();
  const [note, setNote] = useState(profile?.freeNotes ?? '');
  const [saved, setSaved] = useState(false);

  /** Map each program day onto a weekday, spreading rest days sensibly. */
  const week = useMemo(() => {
    if (!program) return [];
    const schedule = program.weeklySchedule.slice(0, 7);
    return WEEKDAYS.map((label, i) => ({
      label,
      day: schedule[i] ?? null,
      isToday: ((new Date().getDay() + 6) % 7) === i,
    }));
  }, [program]);

  const doneThisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return sessions.filter((s) => new Date(s.finishedAt ?? s.startedAt) >= monday).length;
  }, [sessions]);

  const target = program?.daysPerWeek ?? 0;
  const weekProgress = target ? Math.min(1, doneThisWeek / target) : 0;
  const questsDone = quests.filter((q) => q.done).length;

  const addSlot = useCallback(
    (slot: string) => {
      setNote((prev) => {
        const base = prev.trim();
        if (base.toLowerCase().includes(slot.toLowerCase())) return base;
        return base ? `${base}\n${slot}` : slot;
      });
      setSaved(false);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!profile) return;
    await setProfile({ ...profile, freeNotes: note });
    setSaved(true);
  }, [note, profile, setProfile]);

  if (!program) {
    return (
      <EmptyState
        icon="calendar-blank-outline"
        title="No schedule yet"
        body="Generate a program first — the council will lay out a weekly rhythm for you."
      >
        <Btn label="Generate program" onPress={() => router.push('/generate')} />
      </EmptyState>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      {/* week at a glance */}
      <Text style={font.small}>THIS WEEK</Text>
      <Text style={[font.h2, { marginTop: 2 }]}>Your training rhythm</Text>

      <GlowCard style={{ marginTop: spacing.lg }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={font.h1}>{doneThisWeek}</Text>
            <Text style={font.dim}>
              of {target} sessions this week
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={font.small}>WEEK {Math.ceil(dayOfYear() / 7)}</Text>
            <Text style={[font.h3, { color: colors.gold }]}>
              {Math.round(weekProgress * 100)}%
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Progress value={weekProgress} />
        </View>
        <Text style={[font.small, { marginTop: 10 }]}>
          {questsDone} of {quests.length} daily quests ticked off today
        </Text>
      </GlowCard>

      {/* weekday strip */}
      <View style={styles.weekStrip}>
        {week.map(({ label, day, isToday }) => {
          const complete = day ? completions.includes(day.day) : false;
          const rest = !day || day.isRest;
          return (
            <View
              key={label}
              style={[
                styles.dayCell,
                isToday && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={[font.small, isToday && { color: colors.text }]}>{label}</Text>
              <MaterialCommunityIcons
                name={
                  rest
                    ? 'weather-night'
                    : complete
                      ? 'check-circle'
                      : 'dumbbell'
                }
                size={17}
                color={rest ? colors.purple : complete ? colors.success : colors.accent}
                style={{ marginTop: 6 }}
              />
              <Text style={[font.small, { fontSize: 10, marginTop: 4 }]}>
                {day ? (rest ? 'rest' : `${day.estimatedMinutes}m`) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* day by day */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Day plan
      </Text>
      {week.map(({ label, day, isToday }) =>
        day ? (
          <Card
            key={label}
            style={[styles.dayCard, isToday && { borderColor: colors.accent }]}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={font.h3}>{label}</Text>
                  {isToday && <Pill label="TODAY" />}
                  {day.isRest && <Pill label="REST" color={colors.purple} />}
                </View>
                <Text style={[font.dim, { marginTop: 4 }]}>{day.title}</Text>
                <Text style={font.small}>
                  {day.isRest ? 'Recover, walk, stretch, sleep' : `${day.exercises.length} exercises · ${day.estimatedMinutes} min`}
                </Text>
              </View>
              {!day.isRest && (
                <Btn
                  label="Start"
                  variant="ghost"
                  onPress={() => router.push(`/workout/${day.day}`)}
                />
              )}
            </View>
          </Card>
        ) : null,
      )}

      {/* the habit half: when will you actually train */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        When will you train?
      </Text>
      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          A plan without a time slot is a wish. Write down the exact windows you can protect —
          early mornings before work, right after you drop the kids off, whatever is real for you.
          The coach reads this and plans around it.
        </Text>
        <View style={styles.chipWrap}>
          {TIME_SLOTS.map((slot) => (
            <Chip key={slot} label={slot} onPress={() => addSlot(slot)} />
          ))}
        </View>
        <TextInput
          value={note}
          onChangeText={(t) => {
            setNote(t);
            setSaved(false);
          }}
          placeholder={'e.g. Mon/Wed/Fri 6:30am at home\nTue/Thu 7pm gym\nWeekend long walk'}
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.input}
        />
        <Btn
          label={saved ? 'Saved ✓' : 'Save my schedule'}
          variant={saved ? 'ghost' : 'primary'}
          onPress={save}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {/* honest rules */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={font.h3}>Rules that make it stick</Text>
        {[
          'Two sessions a week still beats zero. Never skip twice in a row.',
          'If you miss a day, do not double up — just carry on with the next one.',
          'Same time, same place. The context does half the work for you.',
          'Log the session even if it was short. The streak is the point.',
        ].map((rule, i) => (
          <View key={rule} style={[styles.ruleRow, i > 0 && styles.ruleDivider]}>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.accent}
              style={{ marginTop: 2 }}
            />
            <Text style={[font.dim, { flex: 1, lineHeight: 20 }]}>{rule}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekStrip: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  dayCard: { marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  input: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  ruleRow: { flexDirection: 'row', paddingVertical: 10, gap: 4 },
  ruleDivider: { borderTopWidth: 1, borderTopColor: colors.border },
});
