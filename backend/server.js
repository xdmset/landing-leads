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
    mongoClientPromise = client.connect();
  }

  const client = await mongoClientPromise;
  return client.db(DB_NAME);
};

const normalizeText = (value) => {
  return typeof value === 'string' ? value.trim() : '';
};

const createLead = async (payload, req) => {
  const fullName = normalizeText(payload.fullName);
  const email = normalizeText(payload.email).toLowerCase();
  const phone = normalizeText(payload.phone);
  const country = normalizeText(payload.country);
  const state = normalizeText(payload.state);
  const howHeard = normalizeText(payload.howHeard);

  if (!fullName || !email || !phone || !country || !state || !howHeard || !payload.consent) {
    const error = new Error('Missing required lead fields');
    error.statusCode = 400;
    throw error;
  }

  const db = await getMongoDb();
  const document = {
    fullName,
    email,
    phone,
    country,
    state,
    howHeard,
    consent: Boolean(payload.consent),
    language: normalizeText(payload.language) || null,
    phoneCode: normalizeText(payload.phoneCode) || null,
    phoneCountry: normalizeText(payload.phoneCountry) || null,
    page: normalizeText(payload.page) || null,
    createdAt: new Date(),
  };

  const result = await db.collection(LEADS_COLLECTION).insertOne(document);

  return result.insertedId;
};

const parseJsonResponse = async (response) => {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const assertBackblazeConfig = () => {
  if (!KEY_ID || !APPLICATION_KEY) {
    throw new Error('Missing BACKBLAZE_KEY_ID or BACKBLAZE_APPLICATION_KEY in backend/.env');
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

    if (req.method === 'POST' && ['/api/leads', '/leads'].includes(requestUrl.pathname)) {
      const payload = await readJsonBody(req);
      const insertedId = await createLead(payload, req);

      sendJson(res, 201, { ok: true, id: insertedId.toString() });
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
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Landing backend listening on http://localhost:${PORT}`);
});
