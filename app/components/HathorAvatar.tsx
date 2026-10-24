import React, { useEffect, useState } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  G,
  Path,
  Circle,
  Ellipse,
  Rect,
} from 'react-native-svg';

interface HathorAvatarProps {
  heat: number; // 0 to 100
  mode: 'warm' | 'watchful' | 'Sekhmet';
  isStreaming: boolean;
  size?: number;
}

export function HathorAvatar({
  heat,
  mode,
  isStreaming,
  size = 140,
}: HathorAvatarProps) {
  const systemReducedMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(Boolean(systemReducedMotion));

  // Check system accessibility settings
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled || Boolean(systemReducedMotion));
    });
  }, [systemReducedMotion]);

  // Breathing float animation (-5px to +4px)
  const translateY = useSharedValue(0);

  // Speaking sway animation (-1.8deg to +1.8deg)
  const rotation = useSharedValue(0);

  // Flame flicker animation (scale and opacity)
  const flameScaleY = useSharedValue(1);
  const flameOpacity = useSharedValue(0.9);

  // Blink animation (eyelid opacity / scaleY)
  const blinkProgress = useSharedValue(0);

  // Heat normalized (0 to 1) for transitions
  const heatProgress = useSharedValue(heat / 100);

  useEffect(() => {
    heatProgress.value = withTiming(Math.min(1, Math.max(0, heat / 100)), {
      duration: 600,
    });
  }, [heat]);

  // Start Idle Breathing loop
  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      return;
    }
    translateY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [reduceMotion]);

  // Start Flame flicker loop
  useEffect(() => {
    if (reduceMotion) {
      flameScaleY.value = 1;
      flameOpacity.value = 0.95;
      return;
    }
    flameScaleY.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 350, easing: Easing.linear }),
        withTiming(0.92, { duration: 300, easing: Easing.linear }),
        withTiming(1.08, { duration: 400, easing: Easing.linear }),
        withTiming(0.96, { duration: 250, easing: Easing.linear })
      ),
      -1,
      true
    );
    flameOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.82, { duration: 300 }),
        withTiming(0.95, { duration: 350 })
      ),
      -1,
      true
    );
  }, [reduceMotion]);

  // Start Blink loop (every 4 seconds)
  useEffect(() => {
    if (reduceMotion) {
      blinkProgress.value = 0;
      return;
    }
    const interval = setInterval(() => {
      blinkProgress.value = withSequence(
        withTiming(1, { duration: 80, easing: Easing.linear }),
        withTiming(0, { duration: 120, easing: Easing.linear })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [reduceMotion]);

  // Speaking sway when streaming
  useEffect(() => {
    if (!isStreaming || reduceMotion) {
      rotation.value = withTiming(0, { duration: 400 });
      return;
    }

    rotation.value = withRepeat(
      withSequence(
        withTiming(-1.8, { duration: 550, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.8, { duration: 600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [isStreaming, reduceMotion]);

  // Visual cues based on heat & mode
  const glowColor =
    mode === 'warm'
      ? 'rgba(212, 175, 55, 0.45)'
      : mode === 'watchful'
      ? 'rgba(217, 119, 6, 0.55)'
      : 'rgba(220, 38, 38, 0.75)';

  const flameColor =
    mode === 'warm'
      ? '#F59E0B'
      : mode === 'watchful'
      ? '#EA580C'
      : '#DC2626';

  const eyeColor =
    mode === 'warm'
      ? '#FBBF24'
      : mode === 'watchful'
      ? '#F97316'
      : '#EF4444';

  const avatarContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { rotateZ: `${rotation.value}deg` },
      ],
    };
  });

  const flameAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scaleY: flameScaleY.value }],
      opacity: flameOpacity.value,
    };
  });

  const eyelidAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: blinkProgress.value,
    };
  });

  const glowAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + heatProgress.value * 0.25;
    return {
      transform: [{ scale }],
    };
  });

  return (
    <View style={[styles.root, { width: size, height: size * 1.25 }]}>
      {/* Dynamic Glow Aura Layer */}
      <Animated.View
        style={[
          styles.glowAura,
          {
            width: size * 1.3,
            height: size * 1.3,
            borderRadius: (size * 1.3) / 2,
            backgroundColor: glowColor,
            shadowColor: glowColor,
          },
          glowAnimatedStyle,
        ]}
      />

      {/* Main Animated Hathor Figure */}
      <Animated.View style={[styles.figureContainer, avatarContainerStyle]}>
        <Svg
          width={size}
          height={size * 1.25}
          viewBox="0 0 200 250"
          fill="none"
        >
          <Defs>
            {/* Sun Disc Gradient */}
            <RadialGradient
              id="sunDiscGrad"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
              fx="40%"
              fy="40%"
            >
              <Stop offset="0%" stopColor="#FFFBEB" />
              <Stop offset="40%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor={mode === 'Sekhmet' ? '#B91C1C' : '#D97706'} />
            </RadialGradient>

            {/* Horns Gold Gradient */}
            <LinearGradient id="goldHornsGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FDE68A" />
              <Stop offset="50%" stopColor="#D4AF37" />
              <Stop offset="100%" stopColor="#78350F" />
            </LinearGradient>

            {/* Face/Skin Gradient */}
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E5B287" />
              <Stop offset="60%" stopColor="#D49B6A" />
              <Stop offset="100%" stopColor="#B37848" />
            </LinearGradient>

            {/* Collar Jewelry Gradient */}
            <LinearGradient id="collarGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#D4AF37" />
              <Stop offset="25%" stopColor={mode === 'Sekhmet' ? '#7F1D1D' : '#1E3A8A'} />
              <Stop offset="50%" stopColor="#D4AF37" />
              <Stop offset="75%" stopColor={mode === 'Sekhmet' ? '#7F1D1D' : '#1E3A8A'} />
              <Stop offset="100%" stopColor="#D4AF37" />
            </LinearGradient>
          </Defs>

          {/* 1. Hair Back Layer */}
          <G id="hair-back">
            <Path
              d="M 50 110 C 35 150 40 210 55 240 C 65 245 75 220 80 180 Z"
              fill="#181216"
            />
            <Path
              d="M 150 110 C 165 150 160 210 145 240 C 135 245 125 220 120 180 Z"
              fill="#181216"
            />
          </G>

          {/* 2. Dress & Royal Usekh Collar */}
          <G id="dress">
            <Path
              d="M 35 250 C 40 210 65 190 100 190 C 135 190 160 210 165 250 Z"
              fill={mode === 'Sekhmet' ? '#260B12' : '#1C1418'}
            />
            {/* Egyptian Broad Collar Rings */}
            <Path
              d="M 60 195 C 75 220 125 220 140 195 C 130 185 70 185 60 195 Z"
              fill="url(#collarGrad)"
              stroke="#D4AF37"
              strokeWidth="1.5"
            />
            <Circle cx="100" cy="210" r="5" fill="#D4AF37" stroke="#FDE68A" strokeWidth="1" />
          </G>

          {/* 3. Neck and Face */}
          <G id="face">
            <Path
              d="M 86 160 L 86 195 C 95 198 105 198 114 195 L 114 160 Z"
              fill="#C2895A"
            />
            <Path
              d="M 68 115 C 68 85 132 85 132 115 C 132 145 116 168 100 168 C 84 168 68 145 68 115 Z"
              fill="url(#skinGrad)"
            />

            {/* Nose */}
            <Path
              d="M 100 118 L 98 135 L 102 135"
              stroke="#B37848"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* EXPRESSION VARIANT: Eyebrows */}
            {mode === 'warm' && (
              // Amused, gentle high arches
              <G id="brows-warm">
                <Path
                  d="M 76 114 Q 85 107 94 112"
                  stroke="#1F151B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 106 112 Q 115 107 124 114"
                  stroke="#1F151B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {mode === 'watchful' && (
              // Asymmetric assessing brow (teasing cocked right eyebrow)
              <G id="brows-watchful">
                <Path
                  d="M 76 113 Q 85 109 94 113"
                  stroke="#1F151B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 106 111 Q 115 103 124 107"
                  stroke="#1F151B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {mode === 'Sekhmet' && (
              // Angry / Menacing sharply furrowed brows angled down to nose bridge
              <G id="brows-sekhmet">
                <Path
                  d="M 75 109 L 95 116"
                  stroke="#1F151B"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 105 116 L 125 109"
                  stroke="#1F151B"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {/* EXPRESSION VARIANT: Mouth & Lips */}
            {mode === 'warm' && (
              // Amused, soft radiant smile
              <G id="mouth-warm">
                <Path
                  d="M 93 145 Q 100 152 107 145 Q 100 154 93 145 Z"
                  fill="#DB2777"
                />
                <Path
                  d="M 92 144 Q 100 151 108 144"
                  stroke="#831843"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {mode === 'watchful' && (
              // Subtle knowing smirk (elevated right lip corner)
              <G id="mouth-watchful">
                <Path
                  d="M 93 147 Q 99 149 107 143 Q 100 153 93 147 Z"
                  fill="#BE123C"
                />
                <Path
                  d="M 92 147 Q 99 150 108 143"
                  stroke="#4C0519"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {mode === 'Sekhmet' && (
              // Angry / Fierce menacing snarling parted lips with feline fangs
              <G id="mouth-sekhmet">
                <Path
                  d="M 92 144 Q 100 142 108 144 Q 100 155 92 144 Z"
                  fill="#881337"
                />
                {/* Subtle feline fangs */}
                <Path d="M 95 144 L 97 148 L 99 144 M 101 144 L 103 148 L 105 144" fill="#FFFBEB" />
              </G>
            )}
          </G>

          {/* 4. Eyes & Kohl Eyeliner with Mode Variations */}
          <G id="eyes">
            {/* Left Eye */}
            <Path
              d={
                mode === 'Sekhmet'
                  ? 'M 77 123 Q 86 118 94 123 Q 86 127 77 123 Z'
                  : 'M 78 122 Q 86 116 93 122 Q 86 128 78 122 Z'
              }
              fill="#FFFFFF"
              stroke="#111827"
              strokeWidth="2"
            />
            <Path d="M 74 121 L 78 122 M 93 122 L 96 120" stroke="#111827" strokeWidth="1.5" />
            <Circle cx="86" cy="122" r="3.5" fill={eyeColor} />
            {mode === 'Sekhmet' ? (
              // Sekhmet solar lioness slit pupil
              <Ellipse cx="86" cy="122" rx="1.2" ry="3.2" fill="#111827" />
            ) : (
              // Round pupil with gold star highlight
              <>
                <Circle cx="86" cy="122" r="1.6" fill="#111827" />
                {mode === 'warm' && <Circle cx="87.5" cy="120.5" r="0.8" fill="#FFFFFF" />}
              </>
            )}

            {/* Right Eye */}
            <Path
              d={
                mode === 'Sekhmet'
                  ? 'M 106 123 Q 114 118 123 123 Q 114 127 106 123 Z'
                  : 'M 107 122 Q 114 116 122 122 Q 114 128 107 122 Z'
              }
              fill="#FFFFFF"
              stroke="#111827"
              strokeWidth="2"
            />
            <Path d="M 104 120 L 107 122 M 122 122 L 126 121" stroke="#111827" strokeWidth="1.5" />
            <Circle cx="114" cy="122" r="3.5" fill={eyeColor} />
            {mode === 'Sekhmet' ? (
              <Ellipse cx="114" cy="122" rx="1.2" ry="3.2" fill="#111827" />
            ) : (
              <>
                <Circle cx="114" cy="122" r="1.6" fill="#111827" />
                {mode === 'warm' && <Circle cx="115.5" cy="120.5" r="0.8" fill="#FFFFFF" />}
              </>
            )}
          </G>

          {/* 5. Hair Front & Braids */}
          <G id="hair-front">
            <Path
              d="M 68 105 C 78 95 122 95 132 105 C 132 108 120 102 100 102 C 80 102 68 108 68 105 Z"
              fill="#110B10"
            />
            {/* Left tress with gold ring */}
            <Path
              d="M 68 105 C 62 125 64 165 70 185 C 74 185 76 160 74 135 C 72 120 74 110 68 105 Z"
              fill="#110B10"
            />
            <Rect x="65" y="145" width="8" height="3" fill="#D4AF37" rx="1" />
            {/* Right tress with gold ring */}
            <Path
              d="M 132 105 C 138 125 136 165 130 185 C 126 185 124 160 126 135 C 128 120 126 110 132 105 Z"
              fill="#110B10"
            />
            <Rect x="127" y="145" width="8" height="3" fill="#D4AF37" rx="1" />
          </G>

          {/* 6. Crown and Horns (Sacred Cow Horns + Golden Disc) */}
          <G id="crown-and-horns">
            <Path
              d="M 85 92 C 70 80 50 50 62 25 C 68 38 78 60 92 78 Z"
              fill="url(#goldHornsGrad)"
              stroke="#B45F06"
              strokeWidth="1"
            />
            <Path
              d="M 115 92 C 130 80 150 50 138 25 C 132 38 122 60 108 78 Z"
              fill="url(#goldHornsGrad)"
              stroke="#B45F06"
              strokeWidth="1"
            />
            <Circle
              cx="100"
              cy="52"
              r="22"
              fill="url(#sunDiscGrad)"
              stroke="#D4AF37"
              strokeWidth="1.5"
            />
            {/* Uraeus cobra */}
            <Path
              d="M 98 88 C 96 82 104 80 102 74 C 100 70 103 66 100 64"
              stroke="#D4AF37"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="100" cy="63" r="2" fill="#DC2626" />
          </G>
        </Svg>

        {/* 7. Animated Solar Flame atop the Sun Disc */}
        <Animated.View
          style={[
            styles.flameContainer,
            {
              top: size * 0.05,
              left: size * 0.5 - 14,
            },
            flameAnimatedStyle,
          ]}
        >
          <Svg width="28" height="36" viewBox="0 0 28 36">
            <Path
              d="M 14 0 C 20 12 28 18 24 28 C 21 34 7 34 4 28 C 0 18 8 12 14 0 Z"
              fill={flameColor}
            />
            <Path
              d="M 14 10 C 18 16 22 22 19 28 C 17 31 11 31 9 28 C 7 22 10 16 14 10 Z"
              fill="#FEF08A"
            />
          </Svg>
        </Animated.View>

        {/* Eyelid Blink Overlay */}
        <Animated.View
          style={[
            styles.eyelidOverlay,
            {
              top: size * 0.6,
              left: size * 0.36,
              width: size * 0.28,
              height: size * 0.045,
            },
            eyelidAnimatedStyle,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  glowAura: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    opacity: 0.35,
  },
  figureContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  flameContainer: {
    position: 'absolute',
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyelidOverlay: {
    position: 'absolute',
    backgroundColor: '#C2895A',
    borderRadius: 3,
  },
});
