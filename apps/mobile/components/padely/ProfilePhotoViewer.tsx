import { Modal, Pressable, Text, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';

type ProfilePhotoViewerProps = {
  visible: boolean;
  photo?: string | null;
  name: string;
  onClose: () => void;
};

export function ProfilePhotoViewer({
  visible,
  photo,
  name,
  onClose,
}: ProfilePhotoViewerProps) {
  if (!photo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.86)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: ui.spacing.xl,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>

          <Image
            source={{ uri: photo }}
            resizeMode="contain"
            style={{
              width: '100%',
              maxWidth: 360,
              height: 360,
              borderRadius: ui.radius.lg,
              backgroundColor: ui.colors.surfaceAlt,
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
