import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StreamSource, FallbackServer } from '../../services/api';
import { BottomSheetType } from '../../hooks/usePlayerState';

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
  onOpenBottomSheet: (type: BottomSheetType) => void;
  onSwitchDub: (dubId: string, dubName: string) => void;
  onSwitchQuality: (stream: StreamSource) => void;
  onSwitchServer: (serverId: string) => void;
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
  onOpenBottomSheet,
  onSwitchDub,
  onSwitchQuality,
  onSwitchServer,
}) => {
  return (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces
    >
      {/* Movie Title & Badges */}
      <View style={styles.metaSection}>
        <Text style={styles.movieMainTitle}>{title || 'Now Playing'}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{isSeriesType ? 'TV Series' : 'Movie'}</Text>
          </View>
          <View style={styles.qualityTagBadge}>
            <Text style={styles.qualityTagText}>{activeStream?.quality || '1080p FHD'}</Text>
          </View>
          {/* FIX P3 #15 & #16: Display real format/codec instead of fake 98% Match and fake Dolby */}
          <View style={styles.metaTagBadge}>
            <Text style={styles.metaTagText}>
              {activeStream?.format ? `${activeStream.format} Direct` : 'Fast CDN'}
            </Text>
          </View>
          <View style={styles.metaTagBadge}>
            <Text style={styles.metaTagText}>{selectedDubName}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onOpenBottomSheet('audio')}
          activeOpacity={0.8}
        >
          <View style={styles.quickBtnIconBox}>
            <Ionicons name="volume-high" size={20} color="#e50914" />
          </View>
          <Text style={styles.quickBtnLabel}>Audio Dubs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onOpenBottomSheet('quality')}
          activeOpacity={0.8}
        >
          <View style={styles.quickBtnIconBox}>
            <Ionicons name="flash" size={20} color="#e50914" />
          </View>
          <Text style={styles.quickBtnLabel}>Quality</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onOpenBottomSheet('servers')}
          activeOpacity={0.8}
        >
          <View style={styles.quickBtnIconBox}>
            <Ionicons name="cloud" size={20} color="#e50914" />
          </View>
          <Text style={styles.quickBtnLabel}>Servers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onOpenBottomSheet('speed')}
          activeOpacity={0.8}
        >
          <View style={styles.quickBtnIconBox}>
            <Ionicons name="speedometer" size={20} color="#e50914" />
          </View>
          <Text style={styles.quickBtnLabel}>Speed ({playbackSpeed}x)</Text>
        </TouchableOpacity>

        {seasonsCount > 0 && (
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => onOpenBottomSheet('episodes')}
            activeOpacity={0.8}
          >
            <View style={styles.quickBtnIconBox}>
              <Ionicons name="list" size={20} color="#e50914" />
            </View>
            <Text style={styles.quickBtnLabel}>Episodes</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Audio Languages Shelf */}
      {dubsList.length > 0 && (
        <View style={styles.dashSection}>
          <Text style={styles.dashSectionTitle}>AVAILABLE AUDIO LANGUAGES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {dubsList.map((dub, i) => {
              const isCurrent = dub.subject_id === currentId;
              return (
                <TouchableOpacity
                  key={dub.subject_id || i}
                  style={[styles.audioChip, isCurrent && styles.audioChipActive]}
                  onPress={() => onSwitchDub(dub.subject_id, dub.lang_name)}
                >
                  <Ionicons
                    name={isCurrent ? 'checkmark-circle' : 'volume-medium-outline'}
                    size={14}
                    color={isCurrent ? '#e50914' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.audioChipText, isCurrent && styles.audioChipTextActive]}>
                    {dub.lang_name || 'Dub'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Stream Resolutions Shelf */}
      {playableStreams.length > 0 && (
        <View style={styles.dashSection}>
          <Text style={styles.dashSectionTitle}>SELECT STREAM RESOLUTION</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {playableStreams.map((s, i) => {
              const isCurrent = !useIframe && activeStream?.url === s.url;
              return (
                <TouchableOpacity
                  key={s.url || i}
                  style={[styles.qualityChip, isCurrent && styles.qualityChipActive]}
                  onPress={() => onSwitchQuality(s)}
                >
                  <Ionicons
                    name={isCurrent ? 'checkmark-circle' : 'flash-outline'}
                    size={14}
                    color={isCurrent ? '#e50914' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[styles.qualityChipText, isCurrent && styles.qualityChipTextActive]}
                  >
                    {s.quality} {s.size_mb ? `(${s.size_mb} MB)` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Cloud Fallback Servers */}
      {fallbackServers.length > 0 && (
        <View style={styles.dashSection}>
          <Text style={styles.dashSectionTitle}>ALTERNATE STREAMING MIRRORS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <TouchableOpacity
              style={[styles.serverChip, !useIframe && styles.serverChipActive]}
              onPress={() => onSwitchServer('direct')}
            >
              <Ionicons
                name={!useIframe ? 'checkmark-circle' : 'flash-outline'}
                size={14}
                color={!useIframe ? '#e50914' : '#94a3b8'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.serverChipText, !useIframe && styles.serverChipTextActive]}>
                CineScope CDN
              </Text>
            </TouchableOpacity>
            {fallbackServers.map((srv) => {
              const isCurrent = useIframe && selectedServer === srv.id;
              return (
                <TouchableOpacity
                  key={srv.id}
                  style={[styles.serverChip, isCurrent && styles.serverChipActive]}
                  onPress={() => onSwitchServer(srv.id)}
                >
                  <Ionicons
                    name={isCurrent ? 'checkmark-circle' : 'cloud-outline'}
                    size={14}
                    color={isCurrent ? '#e50914' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.serverChipText, isCurrent && styles.serverChipTextActive]}>
                    {srv.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollArea: { flex: 1, backgroundColor: '#090a0f' },
  scrollContent: { padding: 16 },
  metaSection: { marginBottom: 16 },
  movieMainTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  typeBadge: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  typeBadgeText: { color: '#38bdf8', fontSize: 11, fontWeight: '800' },
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
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#12141c',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickBtnIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229,9,20,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.25)',
  },
  quickBtnLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },
  dashSection: { marginBottom: 18 },
  dashSectionTitle: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipsRow: { gap: 8, paddingVertical: 2 },
  audioChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  audioChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  audioChipTextActive: { color: '#fff', fontWeight: '800' },
  qualityChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  qualityChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  qualityChipTextActive: { color: '#fff', fontWeight: '800' },
  serverChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  serverChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  serverChipTextActive: { color: '#fff', fontWeight: '800' },
});
