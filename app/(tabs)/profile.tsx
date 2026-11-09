/**
 * "You" tab — profile, AI connection settings and the council roster.
 *
 * This is the control room: the user's own Token Harbor key lives here, they
 * pick which models sit on their council, check the live connection, regenerate
 * the program or wipe the device data. No account, no subscription.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, Chip, Divider, GlowCard, Pill, Progress } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { MODEL_CATALOG, mergeLiveModels, modelLabel, ModelInfo } from '@/lib/models';
import { listModels, ping } from '@/lib/tokenHarbor';
import { xpForLevel } from '@/lib/gamification';

type ConnState = 'idle' | 'checking' | 'ok' | 'fail';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    settings,
    updateSettings,
    program,
    sessions,
    level,
    streak,
    levelProgress,
    achievements,
    reset,
  } = useApp();

  const [conn, setConn] = useState<ConnState>('idle');
  const [connMsg, setConnMsg] = useState('Not checked yet');
  const [liveModels, setLiveModels] = useState<ModelInfo[]>([]);
  const [showAllModels, setShowAllModels] = useState(false);

  const catalog = useMemo(
    () => (liveModels.length ? liveModels : MODEL_CATALOG),
    [liveModels],
  );

  const checkConnection = useCallback(async () => {
    if (!settings.apiKey) {
      setConn('fail');
      setConnMsg('No key saved');
      return;
    }
    setConn('checking');
    setConnMsg('Contacting tokenharbor.ai…');
    const base = settings.apiBaseUrl;
    const models = await listModels(settings.apiKey, base).catch(() => []);
    const ok = models.length > 0 || (await ping(settings.apiKey, settings.chatModel, base));
    if (!ok) {
      setConn('fail');
      setConnMsg('Could not reach the gateway — check the key and base URL');
      return;
    }
    if (models.length) setLiveModels(mergeLiveModels(models.map((m) => m.id)));
    setConn('ok');
    setConnMsg(
      models.length
        ? `Connected · ${models.length} models available`
        : 'Connected · model list unavailable',
    );
  }, [settings.apiKey, settings.apiBaseUrl, settings.chatModel]);

  useEffect(() => {
    // quietly refresh the roster once, so the picker reflects the real account
    if (settings.apiKey && liveModels.length === 0) void checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCouncilModel = useCallback(
    (id: string) => {
      const has = settings.councilModels.includes(id);
      const next = has
        ? settings.councilModels.filter((m) => m !== id)
        : [...settings.councilModels, id];
      void updateSettings({ councilModels: next });
    },
    [settings.councilModels, updateSettings],
  );

  const stepEnsemble = useCallback(
    (delta: number) => {
      const next = Math.max(2, Math.min(8, settings.ensembleSize + delta));
      void updateSettings({ ensembleSize: next });
    },
    [settings.ensembleSize, updateSettings],
  );

  const onReset = useCallback(() => {
    Alert.alert(
      'Erase everything?',
      'Profile, program, history, photos and your key will be deleted from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await reset();
            router.replace('/setup');
          },
        },
      ],
    );
  }, [reset, router]);

  const onRegenerate = useCallback(() => {
    Alert.alert(
      'Regenerate program?',
      'The council will write a fresh plan from your current profile and replace the active one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: () => router.push('/generate?replace=1') },
      ],
    );
  }, [router]);

  const totalSets = useMemo(
    () => sessions.reduce((n, s) => n + s.exercises.reduce((k, e) => k + e.sets.length, 0), 0),
    [sessions],
  );

  const shown = showAllModels ? catalog : catalog.slice(0, 18);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: 40,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text style={font.small}>YOUR PROFILE</Text>
        <Text style={[font.h1, { marginTop: 2 }]}>{profile?.name ?? 'Athlete'}</Text>

      {/* profile card */}
      <GlowCard color={colors.gold} style={{ marginTop: spacing.lg }}>
        <View style={styles.rowBetween}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{level.rank}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={font.h3}>
              Level {level.level} · {level.rank}-Rank
            </Text>
            <Text style={[font.small, { marginTop: 2 }]}>
              {level.xp} / {xpForLevel(level.level)} XP
            </Text>
            <View style={{ marginTop: 8 }}>
              <Progress value={levelProgress} color={colors.gold} />
            </View>
          </View>
        </View>
        <View style={styles.statRow}>
          <Stat label="Sessions" value={String(sessions.length)} />
          <Stat label="Sets" value={String(totalSets)} />
          <Stat label="Streak" value={`${streak}d`} />
          <Stat label="Badges" value={String(achievements.length)} />
        </View>
      </GlowCard>

      {/* the promise made during onboarding, kept in view */}
      {(profile?.becoming || profile?.goalDays) && (
        <Card style={{ marginTop: spacing.md, borderColor: colors.accent }}>
          <Text style={font.small}>YOUR MISSION</Text>
          {!!profile?.becoming && (
            <Text style={[font.body, { marginTop: 6, lineHeight: 21, fontStyle: 'italic' }]}>
              “{profile.becoming}”
            </Text>
          )}
          <Text style={[font.dim, { marginTop: 8 }]}>
            {profile?.weightKg} → {profile?.targetWeightKg} kg in {profile?.goalDays} days
            {profile?.daysPerWeek ? ` · ${profile.daysPerWeek}×/week` : ''}
          </Text>
        </Card>
      )}
      <View style={styles.linkRow}>
        <LinkTile icon="trophy-outline" label="Ranks" onPress={() => router.push('/rank')} />
        <LinkTile
          icon="medal-outline"
          label="Achievements"
          onPress={() => router.push('/achievements')}
        />
      </View>
      <View style={styles.linkRow}>
        <LinkTile
          icon="chart-timeline-variant"
          label="Training log"
          onPress={() => router.push('/history')}
        />
        <LinkTile
          icon="account-edit-outline"
          label="Edit profile"
          onPress={() => router.push('/onboarding?edit=1')}
        />
      </View>

      {/* -------------------- AI connection -------------------- */}
      <SectionTitle icon="robot-outline" title="AI connection" />

      <Card>
        <Text style={font.small}>KEY</Text>
        <Text style={[font.body, { marginTop: 4 }]}>
          {settings.apiKey
            ? `${settings.apiKey.slice(0, 12)}••••${settings.apiKey.slice(-4)}`
            : 'Not set'}
        </Text>
        <Text style={[font.small, { marginTop: 8 }]}>BASE URL</Text>
        <Text style={[font.body, { marginTop: 4 }]}>{settings.apiBaseUrl}</Text>

        <View style={[styles.connRow, { borderColor: connColor(conn) }]}>
          {conn === 'checking' ? (
            <MaterialCommunityIcons name="progress-clock" size={16} color={colors.accent} />
          ) : (
            <MaterialCommunityIcons
              name={conn === 'ok' ? 'check-circle' : conn === 'fail' ? 'alert-circle' : 'circle-outline'}
              size={16}
              color={connColor(conn)}
            />
          )}
          <Text style={[font.small, { marginLeft: 6, flex: 1 }]}>{connMsg}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Btn
            label="Test again"
            variant="ghost"
            loading={conn === 'checking'}
            onPress={checkConnection}
            style={{ flex: 1 }}
          />
          <Btn
            label="Change key"
            onPress={() => router.push('/setup')}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {/* chat behaviour */}
      <Card style={{ marginTop: spacing.md }}>
        <Row
          label="Stream answers"
          hint="Show the coach reply as it is written"
          value={settings.streaming}
          onChange={(v) => void updateSettings({ streaming: v })}
        />
        <Divider />
        <Row
          label="Council mode default"
          hint="Every coach question goes to several models at once"
          value={settings.councilMode}
          onChange={(v) => void updateSettings({ councilMode: v })}
        />
        <Divider />
        <View style={styles.stepperRow}>
          <View style={{ flex: 1 }}>
            <Text style={font.body}>Council size</Text>
            <Text style={font.small}>How many models draft each answer</Text>
          </View>
          <StepperBtn icon="minus" onPress={() => stepEnsemble(-1)} />
          <Text style={[font.h3, { width: 34, textAlign: 'center' }]}>{settings.ensembleSize}</Text>
          <StepperBtn icon="plus" onPress={() => stepEnsemble(1)} />
        </View>
      </Card>

      {/* -------------------- council roster -------------------- */}
      <SectionTitle
        icon="account-group-outline"
        title="Your council"
        trailing={
          <Text style={font.small}>
            {settings.councilModels.length} of {catalog.length} selected
          </Text>
        }
      />

      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          Pick the models you want on the team. The orchestrator routes each job by specialty,
          caps two models per vendor for diversity, runs the drafts in parallel and has the
          heaviest model merge them into one answer.
        </Text>
        <View style={styles.chipWrap}>
          {shown.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              selected={settings.councilModels.includes(m.id)}
              onPress={() => toggleCouncilModel(m.id)}
            />
          ))}
        </View>
        {catalog.length > 18 && (
          <Btn
            label={showAllModels ? 'Show fewer' : `Show all ${catalog.length} models`}
            variant="ghost"
            onPress={() => setShowAllModels((s) => !s)}
          />
        )}
      </Card>

      {/* fast chat model */}
      <SectionTitle icon="lightning-bolt-outline" title="Fast chat model" />
      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          Used when Council mode is off: one model, quick reply, cheapest. Currently{' '}
          <Text style={{ color: colors.accent }}>{modelLabel(settings.chatModel)}</Text>.
        </Text>
        <View style={styles.chipWrap}>
          {(liveModels.length ? liveModels : MODEL_CATALOG)
            .slice()
            .sort((a, b) => (b.speed === 'fast' ? 1 : 0) - (a.speed === 'fast' ? 1 : 0))
            .slice(0, 12)
            .map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                selected={settings.chatModel === m.id}
                onPress={() => void updateSettings({ chatModel: m.id })}
              />
            ))}
        </View>
      </Card>

      {/* image model */}
      <SectionTitle icon="image-outline" title="Progress image model" />
      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          Illustrations go through the gateway's image endpoint. If this model is unavailable the
          app silently falls back to the built-in offline poster, so you always get an image.
        </Text>
        <View style={styles.chipWrap}>
          {['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'flux-1.1-pro', 'imagen-4'].map((id) => (
            <Chip
              key={id}
              label={modelLabel(id)}
              selected={settings.imageModel === id}
              onPress={() => void updateSettings({ imageModel: id })}
            />
          ))}
        </View>
      </Card>

      {/* units */}
      <SectionTitle icon="swap-horizontal" title="Units" />
      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          How weights are shown. The stored data is always metric, so switching never loses
          anything.
        </Text>
        <View style={styles.chipWrap}>
          <Chip
            label="Kilograms"
            selected={settings.units !== 'imperial'}
            onPress={() => void updateSettings({ units: 'metric' })}
          />
          <Chip
            label="Pounds"
            selected={settings.units === 'imperial'}
            onPress={() => void updateSettings({ units: 'imperial' })}
          />
        </View>
      </Card>

      {/* -------------------- program -------------------- */}
      <SectionTitle icon="clipboard-text-outline" title="Program" />
      <Card>
        {program ? (
          <>
            <Text style={font.h3}>{program.title}</Text>
            <Text style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>{program.summary}</Text>
            <View style={styles.pillRow}>
              <Pill label={`${program.weeks} WEEKS`} />
              <Pill label={`${program.daysPerWeek} DAYS/WK`} color={colors.gold} />
              <Pill label={`${program.generatedBy.length} MODELS`} color={colors.purple} />
            </View>
          </>
        ) : (
          <Text style={font.dim}>No program on this device yet.</Text>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Btn label="Regenerate" variant="ghost" onPress={onRegenerate} style={{ flex: 1 }} />
          <Btn
            label="Open plan"
            onPress={() => router.push('/(tabs)/plan')}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {/* -------------------- about / legal -------------------- */}
      <SectionTitle icon="information-outline" title="About" />
      <Card>
        <Text style={[font.dim, { lineHeight: 20 }]}>
          Ascent AI Trainer is an independent, open reimplementation of a gamified AI training app.
          It ships with no paid features, no ads, no analytics and no accounts: the only network
          calls it makes are to the AI gateway your own key points at.
        </Text>
        <Divider />
        <Pressable
          onPress={() => Linking.openURL('https://tokenharbor.ai/docs')}
          style={styles.aboutLink}
        >
          <MaterialCommunityIcons name="open-in-new" size={16} color={colors.accent} />
          <Text style={[font.body, { color: colors.accent, marginLeft: 8 }]}>
            Gateway docs & billing
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL('https://tokenharbor.ai/dashboard/api-keys')}
          style={styles.aboutLink}
        >
          <MaterialCommunityIcons name="key-outline" size={16} color={colors.accent} />
          <Text style={[font.body, { color: colors.accent, marginLeft: 8 }]}>Manage API keys</Text>
        </Pressable>
      </Card>

      <Card style={{ marginTop: spacing.md, borderColor: colors.danger }}>
        <Text style={[font.h3, { color: colors.danger }]}>Medical disclaimer</Text>
        <Text style={[font.small, { marginTop: 8, lineHeight: 18 }]}>
          This app generates training and nutrition suggestions with language models. It is not
          medical advice and the models can be wrong. Talk to a qualified professional before
          starting a new program, especially if you have a heart condition, are pregnant, are
          recovering from injury, or take medication. Stop immediately if you feel pain, dizziness
          or shortness of breath.
        </Text>
        <Btn
          label="Erase all data"
          variant="danger"
          onPress={onReset}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      <Text style={[font.small, { textAlign: 'center', marginTop: spacing.lg }]}>
          Ascent · local-first · your key, your models, your data
      </Text>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

function SectionTitle({
  icon,
  title,
  trailing,
}: {
  icon: any;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.accent} />
      <Text style={[font.h3, { marginLeft: 8, flex: 1 }]}>{title}</Text>
      {trailing}
    </View>
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

function Row({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={font.body}>{label}</Text>
        <Text style={font.small}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentSoft }}
        thumbColor={value ? colors.accent : colors.textFaint}
      />
    </View>
  );
}

function StepperBtn({ icon, onPress }: { icon: 'plus' | 'minus'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stepper}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function LinkTile({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkTile}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
      <Text style={[font.body, { marginLeft: 8, fontSize: 14 }]}>{label}</Text>
    </Pressable>
  );
}

function connColor(state: ConnState): string {
  if (state === 'ok') return colors.success;
  if (state === 'fail') return colors.danger;
  if (state === 'checking') return colors.accent;
  return colors.border;
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
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  linkTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stepper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' },
  aboutLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
