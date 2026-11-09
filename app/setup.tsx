/**
 * Connect step. The app is fully free because the user brings their own
 * Token Harbor Universal Key (thk_live_...). One key unlocks 50+ models.
 */
import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Card, GlowCard, Screen } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import { listModels, DEFAULT_BASE_URL } from '@/lib/tokenHarbor';
import { DEFAULT_COUNCIL, DEFAULT_CHAT_MODEL } from '@/lib/models';
import { useApp } from '@/context/AppContext';

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();
  const [key, setKey] = useState(settings.apiKey);
  const [base, setBase] = useState(settings.apiBaseUrl || DEFAULT_BASE_URL);
  const [testing, setTesting] = useState(false);

  /** Reached from the You tab rather than first launch → show a way back. */
  const isEdit = Boolean(settings.apiKey);
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  async function connect() {
    const trimmed = key.trim();
    if (!trimmed) {
      Alert.alert('Key required', 'Paste your Token Harbor Universal Key (starts with thk_live_).');
      return;
    }
    setTesting(true);
    try {
      const models = await listModels(trimmed, base.trim());
      const ids = models.map((m) => m.id);
      const council = DEFAULT_COUNCIL.filter((m) => !ids.length || ids.includes(m));
      await updateSettings({
        apiKey: trimmed,
        apiBaseUrl: base.trim() || DEFAULT_BASE_URL,
        councilModels: council.length >= 3 ? council : ids.slice(0, 10),
        chatModel: ids.includes(DEFAULT_CHAT_MODEL) ? DEFAULT_CHAT_MODEL : ids[0] ?? DEFAULT_CHAT_MODEL,
      });
      Alert.alert(
        'Connected',
        ids.length
          ? `Your key reaches ${ids.length} models. The council is ready.`
          : 'Key saved. Free models (ids ending in :free) cost nothing.',
        [
          {
            text: 'Continue',
            onPress: () => {
              if (isEdit) dismiss();
              else router.replace('/onboarding');
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        'Could not connect',
        `${(e as Error).message}\n\nCheck the key and your connection. You can still continue and fix it later in Settings.`,
        [
          { text: 'Try again', style: 'cancel' },
          {
            text: 'Continue anyway',
            onPress: async () => {
              await updateSettings({
                apiKey: key.trim(),
                apiBaseUrl: base.trim() || DEFAULT_BASE_URL,
              });
              if (isEdit) dismiss();
              else router.replace('/onboarding');
            },
          },
        ],
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="sword-cross" size={26} color={colors.gold} />
          </View>
          <Text style={[font.h1, { marginTop: spacing.lg }]}>
            {isEdit ? 'YOUR KEY' : 'ASCENT'}
          </Text>
          <Text style={[font.dim, { marginTop: 6, lineHeight: 21 }]}>
            {isEdit
              ? 'Update the Token Harbor key or base URL stored on this device.'
              : 'Your AI training council. 50+ models draft, critique and merge every plan — for free.'}
          </Text>
        </View>

        <GlowCard style={{ marginTop: spacing.xl }}>
          <Text style={font.h3}>1. Get a free Token Harbor key</Text>
          <Text style={[font.dim, { marginTop: 6, lineHeight: 20 }]}>
            Create a free account at tokenharbor.ai, open Dashboard → API keys, and copy the
            Universal Key that starts with <Text style={{ color: colors.accent }}>thk_live_</Text>.
            Free models (ids ending in :free) never charge your balance.
          </Text>
          <Btn
            label="Open tokenharbor.ai"
            variant="ghost"
            style={{ marginTop: spacing.md }}
            onPress={() => Linking.openURL('https://tokenharbor.ai/dashboard/api-keys')}
          />
        </GlowCard>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={font.h3}>2. Paste it here</Text>
          <Text style={[font.small, { marginTop: 4 }]}>Stored only on this device.</Text>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="thk_live_..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
          <Text style={[font.small, { marginTop: spacing.md }]}>API base URL</Text>
          <TextInput
            value={base}
            onChangeText={setBase}
            placeholder={DEFAULT_BASE_URL}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Btn label="Connect & test key" onPress={connect} loading={testing} style={{ marginTop: spacing.lg }} />
          {isEdit && (
            <Btn
              label="Cancel"
              variant="ghost"
              onPress={dismiss}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>

        <Text style={[font.small, { marginTop: spacing.lg, textAlign: 'center', lineHeight: 18 }]}>
          No subscription. No paywall. The app is free — you only pay Token Harbor for the tokens
          you personally use, and free-tier models cost nothing.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.xl },
  badge: {
    width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  input: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
  },
});