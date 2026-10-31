import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EdgeInsets } from 'react-native-safe-area-context';
import { StreamSource, FallbackServer } from '../../services/api';
import { BottomSheetType, SeasonData, EpisodeData } from '../../hooks/usePlayerState';

interface PlayerBottomSheetProps {
  bottomSheet: BottomSheetType;
  insets: EdgeInsets;
  dubsList: Array<{ subject_id: string; lang_name: string }>;
  currentId: string;
  playableStreams: StreamSource[];
  activeStream: StreamSource | null;
  useIframe: boolean;
  selectedServer: string;
  fallbackServers: FallbackServer[];
  playbackSpeed: number;
  seasonsData: SeasonData[];
  sheetSeason: number;
  currentSeason: number;
  currentEpisode: number;
  sheetSeasonEpisodes: EpisodeData[];
  onClose: () => void;
  onSwitchDub: (dubId: string, dubName: string) => void;
  onSwitchQuality: (stream: StreamSource) => void;
  onChangeSpeed: (speed: number) => void;
  onSwitchServer: (serverId: string) => void;
  onSwitchEpisode: (season: number, episode: number) => void;
  onSetSheetSeason: (season: number) => void;
}

export const PlayerBottomSheet: React.FC<PlayerBottomSheetProps> = ({
  bottomSheet,
  insets,
  dubsList,
  currentId,
  playableStreams,
  activeStream,
  useIframe,
  selectedServer,
  fallbackServers,
  playbackSpeed,
  seasonsData,
  sheetSeason,
  currentSeason,
  currentEpisode,
  sheetSeasonEpisodes,
  onClose,
  onSwitchDub,
  onSwitchQuality,
  onChangeSpeed,
  onSwitchServer,
  onSwitchEpisode,
  onSetSheetSeason,
}) => {
  return (
    <Modal
      visible={bottomSheet !== 'none'}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  {bottomSheet === 'audio' && (
                    <Ionicons name="volume-high" size={18} color="#e50914" />
                  )}
                  {bottomSheet === 'quality' && (
                    <Ionicons name="flash" size={18} color="#e50914" />
                  )}
                  {bottomSheet === 'speed' && (
                    <Ionicons name="speedometer" size={18} color="#e50914" />
                  )}
                  {bottomSheet === 'servers' && (
                    <Ionicons name="cloud" size={18} color="#e50914" />
                  )}
                  {bottomSheet === 'episodes' && (
                    <Ionicons name="list" size={18} color="#e50914" />
                  )}
                  <Text style={styles.bottomSheetTitle}>
                    {bottomSheet === 'audio' && 'Audio Languages & Dubs'}
                    {bottomSheet === 'quality' && 'Video Quality'}
                    {bottomSheet === 'speed' && 'Playback Speed'}
                    {bottomSheet === 'servers' && 'Streaming Servers'}
                    {bottomSheet === 'episodes' && 'TV Show Episodes'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* AUDIO DUBS LIST */}
              {bottomSheet === 'audio' && (
                <ScrollView style={styles.sheetList}>
                  {dubsList.length > 0 ? (
                    dubsList.map((dub, i) => {
                      const isSelected = dub.subject_id === currentId;
                      return (
                        <TouchableOpacity
                          key={dub.subject_id || i}
                          style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                          onPress={() => onSwitchDub(dub.subject_id, dub.lang_name)}
                        >
                          <Ionicons
                            name="volume-medium-outline"
                            size={18}
                            color={isSelected ? '#e50914' : '#64748b'}
                            style={{ marginRight: 12 }}
                          />
                          <Text
                            style={[
                              styles.sheetRowText,
                              isSelected && styles.sheetRowTextSelected,
                            ]}
                          >
                            {dub.lang_name || 'Original Audio'}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={[styles.sheetRow, styles.sheetRowSelected]}>
                      <Ionicons
                        name="volume-medium-outline"
                        size={18}
                        color="#e50914"
                        style={{ marginRight: 12 }}
                      />
                      <Text style={[styles.sheetRowText, styles.sheetRowTextSelected]}>
                        Original Audio Track
                      </Text>
                      <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                    </View>
                  )}
                </ScrollView>
              )}

              {/* QUALITY LIST */}
              {bottomSheet === 'quality' && (
                <ScrollView style={styles.sheetList}>
                  {playableStreams.map((s, i) => {
                    const isSelected = !useIframe && activeStream?.url === s.url;
                    return (
                      <TouchableOpacity
                        key={s.url || i}
                        style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                        onPress={() => onSwitchQuality(s)}
                      >
                        <Ionicons
                          name="flash-outline"
                          size={18}
                          color={isSelected ? '#e50914' : '#64748b'}
                          style={{ marginRight: 12 }}
                        />
                        <Text
                          style={[
                            styles.sheetRowText,
                            isSelected && styles.sheetRowTextSelected,
                          ]}
                        >
                          {s.quality} {s.size_mb ? `(~${s.size_mb} MB)` : ''}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* SPEED LIST */}
              {bottomSheet === 'speed' && (
                <View style={styles.sheetList}>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((sp) => {
                    const isSelected = playbackSpeed === sp;
                    return (
                      <TouchableOpacity
                        key={sp}
                        style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                        onPress={() => onChangeSpeed(sp)}
                      >
                        <Ionicons
                          name="speedometer-outline"
                          size={18}
                          color={isSelected ? '#e50914' : '#64748b'}
                          style={{ marginRight: 12 }}
                        />
                        <Text
                          style={[
                            styles.sheetRowText,
                            isSelected && styles.sheetRowTextSelected,
                          ]}
                        >
                          {sp === 1.0 ? '1.0× Normal' : `${sp}×`}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* SERVERS LIST */}
              {bottomSheet === 'servers' && (
                <ScrollView style={styles.sheetList}>
                  <TouchableOpacity
                    style={[styles.sheetRow, !useIframe && styles.sheetRowSelected]}
                    onPress={() => onSwitchServer('direct')}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={18}
                      color={!useIframe ? '#e50914' : '#64748b'}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.sheetRowText,
                          !useIframe && styles.sheetRowTextSelected,
                        ]}
                      >
                        CineScope Direct CDN
                      </Text>
                      <Text style={styles.sheetRowSub}>Fastest · Native Stream</Text>
                    </View>
                    {!useIframe && (
                      <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                    )}
                  </TouchableOpacity>
                  {fallbackServers.map((srv) => {
                    const isSelected = useIframe && selectedServer === srv.id;
                    return (
                      <TouchableOpacity
                        key={srv.id}
                        style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                        onPress={() => onSwitchServer(srv.id)}
                      >
                        <Ionicons
                          name="cloud-outline"
                          size={18}
                          color={isSelected ? '#e50914' : '#64748b'}
                          style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.sheetRowText,
                              isSelected && styles.sheetRowTextSelected,
                            ]}
                          >
                            {srv.name}
                          </Text>
                          <Text style={styles.sheetRowSub}>Cloud Stream</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* EPISODES — with season tabs */}
              {bottomSheet === 'episodes' && (
                <View style={{ flex: 1 }}>
                  {seasonsData.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.seasonTabsRow}
                      style={styles.seasonTabsScroll}
                    >
                      {seasonsData.map((s) => {
                        const isActive = s.season === sheetSeason;
                        return (
                          <TouchableOpacity
                            key={s.season}
                            style={[styles.seasonTab, isActive && styles.seasonTabActive]}
                            onPress={() => onSetSheetSeason(s.season)}
                          >
                            <Text
                              style={[
                                styles.seasonTabText,
                                isActive && styles.seasonTabTextActive,
                              ]}
                            >
                              Season {s.season}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                  <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                    {sheetSeasonEpisodes.length > 0 ? (
                      sheetSeasonEpisodes.map((ep) => {
                        const isCurrent =
                          ep.episode === currentEpisode && sheetSeason === currentSeason;
                        return (
                          <TouchableOpacity
                            key={ep.episode}
                            style={[styles.sheetRow, isCurrent && styles.sheetRowSelected]}
                            onPress={() => onSwitchEpisode(sheetSeason, ep.episode)}
                          >
                            <View style={styles.epRowLeft}>
                              <Text style={styles.epNumber}>{ep.episode}</Text>
                              <Text
                                style={[
                                  styles.sheetRowText,
                                  isCurrent && styles.sheetRowTextSelected,
                                ]}
                                numberOfLines={2}
                              >
                                {ep.title || `Episode ${ep.episode}`}
                              </Text>
                            </View>
                            {isCurrent && (
                              <Ionicons name="play-circle" size={22} color="#e50914" />
                            )}
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={styles.sheetEmptyBox}>
                        <Ionicons name="film-outline" size={36} color="#3f3f46" />
                        <Text style={styles.sheetEmptyText}>No episodes found.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#12141c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomSheetTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#262938',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: { paddingVertical: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  sheetRowSelected: { backgroundColor: 'rgba(229,9,20,0.1)' },
  sheetRowText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', flex: 1 },
  sheetRowTextSelected: { color: '#e50914', fontWeight: '800' },
  sheetRowSub: { color: '#52525b', fontSize: 11, marginTop: 2 },
  sheetEmptyBox: { padding: 32, alignItems: 'center', gap: 10 },
  sheetEmptyText: { color: '#52525b', fontSize: 13 },
  seasonTabsScroll: { marginVertical: 12 },
  seasonTabsRow: { gap: 8, paddingHorizontal: 2 },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1e2030',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seasonTabActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  seasonTabText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  seasonTabTextActive: { color: '#fff' },
  epRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  epNumber: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'right',
  },
});
