import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { MapView, Marker } from '@/components/MapViewSafe';
import { Brand } from '@/constants/brand';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

type Props = {
  visible: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
  title?: string;
};

/** Harare CBD as fallback when no GPS is available. */
const HARARE_REGION = {
  latitude: -17.8252,
  longitude: 31.0335,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

export function MapPickerModal({
  visible,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
  title = 'Pick location',
}: Props) {
  const hasInitial = initialLat != null && initialLng != null;
  const [pickedCoord, setPickedCoord] = useState<{ latitude: number; longitude: number } | null>(
    hasInitial ? { latitude: initialLat!, longitude: initialLng! } : null,
  );
  const [geocoding, setGeocoding] = useState(false);
  const [address, setAddress] = useState('');
  const mapRef = useRef<any>(null);

  const initialRegion = pickedCoord
    ? { ...pickedCoord, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : HARARE_REGION;

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const r = results[0];
      if (r) {
        const parts = [r.name, r.street, r.city, r.region].filter(Boolean);
        setAddress(parts.slice(0, 3).join(', '));
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  }, []);

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPickedCoord({ latitude, longitude });
      reverseGeocode(latitude, longitude);
    },
    [reverseGeocode],
  );

  const handleConfirm = useCallback(() => {
    if (!pickedCoord) return;
    onConfirm({ ...pickedCoord, address });
  }, [pickedCoord, address, onConfirm]);

  // On open: always try to centre on GPS first (unless explicit initial coords were given)
  useEffect(() => {
    if (!visible) return;
    if (hasInitial) {
      reverseGeocode(initialLat!, initialLng!);
      return;
    }
    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setPickedCoord(coord);
          reverseGeocode(coord.latitude, coord.longitude);
          // Animate map to current location (overrides the HARARE default initial region)
          const gpsRegion = { ...coord, latitudeDelta: 0.05, longitudeDelta: 0.05 };
          setTimeout(() => mapRef.current?.animateToRegion?.(gpsRegion, 600), 100);
        } catch {
          if (pickedCoord) reverseGeocode(pickedCoord.latitude, pickedCoord.longitude);
        }
      } else if (pickedCoord) {
        reverseGeocode(pickedCoord.latitude, pickedCoord.longitude);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={handleConfirm}
            disabled={!pickedCoord || geocoding}
            style={[styles.confirmBtn, (!pickedCoord || geocoding) && styles.btnDisabled]}
          >
            <Text style={styles.confirmText}>Use this</Text>
          </Pressable>
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handleMapPress}
        >
          {pickedCoord && <Marker coordinate={pickedCoord} />}
        </MapView>

        <View style={styles.addressBar}>
          {geocoding ? (
            <ActivityIndicator size="small" color={Brand.blue} />
          ) : (
            <Text style={styles.addressText} numberOfLines={2}>
              {pickedCoord
                ? address || 'Tap the map to pick a spot'
                : 'Tap the map to pick a spot'}
            </Text>
          )}
          <Text style={styles.addressHint}>Tap anywhere on the map to set the location</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  cancelBtn: { paddingVertical: 4, minWidth: 60 },
  cancelText: { fontSize: 15, color: Brand.blue, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: Brand.blue,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  map: { flex: 1 },
  addressBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    minHeight: 72,
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 14,
    color: Brand.navy,
    fontWeight: '600',
    textAlign: 'center',
  },
  addressHint: {
    fontSize: 11,
    color: Brand.muted,
    textAlign: 'center',
  },
});
