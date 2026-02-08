import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const GENDER_OPTIONS = ['Masculino', 'Femenino', 'Otro'] as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campos del perfil
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Preferencias
  const [preferences, setPreferences] = useState({
    preferredHand: '',
    courtPosition: '',
    matchType: '',
    preferredPlayTime: '',
  });

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      const data = response.data;
      setName(data.name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setGender(data.gender || '');
      setBirthDate(data.birthDate ? new Date(data.birthDate) : null);
      setDescription(data.description || '');
      setLocation(data.location || '');
      setPreferences({
        preferredHand: data.preferences?.preferredHand || '',
        courtPosition: data.preferences?.courtPosition || '',
        matchType: data.preferences?.matchType || '',
        preferredPlayTime: data.preferences?.preferredPlayTime || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForAPI = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const handleRequestLocation = async () => {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    if (existingStatus === 'granted') {
      await fetchLocation();
    } else {
      setShowLocationModal(true);
    }
  };

  const handleLocationPermissionAccepted = async () => {
    setShowLocationModal(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'No se pudo acceder a tu ubicación. Podés habilitarlo desde los ajustes del dispositivo.');
      return;
    }
    await fetchLocation();
  };

  const fetchLocation = async () => {
    setLoadingLocation(true);
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      if (reverseGeocode) {
        const parts = [
          reverseGeocode.city,
          reverseGeocode.region,
          reverseGeocode.country,
        ].filter(Boolean);
        setLocation(parts.join(', '));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const profileData: any = {
        name: name.trim(),
        phone: phone.trim() || null,
        gender: gender || null,
        description: description.trim() || null,
        location: location.trim() || null,
      };

      if (birthDate) {
        profileData.birthDate = formatDateForAPI(birthDate);
      }

      const response = await api.patch('/users/profile', profileData);
      updateUser({
        name: response.data.name,
        phone: response.data.phone,
        gender: response.data.gender,
        birthDate: response.data.birthDate,
        description: response.data.description,
        location: response.data.location,
      });
      Alert.alert('Listo', 'Perfil actualizado correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B5BDB" />
      </View>
    );
  }

  const preferencesSubtitle = [
    preferences.preferredHand,
    preferences.courtPosition,
    preferences.matchType,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ marginRight: 4 }}>
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Guardar
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1 pt-4" showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View className="items-center mb-2">
          <View className="w-20 h-20 rounded-full bg-gray-800 items-center justify-center">
            <Text className="text-white text-2xl font-bold">
              {getInitials(name || 'U')}
            </Text>
          </View>
          <TouchableOpacity className="mt-2 mb-4">
            <Text className="text-blue-500 text-sm font-medium">
              Cambiar foto de perfil
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══ Información personal ═══ */}
        <View className="px-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Información personal
          </Text>

          {/* Nombre y apellidos */}
          <View className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 mb-3">
            <Text className="text-xs text-gray-500 mb-1">
              Nombre y apellidos
            </Text>
            <TextInput
              className="text-base text-gray-900 p-0"
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre completo"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
            />
          </View>

          {/* Email (solo lectura) */}
          <View className="bg-gray-100 rounded-xl px-4 pt-2.5 pb-3 mb-3">
            <Text className="text-xs text-gray-500 mb-1">Email</Text>
            <Text className="text-base text-gray-500">{email}</Text>
          </View>

          {/* Teléfono */}
          <View className="flex-row gap-3 mb-3">
            <View className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 flex-row items-end" style={{ width: 120 }}>
              <Text className="text-base text-gray-900">AR  +54</Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" style={{ marginLeft: 4, marginBottom: 2 }} />
            </View>
            <View className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 flex-1">
              <Text className="text-xs text-gray-500 mb-1">Teléfono</Text>
              <TextInput
                className="text-base text-gray-900 p-0"
                value={phone}
                onChangeText={setPhone}
                placeholder="Tu teléfono"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Género */}
          <TouchableOpacity
            className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowGenderPicker(!showGenderPicker)}
          >
            <View>
              <Text className="text-xs text-gray-500 mb-1">Género</Text>
              <Text className={`text-base ${gender ? 'text-gray-900' : 'text-gray-400'}`}>
                {gender || 'Seleccionar'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>

          {/* Opciones de género */}
          {showGenderPicker && (
            <View className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  className={`px-4 py-3 border-b border-gray-100 ${gender === option ? 'bg-blue-50' : ''
                    }`}
                  onPress={() => {
                    setGender(option);
                    setShowGenderPicker(false);
                  }}
                >
                  <Text
                    className={`text-base ${gender === option
                      ? 'text-blue-500 font-medium'
                      : 'text-gray-700'
                      }`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fecha de nacimiento */}
          <TouchableOpacity
            className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowDatePicker(true)}
          >
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">
                Fecha de nacimiento
              </Text>
              <Text className={`text-base ${birthDate ? 'text-gray-900' : 'text-gray-400'}`}>
                {birthDate ? formatDateForDisplay(birthDate) : 'DD/MM/AAAA'}
              </Text>
            </View>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
          </TouchableOpacity>

          {showDatePicker && (
            <View className="mb-3">
              <DateTimePicker
                value={birthDate || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(1930, 0, 1)}
                onChange={onDateChange}
                locale="es"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  className="bg-blue-500 rounded-lg py-2 mt-2 items-center"
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text className="text-white font-semibold">Confirmar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Descripción */}
          <View className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 mb-1">
            <Text className="text-xs text-gray-500 mb-1">Descripción</Text>
            <TextInput
              className="text-base text-gray-900 p-0"
              value={description}
              onChangeText={(text) => {
                if (text.length <= 160) setDescription(text);
              }}
              placeholder="Escribe algo sobre ti..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <Text className="text-xs text-gray-400 mb-4 px-1">
            {160 - description.length} caracteres
          </Text>

          {/* ¿Dónde juegas? */}
          <View className="bg-gray-50 rounded-xl px-4 pt-2.5 pb-3 mb-3">
            <Text className="text-xs text-gray-500 mb-1">¿Dónde juegas?</Text>
            <View className="flex-row items-center">
              <View className="flex-1">
                <TextInput
                  className="text-base text-gray-900 p-0"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Ciudad, zona..."
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <TouchableOpacity
                onPress={handleRequestLocation}
                disabled={loadingLocation}
                className="ml-2"
              >
                {loadingLocation ? (
                  <ActivityIndicator size="small" color="#3B5BDB" />
                ) : (
                  <Ionicons name="navigate-outline" size={20} color="#3B5BDB" />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            className="flex-row items-center mb-8 px-1"
            onPress={handleRequestLocation}
            disabled={loadingLocation}
          >
            <Ionicons name="locate-outline" size={16} color="#3B5BDB" />
            <Text className="text-blue-500 text-sm ml-1.5">
              Usar mi ubicación actual
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══ Preferencias de jugador ═══ */}
        <View className="px-5 mb-8">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Preferencias de jugador
          </Text>

          <TouchableOpacity
            className="bg-gray-50 rounded-xl px-4 py-4 flex-row items-center"
            onPress={() => router.push('/edit-preferences' as any)}
          >
            <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
              <Ionicons name="tennisball-outline" size={22} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Editar tus preferencias
              </Text>
              <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                {preferencesSubtitle || 'Mejor mano, lado de la pista, tipo de pa...'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ═══ Tu contraseña ═══ */}
        <View className="px-5 mb-10">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            Tu contraseña
          </Text>

          <View className="bg-gray-50 rounded-xl px-4 py-4 flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-gray-500 mb-1">Contraseña</Text>
              <Text className="text-base text-gray-900 tracking-widest">
                ••••••••••
              </Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="create-outline" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de permiso de ubicación */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View className="bg-white rounded-2xl mx-6 p-6" style={{ width: '85%' }}>
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-blue-50 items-center justify-center mb-3">
                <Ionicons name="location" size={32} color="#3B5BDB" />
              </View>
              <Text className="text-lg font-bold text-gray-900 text-center">
                Permitir acceso a la ubicación
              </Text>
            </View>

            <Text className="text-sm text-gray-600 text-center mb-6 leading-5">
              Necesitamos acceder a tu ubicación para detectar automáticamente
              dónde jugás y mostrarte clubes y jugadores cercanos.
            </Text>

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3.5 mb-3 items-center"
              onPress={handleLocationPermissionAccepted}
            >
              <Text className="text-white font-semibold text-base">
                Permitir ubicación
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3 items-center"
              onPress={() => setShowLocationModal(false)}
            >
              <Text className="text-gray-500 font-medium text-base">
                Ahora no
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

