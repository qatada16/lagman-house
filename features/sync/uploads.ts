import { Directory, File, Paths } from 'expo-file-system';
import { all, get, nowIso, run } from '@/lib/db';
import { newId } from '@/lib/device';
import { uploadImage } from '@/lib/storage';

export interface PendingUpload {
  id: string;
  bucket: 'images' | 'avatars';
  path: string;
  local_uri: string;
  target_table: string;
  target_id: string;
  target_column: string;
  created_at: string;
}

function uploadsDir() {
  const dir = new Directory(Paths.document, 'pending-uploads');
  if (!dir.exists) dir.create();
  return dir;
}

// Copies the picked image into app storage so it survives cache clean-ups, then records the upload.
export function queueImageUpload(input: { bucket: 'images' | 'avatars'; path: string; sourceUri: string; targetTable: string; targetId: string; targetColumn: string }): string {
  const ext = input.sourceUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const id = newId();
  const dest = new File(uploadsDir(), `${id}.${ext}`);
  new File(input.sourceUri).copy(dest);
  run('DELETE FROM pending_uploads WHERE target_table = ? AND target_id = ? AND target_column = ?', [input.targetTable, input.targetId, input.targetColumn]);
  run(
    'INSERT INTO pending_uploads (id, bucket, path, local_uri, target_table, target_id, target_column, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.bucket, input.path, dest.uri, input.targetTable, input.targetId, input.targetColumn, nowIso()]
  );
  return dest.uri;
}

export function hasPendingUpload(table: string, id: string, column: string) {
  return !!get('SELECT id FROM pending_uploads WHERE target_table = ? AND target_id = ? AND target_column = ?', [table, id, column]);
}

export function countPendingUploads() {
  return get<{ c: number }>('SELECT COUNT(*) AS c FROM pending_uploads')?.c ?? 0;
}

export async function processPendingUploads(): Promise<number> {
  const rows = all<PendingUpload>('SELECT * FROM pending_uploads ORDER BY created_at');
  let done = 0;
  for (const u of rows) {
    const file = new File(u.local_uri);
    if (!file.exists) {
      run('DELETE FROM pending_uploads WHERE id = ?', [u.id]);
      continue;
    }
    const url = await uploadImage(u.bucket, u.path, u.local_uri);
    run(`UPDATE ${u.target_table} SET ${u.target_column} = ?, updated_at = ?, is_dirty = 1 WHERE id = ?`, [url, nowIso(), u.target_id]);
    run('DELETE FROM pending_uploads WHERE id = ?', [u.id]);
    try {
      file.delete();
    } catch {
      // leftover file is harmless
    }
    done++;
  }
  return done;
}
