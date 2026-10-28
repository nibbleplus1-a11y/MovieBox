import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CONFIG } from '../config';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 3;

interface Props {
  id: string;
  title: string;
  cover: string;
  rating?: number | string;
  type?: string;
  onPress: () => void;
}

export default function MovieCard({ id, title, cover, rating, type, onPress }: Props) {
  const parsedRating = (() => {
    if (!rating || rating === 'N/A') return null;
    const num = typeof rating === 'number' ? rating : parseFloat(rating);
    return isNaN(num) ? null : num.toFixed(1);
  })();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.posterWrap}>
        <Image
          source={{ uri: cover || 'https://via.placeholder.com/120x180/1b1c26/666' }}
          style={styles.poster}
          resizeMode="cover"
        />
        <View style={styles.overlay}>
          {parsedRating ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {parsedRating}</Text>
            </View>
          ) : null}
          {type ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{type === 'Series' ? 'TV' : 'MOVIE'}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.playOverlay}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    marginBottom: 16,
  },
  posterWrap: {
    width: CARD_W,
    height: CARD_W * 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: CONFIG.COLORS.card,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingBadge: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '700',
  },
  typeBadge: {
    backgroundColor: CONFIG.COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  typeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0)',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 15,
  },
});
