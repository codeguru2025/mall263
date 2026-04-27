import {
  ActivityIndicator, Alert, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import {
  ALL_DOC_TYPES, DOC_TYPE_LABELS, driverDocsApi, type DocType, type DriverDocument,
} from '@/lib/driver-documents-api';
import { api } from '@/lib/api';

const DOC_ICONS: Record<DocType, React.ComponentProps<typeof FontAwesome>['name']> = {
  DRIVERS_LICENSE: 'id-card',
  NATIONAL_ID: 'address-card',
  POLICE_CLEARANCE: 'shield',
  PROOF_OF_RESIDENCE: 'home',
  CAR_REG_BOOK: 'car',
  INSURANCE: 'file-text',
  ZINARA: 'certificate',
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  PENDING_REVIEW: '#f59e0b',
};

export default function DriverOnboardingScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<DocType | null>(null);

  const q = useQuery({
    queryKey: ['driver-docs'],
    queryFn: driverDocsApi.getMyDocuments,
  });

  const submitMut = useMutation({
    mutationFn: ({ type, fileUrl }: { type: DocType; fileUrl: string }) =>
      driverDocsApi.submit(type, fileUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-docs'] }),
    onError: (err: any) => Alert.alert('Upload failed', err?.response?.data?.message ?? 'Could not save document'),
  });

  const handleUpload = async (type: DocType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to photos to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `${type.toLowerCase()}.jpg`,
        type: 'image/jpeg',
      } as any);
      const uploadRes = await api.post('/api/v1/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl: string = uploadRes.data.cdnUrl;
      submitMut.mutate({ type, fileUrl });
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message ?? 'Could not upload image');
    } finally {
      setUploading(null);
    }
  };

  const handleCamera = async (type: DocType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow camera access to take document photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `${type.toLowerCase()}.jpg`,
        type: 'image/jpeg',
      } as any);
      const uploadRes = await api.post('/api/v1/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      submitMut.mutate({ type, fileUrl: uploadRes.data.cdnUrl });
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message ?? 'Could not upload photo');
    } finally {
      setUploading(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  const status = q.data;
  const docMap: Partial<Record<DocType, DriverDocument>> = {};
  (status?.documents ?? []).forEach((d) => { docMap[d.type] = d; });
  const approved = status?.approvedCount ?? 0;
  const total = status?.totalRequired ?? ALL_DOC_TYPES.length;
  const progress = total > 0 ? approved / total : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.heading}>Driver Onboarding</Text>
        <Text style={styles.subheading}>
          Upload all 7 required documents to activate your driver account. Admin reviews within 1–2 business days.
        </Text>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{approved}/{total} approved</Text>
        </View>

        {status?.kycVerified && (
          <View style={styles.verifiedBadge}>
            <FontAwesome name="check-circle" size={14} color={Brand.green} />
            <Text style={styles.verifiedText}>KYC Verified — you can accept jobs</Text>
          </View>
        )}
      </View>

      {/* Document list */}
      {ALL_DOC_TYPES.map((type) => {
        const doc = docMap[type];
        const isUploading = uploading === type || (submitMut.isPending && submitMut.variables?.type === type);
        const statusColor = doc ? (STATUS_COLOR[doc.status] ?? Brand.muted) : Brand.border;

        return (
          <View key={type} style={[styles.docCard, doc?.status === 'APPROVED' && styles.docCardApproved]}>
            <View style={styles.docHeader}>
              <View style={[styles.docIconBox, { backgroundColor: statusColor + '18' }]}>
                <FontAwesome name={DOC_ICONS[type]} size={18} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{DOC_TYPE_LABELS[type]}</Text>
                {doc ? (
                  <Text style={[styles.docStatus, { color: statusColor }]}>
                    {doc.status === 'PENDING_REVIEW' ? 'Pending review' :
                     doc.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </Text>
                ) : (
                  <Text style={styles.docStatus}>Not uploaded</Text>
                )}
              </View>
              {doc?.status === 'APPROVED' && (
                <FontAwesome name="check-circle" size={18} color={Brand.green} />
              )}
            </View>

            {doc?.status === 'REJECTED' && doc.rejectedReason && (
              <View style={styles.rejectNote}>
                <FontAwesome name="exclamation-circle" size={12} color="#ef4444" />
                <Text style={styles.rejectText}>{doc.rejectedReason}</Text>
              </View>
            )}

            {doc?.status !== 'APPROVED' && (
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.uploadBtn, isUploading && { opacity: 0.5 }]}
                  disabled={isUploading}
                  onPress={() => handleCamera(type)}
                >
                  {isUploading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><FontAwesome name="camera" size={13} color="#fff" /><Text style={styles.uploadBtnText}>Camera</Text></>
                  }
                </Pressable>
                <Pressable
                  style={[styles.galleryBtn, isUploading && { opacity: 0.5 }]}
                  disabled={isUploading}
                  onPress={() => handleUpload(type)}
                >
                  <FontAwesome name="photo" size={13} color={Brand.primary} />
                  <Text style={styles.galleryBtnText}>Gallery</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40, gap: 10, backgroundColor: Brand.pageBg },

  headerCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, ...cardShadow,
  },
  heading: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 6 },
  subheading: { fontSize: 13, color: Brand.muted, lineHeight: 19, marginBottom: 14 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Brand.green, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, width: 60 },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: '#dcfce7', borderRadius: 8, padding: 8,
  },
  verifiedText: { fontSize: 12, fontWeight: '700', color: Brand.green },

  docCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Brand.border, ...cardShadow,
  },
  docCardApproved: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  docStatus: { fontSize: 12, fontWeight: '600', color: Brand.muted, marginTop: 2 },

  rejectNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, marginTop: 10,
  },
  rejectText: { flex: 1, fontSize: 12, color: '#b91c1c', lineHeight: 17 },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  uploadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 10,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  galleryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Brand.primary + '10', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: Brand.primary + '30',
  },
  galleryBtnText: { color: Brand.primary, fontWeight: '700', fontSize: 13 },
});
