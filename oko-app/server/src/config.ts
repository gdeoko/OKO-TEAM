const req = (name: string): string => {
  const v = process.env[name];
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing env: ${name}`);
  }
  return v ?? '';
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  supabase: {
    url: req('SUPABASE_URL'),
    anonKey: req('SUPABASE_ANON_KEY'),
    serviceRoleKey: req('SUPABASE_SERVICE_ROLE_KEY'),
    jwtSecret: req('SUPABASE_JWT_SECRET'),
  },
  s3: {
    endpoint: req('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'ru-1',
    bucket: process.env.S3_BUCKET ?? 'oko-media',
    bucketTmp: process.env.S3_BUCKET_TMP ?? 'oko-tmp',
    accessKey: req('S3_ACCESS_KEY'),
    secretKey: req('S3_SECRET_KEY'),
    cdnBaseUrl: process.env.CDN_BASE_URL ?? '',
  },
  tg: {
    botToken: req('TG_BOT_TOKEN'),
    teamChatId: process.env.TG_TEAM_CHAT_ID ?? '',
  },
  lava: {
    apiKey: req('LAVA_API_KEY'),
    webhookSecret: req('LAVA_WEBHOOK_SECRET'),
  },
  ai: {
    anthropicKey: req('ANTHROPIC_API_KEY'),
    geminiKey: req('GEMINI_API_KEY'),
    flikiKey: process.env.FLIKI_API_KEY ?? '',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
  },
  livekit: {
    url: process.env.LIVEKIT_URL ?? '',
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
  },
  n8nWebhookBase: process.env.N8N_WEBHOOK_BASE ?? '',
};
