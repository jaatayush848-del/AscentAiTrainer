/**
 * AI Coach tab. Free-form chat that answers any fitness/nutrition/motivation
 * question. A toggle switches between a fast single model and the full council
 * (many models draft, one synthesizes) for deep questions.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '@/components/ui';
import { colors, font, glow, radius, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { coachAnswer } from '@/lib/ai';
import { modelLabel } from '@/lib/models';
import { ChatMessage } from '@/types';

const SUGGESTIONS = [
  'How much protein should I eat today?',
  'My knees hurt after squats — what should I do?',
  'I missed 3 days. How do I get back on track?',
  'Build me a quick 15-minute home workout.',
  'Am I on pace to hit my goal?',
];

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const { settings, profile, chat, setChatMessages } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCouncil, setUseCouncil] = useState(settings.councilMode);
  const [progressNote, setProgressNote] = useState('');
  /** text arriving from the stream before the message is committed */
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>();
  const abortRef = useRef<AbortController | null>();

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [chat.length, busy, draft]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: question,
        at: Date.now(),
      };
      const withUser = [...chat, userMsg];
      await setChatMessages(withUser);
      setInput('');
      setBusy(true);
      setProgressNote(useCouncil ? 'Convening the council…' : 'Thinking…');

      const controller = new AbortController();
      abortRef.current = controller;
      const streaming = settings.streaming && !useCouncil;

      try {
        const { answer, consulted } = await coachAnswer(withUser, question, profile!, {
          apiKey: settings.apiKey,
          baseUrl: settings.apiBaseUrl,
          chatModel: settings.chatModel,
          councilModels: settings.councilModels,
          ensembleSize: settings.ensembleSize,
          useCouncil,
          stream: streaming,
          signal: controller.signal,
          onDelta: streaming ? (t) => setDraft((prev) => prev + t) : undefined,
          onProgress: (m, d, t) => setProgressNote(`${m} (${d}/${t})`),
        });
        const aiMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: answer,
          at: Date.now(),
          consulted,
        };
        await setChatMessages([...withUser, aiMsg]);
      } catch (e) {
        const stopped = (e as Error).name === 'AbortError';
        const aiMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: stopped
            ? 'Stopped. Ask again whenever you are ready.'
            : `I couldn't reach the models: ${(e as Error).message}\n\nCheck your key in the You tab.`,
          at: Date.now(),
        };
        await setChatMessages([...withUser, aiMsg]);
      } finally {
        abortRef.current = null;
        setDraft('');
        setBusy(false);
        setProgressNote('');
      }
    },
    [chat, busy, profile, settings, setChatMessages, useCouncil],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Screen>
        {/* council toggle */}
        <View style={styles.toggleBar}>
          <View style={{ flex: 1 }}>
            <Text style={font.body}>Council mode</Text>
            <Text style={font.small}>
              {useCouncil
                ? `${settings.ensembleSize} models draft, one merges`
                : `Fast answer · ${modelLabel(settings.chatModel)}`}
            </Text>
          </View>
          <Switch
            value={useCouncil}
            onValueChange={setUseCouncil}
            trackColor={{ true: colors.accentSoft, false: colors.border }}
            thumbColor={useCouncil ? colors.accent : colors.textFaint}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {chat.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <MaterialCommunityIcons name="robot-happy-outline" size={46} color={colors.accent} />
              <Text style={[font.h3, { marginTop: spacing.md }]}>Ask me anything</Text>
              <Text style={[font.dim, { marginTop: 6, textAlign: 'center', lineHeight: 20 }]}>
                Training, food, soreness, motivation — I know your whole plan and profile.
              </Text>
            </View>
          )}

          {chat.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}
            >
              {m.role === 'assistant' && (
                <Text style={styles.aiTag}>
                  COACH{useCouncil && m.consulted?.length ? ` · ${m.consulted.length} MODELS` : ''}
                </Text>
              )}
              <Text style={{ color: m.role === 'user' ? '#05060a' : colors.text, fontSize: 15, lineHeight: 22 }}>
                {m.content}
              </Text>
            </View>
          ))}

          {/* live streamed answer, before it is committed to history */}
          {busy && draft.length > 0 && (
            <View style={[styles.bubble, styles.ai]}>
              <Text style={styles.aiTag}>
                COACH · {modelLabel(settings.chatModel).toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
                {draft}
                <Text style={{ color: colors.accent }}>▍</Text>
              </Text>
            </View>
          )}

          {busy && (
            <View style={[styles.bubble, styles.ai, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={font.small}>{draft.length > 0 ? 'Receiving…' : progressNote}</Text>
            </View>
          )}
        </ScrollView>

        {/* suggestions */}
        {chat.length === 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => send(s)}>
                <Text style={{ color: colors.textDim, fontSize: 13 }}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* input */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={() => (busy ? stop() : send(input))}
            disabled={!busy && !input.trim()}
            style={[
              styles.sendBtn,
              glow(busy ? colors.danger : colors.accent, 10),
              {
                backgroundColor: busy ? colors.danger : colors.accent,
                opacity: !busy && !input.trim() ? 0.4 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={busy ? 'stop' : 'send'}
              size={20}
              color="#05060a"
            />
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  bubble: { maxWidth: '86%', borderRadius: 18, padding: spacing.md, marginBottom: 10 },
  ai: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  user: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  aiTag: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 4 },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: colors.card,
    height: 36,
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
