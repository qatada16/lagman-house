import postgres from 'npm:postgres@3.4.5';

interface EasBuild {
  id?: string;
  status?: string;
  platform?: string;
  expirationDate?: string;
  artifacts?: { buildUrl?: string };
  metadata?: { appVersion?: string; appBuildVersion?: string | number; buildProfile?: string; message?: string };
}

const encoder = new TextEncoder();

async function signature(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return `sha1=${Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'method not allowed');
  const secret = Deno.env.get('EAS_WEBHOOK_SECRET') ?? '';
  const dbUrl = Deno.env.get('SUPABASE_DB_URL') ?? '';
  if (secret.length < 16 || !dbUrl) return reply(500, 'webhook is not configured');

  const body = await req.text();
  if (!sameText(req.headers.get('expo-signature') ?? '', await signature(secret, body))) return reply(401, 'invalid signature');

  let build: EasBuild;
  try {
    build = JSON.parse(body) as EasBuild;
  } catch {
    return reply(400, 'invalid json');
  }

  const profile = Deno.env.get('EAS_RELEASE_PROFILE') || 'production';
  const url = build.artifacts?.buildUrl;
  const version = build.metadata?.appVersion;
  if (build.status !== 'finished' || build.platform !== 'android' || build.metadata?.buildProfile !== profile) return reply(200, 'ignored');
  if (!build.id || typeof url !== 'string' || !/^https:\/\/\S+\.apk$/i.test(url) || typeof version !== 'string' || !version.trim()) return reply(200, 'ignored');

  const parsedBuild = parseInt(String(build.metadata?.appBuildVersion ?? ''), 10);
  const buildNumber = Number.isFinite(parsedBuild) ? parsedBuild : 0;
  const message = typeof build.metadata?.message === 'string' ? build.metadata.message : '';
  const mandatory = /\[mandatory\]/i.test(message);
  const notes = message.replace(/\[mandatory\]/gi, '').trim().slice(0, 1000) || null;
  const expiresAt = typeof build.expirationDate === 'string' ? build.expirationDate : null;

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    await sql`
      insert into public.app_releases (build_id, version, build_number, apk_url, notes, mandatory, expires_at)
      values (${build.id}, ${version.trim()}, ${buildNumber}, ${url}, ${notes}, ${mandatory}, ${expiresAt})
      on conflict (build_id) do update set
        version = excluded.version,
        build_number = excluded.build_number,
        apk_url = excluded.apk_url,
        notes = excluded.notes,
        mandatory = excluded.mandatory,
        expires_at = excluded.expires_at`;
    return reply(200, `published ${version.trim()} (${buildNumber})`);
  } catch (e) {
    return reply(500, (e as Error).message);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
