import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDownloads } from '../../services/downloadService';

interface DownloadFloatingBarProps {
  bottomOffset?: number;
}

export const DownloadFloatingBar: React.FC<DownloadFloatingBarProps> = ({ bottomOffset = 16 }) => {
  const { activeTasks, completedTasks, dismissTask } = useDownloads();
  const [expanded, setExpanded] = useState(false);

  // If no active tasks and no recently completed tasks, render nothing
  const latestCompleted = completedTasks[0];
  const isRecentCompleted = latestCompleted && Date.now() - latestCompleted.startedAt < 60000;

  if (activeTasks.length === 0 && !isRecentCompleted) {
    return null;
  }

  const primaryTask = activeTasks[0] || latestCompleted;
  const isComplete = activeTasks.length === 0 && isRecentCompleted;
  const totalCount = activeTasks.length;
  const avgProgress =
    totalCount > 0
      ? activeTasks.reduce((acc, t) => acc + t.progress, 0) / totalCount
      : 1.0;
  const percentText = `${Math.round(avgProgress * 100)}%`;

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={[styles.barCard, isComplete && styles.barCardCompleted]}>
        <TouchableOpacity
          style={styles.contentRow}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBubble, isComplete && styles.iconBubbleCompleted]}>
            <Ionicons
              name={isComplete ? 'checkmark-circle' : 'cloud-download'}
              size={18}
              color={isComplete ? '#10B981' : '#38BDF8'}
            />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {isComplete
                  ? `Saved to MovieVerse: ${primaryTask?.filename}`
                  : totalCount > 1
                  ? `Downloading ${totalCount} items… (${percentText})`
                  : `${primaryTask?.filename || 'Downloading…'} (${percentText})`}
              </Text>
              {!isComplete && (
                <Text style={styles.percentBadge}>{percentText}</Text>
              )}
            </View>

            {!isComplete && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(avgProgress * 100)}%` }]} />
              </View>
            )}
          </View>

          {isComplete && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => dismissTask(primaryTask.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Multi-download expanded drawer */}
        {expanded && totalCount > 1 && (
          <View style={styles.expandedDrawer}>
            {activeTasks.map((task) => (
              <View key={task.id} style={styles.taskMiniRow}>
                <Text style={styles.miniFilename} numberOfLines={1}>
                  {task.filename}
                </Text>
                <Text style={styles.miniPercent}>{Math.round(task.progress * 100)}%</Text>
                <TouchableOpacity
                  style={styles.miniDismiss}
                  onPress={() => dismissTask(task.id)}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: 'center',
  },
  barCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
  barCardCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(6, 78, 59, 0.92)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  percentBadge: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  expandedDrawer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  taskMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  miniFilename: {
    color: '#CBD5E1',
    fontSize: 11,
    flex: 1,
    marginRight: 6,
  },
  miniPercent: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
  },
  miniDismiss: {
    padding: 2,
  },
});
