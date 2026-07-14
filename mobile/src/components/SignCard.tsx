import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SignFromAPI } from '../lib/api';
import { getSignImage } from '../lib/signImages';
import { colors, radius, spacing } from '../theme';
import { Tag } from './UI';

interface Props {
  sign:       SignFromAPI;
  selected:   boolean;
  favorite:   boolean;
  onPress:    () => void;
  onToggleFavorite: () => void;
}

export function SignCard({ sign, selected, favorite, onPress, onToggleFavorite }: Props) {
  const image = getSignImage(sign.letter, sign.category);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { borderColor: selected ? sign.color : colors.border, borderWidth: selected ? 1.5 : 1 },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: `${sign.color}08` }]}>
        {image ? (
          <Image source={image} style={styles.thumbImage} resizeMode="contain" />
        ) : (
          <View style={[styles.letterBadge, { backgroundColor: `${sign.color}14` }]}>
            <Text style={[styles.letterText, { color: sign.color }]}>{sign.letter}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: sign.color }]} numberOfLines={1}>{sign.name}</Text>
          <Pressable hitSlop={8} onPress={onToggleFavorite}>
            <Text style={styles.heart}>{favorite ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>
        <Tag text={sign.category} color={sign.color} />
        <Text style={styles.desc} numberOfLines={selected ? undefined : 2}>{sign.description}</Text>
        {sign.tip && selected && (
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>💡 {sign.tip}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  thumb: {
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  thumbImage: { width: 56, height: 66 },
  letterBadge: {
    width: 56,
    height: 66,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { fontSize: 26, fontWeight: '900' },
  body: { padding: spacing.sm + 2, paddingTop: spacing.sm, gap: 5 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '700', fontSize: 15, flexShrink: 1 },
  heart: { fontSize: 14 },
  desc: { fontSize: 11, color: colors.text3, lineHeight: 15.5, marginTop: 2 },
  tipBox: {
    backgroundColor: colors.tealBg,
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
  tipText: { fontSize: 11, color: colors.teal },
});
