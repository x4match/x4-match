import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });
      await login(response.data.access_token, response.data.user);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    Alert.alert('Google', 'Registro con Google próximamente');
  };

  const handleAppleRegister = () => {
    Alert.alert('Apple', 'Registro con Apple próximamente');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 rounded-t-3xl bg-white"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-5 pt-8 pb-10">
          {/* ═══ Header ═══ */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-full bg-gray-900 items-center justify-center mb-4">
              <Ionicons name="person-add" size={26} color="#fbbf24" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              Creá tu cuenta
            </Text>
            <Text className="text-sm text-gray-500">
              Unite y empezá a jugar
            </Text>
          </View>

          {/* ═══ Botones sociales ═══ */}
          <View className="flex-row gap-3 mb-6">
            {/* Google */}
            <TouchableOpacity
              className="flex-1 bg-gray-50 rounded-xl py-3.5 flex-row items-center justify-center"
              onPress={handleGoogleRegister}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={18} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700 ml-2">Google</Text>
            </TouchableOpacity>

            {/* Apple - solo en iOS */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                className="flex-1 bg-gray-50 rounded-xl py-3.5 flex-row items-center justify-center"
                onPress={handleAppleRegister}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={18} color="#374151" />
                <Text className="text-sm font-semibold text-gray-700 ml-2">Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ═══ Separador ═══ */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs text-gray-400 mx-4">o registrate con email</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* ═══ Formulario ═══ */}
          <View className="mb-6">
            {/* Nombre */}
            <View className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center">
              <Ionicons name="person-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-3 text-sm text-gray-900"
                placeholder="Nombre completo"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            </View>

            {/* Email */}
            <View className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center">
              <Ionicons name="mail-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-3 text-sm text-gray-900"
                placeholder="Email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Contraseña */}
            <View className="bg-gray-50 rounded-xl px-4 py-3.5 mb-1 flex-row items-center">
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-3 text-sm text-gray-900"
                placeholder="Contraseña"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
            <Text className="text-[11px] text-gray-400 ml-1 mb-4">
              Mínimo 6 caracteres
            </Text>
          </View>

          {/* ═══ Botón principal ═══ */}
          <TouchableOpacity
            className={`bg-gray-900 rounded-xl py-4 items-center justify-center mb-6 ${loading ? 'opacity-70' : ''}`}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Text>
          </TouchableOpacity>

          {/* ═══ Términos ═══ */}
          <Text className="text-[11px] text-gray-400 text-center mb-6 px-4">
            Al registrarte, aceptás nuestros{' '}
            <Text className="text-blue-500">Términos de servicio</Text> y{' '}
            <Text className="text-blue-500">Política de privacidad</Text>
          </Text>

          {/* ═══ Link a login ═══ */}
          <View className="flex-row items-center justify-center">
            <Text className="text-sm text-gray-500">¿Ya tenés cuenta? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-sm font-semibold text-blue-500">
                Iniciá sesión
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
