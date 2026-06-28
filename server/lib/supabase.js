const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function init() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('[supabase] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — disabled');
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('[supabase] Client initialized');
  return supabase;
}

function getClient() {
  return supabase;
}

async function uploadFile(bucket, path, fileBuffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  return data;
}

async function downloadFile(bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function listFiles(bucket, prefix) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix);
  if (error) throw error;
  return data;
}

async function deleteFile(bucket, path) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  if (error) throw error;
}

async function ensureBucket(bucket, options = {}) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === bucket)) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: options.public || false,
      fileSizeLimit: options.fileSizeLimit || 52428800,
    });
    if (error) throw error;
    console.log('[supabase] Created bucket:', bucket);
  }
}

async function signUp(email, password, metadata) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

async function verifyToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

module.exports = {
  init,
  getClient,
  uploadFile,
  downloadFile,
  listFiles,
  deleteFile,
  ensureBucket,
  signUp,
  signIn,
  verifyToken,
};
