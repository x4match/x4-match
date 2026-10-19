import { useLocalSearchParams } from 'expo-router';
import { Screen, AppHeader } from '@/components/x4match';
import { OrganizerModule } from '@/components/organizer/OrganizerModule';

export default function OrganizerScreen() {
  const params = useLocalSearchParams<{ create?: string | string[] }>();
  const create = Array.isArray(params.create) ? params.create[0] : params.create;

  return (
    <Screen>
      <AppHeader title="Organizador" showBack />
      <OrganizerModule initialCreate={create} />
    </Screen>
  );
}
