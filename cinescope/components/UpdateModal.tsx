import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UpdateInfo, downloadAndInstallApk, dismissUpdate, DownloadProgress } from '../services/updateService';

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ updateInfo, onDismiss }) => {
  const [downloading, setDownloading] = useState(false);
  const [progressInfo, setProgressInfo] = useState<DownloadProgress>({
    ratio: 0.01,
    loadedMb: 0.1,
    totalMb: 84.4,
    percent: 1,
  });

  if (!updateInfo || !updateInfo.available) return null;

  const handleDismiss = () => {
    if (updateInfo?.version) {
      dismissUpdate(updateInfo.version);
    }
    onDismiss();
  };

  const handleBrowserDownload = () => {
    if (updateInfo.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl).catch(() => {});
    }
  };

  const handleUpdate = async () => {
    try {
      setDownloading(true);
      setProgressInfo({ ratio: 0.02, loadedMb: 0.5, totalMb: 84.4, percent: 2 });

      await downloadAndInstallApk(updateInfo.downloadUrl, (p) => {
        setProgressInfo(p);
      });

      // Done or launched installer
      setDownloading(false);
      onDismiss();
    } catch (e: any) {
      setDownloading(false);
      Alert.alert(
        'In-App Download Error',
        'Could not complete in-app download. Would you like to download directly via your browser?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download via Browser', onPress: handleBrowserDownload },
        ]
      );
    }
  };

  const percent = progressInfo.percent;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (!updateInfo.forceUpdate && !downloading) handleDismiss();
      }}
    >
      <View style={S.overlay}>
        <View style={S.card}>
          {/* Header Icon */}
          <View style={S.iconCircle}>
            <Ionicons name="sparkles" size={32} color="#FF2E55" />
          </View>

          <Text style={S.title}>Update Available!</Text>
          <Text style={S.versionText}>MovieVerse v{updateInfo.version}</Text>

          {/* Changelog Box */}
          <View style={S.changelogBox}>
            <Text style={S.changelogHeader}>What's New:</Text>
            <Text style={S.changelogText}>{updateInfo.changelog}</Text>
          </View>

          {/* Progress or Action buttons */}
          {downloading ? (
            <View style={S.progressContainer}>
              <View style={S.progressTrack}>
                <View style={[S.progressFill, { width: `${Math.max(2, percent)}%` }]} />
              </View>
              <View style={S.progressMeta}>
                <ActivityIndicator size="small" color="#FF2E55" />
                <Text style={S.progressText}>
                  {progressInfo.loadedMb > 0
                    ? `Downloading: ${progressInfo.loadedMb} / ${progressInfo.totalMb} MB (${percent}%)`
                    : `Connecting to high-speed CDN… (${percent}%)`}
                </Text>
              </View>
              <TouchableOpacity
                style={S.directFallbackBtn}
                onPress={handleBrowserDownload}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={14} color="#94A3B8" />
                <Text style={S.directFallbackText}>Or switch to High-Speed Browser Download</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: '100%', gap: 10 }}>
              <View style={S.btnRow}>
                {!updateInfo.forceUpdate && (
                  <TouchableOpacity
                    style={S.laterBtn}
                    onPress={handleDismiss}
                    activeOpacity={0.7}
                  >
                    <Text style={S.laterBtnText}>Later</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[S.updateBtn, updateInfo.forceUpdate && { flex: 1 }]}
                  onPress={handleUpdate}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
                  <Text style={S.updateBtnText}>Update Now</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={S.browserAltBtn}
                onPress={handleBrowserDownload}
                activeOpacity={0.75}
              >
                <Ionicons name="globe-outline" size={15} color="#94A3B8" />
                <Text style={S.browserAltText}>Direct Browser Download (High-Speed APK)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#11131E',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 46, 85, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.25)',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  versionText: {
    color: '#FF2E55',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  changelogBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  changelogHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  changelogText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF2E55',
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  laterBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  laterBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  updateBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FF2E55',
  },
  updateBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  directFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  directFallbackText: {
    color: '#94A3B8',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  browserAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  browserAltText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
});
