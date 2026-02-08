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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      await login(response.data.access_token, response.data.user);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    Alert.alert('Google', 'Inicio de sesión con Google próximamente');
  };

  const handleAppleLogin = () => {
    Alert.alert('Apple', 'Inicio de sesión con Apple próximamente');
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
              <Ionicons name="tennisball" size={28} color="#fbbf24" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              Bienvenido de nuevo
            </Text>
            <Text className="text-sm text-gray-500">
              Iniciá sesión para continuar
            </Text>
          </View>

          {/* ═══ Formulario ═══ */}
          <View className="mb-6">
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
            <View className="bg-gray-50 rounded-xl px-4 py-3.5 mb-2 flex-row items-center">
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-3 text-sm text-gray-900"
                placeholder="Contraseña"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            {/* Olvidé contraseña */}
            <TouchableOpacity className="self-end mb-4">
              <Text className="text-xs text-blue-500 font-medium">
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          {/* ═══ Botón principal ═══ */}
          <TouchableOpacity
            className={`bg-gray-900 rounded-xl py-4 items-center justify-center mb-6 ${loading ? 'opacity-70' : ''}`}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Text>
          </TouchableOpacity>

          {/* ═══ Separador ═══ */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs text-gray-400 mx-4">o continuar con</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* ═══ Botones sociales ═══ */}
          <View className="flex-row gap-3 mb-8">
            {/* Google */}
            <TouchableOpacity
              className="flex-1 bg-gray-50 rounded-xl py-3.5 flex-row items-center justify-center"
              onPress={handleGoogleLogin}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={18} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700 ml-2">Google</Text>
            </TouchableOpacity>

            {/* Apple - solo en iOS */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                className="flex-1 bg-gray-50 rounded-xl py-3.5 flex-row items-center justify-center"
                onPress={handleAppleLogin}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={18} color="#374151" />
                <Text className="text-sm font-semibold text-gray-700 ml-2">Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ═══ Link a registro ═══ */}
          <View className="flex-row items-center justify-center">
            <Text className="text-sm text-gray-500">¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-sm font-semibold text-blue-500">
                Registrate
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
