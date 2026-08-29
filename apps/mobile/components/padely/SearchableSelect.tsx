import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';

export type SearchableSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string | null;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  emptyMessage?: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function SearchableSelect({
  label,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  value,
  options,
  onChange,
  emptyMessage = 'Sin resultados',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => {
      const haystack = normalize([o.label, o.subtitle].filter(Boolean).join(' '));
      return haystack.includes(q);
    });
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  return (
    <View style={{ marginBottom: ui.spacing.md }}>
      {label ? (
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: ui.colors.textInverse,
            marginBottom: 12,
          }}
        >
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: ui.colors.card,
          borderRadius: ui.radius.md,
          borderWidth: 1,
          borderColor: value ? ui.colors.primary : ui.colors.border,
          ...ui.shadow.card,
        }}
      >
        <Ionicons name="business" size={22} color={value ? ui.colors.primary : ui.colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontWeight: '600',
              fontSize: 15,
              color: selected ? ui.colors.textPrimary : ui.colors.textMuted,
            }}
            numberOfLines={1}
          >
            {selected ? selected.label : placeholder}
          </Text>
          {selected?.subtitle ? (
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {selected.subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={20} color={ui.colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(8, 16, 24, 0.65)', justifyContent: 'flex-end' }}
          onPress={close}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: '85%' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View
                style={{
                  backgroundColor: ui.colors.surface,
                  borderTopLeftRadius: ui.radius.xl,
                  borderTopRightRadius: ui.radius.xl,
                  paddingTop: 12,
                  paddingBottom: Platform.OS === 'ios' ? 34 : 24,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: ui.colors.surfaceAlt,
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: ui.spacing.lg,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textInverse }}>
                    {label || placeholder}
                  </Text>
                  <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={24} color={ui.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: ui.spacing.lg, marginBottom: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: ui.colors.card,
                      borderRadius: ui.radius.md,
                      borderWidth: 1,
                      borderColor: ui.colors.border,
                    }}
                  >
                    <Ionicons name="search" size={20} color={ui.colors.textMuted} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={ui.colors.textMuted}
                      autoCorrect={false}
                      style={{ flex: 1, fontSize: 15, color: ui.colors.textPrimary, padding: 0 }}
                    />
                    {query.length > 0 ? (
                      <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color={ui.colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.value}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 360 }}
                  contentContainerStyle={{ paddingHorizontal: ui.spacing.lg, paddingBottom: 8 }}
                  ListEmptyComponent={
                    <Text style={{ textAlign: 'center', color: ui.colors.textMuted, paddingVertical: 24 }}>
                      {emptyMessage}
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const active = item.value === value;
                    return (
                      <TouchableOpacity
                        onPress={() => handleSelect(item.value)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          marginBottom: 8,
                          borderRadius: ui.radius.md,
                          backgroundColor: active ? ui.colors.card : ui.colors.surfaceAlt,
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? ui.colors.primary : 'transparent',
                        }}
                      >
                        <Ionicons
                          name="business"
                          size={22}
                          color={active ? ui.colors.primary : ui.colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', fontSize: 15, color: ui.colors.textPrimary }}>
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        {active ? <Ionicons name="checkmark-circle" size={22} color={ui.colors.primary} /> : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
