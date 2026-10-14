import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { MongoClient } from 'mongodb';

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

  for (const [upstreamName, headerName] of [
    ['content-length', 'Content-Length'],
    ['content-range', 'Content-Range'],
    ['last-modified', 'Last-Modified'],
    ['etag', 'ETag'],
  ]) {
    const headerValue = response.headers.get(upstreamName);
    if (headerValue) headers[headerName] = headerValue;
  }

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
