/**
 * "Generating your program" screen.
 *
 * Runs the full council pipeline (several models draft, one synthesizes) and
 * shows live progress, then saves the program and drops the user into the app.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Btn, Screen } from '@/components/ui';
import { colors, font, glow, spacing } from '@/lib/theme';
import { useApp } from '@/context/AppContext';
import { generateProgram } from '@/lib/ai';

export default function GenerateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const { settings, profile, setProgram } = useApp();
  const [status, setStatus] = useState('Waking the council…');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(settings.ensembleSize || 5);
  const [error, setError] = useState<string | null>();
  const [models, setModels] = useState<string[]>([]);

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  async function run() {
    if (!profile) return;
    setError(null);
    setDone(0);
    try {
      const program = await generateProgram(profile, {
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        chatModel: settings.chatModel,
        councilModels: settings.councilModels,
        ensembleSize: settings.ensembleSize,
        onProgress: (msg, d, t) => {
          setStatus(msg);
          setDone(d);
          setTotal(t || t === 0 ? t : settings.ensembleSize);
          setModels((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
        },
      });
      await setProgram(program);
      if (replace === '1') {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus('The council could not finish.');
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pct = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <Screen>
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Animated.View style={[styles.orb, glow(colors.accent, 30), { transform: [{ rotate }] }]}>
          <MaterialCommunityIcons name="crown" size={44} color={colors.gold} />
        </Animated.View>

        <Text style={[font.h2, { marginTop: spacing.xl, textAlign: 'center' }]}>
          Forging your program
        </Text>
        <Text style={[font.dim, { marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.lg }]}>
          {status}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>

        {models.length > 0 && (
          <View style={styles.modelList}>
            {models.slice(-5).map((m) => (
              <Text key={m} style={font.small} numberOfLines={1}>
                • {m}
              </Text>
            ))}
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={[font.dim, { color: colors.danger, lineHeight: 20 }]}>{error}</Text>
            <Btn label="Retry" onPress={run} style={{ marginTop: spacing.md }} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl },
  orb: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  fill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  modelList: { alignSelf: 'stretch', marginTop: spacing.lg },
  errorBox: { alignSelf: 'stretch', marginTop: spacing.xl },
});
