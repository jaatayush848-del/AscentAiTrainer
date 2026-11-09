/**
 * Achievement toast — the moment a milestone lands.
 *
 * Mounted once in the root layout, above the navigator, so it appears over any
 * screen. Reads the unlock queue from the context, animates in, stays for a
 * few seconds and slides out. Celebration is the cheapest retention feature
 * there is, so it gets real animation weight.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, glow, radius, spacing } from '@/lib/theme';
import { TIER_COLOR } from '@/lib/achievements';
import { useApp } from '@/context/AppContext';

const TIER_LABEL: Record<string, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  mythic: 'MYTHIC',
};

export function AchievementToast() {
  const insets = useSafeAreaInsets();
  const { unlockQueue, dismissUnlock } = useApp();
  const current = unlockQueue[0];

  const slide = useRef(new Animated.Value(-160)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    slide.setValue(-160);
    scale.setValue(0.9);
    shine.setValue(0);

    const inAnim = Animated.parallel([
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 80,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.timing(shine, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]);
    inAnim.start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: -200,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => dismissUnlock(current.id));
    }, 3600);

    return () => {
      clearTimeout(timer);
      inAnim.stop();
    };
  }, [current, dismissUnlock, scale, shine, slide]);

  if (!current) return null;

  const tint = TIER_COLOR[current.tier as keyof typeof TIER_COLOR] ?? colors.gold;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8, transform: [{ translateY: slide }, { scale }] },
      ]}
    >
      <Pressable onPress={() => dismissUnlock(current.id)} style={[styles.card, glow(tint, 22), { borderColor: tint }]}>
        <View style={[styles.iconWrap, { borderColor: tint }]}>
          <MaterialCommunityIcons name={current.icon as any} size={24} color={tint} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.kicker, { color: tint }]}>
            ACHIEVEMENT UNLOCKED · {TIER_LABEL[current.tier] ?? ''}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.desc} numberOfLines={1}>
            {current.description}
          </Text>
        </View>
        <View style={styles.xpWrap}>
          <Text style={[styles.xp, { color: tint }]}>+{current.xp}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1120',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  desc: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  xpWrap: { alignItems: 'center', marginLeft: spacing.sm },
  xp: { fontSize: 17, fontWeight: '900' },
  xpLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800' },
});