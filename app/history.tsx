/**
 * Training log — the full history, rendered as a contribution-style heatmap
 * plus a readable list. This is the "proof of work" screen: it answers
 * "have I actually been training?" without asking the user to remember.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, GlowCard, Pill } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { totalMinutes, totalSets, totalVolumeKg } from '@/lib/achievements';

const WEEKS = 14;
const DAY_MS = 86400000;

export default function HistoryScreen() {
  const { sessions, program } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  /** Map yyyy-mm-dd → total minutes trained that day. */
  const byDay = useMemo(() => {
    const map = new Map<string, { minutes: number; count: number }>();
    for (const s of sessions) {
      const d = new Date(s.finishedAt ?? s.startedAt);
      const key = keyOf(d);
      const prev = map.get(key) ?? { minutes: 0, count: 0 };
      map.set(key, {
        minutes: prev.minutes + Math.round((s.durationSeconds || 0) / 60),
        count: prev.count + 1,
      });
    }
    return map;
  }, [sessions]);

  /** Build the grid: `WEEKS` columns of 7 days, ending today. */
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // walk back to the Monday of this week, then back WEEKS-1 weeks
    const end = new Date(today);
    const dow = (end.getDay() + 6) % 7; // Mon = 0
    end.setDate(end.getDate() - dow + 6); // Sunday of this week
    const start = new Date(end);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));

    const cols: { key: string; date: Date }[][] = [];
    for (let w = 0; w < WEEKS; w += 1) {
      const col: { key: string; date: Date }[] = [];
      for (let d = 0; d < 7; d += 1) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        col.push({ key: keyOf(date), date });
      }
      cols.push(col);
    }
    return cols;
  }, []);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt)),
    [sessions],
  );

  const selectedSessions = selected
    ? sorted.filter((s) => keyOf(new Date(s.finishedAt ?? s.startedAt)) === selected)
    : [];

  const activeDays = byDay.size;
  const totalMin = totalMinutes(sessions);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GlowCard color={colors.success}>
        <Text style={font.small}>CONSISTENCY</Text>
        <Text style={[font.h1, { marginTop: 2 }]}>{activeDays} days trained</Text>
        <View style={styles.statRow}>
          <Stat label="Sessions" value={String(sessions.length)} />
          <Stat label="Sets" value={String(totalSets(sessions))} />
          <Stat label="Hours" value={(totalMin / 60).toFixed(1)} />
          <Stat label="Volume" value={`${(totalVolumeKg(sessions) / 1000).toFixed(1)}t`} />
        </View>
      </GlowCard>

      {/* heatmap */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={font.h3}>Last {WEEKS} weeks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {grid.map((col, ci) => (
              <View key={ci} style={{ gap: 3 }}>
                {col.map(({ key, date }) => {
                  const info = byDay.get(key);
                  const future = date.getTime() > Date.now();
                  const isSelected = selected === key;
                  return (
                    <View
                      key={key}
                      onTouchEnd={() => setSelected(isSelected ? null : key)}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: future
                            ? 'transparent'
                            : info
                              ? levelColor(info.minutes)
                              : colors.bgElevated,
                          borderColor: isSelected ? colors.text : colors.border,
                          borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                          opacity: future ? 0 : 1,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.legend}>
          <Text style={font.small}>less</Text>
          {[colors.bgElevated, '#1f4a2e', '#2b7a45', '#39d98a', '#7bf0b4'].map((c) => (
            <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
          ))}
          <Text style={font.small}>more</Text>
        </View>
      </Card>

      {/* selected day */}
      {selected && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={font.h3}>{new Date(selected).toLocaleDateString()}</Text>
          {selectedSessions.length === 0 ? (
            <Text style={[font.dim, { marginTop: 6 }]}>Rest day — nothing logged.</Text>
          ) : (
            selectedSessions.map((s) => (
              <Text key={s.id} style={[font.dim, { marginTop: 6 }]}>
                • {s.title} · {Math.round((s.durationSeconds || 0) / 60)} min
                · +{s.xpEarned} XP
              </Text>
            ))
          )}
        </Card>
      )}

      {/* list */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        All sessions
      </Text>

      {sorted.length === 0 && (
        <Card>
          <Text style={font.dim}>
            Nothing logged yet. Finish a workout and it will appear here with its sets, duration,
            volume and XP.
          </Text>
        </Card>
      )}

      {sorted.map((s) => {
        const sets = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completed).length, 0);
        const vol = s.exercises.reduce(
          (n, e) =>
            n + e.sets.filter((x) => x.completed).reduce((k, x) => k + x.reps * x.weightKg, 0),
          0,
        );
        return (
          <Card key={s.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={font.body}>{s.title}</Text>
                <Text style={font.small}>
                  {new Date(s.finishedAt ?? s.startedAt).toLocaleString()} ·{' '}
                  {Math.round((s.durationSeconds || 0) / 60)} min
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Pill label={`+${s.xpEarned} XP`} color={colors.gold} />
                <Text style={[font.small, { marginTop: 4 }]}>
                  {sets} sets{vol > 0 ? ` · ${Math.round(vol)} kg` : ''}
                </Text>
              </View>
            </View>
            {s.exercises.length > 0 && (
              <Text style={[font.small, { marginTop: 8 }]} numberOfLines={2}>
                {s.exercises.map((e) => e.name).join(' · ')}
              </Text>
            )}
          </Card>
        );
      })}

      {program && (
        <Text style={[font.small, { textAlign: 'center', marginTop: spacing.lg }]}>
          Program: {program.title} · {program.weeks} weeks
        </Text>
      )}
    </ScrollView>
  );
}

function keyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function levelColor(minutes: number): string {
  if (minutes >= 60) return '#7bf0b4';
  if (minutes >= 40) return '#39d98a';
  if (minutes >= 20) return '#2b7a45';
  return '#1f4a2e';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.h3, { fontSize: 17 }]}>{value}</Text>
      <Text style={[font.small, { fontSize: 10 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cell: { width: 15, height: 15, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  legendCell: { width: 11, height: 11, borderRadius: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});