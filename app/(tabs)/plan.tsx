/**
 * Plan tab: the full program — weekly schedule, the 8-day build-up ramp,
 * nutrition targets, and a completion calendar. Tapping a day opens the player.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Pill } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { colors, font, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';

export default function PlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { program, completions } = useApp();

  if (!program) {
    return (
      <EmptyState
        icon="clipboard-text-outline"
        title="No program yet"
        body="Finish onboarding to have the council build your plan."
      >
        <Btn label="Go to onboarding" onPress={() => router.replace('/onboarding')} />
      </EmptyState>
    );
  }

  const n = program.nutrition;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
    >
      <Text style={font.small}>YOUR PROGRAM</Text>
      <Text style={[font.h1, { marginTop: 2 }]}>{program.title}</Text>
      <Text style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>{program.summary}</Text>

      <View style={styles.pillRow}>
        <Pill label={`${program.weeks} WEEKS`} />
        <Pill label={`${program.daysPerWeek} DAYS/WK`} color={colors.gold} />
        <Pill label={program.difficulty.toUpperCase()} color={colors.purple} />
      </View>

      {/* weekly schedule */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Weekly schedule</Text>
      {program.weeklySchedule.map((day) => {
        const complete = completions.includes(day.day);
        return (
          <Card key={day.day} style={{ marginBottom: spacing.md }}>
            <View style={styles.dayHeader}>
              <View style={[styles.dayNum, day.isRest && { borderColor: colors.purple }]}>
                <Text style={[styles.dayNumText, day.isRest && { color: colors.purple }]}>
                  {day.isRest ? '💤' : day.day}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={font.h3}>{day.title}</Text>
                  {complete && <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />}
                </View>
                <Text style={font.small}>
                  {day.focus} · {day.estimatedMinutes} min
                </Text>
              </View>
              {!day.isRest && (
                <Btn label="Open" variant="ghost" onPress={() => router.push(`/workout/${day.day}`)} />
              )}
            </View>

            {!day.isRest && (
              <View style={{ marginTop: spacing.md }}>
                {day.exercises.map((ex, i) => (
                  <View key={`${ex.name}-${i}`} style={styles.exerciseRow}>
                    <Text style={[font.dim, { flex: 1 }]} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={font.small}>
                      {ex.sets} × {ex.reps}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {/* build-up plan */}
      {program.awakeningPlan?.length > 0 && (
        <>
          <Text style={[font.h3, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>8-day build-up ramp</Text>
          <Text style={[font.small, { marginBottom: spacing.sm }]}>
            Gentle starter days to wake your body up before the main block.
          </Text>
          {program.awakeningPlan.map((day, i) => (
            <Card key={`aw-${i}`} style={{ marginBottom: spacing.sm }}>
              <Text style={font.h3}>{day.title}</Text>
              <Text style={[font.small, { marginTop: 2 }]}>
                {day.isRest ? 'Rest' : `${day.exercises.length} exercises · ${day.estimatedMinutes} min`}
              </Text>
            </Card>
          ))}
        </>
      )}

      {/* nutrition */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Nutrition targets</Text>
      <GlowCard color={colors.success}>
        <Text style={[font.h3, { fontSize: 28 }]}>{n.dailyCalories} kcal</Text>
        <View style={styles.macroRow}>
          <Macro label="Protein" value={`${n.proteinG}g`} color={colors.accent} />
          <Macro label="Carbs" value={`${n.carbsG}g`} color={colors.gold} />
          <Macro label="Fat" value={`${n.fatG}g`} color={colors.purple} />
          <Macro label="Water" value={`${(n.waterMl / 1000).toFixed(1)}L`} color={colors.success} />
        </View>
        {n.guidance?.map((g, i) => (
          <Text key={i} style={[font.dim, { marginTop: i === 0 ? spacing.md : 4, lineHeight: 20 }]}>
            • {g}
          </Text>
        ))}
      </GlowCard>

      <Text style={[font.small, { marginTop: spacing.lg, textAlign: 'center', lineHeight: 18 }]}>
        Council: {program.generatedBy.join(', ')}
      </Text>
    </ScrollView>
  );
}

function Macro({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  dayNum: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated,
  },
  dayNumText: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  macroRow: { flexDirection: 'row', marginTop: spacing.md },
});
