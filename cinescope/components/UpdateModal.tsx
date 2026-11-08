import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UpdateInfo, downloadAndInstallApk } from '../services/updateService';

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ updateInfo, onDismiss }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!updateInfo || !updateInfo.available) return null;

  const handleUpdate = async () => {
    try {
      setDownloading(true);
      setProgress(0.05);

      await downloadAndInstallApk(updateInfo.downloadUrl, (ratio) => {
        setProgress(ratio);
      });

      // Done or launched installer
      setDownloading(false);
      onDismiss();
    } catch (e: any) {
      setDownloading(false);
      Alert.alert('Update Failed', 'Could not complete update. Please try again.');
    }
  };

  const percent = Math.round(progress * 100);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (!updateInfo.forceUpdate && !downloading) onDismiss();
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
                <View style={[S.progressFill, { width: `${percent}%` }]} />
              </View>
              <View style={S.progressMeta}>
                <ActivityIndicator size="small" color="#FF2E55" />
                <Text style={S.progressText}>
                  Downloading update… {percent}%
                </Text>
              </View>
            </View>
          ) : (
            <View style={S.btnRow}>
              {!updateInfo.forceUpdate && (
                <TouchableOpacity
                  style={S.laterBtn}
                  onPress={onDismiss}
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
});
