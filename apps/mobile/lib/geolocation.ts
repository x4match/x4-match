import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { api } from './api';

export type PlayerCoordinates = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type RequestCoordinatesOptions = {
  withLabel?: boolean;
  showAlerts?: boolean;
};

function buildLocationLabel(place: Location.LocationGeocodedAddress | null | undefined): string | undefined {
  if (!place) return undefined;
  const parts = [
    place.district || place.subregion || place.city,
    place.city && place.city !== place.district ? place.city : null,
    place.region,
  ].filter(Boolean);
  const unique = [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))];
  return unique.length ? unique.join(', ') : undefined;
}

async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch {
    // ignore
  }
}

export async function requestPlayerCoordinates(
  options: RequestCoordinatesOptions = {},
): Promise<PlayerCoordinates | null> {
  const { withLabel = false, showAlerts = false } = options;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    if (showAlerts) {
      Alert.alert(
        'Ubicación desactivada',
        'Activá los servicios de ubicación del dispositivo para encontrar partidos y jugadores cerca.',
      );
    }
    return null;
  }

  const { status: existingStatus, canAskAgain } = await Location.getForegroundPermissionsAsync();
  let status = existingStatus;

  if (status !== 'granted') {
    if (existingStatus === 'denied' && canAskAgain === false) {
      if (showAlerts) {
        Alert.alert(
          'Permiso de ubicación',
          'Tenés que habilitar la ubicación desde Ajustes para usarla en x4 match.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: () => void openAppSettings() },
          ],
        );
      }
      return null;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    status = permission.status;
  }

  if (status !== 'granted') {
    if (showAlerts) {
      Alert.alert(
        'Permiso denegado',
        'Sin ubicación solo vamos a poder sugerirte partidos por zona. Podés activarla cuando quieras.',
      );
    }
    return null;
  }

  try {
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });

    const coords: PlayerCoordinates = {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };

    if (withLabel) {
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        coords.label = buildLocationLabel(place);
      } catch {
        // reverse geocode is best-effort
      }
    }

    return coords;
  } catch (error) {
    if (showAlerts) {
      const message =
        Platform.OS === 'web'
          ? 'La ubicación no está disponible en este entorno. Probá en el celular.'
          : 'No se pudo leer tu posición. Revisá el GPS e intentá de nuevo.';
      Alert.alert('Ubicación', message);
    }
    console.warn('requestPlayerCoordinates failed', error);
    return null;
  }
}

export function formatDistanceKm(km?: number | string | null): string | null {
  if (km == null || km === '') return null;
  const value = typeof km === 'number' ? km : Number(km);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 1) return `${Math.max(100, Math.round(value * 1000))} m`;
  if (value < 10) return `${value.toFixed(1)} km`;
  return `${Math.round(value)} km`;
}

export async function syncPlayerCoordinates(
  coords: PlayerCoordinates,
  extras?: { location?: string | null; updateLocality?: boolean },
): Promise<{ location?: string }> {
  const payload: Record<string, unknown> = {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };

  // Solo actualizar la localidad visible cuando el caller lo pide (p. ej. Perfil)
  // o cuando ya viene un label. El sync silencioso de Home solo manda GPS.
  const updateLocality =
    extras?.updateLocality === true || extras?.location != null || Boolean(coords.label);

  let locationLabel: string | null | undefined;
  if (extras?.location !== undefined) {
    locationLabel = extras.location;
  } else if (coords.label) {
    locationLabel = coords.label;
  } else if (extras?.updateLocality) {
    locationLabel = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }

  if (updateLocality && locationLabel != null) {
    payload.location = locationLabel;
  }

  const res = await api.patch('/users/profile', payload);
  return {
    location:
      (typeof res.data?.location === 'string' && res.data.location) ||
      (typeof locationLabel === 'string' ? locationLabel : undefined),
  };
}
