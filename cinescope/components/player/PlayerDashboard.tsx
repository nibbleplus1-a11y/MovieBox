import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StreamSource, FallbackServer, MovieCard as MovieCardData } from '../../services/api';
import { BottomSheetType } from '../../hooks/usePlayerState';

const { width } = Dimensions.get('window');
const POSTER_W = (width - 48) / 3;
const POSTER_H = POSTER_W * 1.48;

interface PlayerDashboardProps {
  title?: string;
  isSeriesType: boolean;
  selectedDubName: string;
  activeStream: StreamSource | null;
  playbackSpeed: number;
  seasonsCount: number;
  dubsList: Array<{ subject_id: string; lang_name: string }>;
  currentId: string;
  playableStreams: StreamSource[];
  fallbackServers: FallbackServer[];
  useIframe: boolean;
  selectedServer: string;
  similarMovies?: MovieCardData[];
  onOpenBottomSheet: (type: BottomSheetType) => void;
  onSwitchDub: (dubId: string, dubName: string) => void;
  onSwitchQuality: (stream: StreamSource) => void;
  onSwitchServer: (serverId: string) => void;
  onSelectMovie?: (movie: MovieCardData) => void;
}

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({
  title,
  isSeriesType,
  selectedDubName,
  activeStream,
  playbackSpeed,
  seasonsCount,
  dubsList,
  currentId,
  playableStreams,
  fallbackServers,
  useIframe,
  selectedServer,
  similarMovies = [],
  onOpenBottomSheet,
  onSwitchDub,
  onSwitchQuality,
  onSwitchServer,
  onSelectMovie,
}) => {
  const currentServerName = useIframe
    ? (fallbackServers.find((s) => s.id === selectedServer)?.name || 'Mirror Server')
    : 'CineScope CDN';

  return (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces
    >
      {/* Title & Metadata Badges */}
      <View style={styles.metaSection}>
        <Text style={styles.movieMainTitle} numberOfLines={2}>
          {title || 'Now Playing'}
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{isSeriesType ? 'TV Series' : 'Movie'}</Text>
          </View>
          <View style={styles.qualityTagBadge}>
            <Text style={styles.qualityTagText}>{activeStream?.quality || '720p HD'}</Text>
          </View>
          <View style={styles.metaTagBadge}>
            <Text style={styles.metaTagText}>
              {useIframe ? currentServerName : (activeStream?.format ? `${activeStream.format} Direct` : 'Fast CDN')}
            </Text>
          </View>
          <View style={styles.metaTagBadge}>
            <Text style={styles.metaTagText}>{selectedDubName}</Text>
          </View>
        </View>
      </View>

      {/* ─── MOVIE SETTINGS (COMPACT 1-2 LINES) ─── */}
      <View style={styles.compactSettingsContainer}>
        {/* LINE 1: Quick Action Pills Bar */}
        <View style={styles.quickBar}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => onOpenBottomSheet('audio')}
            activeOpacity={0.8}
          >
            <View style={styles.quickBtnIconBox}>
              <Ionicons name="volume-high" size={16} color="#e50914" />
            </View>
            <View style={styles.quickBtnTextBox}>
              <Text style={styles.quickBtnHeader}>Audio</Text>
              <Text style={styles.quickBtnValue} numberOfLines={1}>{selectedDubName.replace('dub', '').trim() || 'Original'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => onOpenBottomSheet('quality')}
            activeOpacity={0.8}
          >
            <View style={styles.quickBtnIconBox}>
              <Ionicons name="flash" size={16} color="#e50914" />
            </View>
            <View style={styles.quickBtnTextBox}>
              <Text style={styles.quickBtnHeader}>Quality</Text>
              <Text style={styles.quickBtnValue} numberOfLines={1}>{activeStream?.quality || 'Auto'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => onOpenBottomSheet('servers')}
            activeOpacity={0.8}
          >
            <View style={styles.quickBtnIconBox}>
              <Ionicons name="cloud" size={16} color="#e50914" />
            </View>
            <View style={styles.quickBtnTextBox}>
              <Text style={styles.quickBtnHeader}>Server</Text>
              <Text style={styles.quickBtnValue} numberOfLines={1}>{useIframe ? 'Mirror' : 'Direct'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => onOpenBottomSheet('speed')}
            activeOpacity={0.8}
          >
            <View style={styles.quickBtnIconBox}>
              <Ionicons name="speedometer" size={16} color="#e50914" />
            </View>
            <View style={styles.quickBtnTextBox}>
              <Text style={styles.quickBtnHeader}>Speed</Text>
              <Text style={styles.quickBtnValue}>{playbackSpeed}x</Text>
            </View>
          </TouchableOpacity>

          {seasonsCount > 0 && (
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => onOpenBottomSheet('episodes')}
              activeOpacity={0.8}
            >
              <View style={styles.quickBtnIconBox}>
                <Ionicons name="list" size={16} color="#e50914" />
              </View>
              <View style={styles.quickBtnTextBox}>
                <Text style={styles.quickBtnHeader}>Episodes</Text>
                <Text style={styles.quickBtnValue}>{seasonsCount} S</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* LINE 2: Horizontal Quick Resolution & Server Selector */}
        {(playableStreams.length > 0 || fallbackServers.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickSelectScroll}
          >
            {playableStreams.map((s, idx) => {
              const isCurrent = !useIframe && activeStream?.url === s.url;
              return (
                <TouchableOpacity
                  key={`quality_${idx}`}
                  style={[styles.quickChip, isCurrent && styles.quickChipActive]}
                  onPress={() => onSwitchQuality(s)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCurrent ? 'checkmark-circle' : 'flash-outline'}
                    size={12}
                    color={isCurrent ? '#fff' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.quickChipText, isCurrent && styles.quickChipTextActive]}>
                    {s.quality} {s.size_mb ? `(${s.size_mb} MB)` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {fallbackServers.map((srv) => {
              const isCurrent = useIframe && selectedServer === srv.id;
              return (
                <TouchableOpacity
                  key={`srv_${srv.id}`}
                  style={[styles.quickChip, isCurrent && styles.quickChipActive]}
                  onPress={() => onSwitchServer(srv.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCurrent ? 'checkmark-circle' : 'cloud-outline'}
                    size={12}
                    color={isCurrent ? '#fff' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.quickChipText, isCurrent && styles.quickChipTextActive]}>
                    {srv.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ─── SIMILAR MOVIES & TOPIC RECOMMENDATIONS ─── */}
      <View style={styles.similarSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionHeaderDot} />
            <Text style={styles.sectionTitle}>More Like This</Text>
          </View>
          <Text style={styles.sectionSub}>Similar titles & topics</Text>
        </View>

        {similarMovies.length > 0 ? (
          <View style={styles.posterGrid}>
            {similarMovies.map((item) => {
              const rating = item.rating || item.imdb_rating;
              return (
                <TouchableOpacity
                  key={item.subject_id}
                  style={styles.movieCard}
                  onPress={() => onSelectMovie && onSelectMovie(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.posterWrapper}>
                    <Image
                      source={{ uri: item.cover }}
                      style={styles.posterImage}
                      resizeMode="cover"
                    />
                    {rating ? (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={9} color="#eab308" style={{ marginRight: 2 }} />
                        <Text style={styles.ratingBadgeText}>{String(rating).slice(0, 3)}</Text>
                      </View>
                    ) : null}
                    {item.quality ? (
                      <View style={styles.qualityMiniBadge}>
                        <Text style={styles.qualityMiniText}>{item.quality}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.year ? (
                    <Text style={styles.cardSubText}>
                      {item.year} {item.type ? `• ${item.type === 'Series' ? 'TV' : 'Movie'}` : ''}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySimilar}>
            <Ionicons name="film-outline" size={28} color="#475569" style={{ marginBottom: 6 }} />
            <Text style={styles.emptySimilarText}>Exploring cinema catalog for matches…</Text>
          </View>
        )}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollArea: { flex: 1, backgroundColor: '#090a0f' },
  scrollContent: { padding: 16 },
  metaSection: { marginBottom: 14 },
  movieMainTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  typeBadge: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  typeBadgeText: { color: '#38bdf8', fontSize: 10, fontWeight: '800' },
  qualityTagBadge: {
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
  },
  qualityTagText: { color: '#e50914', fontSize: 10, fontWeight: '800' },
  metaTagBadge: {
    backgroundColor: '#1b1d28',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaTagText: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  // Compact 1-2 Line Settings
  compactSettingsContainer: {
    backgroundColor: '#12141c',
    borderRadius: 14,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  quickBtnIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(229,9,20,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.25)',
  },
  quickBtnTextBox: { flex: 1 },
  quickBtnHeader: { color: '#94a3b8', fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  quickBtnValue: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Quick Select Scroll (Line 2)
  quickSelectScroll: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 6,
  },
  quickChip: {
    backgroundColor: '#181b26',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  quickChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  quickChipTextActive: { color: '#fff', fontWeight: '800' },

  // Similar Movies Section
  similarSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderDot: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#e50914',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  movieCard: {
    width: POSTER_W,
    marginBottom: 14,
  },
  posterWrapper: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1b1d28',
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingBadgeText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
  },
  qualityMiniBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  qualityMiniText: {
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    lineHeight: 14,
  },
  cardSubText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  emptySimilar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#12141c',
    borderRadius: 12,
  },
  emptySimilarText: {
    color: '#64748b',
    fontSize: 12,
  },
});
