import { File } from 'expo-file-system';
import { supabase } from './supabase';

export async function uploadImage(bucket: 'images' | 'avatars', path: string, uri: string): Promise<string> {
  const file = new File(uri);
  const buffer = await file.arrayBuffer();
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const fullPath = `${path}.${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg'}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  // Cache-bust so a replaced image shows immediately.
  return `${data.publicUrl}?v=${Date.now()}`;
}
