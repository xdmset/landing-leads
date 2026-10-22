import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { MongoClient, ObjectId } from 'mongodb';

const envPath = resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const PORT = Number(process.env.PORT || 3001);
const KEY_ID = process.env.BACKBLAZE_KEY_ID;
const APPLICATION_KEY = process.env.BACKBLAZE_APPLICATION_KEY;
const BUCKET_NAME = process.env.BACKBLAZE_BUCKET_NAME || 'landingmad';
const BUCKET_ID = process.env.BACKBLAZE_BUCKET_ID;
const DOWNLOAD_TOKEN_TTL = Number(process.env.BACKBLAZE_DOWNLOAD_TOKEN_TTL || 3600);
const FILE_PREFIX = process.env.BACKBLAZE_FILE_PREFIX?.trim().replace(/^\/+|\/+$/g, '');
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'Studio';
const LEADS_COLLECTION = process.env.LEADS_COLLECTION || 'landing_clients';
const CONTENT_COLLECTION = process.env.CONTENT_COLLECTION || 'Contenido';
// Maderas Studio campaign webhook: every saved lead is also sent there (POST, JSON).
const CAMPAIGN_WEBHOOK_URL = 'https://maderasstudio.com/api/campanas/webhook/mkc_bd984765662555d9bb42f615d04d6b98b08fbb3692b8260d';
const CAMPAIGN_ORIGIN = 'miterrenoenmexico.com';
const CAMPAIGN_WEBHOOK_ATTEMPTS = 3;

const allowedVideos = new Set([
  'Carlos Subt.mp4',
  'DESARROLLOS ENG.mp4',
  'Luis Subt.mp4',
  'MiriamAraujo Subt.mp4',
  'Primer residente CM Península.mp4',
  'Video Home – Versión 3.0.mp4',
  'tomas desarrollos eng.mp4',
]);

let accountAuthCache = null;
const filePathCache = new Map();
let mongoClientPromise = null;
let leadIndexesPromise = null;

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
};

const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const getMongoDb = async () => {
  if (!MONGO_URI) {
    throw new Error('Missing MONGO_URI in backend/.env');
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(MONGO_URI);
    mongoClientPromise = client.connect().catch((error) => {
      // Do not cache the failure: the next request must try to connect again.
      mongoClientPromise = null;
      throw error;
    });
  }

  const client = await mongoClientPromise;
  return client.db(DB_NAME);
};

const normalizeText = (value) => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeLeadKey = (value) => {
  return normalizeText(value).replace(/\s+/g, ' ').toLocaleLowerCase('es-MX');
};

const createDuplicateLeadError = () => {
  const error = new Error('This name or email has already been registered');
  error.statusCode = 409;
  error.code = 'LEAD_DUPLICATE';
  return error;
};

const ensureLeadIndexes = async (collection) => {
  if (!leadIndexesPromise) {
    leadIndexesPromise = Promise.all([
      collection.createIndex(
        { normalizedEmail: 1 },
        {
          unique: true,
          partialFilterExpression: { normalizedEmail: { $type: 'string' } },
        }
      ),
      collection.createIndex(
        { normalizedFullName: 1 },
        {
          unique: true,
          partialFilterExpression: { normalizedFullName: { $type: 'string' } },
        }
      ),
    ]).catch((error) => {
      leadIndexesPromise = null;
      throw error;
    });
  }

  await leadIndexesPromise;
};

const sendLeadToCampaign = async (collection, leadId, lead) => {
  const body = JSON.stringify({
    // The campaign uses leadId to ignore repeats, so retrying or re-sending never duplicates a lead.
    leadId: String(leadId),
    nombre: lead.fullName,
    telefono: lead.phone,
    lada: lead.phoneCode,
    correo: lead.email,
    origen: CAMPAIGN_ORIGIN,
    // Any other field is stored by the campaign as an extra field of the lead.
    idioma: lead.language,
    fuente: lead.howHeard,
    pagina: lead.page,
    consentimiento: lead.consent,
  });
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= CAMPAIGN_WEBHOOK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(CAMPAIGN_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        await collection.updateOne({ _id: leadId }, { $set: { campaignWebhook: { ok: true, attempts: attempt, at: new Date() } } });
        return;
      }

      lastError = `HTTP ${response.status}`;

      // A rejected request (bad token, bad data) will not improve by retrying; 429 and 5xx might.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error.message;
    }

    if (attempt < CAMPAIGN_WEBHOOK_ATTEMPTS) {
      await new Promise((resolve) => { setTimeout(resolve, attempt * 1500); });
    }
  }

  console.error(`Campaign webhook failed for lead ${leadId}: ${lastError}`);
  // Kept on the lead so it can be re-sent later (same leadId, so it cannot duplicate).
  await collection.updateOne({ _id: leadId }, { $set: { campaignWebhook: { ok: false, error: lastError, at: new Date() } } }).catch(() => {});
};

const createLead = async (payload) => {
  const fullName = normalizeText(payload.fullName);
  const email = normalizeText(payload.email).toLowerCase();
  const normalizedFullName = normalizeLeadKey(fullName);
  const normalizedEmail = normalizeLeadKey(email);
  const phone = normalizeText(payload.phone);
  const country = normalizeText(payload.country);
  const state = normalizeText(payload.state);
  const howHeard = normalizeText(payload.howHeard);

  // country and state are optional: the landing form no longer asks for them.
  if (!fullName || !email || !phone || !howHeard || !payload.consent) {
    const error = new Error('Missing required lead fields');
    error.statusCode = 400;
    throw error;
  }

  const db = await getMongoDb();
  const collection = db.collection(LEADS_COLLECTION);
  await ensureLeadIndexes(collection);

  const existingLead = await collection.findOne({
    $or: [
      { normalizedEmail },
      { normalizedFullName },
      { email },
      { fullName: { $regex: `^${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    ],
  });

  if (existingLead) {
    throw createDuplicateLeadError();
  }

  const document = {
    fullName,
    normalizedFullName,
    email,
    normalizedEmail,
    phone,
    country: country || null,
    state: state || null,
    howHeard,
    consent: Boolean(payload.consent),
    language: normalizeText(payload.language) || null,
    phoneCode: normalizeText(payload.phoneCode) || null,
    phoneCountry: normalizeText(payload.phoneCountry) || null,
    page: normalizeText(payload.page) || null,
    createdAt: new Date(),
  };

  try {
    const result = await collection.insertOne(document);

    // Not awaited: the visitor should not wait for the campaign, and a failure is stored on the lead.
    sendLeadToCampaign(collection, result.insertedId, document)
      .catch((error) => console.error('Campaign webhook error:', error));

    return result.insertedId;
  } catch (error) {
    if (error.code === 11000) {
      throw createDuplicateLeadError();
    }

    throw error;
  }
};

const parseJsonResponse = async (response) => {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const isoCodeToFlag = (code) => {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';

  return [...code]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
};

const normalizeDialCode = (code) => {
  const compactCode = String(code || '').replace(/\s+/g, '');

  if (!compactCode) return '';
  return compactCode.startsWith('+') ? compactCode : `+${compactCode}`;
};

const normalizeCountryForLada = ({ name, spanishName, flag, dialCode }) => {
  const code = normalizeDialCode(dialCode);

  if (!name || !code) return null;

  return {
    name: { common: name },
    idd: { root: code, suffixes: [''] },
    flag: flag || '🏳️',
    translations: spanishName ? { spa: { common: spanishName } } : {},
  };
};

const fetchCountriesDevData = async () => {
  const response = await fetch('https://countries.dev/countries');
  const data = await parseJsonResponse(response);

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`countries.dev API failed: ${data?.message || response.statusText}`);
  }

  return data
    .map((country) => normalizeCountryForLada({
      name: country.name,
      spanishName: country.translations?.es,
      flag: country.flag,
      dialCode: country.callingCodes?.[0],
    }))
    .filter(Boolean);
};

const fetchCountriesNowData = async () => {
  const response = await fetch('https://countriesnow.space/api/v0.1/countries/codes');
  const data = await parseJsonResponse(response);

  if (!response.ok || data?.error || !Array.isArray(data?.data)) {
    throw new Error(`CountriesNow API failed: ${data?.msg || response.statusText}`);
  }

  return data.data
    .map((country) => normalizeCountryForLada({
      name: country.name,
      flag: isoCodeToFlag(country.code),
      dialCode: country.dial_code,
    }))
    .filter(Boolean);
};

const fetchCountryData = async () => {
  try {
    return await fetchCountriesDevData();
  } catch (primaryError) {
    console.warn(primaryError.message);
    return fetchCountriesNowData();
  }
};

const createConfigError = (message) => {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = 'CONFIGURATION_REQUIRED';
  return error;
};

const assertBackblazeConfig = () => {
  if (!KEY_ID || !APPLICATION_KEY) {
    throw createConfigError('Missing BACKBLAZE_KEY_ID or BACKBLAZE_APPLICATION_KEY in backend/.env');
  }
};

const authorizeAccount = async () => {
  assertBackblazeConfig();

  if (accountAuthCache && accountAuthCache.expiresAt > Date.now()) {
    return accountAuthCache;
  }

  const credentials = Buffer.from(`${KEY_ID}:${APPLICATION_KEY}`).toString('base64');
  const response = await fetch('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Backblaze authorize failed: ${data.message || response.statusText}`);
  }

  const storageApi = data.apiInfo?.storageApi || data;

  accountAuthCache = {
    ...data,
    apiUrl: storageApi.apiUrl,
    downloadUrl: storageApi.downloadUrl,
    allowed: storageApi.allowed || data.allowed,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };

  return accountAuthCache;
};

const getBucketId = async (auth) => {
  if (BUCKET_ID) return BUCKET_ID;
  if (auth.allowed?.bucketId) return auth.allowed.bucketId;

  const allowedBucket = auth.allowed?.buckets?.find((bucket) => bucket.name === BUCKET_NAME);
  if (allowedBucket?.id) return allowedBucket.id;

  const response = await fetch(`${auth.apiUrl}/b2api/v4/b2_list_buckets`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: auth.accountId,
      bucketName: BUCKET_NAME,
    }),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Backblaze list buckets failed: ${data.message || response.statusText}`);
  }

  const bucket = data.buckets?.find((item) => item.bucketName === BUCKET_NAME);

  if (!bucket) {
    throw new Error(`Backblaze bucket not found: ${BUCKET_NAME}`);
  }

  return bucket.bucketId;
};

const encodeBackblazePath = (fileName) => {
  return fileName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

const getCandidateFilePaths = (fileName) => {
  const prefixes = FILE_PREFIX
    ? [FILE_PREFIX]
    : ['landing', 'Landing', ''];

  return prefixes.map((prefix) => (prefix ? `${prefix}/${fileName}` : fileName));
};

const buildBackblazeFileUrl = (downloadUrl, filePath) => {
  return `${downloadUrl}/file/${BUCKET_NAME}/${encodeBackblazePath(filePath)}`;
};

const fetchBackblazeFile = async (auth, filePath, req) => {
  const headers = {
    Authorization: auth.authorizationToken,
  };

  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  return fetch(buildBackblazeFileUrl(auth.downloadUrl, filePath), { headers });
};

const streamVideo = async (fileName, req, res) => {
  const cachedPath = filePathCache.get(fileName);
  const auth = await authorizeAccount();

  const filePaths = cachedPath
    ? [cachedPath, ...getCandidateFilePaths(fileName).filter((path) => path !== cachedPath)]
    : getCandidateFilePaths(fileName);

  let lastResponse = null;
  let selectedPath = null;

  for (const filePath of filePaths) {
    const response = await fetchBackblazeFile(auth, filePath, req);

    if (response.ok || response.status === 206) {
      lastResponse = response;
      selectedPath = filePath;
      break;
    }

    lastResponse = response;

    if (![401, 404].includes(response.status)) {
      break;
    }
  }

  if (!lastResponse || !(lastResponse.ok || lastResponse.status === 206)) {
    const errorBody = lastResponse ? await parseJsonResponse(lastResponse) : null;
    const message = errorBody?.message || errorBody?.code || lastResponse?.statusText || 'Video not found';
    sendJson(res, lastResponse?.status || 404, { error: message });
    return;
  }

  filePathCache.set(fileName, selectedPath);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    'Content-Type': lastResponse.headers.get('content-type') || 'video/mp4',
  };

  for (const headerName of ['content-length', 'content-range', 'last-modified', 'etag']) {
    const headerValue = lastResponse.headers.get(headerName);
    if (headerValue) {
      headers[headerName
        .split('-')
        .map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1))
        .join('-')] = headerValue;
    }
  }

  res.writeHead(lastResponse.status, headers);
  Readable.fromWeb(lastResponse.body).pipe(res);
};

// Landing videos processed by the content hub (HLS: playlists + segments per quality).
// They are looked up by title in Mongo, so a re-processed video is picked up without a deploy.
const hlsVideoTitles = {
  home: 'Video home para landing de mi terreno en mexico',
  hover1: 'Hover 1 de landing mi terreno en mexico',
  hover2: 'Hover 2 de landing mi terreno en mexico',
};
const hlsFilePattern = /^(master\.m3u8|(?:720p|1080p)\/(?:playlist\.m3u8|segment_\d{1,6}\.ts))$/;
const hlsFolderPattern = /^Videos\/HLS\/[A-Za-z0-9_-]+$/;
const HLS_FOLDER_TTL = 10 * 60 * 1000;
const hlsFolderCache = new Map();

const resolveHlsFolder = async (slot) => {
  const cached = hlsFolderCache.get(slot);

  if (cached && cached.expiresAt > Date.now()) return cached.folder;

  try {
    const db = await getMongoDb();
    const doc = await db.collection(CONTENT_COLLECTION).findOne(
      { nombre: hlsVideoTitles[slot], 'videoProcessing.status': 'completed' },
      { projection: { 'videoProcessing.hlsFolder': 1 }, sort: { updatedAt: -1 } },
    );
    const folder = doc?.videoProcessing?.hlsFolder;

    if (typeof folder !== 'string' || !hlsFolderPattern.test(folder)) return null;

    hlsFolderCache.set(slot, { folder, expiresAt: Date.now() + HLS_FOLDER_TTL });
    return folder;
  } catch (error) {
    // A Mongo hiccup should not break playback: keep using the last known folder.
    if (cached) return cached.folder;
    throw error;
  }
};

const copyUpstreamHeaders = (response, headers) => {
  for (const [upstreamName, headerName] of [
    ['content-length', 'Content-Length'],
    ['content-range', 'Content-Range'],
    ['last-modified', 'Last-Modified'],
    ['etag', 'ETag'],
  ]) {
    const headerValue = response.headers.get(upstreamName);
    if (headerValue) headers[headerName] = headerValue;
  }
};

const streamHlsFile = async (slot, filePath, req, res) => {
  const folder = await resolveHlsFolder(slot);

  if (!folder) {
    sendJson(res, 404, { error: 'Video not found' });
    return;
  }

  const auth = await authorizeAccount();
  const response = await fetchBackblazeFile(auth, `${folder}/${filePath}`, req);

  if (!(response.ok || response.status === 206)) {
    const errorBody = await parseJsonResponse(response);
    sendJson(res, response.status === 401 ? 502 : response.status, {
      error: errorBody?.message || errorBody?.code || response.statusText || 'Video not found',
    });
    return;
  }

  const isPlaylist = filePath.endsWith('.m3u8');
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    // Public so Cloudflare can cache the segments at the edge. Playlists are short-lived.
    'Cache-Control': isPlaylist ? 'public, max-age=300' : 'public, max-age=86400',
    'Content-Type': isPlaylist ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
  };

  copyUpstreamHeaders(response, headers);

  res.writeHead(response.status, headers);
  Readable.fromWeb(response.body).pipe(res);
};

// Landing gallery: photos picked from the content hub (collection "Contenido", folder "Fotos").
// Order = display order; the first photo of each category is shown large. Only the processed
// versions (imageProcessing.variants: card / detail, AVIF + WebP) are served, never the originals.
// A photo marked "oculto" in the hub, or not fully processed, drops out of the gallery by itself.
const galleryPhotos = [
  { id: '69f423e58a8d7a086b3cfef9', category: 'homes', es: 'Casa modelo Antara', en: 'Antara home model', description: { es: 'Casa grande con rooftop.', en: 'A large home with a rooftop.' } },
  { id: '69f4254a8a8d7a086b3cff04', category: 'homes', es: 'Casa modelo Aqua', en: 'Aqua home model', description: { es: 'Elegancia en dos niveles.', en: 'Elegance on two levels.' } },
  { id: '69f4274f8a8d7a086b3cff1e', category: 'homes', es: 'Casa modelo Stella', en: 'Stella home model', description: { es: 'Pensada para la familia.', en: 'Designed for family life.' } },
  { id: '69f426cb8a8d7a086b3cff1c', category: 'homes', es: 'Casa modelo Nova', en: 'Nova home model', description: { es: 'Accesible y con mucho estilo.', en: 'Affordable and full of style.' } },
  { id: '6ab1aa8df2e9d4dd9fecc79f', category: 'homes', es: 'Casa modelo Altea', en: 'Altea home model', description: { es: 'Líneas limpias y detalles en piedra.', en: 'Clean lines and stone details.' } },
  { id: '69f4233a8a8d7a086b3cfef6', category: 'homes', es: 'Casa modelo Alba', en: 'Alba home model', description: { es: 'Un primer hogar a tu medida.', en: 'A first home made to fit you.' } },
  { id: '6ab1a780f2e9d4dd9fecc66a', category: 'homes', es: 'Casa modelo Aria', en: 'Aria home model', description: { es: 'Un hogar compacto y luminoso.', en: 'A compact, bright home.' } },
  { id: '69f425c88a8d7a086b3cff05', category: 'homes', es: 'Casa modelo Aura', en: 'Aura home model', description: { es: 'Comodidad en un solo nivel.', en: 'Comfort on a single level.' } },
  { id: '69f426458a8d7a086b3cff0b', category: 'homes', es: 'Casa modelo Lucero', en: 'Lucero home model', description: { es: 'Espacio de sobra para tu familia.', en: 'Plenty of room for your family.' } },
  { id: '6ab1a2f6f2e9d4dd9fecc479', category: 'homes', es: 'Casa modelo Maia', en: 'Maia home model', description: { es: 'Un solo nivel con jardín al frente.', en: 'One level with a front garden.' } },
  { id: '6acec6628078419e0cf0a612', category: 'homes', es: 'Living Maderas · Ceiba', en: 'Living Maderas · Ceiba', description: { es: 'Casa modular de un nivel.', en: 'A single-level modular home.' } },
  { id: '6acec8518078419e0cf0a882', category: 'homes', es: 'Living Maderas · Roble', en: 'Living Maderas · Roble', description: { es: 'Casa modular con diseño moderno.', en: 'A modular home with modern design.' } },
  { id: '6a7261d0551e867a9cb4bd12', category: 'amenities', es: 'Club Acuático Caribe · Cancún', en: 'Caribe Water Club · Cancún', description: { es: 'Parque acuático para toda la familia.', en: 'A water park for the whole family.' } },
  { id: '6a63d030af6ceed6c3c4ce93', category: 'amenities', es: 'Family Club · San Miguel de Allende', en: 'Family Club · San Miguel de Allende', description: { es: 'Albercas y terrazas para disfrutar en familia.', en: 'Pools and terraces to enjoy with family.' } },
  { id: '69fd202c1a60b0e28eae2e4e', category: 'amenities', es: 'Family Club · Península', en: 'Family Club · Península', description: { es: 'Una alberca frente a tu club.', en: 'A pool right in front of your club.' } },
  { id: '6a725e95551e867a9cb4bc94', category: 'amenities', es: 'Laguna del Club Acuático · Cancún', en: 'Water Club lagoon · Cancún', description: { es: 'Palapas y agua cristalina para relajarte.', en: 'Palapas and crystal-clear water to unwind.' } },
  { id: '69fd08e51a60b0e28eae2e27', category: 'amenities', es: 'Club deportivo · Hacienda Península', en: 'Sports club · Hacienda Península', description: { es: 'Alberca, palmeras y convivencia.', en: 'Pool, palm trees and good company.' } },
  { id: '69fd22171a60b0e28eae2e54', category: 'amenities', es: 'Family Club · Hacienda Puebla', en: 'Family Club · Hacienda Puebla', description: { es: 'Casa club y alberca en Puebla.', en: 'A clubhouse and pool in Puebla.' } },
  { id: '6a7254f5551e867a9cb4ba89', category: 'amenities', es: 'Family Club · Hacienda Aguascalientes', en: 'Family Club · Hacienda Aguascalientes', description: { es: 'Canchas deportivas, alberca y áreas de juego.', en: 'Sports courts, a pool and play areas.' } },
  { id: '69fd1fa01a60b0e28eae2e44', category: 'amenities', es: 'Puerto Maderas · Península', en: 'Puerto Maderas · Península', description: { es: 'Un paseo frente a la laguna.', en: 'A promenade by the lagoon.' } },
];
const galleryPhotoIds = new Set(galleryPhotos.map((photo) => photo.id));
const photoNamePattern = /^[a-z]+-\d{2,5}\.(?:webp|avif)$/;
const GALLERY_TTL = 10 * 60 * 1000;
const galleryPhotoCache = new Map();

const resolveGalleryPhoto = async (id) => {
  const cached = galleryPhotoCache.get(id);

  if (cached && cached.expiresAt > Date.now()) return cached.photo;

  try {
    const db = await getMongoDb();
    const doc = await db.collection(CONTENT_COLLECTION).findOne(
      { _id: new ObjectId(id), oculto: { $ne: true }, 'imageProcessing.status': 'completed' },
      { projection: { imageProcessing: 1 } },
    );

    let photo = null;

    if (doc) {
      const processing = doc.imageProcessing;
      const variants = new Map();

      for (const group of ['card', 'detail']) {
        for (const variant of processing.variants?.[group] || []) {
          const name = String(variant.key || '').split('/').pop();

          // The key must belong to this very document and be one of the public variant names.
          if (photoNamePattern.test(name) && variant.key.startsWith(`optimized/images/contenido/${id}/`)) {
            variants.set(name, { key: variant.key, group, width: variant.width, format: variant.format });
          }
        }
      }

      if (variants.size) {
        photo = {
          variants,
          width: processing.metadata?.width,
          height: processing.metadata?.height,
          version: processing.sourceFingerprint || '',
        };
      }
    }

    galleryPhotoCache.set(id, { photo, expiresAt: Date.now() + GALLERY_TTL });
    return photo;
  } catch (error) {
    // A Mongo hiccup should not empty the gallery: keep the last known version.
    if (cached) return cached.photo;
    throw error;
  }
};

const buildGallery = async () => {
  const items = await Promise.all(galleryPhotos.map(async (config) => {
    const photo = await resolveGalleryPhoto(config.id);

    if (!photo) return null;

    const list = (group) => [...photo.variants]
      .filter(([, variant]) => variant.group === group)
      .map(([name, variant]) => ({
        width: variant.width,
        format: variant.format,
        url: `/api/photos/${config.id}/${name}?v=${photo.version}`,
      }));

    return {
      ...config,
      render: true,
      width: photo.width,
      height: photo.height,
      card: list('card'),
      detail: list('detail'),
    };
  }));

  return items.filter(Boolean);
};

const streamGalleryPhoto = async (id, name, req, res) => {
  const photo = await resolveGalleryPhoto(id);
  const variant = photo?.variants.get(name);

  if (!variant) {
    sendJson(res, 404, { error: 'Photo not found' });
    return;
  }

  const auth = await authorizeAccount();
  const response = await fetchBackblazeFile(auth, variant.key, req);

  if (!(response.ok || response.status === 206)) {
    const errorBody = await parseJsonResponse(response);
    sendJson(res, response.status === 401 ? 502 : response.status, {
      error: errorBody?.message || errorBody?.code || response.statusText || 'Photo not found',
    });
    return;
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    // The URL carries the processing version (?v=), so a new version is a new URL.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': response.headers.get('content-type') || (name.endsWith('.avif') ? 'image/avif' : 'image/webp'),
  };

  copyUpstreamHeaders(response, headers);

  res.writeHead(response.status, headers);
  Readable.fromWeb(response.body).pipe(res);
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/countries') {
      const countryData = await fetchCountryData();
      sendJson(res, 200, countryData);
      return;
    }

    if (req.method === 'POST' && ['/api/leads', '/leads'].includes(requestUrl.pathname)) {
      const payload = await readJsonBody(req);
      const insertedId = await createLead(payload);

      sendJson(res, 201, { ok: true, id: insertedId.toString() });
      return;
    }

    if (req.method === 'GET' && ['/api/gallery', '/gallery'].includes(requestUrl.pathname)) {
      const items = await buildGallery();

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(JSON.stringify(items));
      return;
    }

    const photosPrefix = ['/api/photos/', '/photos/'].find((prefix) => requestUrl.pathname.startsWith(prefix));

    if (req.method === 'GET' && photosPrefix) {
      const [id, name, ...extra] = requestUrl.pathname.slice(photosPrefix.length).split('/');

      if (extra.length || !galleryPhotoIds.has(id) || !photoNamePattern.test(name || '')) {
        sendJson(res, 404, { error: 'Photo not found' });
        return;
      }

      await streamGalleryPhoto(id, name, req, res);
      return;
    }

    const hlsPrefix = ['/api/hls/', '/hls/'].find((prefix) => requestUrl.pathname.startsWith(prefix));

    if (req.method === 'GET' && hlsPrefix) {
      const [slot, ...rest] = decodeURIComponent(requestUrl.pathname.slice(hlsPrefix.length)).split('/');
      const filePath = rest.join('/');

      if (!Object.hasOwn(hlsVideoTitles, slot) || !hlsFilePattern.test(filePath)) {
        sendJson(res, 404, { error: 'Video not found' });
        return;
      }

      await streamHlsFile(slot, filePath, req, res);
      return;
    }

    const videoPrefix = requestUrl.pathname.startsWith('/api/videos/')
      ? '/api/videos/'
      : requestUrl.pathname.startsWith('/videos/')
        ? '/videos/'
        : null;

    if (req.method === 'GET' && videoPrefix) {
      const fileName = decodeURIComponent(requestUrl.pathname.slice(videoPrefix.length));

      if (!allowedVideos.has(fileName)) {
        sendJson(res, 404, { error: 'Video not found' });
        return;
      }

      await streamVideo(fileName, req, res);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      console.warn(error.message);
    } else if (error.code === 'CONFIGURATION_REQUIRED') {
      console.warn(error.message);
    } else {
      console.error(error);
    }

    sendJson(res, error.statusCode || 500, {
      error: error.message || 'Internal server error',
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Landing backend listening on http://localhost:${PORT}`);
});
