import { useEffect, useState, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, StreamData, StreamSource } from '../services/api';
import { WatchProgressService } from '../services/watchProgress';

export type BottomSheetType = 'none' | 'audio' | 'quality' | 'speed' | 'episodes' | 'servers' | 'subtitles';

export interface SeasonData {
  season: number;
  season_number?: number;
  episodes: EpisodeData[];
}

export interface EpisodeData {
  season: number;
  episode: number;
  title?: string;
}

export interface SubtitleItem {
  id: string;
  language: string;
  url: string;
  code?: string;
  isOnline?: boolean;
}

interface RouteParams {
  id: string;
  title?: string;
  cover?: string;
  initialDub?: string;
  season?: number;
  episode?: number;
  initialSeek?: number;
  type?: string;
}

/** FIX P4 #22: single shared predicate — no duplicated DASH filter logic */
export const isPlayableStream = (s: StreamSource): boolean =>
  s.format !== 'DASH' && !s.url.includes('.mpd');

export function usePlayerState() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    id: initialId,
    title,
    cover,
    initialDub,
    season: initialSeason = 0,
    episode: initialEpisode = 0,
    initialSeek: routeParamsInitialSeek = 0,
    type: initialType = 'Movie',
  } = (route.params as RouteParams) || {};

  const sanitizeTitleForSearch = (t?: string): string => {
    if (!t) return '';
    return t
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\b(?:hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|korean|japanese|spanish|french|german|italian|chinese|russian|arabic|portuguese|english|dual audio|multi audio)\s*(?:dub|dubbed|audio)?\b/gi, '')
      .replace(/\b(?:dubbed|dub|subbed|sub)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanLanguageTag = (t?: string) => {
    if (!t) return '';
    return sanitizeTitleForSearch(t);
  };

  const isSeriesType = initialType === 'Series' || initialType === 'TV Series';

  const [playerTitle, setPlayerTitle]           = useState<string>(() => {
    const raw = title || '';
    const clean = sanitizeTitleForSearch(raw);
    return initialDub && !initialDub.toLowerCase().includes('original')
      ? `${clean} [${initialDub}]`
      : clean || raw;
  });
  const [currentId, setCurrentId]               = useState<string>(initialId);
  const [currentSeason, setCurrentSeason]       = useState<number>(initialSeason);
  const [currentEpisode, setCurrentEpisode]     = useState<number>(initialEpisode);
  const [streamData, setStreamData]             = useState<StreamData | null>(null);
  const [activeStream, setActiveStream]         = useState<StreamSource | null>(null);
  const [selectedServer, setSelectedServer]     = useState<string>('direct');
  const [streamUrl, setStreamUrl]               = useState<string>('');
  const [useIframe, setUseIframe]               = useState<boolean>(false);
  const [iframeServerName, setIframeServerName] = useState<string>('');
  const [loading, setLoading]                   = useState<boolean>(true);
  const [error, setError]                       = useState<string | null>(null);

  // FIX P2 #12: start false — actual state is synced from WebView 'playing'/'pause' events
  const [isPlaying, setIsPlaying]           = useState<boolean>(false);
  const [currentTime, setCurrentTime]       = useState<number>(0);
  const [duration, setDuration]             = useState<number>(0);
  const [isBuffering, setIsBuffering]       = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed]   = useState<number>(1.0);
  const [selectedDubName, setSelectedDubName] = useState<string>(initialDub || 'Original Audio');
  const [hasEnded, setHasEnded]             = useState<boolean>(false);

  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isLocked, setIsLocked]               = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen]       = useState<boolean>(false);
  const [bottomSheet, setBottomSheet]         = useState<BottomSheetType>('none');
  const [seasonsData, setSeasonsData]         = useState<SeasonData[]>([]);
  const [sheetSeason, setSheetSeason]         = useState<number>(initialSeason || 1);
  const [subtitlesList, setSubtitlesList]     = useState<SubtitleItem[]>([]);
  const [activeSubtitle, setActiveSubtitle]   = useState<SubtitleItem | null>(null);
  const [isSearchingOnlineSubs, setIsSearchingOnlineSubs] = useState<boolean>(false);
  const cachedSubsRef                         = useRef<Map<string, SubtitleItem>>(new Map());
  /** FIX P1 #4: measured width from onLayout — replaces (screenWidth - magic_number) */
  const [trackWidth, setTrackWidth]           = useState<number>(300);

  const webViewRef                = useRef<any>(null);
  const controlsTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTokenRef              = useRef<symbol>(Symbol());
  const fadeAnim                  = useRef(new Animated.Value(1)).current;
  const lastSaveTimeRef           = useRef<number>(0);
  const hasAppliedInitialSeekRef = useRef<boolean>(false);

  const epLabel = isSeriesType && currentSeason > 0 ? `S${currentSeason} E${currentEpisode}` : null;
  const allStreams       = streamData?.streams || [];
  const mp4Streams       = allStreams.filter(isPlayableStream);
  const playableStreams  = mp4Streams.length > 0 ? mp4Streams : allStreams;
  const dubsList         = streamData?.dubs || [];
  const fallbackServers  = streamData?.fallback_servers || [];
  const progressRatio    = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const sheetSeasonEpisodes: EpisodeData[] =
    seasonsData.find(s => Number(s.season) === Number(sheetSeason))?.episodes ||
    seasonsData[0]?.episodes ||
    [];

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs  = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
      const o = evt.orientationInfo.orientation;
      if (o === ScreenOrientation.Orientation.LANDSCAPE_LEFT || o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT) {
        setIsFullscreen(true);
      } else if (o === ScreenOrientation.Orientation.PORTRAIT_UP || o === ScreenOrientation.Orientation.PORTRAIT_DOWN) {
        setIsFullscreen(false);
      }
    });
    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setControlsVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (!isLocked && isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setControlsVisible(false);
        });
      }, 3500);
    }
  }, [fadeAnim, isLocked, isPlaying]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [resetControlsTimer, isPlaying]);

  const toggleControls = () => {
    if (controlsVisible) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setControlsVisible(false);
      });
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Orientation lock error:', err);
    }
    resetControlsTimer();
  }, [isFullscreen, resetControlsTimer]);

  const loadStreams = useCallback(async (subjectId: string, se = 0, ep = 0) => {
    // FIX P4 #25: cancel any previous in-flight load
    const token = Symbol();
    loadTokenRef.current = token;
    setLoading(true);
    setError(null);
    setIsBuffering(true);
    setHasEnded(false);
    setIsPlaying(false); // FIX P2 #12: reset while loading

    try {
      const data = await api.streams(subjectId, se, ep);
      if (loadTokenRef.current !== token) return; // stale — discard
      setStreamData(data);

      const playable = (data.streams || []).filter(isPlayableStream);
      if (playable.length > 0) {
        // Fast-start on mobile: prefer 720p or 480p for smooth, instant start, fallback to 1080p
        const best = playable.find(s => s.quality === '720p') || playable.find(s => s.quality === '480p') || playable.find(s => s.quality === '1080p') || playable[0];
        setActiveStream(best);
        setSelectedServer('direct');
        setUseIframe(false);
        setIframeServerName('');
        setStreamUrl(api.proxyUrl(best.url, best.headers?.Referer));
        setIsPlaying(true);
      } else if (data.fallback_servers && data.fallback_servers.length > 0) {
        // FIX P2 #7: DASH-only streams auto-fallback to first iframe server
        const srv = data.fallback_servers[0];
        setSelectedServer(srv.id);
        setIframeServerName(srv.name || srv.id);
        setStreamUrl(srv.url);
        setUseIframe(true);
        setIsPlaying(true);
      } else {
        setError('No streams available for this title.');
      }

      if (isSeriesType || se > 0 || ep > 0) {
        try {
          const epData = await api.episodes(subjectId);
          if (loadTokenRef.current !== token) return;
          if (epData?.seasons) {
            setSeasonsData(epData.seasons);
            setSheetSeason(se || epData.seasons[0]?.season || 1);
          }
        } catch {}
      }

      // Load official subtitles using initialId or subjectId (official subs are tied to root ID)
      const targetCaptionId = initialId || subjectId;
      api.captions(targetCaptionId, se, ep).then((capData) => {
        if (loadTokenRef.current !== token) return;
        if (capData?.captions && capData.captions.length > 0) {
          const formatted: SubtitleItem[] = capData.captions.map((c) => ({
            id: c.id || c.url,
            language: c.language || 'English',
            url: api.proxyCaptionUrl(c.url),
            code: c.code,
            isOnline: false,
          }));
          formatted.forEach(item => cachedSubsRef.current.set(item.id, item));
          setSubtitlesList(Array.from(cachedSubsRef.current.values()));
        }
      }).catch(() => {});
    } catch (err: unknown) {
      if (loadTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Failed to load stream');
    } finally {
      if (loadTokenRef.current === token) setLoading(false);
    }
  }, [isSeriesType]);

  // FIX P2 #8: remove `loadStreams` from deps — it's stable (isSeriesType never changes in session)
  useEffect(() => {
    loadStreams(currentId, currentSeason, currentEpisode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, currentSeason, currentEpisode]);

  const sendVideoCommand = useCallback((jsCode: string) => {
    if (webViewRef.current) webViewRef.current.injectJavaScript(jsCode);
  }, []);

  // Immediately flip isPlaying state and send command to HTML5 video element
  const togglePlayPause = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sendVideoCommand(
      next
        ? 'if(window.videoEl){ window.videoEl.muted = false; window.videoEl.play(); }'
        : 'if(window.videoEl){ window.videoEl.pause(); }'
    );
    resetControlsTimer();
  };

  const seekRelative = (deltaSeconds: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    sendVideoCommand(`if(window.videoEl) window.videoEl.currentTime = ${target};`);
    setCurrentTime(target);
    resetControlsTimer();
  };

  const seekAbsolute = (percentage: number) => {
    if (duration > 0) {
      const target = duration * Math.max(0, Math.min(1, percentage));
      sendVideoCommand(`if(window.videoEl) window.videoEl.currentTime = ${target};`);
      setCurrentTime(target);
      resetControlsTimer();
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    sendVideoCommand(`if(window.videoEl) window.videoEl.playbackRate = ${speed};`);
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchQuality = (stream: StreamSource) => {
    setActiveStream(stream);
    setSelectedServer('direct');
    setUseIframe(false);
    setStreamUrl(api.proxyUrl(stream.url, stream.headers?.Referer));
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchDub = (dubId: string, dubName: string) => {
    setSelectedDubName(dubName);
    setCurrentId(dubId);
    const raw = title || streamData?.title || '';
    const clean = cleanLanguageTag(raw);
    if (dubName && !dubName.toLowerCase().includes('original')) {
      setPlayerTitle(`${clean} [${dubName}]`);
    } else {
      setPlayerTitle(clean || raw);
    }
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchServer = (serverId: string) => {
    if (serverId === 'direct') {
      if (activeStream) {
        setSelectedServer('direct');
        setUseIframe(false);
        setIframeServerName('');
        setStreamUrl(api.proxyUrl(activeStream.url, activeStream.headers?.Referer));
      }
    } else {
      const srv = streamData?.fallback_servers?.find(s => s.id === serverId);
      if (srv) {
        setSelectedServer(srv.id);
        setIframeServerName(srv.name || srv.id);
        setUseIframe(true);
        setStreamUrl(srv.url);
      }
    }
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchEpisode = (se: number, ep: number) => {
    setCurrentSeason(se);
    setCurrentEpisode(ep);
    setSheetSeason(se);
    setBottomSheet('none');
    resetControlsTimer();
    WatchProgressService.save({
      subject_id: currentId,
      title: (title || streamData?.title) as string,
      cover: cover as string,
      type: 'TV Series',
      season: se,
      episode: ep,
      currentTime: 0,
      duration: 0,
      progress: 0,
    });
  };

  const searchOnlineSubs = useCallback(async () => {
    setIsSearchingOnlineSubs(true);
    try {
      const cleanTitle = sanitizeTitleForSearch(title || streamData?.title || '');
      const res = await api.onlineSubtitles(cleanTitle, undefined, currentSeason, currentEpisode);
      if (res?.subtitles && res.subtitles.length > 0) {
        const formatted: SubtitleItem[] = res.subtitles.map((s) => ({
          id: s.id,
          language: `${s.language || 'English'} (Online)`,
          url: s.proxy_url.startsWith('http') ? s.proxy_url : api.proxyCaptionUrl(s.proxy_url),
          isOnline: true,
        }));
        formatted.forEach(item => cachedSubsRef.current.set(item.id, item));
        setSubtitlesList(Array.from(cachedSubsRef.current.values()));
      }
    } catch (e) {
      console.warn('Online subs error:', e);
    } finally {
      setIsSearchingOnlineSubs(false);
    }
  }, [title, streamData, currentSeason, currentEpisode]);

  const selectSubtitle = useCallback((sub: SubtitleItem | null) => {
    setActiveSubtitle(sub);
    if (sub) {
      sendVideoCommand(`if(window.setSubtitleTrack) window.setSubtitleTrack('${sub.url}', '${sub.language}');`);
    } else {
      sendVideoCommand(`if(window.setSubtitleTrack) window.setSubtitleTrack(null);`);
    }
    setBottomSheet('none');
    resetControlsTimer();
  }, [sendVideoCommand, resetControlsTimer]);

  // FIX P1 #3: handle 'ended' + auto-advance; FIX P2 #12: sync isPlaying from WebView events
  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as {
          type: string; currentTime?: number; duration?: number; error?: string;
        };
        switch (msg.type) {
          case 'timeupdate': {
            const cur = msg.currentTime || 0;
            const dur = msg.duration || duration || 0;
            setCurrentTime(cur);
            if (msg.duration && msg.duration > 0) setDuration(msg.duration);
            if (cur > 5 && Date.now() - lastSaveTimeRef.current > 4000) {
              lastSaveTimeRef.current = Date.now();
              WatchProgressService.save({
                subject_id: currentId,
                title: (title || streamData?.title) as string,
                cover: cover as string,
                type: isSeriesType ? 'TV Series' : 'Movie',
                season: isSeriesType ? currentSeason : 0,
                episode: isSeriesType ? currentEpisode : 0,
                currentTime: Math.floor(cur),
                duration: Math.floor(dur),
                progress: dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0,
              });
            }
            break;
          }
          case 'playing':
            setIsPlaying(true);
            setIsBuffering(false);
            setHasEnded(false);
            break;
          case 'pause': {
            setIsPlaying(false);
            if (currentTime > 5) {
              WatchProgressService.save({
                subject_id: currentId,
                title: (title || streamData?.title) as string,
                cover: cover as string,
                type: isSeriesType ? 'TV Series' : 'Movie',
                season: isSeriesType ? currentSeason : 0,
                episode: isSeriesType ? currentEpisode : 0,
                currentTime: Math.floor(currentTime),
                duration: Math.floor(duration),
                progress: duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0,
              });
            }
            break;
          }
          case 'waiting':
            setIsBuffering(true);
            break;
          case 'canplay':
            setIsBuffering(false);
            if (!hasAppliedInitialSeekRef.current && routeParamsInitialSeek && routeParamsInitialSeek > 10) {
              hasAppliedInitialSeekRef.current = true;
              sendVideoCommand(`if(window.videoEl){ window.videoEl.currentTime = ${routeParamsInitialSeek}; }`);
            }
            break;
          case 'ended': {
            setIsPlaying(false);
            setHasEnded(true);
            WatchProgressService.save({
              subject_id: currentId,
              title: (title || streamData?.title) as string,
              cover: cover as string,
              type: isSeriesType ? 'TV Series' : 'Movie',
              season: isSeriesType ? currentSeason : 0,
              episode: isSeriesType ? currentEpisode : 0,
              currentTime: Math.floor(duration || currentTime),
              duration: Math.floor(duration),
              progress: 100,
            });
            if (isSeriesType && seasonsData.length > 0) {
              const curSeason = seasonsData.find(s => Number(s.season) === Number(currentSeason));
              const hasNextEp = curSeason?.episodes.some(e => Number(e.episode) === Number(currentEpisode) + 1);
              if (hasNextEp) {
                setTimeout(() => switchEpisode(currentSeason, currentEpisode + 1), 1200);
              } else {
                const nextSeason = seasonsData.find(s => Number(s.season) === Number(currentSeason) + 1);
                if (nextSeason?.episodes.length) {
                  setTimeout(() => switchEpisode(currentSeason + 1, 1), 1200);
                }
              }
            }
            break;
          }
          case 'error':
            console.warn('Video error from player:', msg.error);
            setIsBuffering(false);
            if (streamData?.fallback_servers && streamData.fallback_servers.length > 0 && selectedServer === 'direct') {
              console.log('Failing over to fallback cloud server on playback error');
              const srv = streamData.fallback_servers[0];
              setSelectedServer(srv.id);
              setIframeServerName(srv.name || srv.id);
              setStreamUrl(srv.url);
              setUseIframe(true);
              setIsPlaying(true);
            } else {
              setError(msg.error || 'Playback stalled. Please switch server or quality.');
            }
            break;
          default:
            break;
        }
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSeriesType, seasonsData, currentSeason, currentEpisode, currentId, title, cover, duration, currentTime, routeParamsInitialSeek, sendVideoCommand],
  );

  const handleBack = () => {
    if (isFullscreen) { toggleFullscreen(); } else { navigation.goBack(); }
  };

  return {
    title: (playerTitle || title) as string | undefined,
    cover: cover as string | undefined,
    isSeriesType,
    currentId, currentSeason, currentEpisode,
    streamData, activeStream, selectedServer,
    streamUrl, useIframe, iframeServerName,
    loading, error,
    isPlaying, currentTime, duration, isBuffering,
    playbackSpeed, selectedDubName, hasEnded,
    controlsVisible, isLocked, setIsLocked,
    isFullscreen, bottomSheet, setBottomSheet,
    seasonsData, sheetSeason, setSheetSeason,
    subtitlesList, activeSubtitle, isSearchingOnlineSubs,
    trackWidth, setTrackWidth,
    webViewRef, fadeAnim,
    epLabel, playableStreams, dubsList, fallbackServers,
    progressRatio, sheetSeasonEpisodes,
    loadStreams, formatTime,
    togglePlayPause, seekRelative, seekAbsolute, changeSpeed,
    switchQuality, switchDub, switchServer, switchEpisode,
    searchOnlineSubs, selectSubtitle,
    toggleControls, toggleFullscreen, resetControlsTimer,
    handleWebViewMessage, handleBack, sendVideoCommand,
  };
}

