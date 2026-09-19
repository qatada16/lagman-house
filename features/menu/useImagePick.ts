import * as ImagePicker from 'expo-image-picker';

export async function pickImage(aspect: [number, number] = [4, 3]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.75 });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}
