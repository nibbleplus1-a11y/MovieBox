import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { StreamSource, FallbackServer } from '../../services/api';
import { BottomSheetType, SeasonData, EpisodeData, SubtitleItem } from '../../hooks/usePlayerState';

interface PlayerBottomSheetProps {
  bottomSheet: BottomSheetType;
  insets: EdgeInsets;
  isFullscreen?: boolean;
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
  subtitlesList?: SubtitleItem[];
  activeSubtitle?: SubtitleItem | null;
  isSearchingOnlineSubs?: boolean;
  onClose: () => void;
  onSwitchDub: (dubId: string, dubName: string) => void;
  onSwitchQuality: (stream: StreamSource) => void;
  onChangeSpeed: (speed: number) => void;
  onSwitchServer: (serverId: string) => void;
  onSwitchEpisode: (season: number, episode: number) => void;
  onSetSheetSeason: (season: number) => void;
  onSelectSubtitle?: (sub: SubtitleItem | null) => void;
  onSearchOnlineSubs?: () => void;
}

export const PlayerBottomSheet: React.FC<PlayerBottomSheetProps> = ({
  bottomSheet,
  insets,
  isFullscreen = false,
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
  subtitlesList = [],
  activeSubtitle = null,
  isSearchingOnlineSubs = false,
  onClose,
  onSwitchDub,
  onSwitchQuality,
  onChangeSpeed,
  onSwitchServer,
  onSwitchEpisode,
  onSetSheetSeason,
  onSelectSubtitle,
  onSearchOnlineSubs,
}) => {
  const windowHeight = Dimensions.get('window').height;
  // Dynamic height ensures flex child never collapses in landscape fullscreen or portrait
  const sheetHeight = isFullscreen
    ? Math.min(windowHeight * 0.90, 390)
    : Math.min(windowHeight * 0.72, 540);

  // Fallback to first available season's episodes if selection failed
  const effectiveEpisodes =
    sheetSeasonEpisodes.length > 0
      ? sheetSeasonEpisodes
      : (seasonsData[0]?.episodes || []);

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
            <View
              style={[
                styles.bottomSheet,
                { height: sheetHeight, paddingBottom: insets.bottom + 16 },
              ]}
            >
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
                  {bottomSheet === 'subtitles' && (
                    <Ionicons name="chatbox-ellipses" size={18} color="#e50914" />
                  )}
                  <Text style={styles.bottomSheetTitle}>
                    {bottomSheet === 'audio' && 'Audio Languages & Dubs'}
                    {bottomSheet === 'quality' && 'Video Quality'}
                    {bottomSheet === 'speed' && 'Playback Speed'}
                    {bottomSheet === 'servers' && 'Streaming Servers'}
                    {bottomSheet === 'episodes' && 'TV Show Episodes'}
                    {bottomSheet === 'subtitles' && 'Subtitles & Captions'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* AUDIO DUBS LIST */}
              {bottomSheet === 'audio' && (
                <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: 20 }}>
                  {dubsList.length > 0 ? (
                    dubsList.map((dub) => {
                      const isSelected = dub.subject_id === currentId;
                      return (
                        <TouchableOpacity
                          key={dub.subject_id}
                          style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                          onPress={() => onSwitchDub(dub.subject_id, dub.lang_name)}
                        >
                          <Ionicons
                            name="volume-high-outline"
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
                            {dub.lang_name || 'Audio Track'}
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
                        name="volume-high-outline"
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
                <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: 20 }}>
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
                <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: 20 }}>
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
                        MovieVerse Direct CDN
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

              {/* SUBTITLES LIST & ONLINE SEARCH */}
              {bottomSheet === 'subtitles' && (
                <View style={{ flex: 1 }}>
                  {onSearchOnlineSubs && (
                    <View style={styles.subSearchHeader}>
                      <TouchableOpacity
                        style={[styles.onlineSubSearchBtn, isSearchingOnlineSubs && { opacity: 0.7 }]}
                        onPress={onSearchOnlineSubs}
                        disabled={isSearchingOnlineSubs}
                        activeOpacity={0.8}
                      >
                        {isSearchingOnlineSubs ? (
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        ) : (
                          <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.onlineSubSearchText}>
                          {isSearchingOnlineSubs ? 'Searching OpenSubtitles…' : 'Search Online Subtitles'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: 24 }}>
                    {/* Off option */}
                    <TouchableOpacity
                      style={[styles.sheetRow, !activeSubtitle && styles.sheetRowSelected]}
                      onPress={() => onSelectSubtitle && onSelectSubtitle(null)}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color={!activeSubtitle ? '#e50914' : '#64748b'}
                        style={{ marginRight: 12 }}
                      />
                      <Text style={[styles.sheetRowText, !activeSubtitle && styles.sheetRowTextSelected]}>
                        Off (No Subtitles)
                      </Text>
                      {!activeSubtitle && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                    </TouchableOpacity>

                    {/* Available tracks */}
                    {subtitlesList && subtitlesList.length > 0 ? (
                      subtitlesList.map((sub, idx) => {
                        const isSelected = activeSubtitle?.id === sub.id;
                        return (
                          <TouchableOpacity
                            key={sub.id || idx}
                            style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                            onPress={() => onSelectSubtitle && onSelectSubtitle(sub)}
                          >
                            <Ionicons
                              name={sub.isOnline ? "cloud-download-outline" : "chatbox-ellipses-outline"}
                              size={18}
                              color={isSelected ? '#e50914' : '#64748b'}
                              style={{ marginRight: 12 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.sheetRowText, isSelected && styles.sheetRowTextSelected]}>
                                {sub.language}
                              </Text>
                              {sub.isOnline && (
                                <Text style={styles.sheetRowSub}>Auto-Matched Online Subtitle</Text>
                              )}
                            </View>
                            {isSelected && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={styles.sheetEmptyBox}>
                        <Ionicons name="chatbubble-outline" size={32} color="#3f3f46" />
                        <Text style={styles.sheetEmptyText}>No official subtitles loaded.</Text>
                        <Text style={styles.sheetRowSub}>Tap 'Search Online Subtitles' above to find SRT files.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* EPISODES — with season tabs & scrollable list */}
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
                        const isActive = Number(s.season) === Number(sheetSeason);
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
                  <ScrollView
                    style={styles.sheetList}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {effectiveEpisodes.length > 0 ? (
                      effectiveEpisodes.map((ep) => {
                        const isCurrent =
                          Number(ep.episode) === Number(currentEpisode) &&
                          Number(sheetSeason) === Number(currentSeason);
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
    paddingBottom: 12,
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
  sheetList: { flex: 1, paddingVertical: 6 },
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
  seasonTabsScroll: { marginVertical: 8, maxHeight: 42 },
  seasonTabsRow: { gap: 8, paddingHorizontal: 2 },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e2030',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  seasonTabActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  seasonTabText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  seasonTabTextActive: { color: '#fff' },
  epRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  epNumber: {
    color: '#e50914',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  subSearchHeader: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 6,
  },
  onlineSubSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  onlineSubSearchText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
