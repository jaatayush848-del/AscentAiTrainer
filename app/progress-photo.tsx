/**
 * Progress image screen.
 *
 * 1. Optionally attach a real progress photo.
 * 2. The council analyses the check-in and writes a score, headline, pep talk
 *    and an image prompt.
 * 3. Two images are produced:
 *      - an AI-generated motivational illustration (if an image model is set)
 *      - an offline SVG transformation poster built from real stats (always)
 * 4. Save both into the gallery and share the poster.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Pill } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { PosterCard } from '@/components/PosterCard';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { analyzeProgress, defaultImagePrompt, ProgressAnalysis } from '@/lib/ai';
import { cacheImage, generateImage, savePoster } from '@/lib/progressImage';
import { PosterStats, ProgressPhoto } from '@/types';

export default function ProgressPhotoScreen() {
  const insets = useSafeAreaInsets();
  const { profile, bodyLogs, settings, addPhoto, level, streak, program } = useApp();

  const [photoUri, setPhotoUri] = useState<string>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [analysis, setAnalysis] = useState<ProgressAnalysis>();
  const [aiImageUri, setAiImageUri] = useState<string>();
  const [posterUri, setPosterUri] = useState<string>();
  /** the same numbers the SVG exporter uses, rendered natively on screen */
  const [posterStats, setPosterStats] = useState<PosterStats>();
  const [error, setError] = useState<string>();

  const startWeight = profile?.weightKg ?? 0;
  const currentWeight = useMemo(() => {
    const logs = bodyLogs.filter((b) => typeof b.weightKg === 'number');
    return logs.length ? logs[logs.length - 1].weightKg! : startWeight;
  }, [bodyLogs, startWeight]);

  const dayNumber = useMemo(() => {
    if (!profile) return 1;
    // prefer the real program start date, else approximate from logged check-ins
    const start = program?.createdAt ?? (bodyLogs.length ? bodyLogs[0].date : undefined);
    if (start) {
      const days = Math.floor((Date.now() - start) / 86400000) + 1;
      return Math.max(1, Math.min(profile.goalDays, days));
    }
    return 1;
  }, [profile, program, bodyLogs]);

  if (!profile) {
    return <EmptyState icon="account-alert-outline" title="No profile" body="Finish onboarding first." />;
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo permission denied.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission denied.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function generate() {
    setBusy(true);
    setError(undefined);
    setAnalysis(undefined);
    setAiImageUri(undefined);
    setPosterUri(undefined);
    setPosterStats(undefined);
    try {
      setStatus('The council is reading your check-in…');
      const result = await analyzeProgress(
        profile!,
        {
          dayNumber,
          startWeightKg: startWeight,
          currentWeightKg: currentWeight,
          targetWeightKg: profile!.targetWeightKg,
          note,
        },
        { apiKey: settings.apiKey, baseUrl: settings.apiBaseUrl, chatModel: settings.chatModel, ensembleSize: settings.ensembleSize },
      );
      setAnalysis(result);

      // offline poster (always)
      const stats: PosterStats = {
        name: profile!.name,
        dayNumber,
        totalDays: profile!.goalDays,
        startWeightKg: startWeight,
        currentWeightKg: currentWeight,
        targetWeightKg: profile!.targetWeightKg,
        rank: level.rank,
        level: level.level,
        streak,
        headline: result.headline,
        encouragement: result.encouragement,
        score: result.score,
      };
      setStatus('Rendering your transformation poster…');
      setPosterStats(stats);
      const poster = await savePoster(stats, `poster_${Date.now()}`);
      setPosterUri(poster);

      // AI illustration (optional)
      let aiUri: string | undefined;
      try {
        setStatus('Painting your hero image…');
        const img = await generateImage({
          apiKey: settings.apiKey,
          baseUrl: settings.apiBaseUrl,
          model: settings.imageModel || 'gpt-image-1',
          prompt: result.imagePrompt || defaultImagePrompt(profile!),
        });
        const cached = await cacheImage(img.url, `ai_${Date.now()}`);
        aiUri = cached;
        setAiImageUri(cached);
      } catch {
        // image models may not be enabled on the account — the poster is enough
        aiUri = undefined;
        setAiImageUri(undefined);
      }

      const entry: ProgressPhoto = {
        id: `photo_${Date.now()}`,
        uri: photoUri ?? '',
        date: Date.now(),
        weightKg: currentWeight,
        note,
        aiCaption: result.encouragement,
        aiScore: result.score,
        aiHeadline: result.headline,
        aiEncouragement: result.encouragement,
        imagePrompt: result.imagePrompt,
        aiImageUri: aiUri,
        posterUri: poster,
        posterStats: stats,
      };
      await addPhoto(entry);
      setStatus('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!posterUri) return;
    const available = await Sharing.isAvailableAsync();
    if (available) await Sharing.shareAsync(posterUri);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
    >
      <Text style={font.small}>PROGRESS IMAGE</Text>
      <Text style={[font.h1, { marginTop: 2 }]}>See your transformation</Text>
      <Text style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>
        The council reads your stats and motivation, then turns them into a hero image and a shareable poster.
      </Text>

      {/* photo input */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={font.h3}>Your photo (optional)</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <MaterialCommunityIcons name="camera-plus-outline" size={34} color={colors.textFaint} />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <Btn label="Library" variant="ghost" onPress={pickPhoto} style={{ flex: 1 }} />
          <Btn label="Camera" variant="ghost" onPress={takePhoto} style={{ flex: 1 }} />
        </View>
        <Text style={[font.small, { marginTop: spacing.lg }]}>How do you feel? Any note for the coach</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Clothes feel looser, more energy this week"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.input}
        />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Row label="Day" value={`${dayNumber} / ${profile.goalDays}`} />
        <Row label="Start weight" value={`${startWeight.toFixed(1)} kg`} />
        <Row label="Current weight" value={`${currentWeight.toFixed(1)} kg`} />
        <Row label="Target" value={`${profile.targetWeightKg.toFixed(1)} kg`} />
        <Row label="Rank" value={`${level.rank} · Lv ${level.level}`} />
        <Row label="Streak" value={`${streak} days`} />
      </Card>

      <Btn
        label={busy ? 'Working…' : 'Generate progress image'}
        onPress={generate}
        loading={busy}
        style={{ marginTop: spacing.lg }}
      />

      {busy && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={font.dim}>{status}</Text>
        </View>
      )}

      {error && <Text style={[font.dim, { color: colors.danger, marginTop: spacing.md }]}>{error}</Text>}

      {analysis && (
        <>
          <GlowCard color={colors.gold} style={{ marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[font.small, { color: colors.gold }]}>COUNCIL SCORE</Text>
              <Pill label={`${analysis.score}/100`} color={colors.gold} />
            </View>
            <Text style={[font.h3, { marginTop: 6 }]}>{analysis.headline}</Text>
            {analysis.observations.map((o, i) => (
              <Text key={i} style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>
                • {o}
              </Text>
            ))}
          </GlowCard>

          <GlowCard color={colors.accent} style={{ marginTop: spacing.md }}>
            <Text style={[font.body, { fontStyle: 'italic', lineHeight: 22 }]}>
              “{analysis.encouragement}”
            </Text>
            <Text style={[font.small, { marginTop: spacing.md, color: colors.accent }]}>NEXT STEPS</Text>
            {analysis.nextSteps.map((s, i) => (
              <Text key={i} style={[font.dim, { marginTop: 4 }]}>
                → {s}
              </Text>
            ))}
          </GlowCard>
        </>
      )}

      {posterStats && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[font.h3, { marginBottom: spacing.sm }]}>Transformation poster</Text>
          <PosterCard stats={posterStats} />
          {posterUri && (
            <Btn label="Share poster" variant="gold" onPress={share} style={{ marginTop: spacing.md }} />
          )}
        </View>
      )}

      {aiImageUri && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[font.h3, { marginBottom: spacing.sm }]}>AI hero image</Text>
          <Image source={{ uri: aiImageUri }} style={styles.result} resizeMode="contain" />
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={font.dim}>{label}</Text>
      <Text style={font.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.bgElevated },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  input: {
    marginTop: 6,
    minHeight: 70,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  result: { width: '100%', height: 400, borderRadius: radius.md, backgroundColor: colors.bgElevated },
});
