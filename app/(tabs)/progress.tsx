/**
 * Progress tab: weight trend chart, body measurements log, and the visual
 * transformation gallery (photos + AI illustrations + offline posters).
 */
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Pill } from '@/components/ui';
import { PosterCard } from '@/components/PosterCard';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { BodyLog } from '@/types';

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, bodyLogs, photos, addBodyLog, sessions } = useApp();
  const [modal, setModal] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [arms, setArms] = useState('');

  const startWeight = profile?.weightKg ?? bodyLogs[0]?.weightKg ?? 0;
  const currentWeight = bodyLogs.length ? bodyLogs[bodyLogs.length - 1].weightKg ?? startWeight : startWeight;
  const target = profile?.targetWeightKg ?? currentWeight;
  const lost = startWeight - currentWeight;
  const totalToGo = Math.max(0.1, startWeight - target);
  const progressPct = Math.max(0, Math.min(1, lost / totalToGo));

  const weights = bodyLogs.filter((b) => typeof b.weightKg === 'number') as (BodyLog & { weightKg: number })[];

  async function save() {
    const w = parseFloat(weight);
    if (!Number.isFinite(w)) {
      Alert.alert('Enter a weight', 'Type your current weight in kg.');
      return;
    }
    const log: BodyLog = {
      id: `body_${Date.now()}`,
      date: Date.now(),
      weightKg: w,
      waistCm: waist ? parseFloat(waist) : undefined,
      chestCm: chest ? parseFloat(chest) : undefined,
      armsCm: arms ? parseFloat(arms) : undefined,
    };
    await addBodyLog(log);
    setModal(false);
    setWeight('');
    setWaist('');
    setChest('');
    setArms('');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
    >
      {/* weight summary */}
      <GlowCard color={colors.success}>
        <Text style={font.small}>CURRENT WEIGHT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
          <Text style={[font.h1, { fontSize: 40 }]}>{currentWeight.toFixed(1)}</Text>
          <Text style={[font.dim, { marginLeft: 6, marginBottom: 8 }]}>kg</Text>
          <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
            <Text style={{ color: lost >= 0 ? colors.success : colors.gold, fontWeight: '800', fontSize: 18 }}>
              {lost >= 0 ? '−' : '+'}
              {Math.abs(lost).toFixed(1)} kg
            </Text>
            <Text style={font.small}>target {target.toFixed(1)} kg</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={[font.small, { marginTop: 6 }]}>{Math.round(progressPct * 100)}% to goal</Text>
        </View>
      </GlowCard>

      {/* chart */}
      {weights.length >= 2 && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={font.h3}>Weight trend</Text>
          <WeightChart data={weights.map((w) => w.weightKg)} />
          <Text style={[font.small, { marginTop: 6 }]}>
            {weights.length} entries · {new Date(weights[0].date).toLocaleDateString()} →{' '}
            {new Date(weights[weights.length - 1].date).toLocaleDateString()}
          </Text>
        </Card>
      )}

      {/* actions */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Btn label="Log weight" onPress={() => setModal(true)} style={{ flex: 1 }} />
        <Btn
          label="Progress image"
          variant="gold"
          onPress={() => router.push('/progress-photo')}
          style={{ flex: 1 }}
        />
      </View>

      {/* gallery */}
      <View style={styles.sectionRow}>
        <Text style={[font.h3, { marginTop: spacing.xl }]}>Transformation gallery</Text>
        <Text style={font.small}>{photos.length} entries</Text>
      </View>
      {photos.length === 0 ? (
        <Card style={{ marginTop: spacing.sm, alignItems: 'center', paddingVertical: spacing.xl }}>
          <MaterialCommunityIcons name="image-multiple-outline" size={38} color={colors.textFaint} />
          <Text style={[font.dim, { marginTop: spacing.md, textAlign: 'center' }]}>
            No progress images yet. Generate your first one — the AI turns your stats into a hero card.
          </Text>
        </Card>
      ) : (
        <View style={styles.gallery}>
          {[...photos].reverse().map((p) => (
            <Pressable key={p.id} style={styles.photoCard} onPress={() => router.push('/progress-photo')}>
              {p.aiImageUri || p.uri ? (
                <Image source={{ uri: p.aiImageUri ?? p.uri }} style={styles.photo} resizeMode="cover" />
              ) : p.posterStats ? (
                /* the SVG file cannot be shown by <Image>, so redraw it natively */
                <View style={styles.posterWrap}>
                  <PosterCard stats={p.posterStats} compact />
                </View>
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <MaterialCommunityIcons name="image-outline" size={28} color={colors.textFaint} />
                </View>
              )}
              <Text style={[font.small, { marginTop: 6 }]}>
                {new Date(p.date).toLocaleDateString()}
              </Text>
              {typeof p.aiScore === 'number' && (
                <View style={{ marginTop: 4 }}>
                  <Pill label={`SCORE ${p.aiScore}`} color={colors.gold} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* session history */}
      <Text style={[font.h3, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Session history</Text>
      {sessions.length === 0 ? (
        <Card>
          <Text style={font.dim}>No sessions logged yet.</Text>
        </Card>
      ) : (
        [...sessions].reverse().slice(0, 12).map((s) => (
          <Card key={s.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={font.body}>{s.title}</Text>
                <Text style={font.small}>
                  {new Date(s.finishedAt ?? s.startedAt).toLocaleString()} ·{' '}
                  {Math.round(s.durationSeconds / 60)} min
                </Text>
              </View>
              <Text style={{ color: colors.gold, fontWeight: '800' }}>+{s.xpEarned} XP</Text>
            </View>
          </Card>
        ))
      )}

      {/* log modal */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={font.h3}>Log body stats</Text>
            <Field label="Weight (kg)" value={weight} onChange={setWeight} />
            <Field label="Waist (cm)" value={waist} onChange={setWaist} />
            <Field label="Chest (cm)" value={chest} onChange={setChest} />
            <Field label="Arms (cm)" value={arms} onChange={setArms} />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Btn label="Cancel" variant="ghost" onPress={() => setModal(false)} style={{ flex: 1 }} />
              <Btn label="Save" onPress={save} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={font.small}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
      />
    </View>
  );
}

/** Tiny dependency-free line chart drawn with plain Views. */
function WeightChart({ data }: { data: number[] }) {
  const H = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return (
    <View style={{ height: H, marginTop: spacing.md, justifyContent: 'flex-end' }}>
      <View style={styles.chartBars}>
        {data.map((v, i) => {
          const h = ((v - min) / range) * (H * 0.7) + H * 0.15;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View
                style={{
                  width: '62%',
                  height: h,
                  backgroundColor: i === data.length - 1 ? colors.success : colors.accentSoft,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={font.small}>{min.toFixed(1)}</Text>
        <Text style={font.small}>{max.toFixed(1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.success, borderRadius: 5 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  photoCard: { width: '48%', marginBottom: spacing.lg },
  photo: { width: '100%', aspectRatio: 0.8, borderRadius: radius.md, backgroundColor: colors.card },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  posterWrap: { width: '100%' },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: '#000c', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  input: {
    marginTop: 6,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
