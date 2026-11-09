/**
 * Conversational onboarding.
 *
 * The AI "asks" the questions one screen at a time (the copy and flow are
 * authored in src/lib/ai.ts). Answers are collected into RawAnswers, then the
 * model normalizes them into a profile before the program is generated.
 *
 * Chat-style: the assistant asks, the user answers with chips / numbers / text,
 * and the transcript grows, so it feels like an AI interview rather than a form.
 */
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Chip, Screen } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import { ONBOARDING_QUESTIONS, RawAnswers, mapRawAnswers, OnboardingQuestion } from '@/lib/ai';
import { useApp } from '@/context/AppContext';
import { OnboardingProfile } from '@/types';

interface Bubble {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { setProfile, profile } = useApp();

  /**
   * When the flow is opened from the profile screen we already have a synced
   * profile, so re-running the interview overwrites it from question one
   * instead of the old "resume where the name was already set" behaviour.
   */
  const isEdit = edit === '1';
  /** In edit mode the old profile is the seed, so nothing is lost when re-answering. */
  const existing = profile;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<RawAnswers>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: 'greet',
      role: 'ai',
      text: "I'm your training council — dozens of AI coaches working as one. Answer a few questions and I'll build a plan made only for you.",
    },
  ]);
  const [name, setName] = useState(existing?.name ?? '');
  const [pending, setPending] = useState<string[]>([]);
  const [textValue, setTextValue] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const q: OnboardingQuestion | undefined = ONBOARDING_QUESTIONS[index];
  const total = ONBOARDING_QUESTIONS.length + 1; // + name step

  function pushBubbles(ai: string, user?: string) {
    setBubbles((prev) => {
      const next = [...prev, { id: `ai_${Date.now()}`, role: 'ai' as const, text: ai }];
      if (user) next.push({ id: `u_${Date.now()}`, role: 'user' as const, text: user });
      return next;
    });
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  function advance(nextAnswers: RawAnswers, nextIndex: number) {
    setAnswers(nextAnswers);
    if (nextIndex >= ONBOARDING_QUESTIONS.length) {
      finish(nextAnswers);
      return;
    }
    const nextQ = ONBOARDING_QUESTIONS[nextIndex];
    setIndex(nextIndex);
    setTextValue('');
    setPending([]);
    pushBubbles(nextQ.title + (nextQ.subtitle ? `\n${nextQ.subtitle}` : ''));
  }

  /* ---- answer handlers ---- */

  function answerSingle(value: string, label: string) {
    if (!q) return;
    const next = { ...answers, [q.id]: value };
    setBubbles((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: label }]);
    advance(next, index + 1);
  }

  function toggleMulti(value: string, label: string) {
    setPending((prev) => {
      const has = prev.includes(value);
      const next = has ? prev.filter((v) => v !== value) : [...prev, value];
      return next;
    });
  }

  function confirmMulti() {
    if (!q) return;
    const labels =
      q.options?.filter((o) => pending.includes(o.value)).map((o) => o.label) ?? [];
    const next = { ...answers, [q.id]: pending };
    setBubbles((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', text: labels.join(', ') || 'None' },
    ]);
    advance(next, index + 1);
  }

  function submitNumber() {
    if (!q) return;
    const n = parseInt(textValue.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    let value = n;
    if (typeof q.max === 'number') value = Math.min(q.max, value);
    if (typeof q.min === 'number') value = Math.max(q.min, value);
    const next = { ...answers, [q.id]: value };
    setBubbles((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', text: String(value) },
    ]);
    advance(next, index + 1);
  }

  function submitText() {
    if (!q) return;
    const v = textValue.trim();
    if (!v) return;
    const next = { ...answers, [q.id]: v };
    setBubbles((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: v }]);
    advance(next, index + 1);
  }

  async function finish(finalAnswers: RawAnswers) {
    const partial = mapRawAnswers({ ...finalAnswers, name: name || 'Athlete' });
    const profile: OnboardingProfile = {
      name: name || 'Athlete',
      gender: partial.gender ?? 'other',
      age: partial.age ?? 30,
      heightCm: partial.heightCm ?? 170,
      weightKg: partial.weightKg ?? 75,
      targetWeightKg: partial.targetWeightKg ?? 70,
      goalDays: partial.goalDays ?? 60,
      daysPerWeek: partial.daysPerWeek ?? existing?.daysPerWeek,
      units: 'metric',
      goal: partial.goal ?? 'stayInShape',
      fitnessLevel: partial.fitnessLevel ?? 'beginner',
      activityLevel: partial.activityLevel ?? 'lightlyActive',
      equipment: partial.equipment ?? ['none'],
      focusAreas: partial.focusAreas ?? [],
      motivations: partial.motivations ?? [],
      healthConditions: partial.healthConditions ?? ['none'],
      // keep whatever the interview collected, falling back to the existing profile
      becoming: partial.becoming || existing?.becoming,
      freeNotes: partial.freeNotes ?? existing?.freeNotes,
    };
    await setProfile(profile);
    router.replace(isEdit ? '/(tabs)/profile' : '/generate');
  }

  /* ---- name step ---- */

  if (!name) {
    return (
      <Screen>
        <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
          <MaterialCommunityIcons name="account-star-outline" size={52} color={colors.gold} />
          <Text style={[font.h2, { marginTop: spacing.lg, textAlign: 'center' }]}>What should I call you?</Text>
          <Text style={[font.dim, { marginTop: 6, textAlign: 'center' }]}>Your council personalizes everything to you.</Text>
          <TextInput
            value={textValue}
            onChangeText={setTextValue}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            style={styles.nameInput}
            autoFocus
          />
          <Btn
            label="Begin"
            onPress={() => {
              const n = textValue.trim() || 'Athlete';
              setName(n);
              setTextValue('');
              const first = ONBOARDING_QUESTIONS[0];
              pushBubbles(first.title, undefined);
            }}
            style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        {/* progress header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, ((index + 1) / total) * 100)}%` }]} />
          </View>
          <Text style={[font.small, { marginTop: 6 }]}>
            {Math.min(index + 1, total)} / {total}
          </Text>
        </View>

        {/* transcript */}
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 20 }}>
          {bubbles.map((b) => (
            <View
              key={b.id}
              style={[
                styles.bubble,
                b.role === 'ai' ? styles.aiBubble : styles.userBubble,
              ]}
            >
              {b.role === 'ai' && (
                <Text style={styles.aiTag}>COUNCIL</Text>
              )}
              <Text style={{ color: b.role === 'ai' ? colors.text : '#05060a', fontSize: 15, lineHeight: 21 }}>
                {b.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* answer area */}
        <View style={[styles.answers, { paddingBottom: insets.bottom + 12 }]}>
          {q?.kind === 'single' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {q.options?.map((o) => (
                <Chip key={o.value} label={o.label} onPress={() => answerSingle(o.value, o.label)} />
              ))}
            </View>
          )}

          {q?.kind === 'multi' && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {q.options?.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    selected={pending.includes(o.value)}
                    onPress={() => toggleMulti(o.value, o.label)}
                  />
                ))}
              </View>
              <Btn label="Confirm" onPress={confirmMulti} style={{ marginTop: spacing.sm }} />
            </>
          )}

          {q?.kind === 'number' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                keyboardType="number-pad"
                placeholder={q.placeholder ?? 'Type a number'}
                placeholderTextColor={colors.textFaint}
                style={[styles.input, { flex: 1 }]}
                onSubmitEditing={submitNumber}
              />
              <Btn label="→" onPress={submitNumber} disabled={!textValue.trim()} />
            </View>
          )}

          {q?.kind === 'text' && (
            <>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                placeholder={q.placeholder}
                placeholderTextColor={colors.textFaint}
                multiline
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              />
              <Btn label="Send" onPress={submitText} disabled={!textValue.trim()} style={{ marginTop: 8 }} />
            </>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl },
  nameInput: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  header: { paddingHorizontal: spacing.lg },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  bubble: { maxWidth: '88%', borderRadius: 18, padding: spacing.md, marginBottom: 10 },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderBottomRightRadius: 6,
  },
  aiTag: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  answers: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
});