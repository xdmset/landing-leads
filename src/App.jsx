import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';

const videoApiBase = import.meta.env.VITE_VIDEO_API_BASE_URL || '';
const privateVideo = (fileName) => `${videoApiBase}/api/videos/${encodeURIComponent(fileName)}`;

// Original MP4s: only a fallback now, if the processed version cannot be played.
const heroVideo = privateVideo('Video Home – Versión 3.0.mp4');
const mapVideo = privateVideo('DESARROLLOS ENG.mp4');
const resortVideo = privateVideo('tomas desarrollos eng.mp4');

// Processed versions (HLS, 720p) served by the backend from the content hub: home / hover1 / hover2.
const hlsPlaylist = (slot) => `${videoApiBase}/api/hls/${slot}/720p/playlist.m3u8`;

const defaultPhoneCodes = [
  { code: '+1', flag: '🇺🇸', iso: 'US', name: 'United States' },
  { code: '+52', flag: '🇲🇽', iso: 'MX', name: 'México' },
];

// The API only sends emoji flags, so the ISO code is recovered from the regional-indicator letters.
const flagToIso = (flag) => {
  const points = [...(flag || '')].map((char) => char.codePointAt(0));
  if (points.length !== 2 || points.some((point) => point < 0x1f1e6 || point > 0x1f1ff)) return '';
  return points.map((point) => String.fromCharCode(point - 0x1f1e6 + 65)).join('');
};

// libphonenumber-js carries per-country length rules (~150 KB), so it loads after first paint.
let phoneLibPromise = null;
const loadPhoneLib = () => {
  if (!phoneLibPromise) {
    phoneLibPromise = Promise.all([
      import('libphonenumber-js/max'),
      import('libphonenumber-js/mobile/examples'),
    ])
      .then(([lib, examples]) => ({
        validatePhoneNumberLength: lib.validatePhoneNumberLength,
        getExampleNumber: lib.getExampleNumber,
        examples: examples.default,
      }))
      .catch((error) => {
        phoneLibPromise = null;
        throw error;
      });
  }
  return phoneLibPromise;
};

const fallbackPhoneRules = { min: 6, max: 15, example: '' };

// Shortest and longest national number the country allows, found by probing the library.
const getPhoneRules = (phoneLib, iso) => {
  if (!phoneLib || !iso) return fallbackPhoneRules;

  try {
    let min = 0;
    let max = 0;

    for (let length = 1; length <= 17; length += 1) {
      const result = phoneLib.validatePhoneNumberLength('2'.repeat(length), iso);

      if (result === 'INVALID_COUNTRY' || result === 'NOT_A_NUMBER') return fallbackPhoneRules;
      if (result === 'TOO_LONG') break;

      max = length;
      if (!min && result !== 'TOO_SHORT') min = length;
    }

    if (!min || !max) return fallbackPhoneRules;

    const example = phoneLib.getExampleNumber(iso, phoneLib.examples);
    return { min, max, example: example?.nationalNumber || '' };
  } catch {
    return fallbackPhoneRules;
  }
};

// Dial codes whose countries do not use a leading 0 trunk prefix (NANP and Mexico).
const noTrunkPrefixCodes = ['+1', '+52'];

const capPhoneDigits = (digits, rules, dialCode) => {
  const allowTrunkPrefix = digits.startsWith('0') && !noTrunkPrefixCodes.includes(dialCode);
  return digits.slice(0, rules.max + (allowTrunkPrefix ? 1 : 0));
};

// Digits only; a pasted "+52 33..." drops the dial code that the selector already shows.
const sanitizePhone = (raw, dialCode) => {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && digits.startsWith(dialCode.slice(1))) {
    digits = digits.slice(dialCode.length - 1);
  }
  return digits;
};

const isPhoneLengthValid = (phoneLib, iso, digits, rules) => {
  if (!phoneLib || !iso) return digits.length >= rules.min && digits.length <= rules.max;

  try {
    return phoneLib.validatePhoneNumberLength(digits, iso) === undefined;
  } catch {
    return false;
  }
};

const prefersReducedMotion = () => (
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

/* ---------- Icons (inline, stroke) ---------- */

const ArrowRight = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const CheckIcon = ({ size = 14, strokeWidth = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);
const ChevronDown = () => (
  <svg className="pick-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

/* ---------- Phone country picker ---------- */

function CountryBadge({ iso, flag }) {
  const [failed, setFailed] = useState(false);

  if (!iso) return <span className="iso-badge iso-badge--emoji" aria-hidden="true">{flag}</span>;
  if (failed) return <span className="iso-badge" aria-hidden="true">{iso}</span>;

  const code = iso.toLowerCase();

  return (
    <img
      className="flag-img"
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width="28"
      height="20"
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function PhoneCodePicker({ options, value, onChange, label, searchLabel, emptyLabel, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const search = query.trim().toLowerCase();
  const visible = search
    ? options.filter((option) => (
      option.name.toLowerCase().includes(search)
      || option.code.includes(search)
      || option.iso.toLowerCase() === search
    ))
    : options;

  return (
    <div className="pick-root" ref={rootRef}>
      <button
        type="button"
        className="pick"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value.name} ${value.code}`}
        onClick={() => { setQuery(''); setOpen((current) => !current); }}
      >
        <CountryBadge key={value.iso || value.flag} iso={value.iso} flag={value.flag} />
        <span>{value.code}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="pick-menu">
          <div className="pick-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input
              type="search"
              className="pick-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              autoComplete="off"
              // On phones the keyboard would cover the list, so only focus the search on desktop.
              autoFocus={window.matchMedia('(pointer: fine)').matches}
            />
          </div>
          <ul className="pick-options" role="listbox" aria-label={label}>
            {visible.map((option) => {
              const selected = option.code === value.code && option.flag === value.flag;

              return (
                <li key={`${option.iso}|${option.code}|${option.name}`} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`pick-option${selected ? ' is-selected' : ''}`}
                    onClick={() => { onChange(option); setOpen(false); }}
                  >
                    <CountryBadge key={option.iso || option.flag} iso={option.iso} flag={option.flag} />
                    <span className="pick-option-name">{option.name}</span>
                    <span className="pick-option-code">{option.code}</span>
                    {selected && <span className="pick-option-check"><CheckIcon size={16} strokeWidth={2.6} /></span>}
                  </button>
                </li>
              );
            })}
            {!visible.length && <li className="pick-empty">{emptyLabel}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Processed (HLS) video ---------- */

// hls.js is only needed by browsers without native HLS (Safari/iOS play it natively), so it loads on demand.
let hlsLibPromise = null;
const loadHlsLib = () => {
  if (!hlsLibPromise) {
    hlsLibPromise = import('hls.js/light')
      .then((module) => module.default)
      .catch((error) => {
        hlsLibPromise = null;
        throw error;
      });
  }
  return hlsLibPromise;
};

// Plays the processed HLS version in `videoRef`. `maxBuffer` is how many seconds hls.js loads ahead:
// a small value only preloads the first segment (hover cards), a large one loads the whole loop (hero).
// Any failure falls back to the original MP4.
function useHlsSource(videoRef, slot, fallbackSrc, enabled, maxBuffer) {
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!enabled || !videoEl) return undefined;

    let hls = null;
    let cancelled = false;
    let fellBack = false;

    const playFallback = () => {
      if (cancelled || fellBack) return;
      fellBack = true;
      if (hls) hls.destroy();
      hls = null;
      videoEl.src = fallbackSrc;
    };

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.addEventListener('error', playFallback, { once: true });
      videoEl.src = hlsPlaylist(slot);
      return () => {
        cancelled = true;
        videoEl.removeEventListener('error', playFallback);
      };
    }

    loadHlsLib()
      .then((Hls) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          playFallback();
          return;
        }

        hls = new Hls({ maxBufferLength: maxBuffer, maxMaxBufferLength: maxBuffer, enableWorker: true });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) playFallback();
        });
        hls.loadSource(hlsPlaylist(slot));
        hls.attachMedia(videoEl);
      })
      .catch(playFallback);

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
    };
  }, [videoRef, slot, fallbackSrc, enabled, maxBuffer]);
}

/* ---------- Cards with hover video ---------- */

const mobileHoverVideoDelayMs = 900;

const getHoverVideoDelay = () => {
  if (typeof window === 'undefined') return 0;
  return window.matchMedia('(hover: none), (pointer: coarse), (max-width: 700px)').matches
    ? mobileHoverVideoDelayMs
    : 0;
};

const playMutedVideo = (video) => {
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  video.play().catch((error) => {
    console.log('Autoplay blocked:', error);
  });
};

function HoverVideoCard({ image, imageAlt, video, slot, children }) {
  const [hovered, setHovered] = useState(false);
  const [near, setNear] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  // Start fetching the video just before the card scrolls into view, so it is ready when the hover happens.
  useEffect(() => {
    if (!cardRef.current) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useHlsSource(videoRef, slot, video, near && !prefersReducedMotion(), 8);

  // On phones there is no hover: the video starts when the card is mostly on screen.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 600px)').matches || !cardRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setHovered(entry.isIntersecting && entry.intersectionRatio >= 0.45),
      { threshold: [0, 0.45, 0.75] },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    if (hovered && !prefersReducedMotion()) {
      const timer = setTimeout(() => {
        setVideoActive(true);
        playMutedVideo(videoEl);
      }, getHoverVideoDelay());
      return () => clearTimeout(timer);
    }

    setVideoActive(false);
    videoEl.pause();
    videoEl.currentTime = 0;
    return undefined;
  }, [hovered]);

  return (
    <article
      ref={cardRef}
      className="card reveal"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img className="card-media" src={image} alt={imageAlt} loading="lazy" decoding="async" />
      <div className={`card-hover-video${videoActive ? ' is-active' : ''}`}>
        <video ref={videoRef} loop muted playsInline preload="auto" poster={image} />
      </div>
      <div className="card-scrim" aria-hidden="true" />
      <div className="card-content">{children}</div>
    </article>
  );
}

/* ---------- Gallery data ---------- */

// Fallback gallery, used only if the backend cannot provide the processed photos from the content hub
// (see galleryPhotos in backend/server.js to change which photos are shown).
// category: 'homes' → toggle "Casas"; 'amenities' → toggle "Amenidades". The first one of each category shows large.
const galleryImages = [
  { src: '/gallery/antara.webp', category: 'homes', es: 'Casa modelo Antara', en: 'Antara home model', description: { es: 'Arquitectura para una nueva etapa.', en: 'Architecture for a new chapter.' }, width: 1600, height: 1600, render: true },
  { src: '/gallery/aqua.webp', category: 'homes', es: 'Casa modelo Aqua', en: 'Aqua home model', description: { es: 'Una fachada con personalidad propia.', en: 'A home with its own personality.' }, width: 1202, height: 1600, render: true },
  { src: '/gallery/interior.webp', category: 'homes', es: 'Espacios para vivir', en: 'Spaces to live in', description: { es: 'Tu hogar, desde adentro.', en: 'Your home, from the inside.' }, width: 905, height: 517, render: true },
  { src: '/gallery/family-club.webp', category: 'amenities', es: 'Family Club · Cancún', en: 'Family Club · Cancún', description: { es: 'La vida que imaginabas, en el Caribe mexicano.', en: 'The lifestyle you imagined, in the Mexican Caribbean.' }, width: 1600, height: 900, render: true },
  { src: '/gallery/amenidades.webp', category: 'amenities', es: 'Vive estilo resort', en: 'Live resort style', description: { es: 'Amenidades de nuestros desarrollos.', en: 'Amenities across our developments.' }, render: true },
];

const toSrcSet = (variants, format) => variants
  .filter((variant) => variant.format === format)
  .sort((a, b) => a.width - b.width)
  .map((variant) => `${videoApiBase}${variant.url} ${variant.width}w`)
  .join(', ');

const largestVariant = (variants, format) => variants
  .filter((variant) => variant.format === format)
  .sort((a, b) => b.width - a.width)[0];

// Turns an item from /api/gallery into what the gallery renders: responsive AVIF/WebP sets for the
// tiles (card) and for the lightbox (detail).
const normalizeGalleryItem = (item) => {
  const card = largestVariant(item.card || [], 'webp');
  if (!card) return null;

  const detail = largestVariant(item.detail || [], 'webp');

  return {
    ...item,
    src: `${videoApiBase}${card.url}`,
    cardSet: { avif: toSrcSet(item.card, 'avif'), webp: toSrcSet(item.card, 'webp') },
    detailSrc: detail ? `${videoApiBase}${detail.url}` : undefined,
    detailSet: { avif: toSrcSet(item.detail || [], 'avif'), webp: toSrcSet(item.detail || [], 'webp') },
  };
};

// Photos come from the content hub (processed versions, served by the backend). Each category falls back
// to the local images if the backend has nothing for it.
function useGalleryItems(fallback) {
  const [remote, setRemote] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${videoApiBase}/api/gallery`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Gallery unavailable'))))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setRemote(data.map(normalizeGalleryItem).filter(Boolean));
      })
      .catch((err) => console.error('No se pudo cargar la galería del backend:', err));

    return () => { cancelled = true; };
  }, []);

  return useMemo(() => ['homes', 'amenities'].flatMap((category) => {
    const fromBackend = remote.filter((item) => item.category === category);
    return fromBackend.length ? fromBackend : fallback.filter((item) => item.category === category);
  }), [remote, fallback]);
}

// Big tiles (feature/wide/tall/full) get a larger image than the single-cell ones.
const tileSizes = (layout) => (layout
  ? '(max-width: 700px) 100vw, 50vw'
  : '(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 25vw');

// Bento layout: the first image is large, the rest fill the grid without gaps for 1–5 images.
const tileLayout = (index, total) => {
  if (index === 0) return total === 1 ? 'tile--full' : 'tile--feature';
  if (total === 2) return 'tile--tall';
  if (total === 3) return 'tile--wide';
  if (total === 4) return index === 3 ? 'tile--wide' : '';
  if (index < 5) return '';
  const leftover = (total - 5) % 4;
  const isLastRow = index >= total - leftover;
  if (!isLastRow) return '';
  if (leftover === 1) return 'tile--full';
  if (leftover === 2) return 'tile--wide';
  if (leftover === 3 && index === total - 1) return 'tile--wide';
  return '';
};

/* ---------- Copy ---------- */

const content = {
  en: {
    moreInfo: 'I want more information',
    register: 'Sign up',
    viewGallery: 'View gallery',
    logo: '/CIUDAD MADERAS BLANCO INGLÉS.png',
    pageTitle: 'My Lot in Mexico',
    switchLang: 'Cambiar a español',
    heroBadge: 'INVEST FROM WHEREVER YOU ARE',
    heroTitle: 'Invest in lots and homes in Mexico',
    heroTitleAccent: 'from the USA',
    heroText: 'The largest real estate developer in Mexico. No credit check, no banks and direct financing from',
    heroTextPrice: '$149 USD per month.*',
    paymentsLabel: 'SECURE PAYMENTS THROUGH',
    trustedBy: 'TRUSTED BY',
    satisfiedClients: 'SATISFIED CLIENTS',
    clientsPurchased: 'who have already purchased a lot or home with us',
    monthlyFrom: 'MONTHLY PAYMENTS FROM',
    lotsAvailable: 'Lots available',
    mapAlt: 'Map of developments',
    amenitiesAlt: 'Amenities',
    anOptionFor: 'AN OPTION FOR',
    everyone: 'EVERYONE',
    developments: 'DEVELOPMENTS',
    acrossMexico: 'ACROSS MEXICO',
    builtYour: 'BUILD YOUR',
    home: 'HOME',
    live: 'LIVE',
    resort: 'Resort',
    style: 'STYLE',
    galleryEyebrow: 'YOUR NEXT CHAPTER STARTS HERE',
    galleryTitle: 'Homes and lots',
    galleryTitleAccent: 'in Mexico',
    gallerySubtitle: 'No credit check. No banks. Direct financing from $149 USD per month.*',
    galleryTabsLabel: 'Gallery type',
    galleryHomes: 'Homes',
    galleryAmenities: 'Amenities',
    galleryView: 'View image',
    galleryClose: 'Close gallery',
    galleryPrevious: 'Previous image',
    galleryNext: 'Next image',
    galleryCollection: 'CIUDAD MADERAS',
    renderLabel: 'REPRESENTATIVE RENDER',
    photoLabel: 'DESTINATION PHOTOGRAPHY',
    pricingNote: '*Monthly payments from $149 USD apply to selected lots. Home pricing is quoted separately. Subject to availability, down payment, term and exchange rate. Restrictions apply.',
    formEyebrow: 'SIGN UP TODAY',
    formTitle1: 'Tell us a bit about you',
    formTitle2: "and we'll take it from there.",
    perMonth: 'PER MONTH',
    benefits: ['No credit check', 'Owner financing, no banks', 'Pay securely from the USA'],
    formCardTitle: 'Get information',
    formCardText: "Leave your details and we'll contact you soon.",
    fullName: 'Full name',
    fullNamePlaceholder: 'e.g. Mary Johnson',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    phone: 'Phone number',
    phoneCodeLabel: 'Phone country code',
    phoneSearch: 'Search country or code',
    phoneNoResults: 'No countries found',
    phoneDigits: 'digits',
    consent: 'I agree to be contacted through any of the provided means to receive information.',
    send: 'I WANT MORE INFORMATION',
    sending: 'SENDING...',
    thanksTitle: 'Thank you!',
    sent: 'We will contact you soon.',
    sendAnother: 'Submit another',
    privacy: 'Privacy Notice',
    privacyLead: 'We will use your data to contact you and send you information about our developments. See our',
    privacyClose: 'Close privacy notice',
    privacyNotice: {
      title: 'Privacy Notice',
      updated: 'Last updated: October 14, 2026',
      sections: [
        {
          heading: 'Who is responsible for your data?',
          paragraphs: ['Ciudad Maderas, located at Blvd. Bernardo Quintana #160, Suite 5 and 6, Carretas Neighborhood, Querétaro, Qro., Mexico, is responsible for the use and protection of your personal data, in accordance with the Mexican Federal Law on Protection of Personal Data Held by Private Parties.'],
        },
        {
          heading: 'Personal data we collect',
          paragraphs: ['When you fill in the form on this website we collect your full name, email address, phone number and its country code. We also store the language you browsed in and the web address and campaign parameters you registered from, so we know which ad or link brought you here. We do not request sensitive personal data.'],
        },
        {
          heading: 'What we use your data for',
          paragraphs: ['Your data may be used to:'],
          items: [
            'Contact you by phone (call or message), email or messaging apps to give you information about our lots, homes, developments and financing options.',
            'Follow up on your request and answer your questions.',
            'Schedule a call or a visit, if you ask us to.',
          ],
        },
        {
          heading: 'Cookies and measurement',
          paragraphs: ['This website uses Google Tag Manager, Google Analytics and campaign measurement tools to understand how it is used. These tools may use cookies and identifiers. They do not receive your name, email or phone number. You can disable cookies in your browser settings.'],
        },
        {
          heading: 'Who we share your data with',
          paragraphs: ['We only share your data with companies related to Ciudad Maderas and with providers that help us contact you and store the information (for example hosting and customer management services), for the purposes described in this notice.'],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'You can access your data, correct it if it is inaccurate, delete it, object to its use (ARCO rights) or withdraw your consent at any time. To do so, send a written request to the address above including your full name, the contact details you registered with, a clear description of the right you want to exercise and an identification. We will reply within the deadlines set by law.',
            'You can also ask us to stop contacting you at any time, through the same channel we use to contact you.',
          ],
        },
        {
          heading: 'Changes to this notice',
          paragraphs: ['Any change will be published on this page. We recommend reviewing it from time to time.'],
        },
      ],
      closing: 'By submitting the form and accepting the contact authorization, you confirm that you have read this notice.',
    },
    sendError: 'Something went wrong. Please try again.',
    duplicateLead: 'This name or email has already been registered.',
    validation: {
      fullNameRequired: 'Please enter your full name.',
      emailRequired: 'Please enter your email.',
      emailInvalid: 'Please enter a valid email address.',
      phoneRequired: 'Please enter your phone number.',
      phoneInvalidExact: 'Enter a phone number with exactly {n} digits.',
      phoneInvalidRange: 'Enter a phone number with {min} to {max} digits.',
      consentRequired: 'Please accept the contact authorization.',
    },
    footer: 'Copyright Ciudad Maderas | Representative information and images subject to change without prior notice. Suggested furniture. Restrictions apply. | Blvd. Bernardo Quintana #160, Suite 5 and 6, Carretas Neighborhood, Querétaro, Qro. | Privacy Notice | Terms and Conditions',
  },
  es: {
    moreInfo: 'Quiero más información',
    register: 'Registrarme',
    viewGallery: 'Ver galería',
    logo: '/CIUDAD MADERAS ESP BL.png',
    pageTitle: 'Mi Terreno en México',
    switchLang: 'Switch to English',
    heroBadge: 'INVIERTE DESDE DONDE ESTÉS',
    heroTitle: 'Invierte en terrenos y casas en México',
    heroTitleAccent: 'desde USA',
    heroText: 'La desarrolladora inmobiliaria más grande de México. Sin revisión de buró, sin bancos y con financiamiento directo desde',
    heroTextPrice: '$149 USD al mes.*',
    paymentsLabel: 'PAGOS SEGUROS A TRAVÉS DE',
    trustedBy: 'CON LA CONFIANZA DE',
    satisfiedClients: 'CLIENTES SATISFECHOS',
    clientsPurchased: 'que ya compraron su terreno o casa con nosotros',
    monthlyFrom: 'MENSUALIDAD DESDE',
    lotsAvailable: 'Terrenos disponibles',
    mapAlt: 'Mapa de desarrollos',
    amenitiesAlt: 'Amenidades',
    anOptionFor: 'UNA OPCIÓN PARA',
    everyone: 'TODOS',
    developments: 'DESARROLLOS',
    acrossMexico: 'EN TODO MÉXICO',
    builtYour: 'CONSTRUYE TU',
    home: 'HOGAR',
    live: 'VIVE',
    resort: 'Resort',
    style: 'ESTILO',
    galleryEyebrow: 'TU PRÓXIMA HISTORIA EMPIEZA AQUÍ',
    galleryTitle: 'Casas y terrenos',
    galleryTitleAccent: 'en México',
    gallerySubtitle: 'Sin revisión de buró. Sin bancos. Con financiamiento directo desde $149 USD al mes.*',
    galleryTabsLabel: 'Tipo de galería',
    galleryHomes: 'Casas',
    galleryAmenities: 'Amenidades',
    galleryView: 'Ver imagen',
    galleryClose: 'Cerrar galería',
    galleryPrevious: 'Imagen anterior',
    galleryNext: 'Siguiente imagen',
    galleryCollection: 'CIUDAD MADERAS',
    renderLabel: 'RENDER REPRESENTATIVO',
    photoLabel: 'FOTOGRAFÍA DEL DESTINO',
    pricingNote: '*Mensualidad desde $149 USD en terrenos seleccionados. Las casas se cotizan por separado. Sujeto a disponibilidad, enganche, plazo y tipo de cambio. Aplican restricciones.',
    formEyebrow: 'REGÍSTRATE HOY',
    formTitle1: 'Cuéntanos un poco sobre ti',
    formTitle2: 'y nosotros nos encargamos del resto.',
    perMonth: 'AL MES',
    benefits: ['Sin verificación de crédito', 'Financiamiento propio, sin bancos', 'Paga de forma segura desde USA'],
    formCardTitle: 'Recibe información',
    formCardText: 'Déjanos tus datos y te contactaremos pronto.',
    fullName: 'Nombre completo',
    fullNamePlaceholder: 'Ej. María González',
    email: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    phone: 'Número de teléfono',
    phoneCodeLabel: 'Código de país del teléfono',
    phoneSearch: 'Buscar país o código',
    phoneNoResults: 'No se encontraron países',
    phoneDigits: 'dígitos',
    consent: 'Acepto ser contactado a través de cualquiera de los medios proporcionados para recibir información.',
    send: 'QUIERO MÁS INFORMACIÓN',
    sending: 'ENVIANDO...',
    thanksTitle: '¡Gracias!',
    sent: 'Te contactaremos pronto.',
    sendAnother: 'Enviar otro registro',
    privacy: 'Aviso de Privacidad',
    privacyLead: 'Usaremos tus datos para contactarte y enviarte información sobre nuestros desarrollos. Consulta nuestro',
    privacyClose: 'Cerrar aviso de privacidad',
    privacyNotice: {
      title: 'Aviso de Privacidad',
      updated: 'Última actualización: 14 de octubre de 2026',
      sections: [
        {
          heading: '¿Quién es responsable de tus datos?',
          paragraphs: ['Ciudad Maderas, con domicilio en Blvd. Bernardo Quintana #160, Suite 5 y 6, Col. Carretas, Querétaro, Qro., es responsable del uso y la protección de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.'],
        },
        {
          heading: 'Datos personales que recabamos',
          paragraphs: ['Al llenar el formulario de este sitio recabamos tu nombre completo, correo electrónico, número de teléfono y su código de país. También guardamos el idioma en el que navegaste y la dirección de la página y los parámetros de campaña desde los que te registraste, para saber qué anuncio o enlace te trajo. No solicitamos datos personales sensibles.'],
        },
        {
          heading: 'Para qué usamos tus datos',
          paragraphs: ['Tus datos podrán usarse para:'],
          items: [
            'Contactarte por teléfono (llamada o mensaje), correo electrónico o aplicaciones de mensajería para darte información sobre nuestros terrenos, casas, desarrollos y opciones de financiamiento.',
            'Dar seguimiento a tu solicitud y resolver tus dudas.',
            'Programar una llamada o una visita, si así lo solicitas.',
          ],
        },
        {
          heading: 'Cookies y medición',
          paragraphs: ['Este sitio usa Google Tag Manager, Google Analytics y herramientas de medición de campañas para conocer cómo se utiliza. Estas herramientas pueden usar cookies e identificadores. No reciben tu nombre, correo ni teléfono. Puedes desactivar las cookies desde la configuración de tu navegador.'],
        },
        {
          heading: 'Con quién compartimos tus datos',
          paragraphs: ['Solo compartimos tus datos con empresas relacionadas con Ciudad Maderas y con proveedores que nos ayudan a contactarte y a almacenar la información (por ejemplo, servicios de alojamiento y de gestión de clientes), para las finalidades de este aviso.'],
        },
        {
          heading: 'Tus derechos',
          paragraphs: [
            'Puedes acceder a tus datos, rectificarlos si son inexactos, cancelarlos, oponerte a su uso (derechos ARCO) o revocar tu consentimiento en cualquier momento. Para hacerlo, envía una solicitud por escrito al domicilio indicado arriba con tu nombre completo, los datos de contacto con los que te registraste, la descripción clara del derecho que quieres ejercer y una identificación. Responderemos en los plazos que marca la ley.',
            'También puedes pedirnos que dejemos de contactarte en cualquier momento, por el mismo medio por el que te contactemos.',
          ],
        },
        {
          heading: 'Cambios a este aviso',
          paragraphs: ['Cualquier cambio se publicará en esta misma página. Te recomendamos revisarla de vez en cuando.'],
        },
      ],
      closing: 'Al enviar el formulario y aceptar la autorización de contacto, confirmas que leíste este aviso.',
    },
    sendError: 'Algo salió mal. Inténtalo de nuevo.',
    duplicateLead: 'Este nombre o correo ya fue registrado.',
    validation: {
      fullNameRequired: 'Ingresa tu nombre completo.',
      emailRequired: 'Ingresa tu correo electrónico.',
      emailInvalid: 'Ingresa un correo electrónico válido.',
      phoneRequired: 'Ingresa tu número de teléfono.',
      phoneInvalidExact: 'Ingresa un teléfono de exactamente {n} dígitos.',
      phoneInvalidRange: 'Ingresa un teléfono de {min} a {max} dígitos.',
      consentRequired: 'Acepta la autorización de contacto.',
    },
    footer: 'Copyright Ciudad Maderas | Información e imágenes representativas sujetas a cambio sin previo aviso. Mobiliario sugerido. Aplican restricciones. | Blvd. Bernardo Quintana #160, Suite 5 y 6, Col. Carretas, Querétaro, Qro. | Aviso de Privacidad | Términos y Condiciones',
  },
};

const banks = [
  { src: '/bank-pnc-cropped.png', alt: 'PNC Bank' },
  { src: '/bank-of-america-cropped.png', alt: 'Bank of America' },
  { src: '/zelle-cropped.png', alt: 'Zelle' },
  { src: '/chase-cropped.png', alt: 'Chase' },
];

const clientsTotal = 100000;

function App() {
  const [lang, setLang] = useState('es');
  const [galleryTab, setGalleryTab] = useState('homes');
  const [activeImage, setActiveImage] = useState(0);
  const [clientsCount, setClientsCount] = useState(() => (prefersReducedMotion() ? clientsTotal : 0));
  const galleryDialogRef = useRef(null);
  const privacyDialogRef = useRef(null);
  const heroVideoRef = useRef(null);

  // LADAS DESDE LA API
  const [countriesRaw, setCountriesRaw] = useState([]);
  const [countryCodes, setCountryCodes] = useState(defaultPhoneCodes);
  const [selectedLada, setSelectedLada] = useState(defaultPhoneCodes[0]);
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneLib, setPhoneLib] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const phoneRules = useMemo(() => getPhoneRules(phoneLib, selectedLada.iso), [phoneLib, selectedLada.iso]);

  const [formStatus, setFormStatus] = useState('idle');
  const [formMessage, setFormMessage] = useState('');
  const [fieldError, setFieldError] = useState('');
  const isSubmittingLeadRef = useRef(false);

  const t = content[lang];

  const galleryItems = useGalleryItems(galleryImages);
  const homes = useMemo(() => galleryItems.filter((item) => item.category === 'homes'), [galleryItems]);
  const amenities = useMemo(() => galleryItems.filter((item) => item.category === 'amenities'), [galleryItems]);
  const filteredGallery = galleryTab === 'homes' ? homes : amenities;
  const currentImage = filteredGallery[Math.min(activeImage, filteredGallery.length - 1)];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.pageTitle;
  }, [lang, t.pageTitle]);

  useEffect(() => {
    loadPhoneLib()
      .then(setPhoneLib)
      .catch((err) => console.error('No se pudieron cargar las reglas de teléfono:', err));
  }, []);

  useEffect(() => {
    fetch('/api/countries')
      .then((res) => { if (!res.ok) throw new Error('Countries unavailable'); return res.json(); })
      .then((data) => {
        setCountriesRaw(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('Error al consultar ladas de la API:', err));
  }, []);

  useEffect(() => {
    if (!countriesRaw.length) return;

    const priorityCountries = new Map([
      ['Mexico', 1],
      ['México', 1],
      ['United States', 0],
      ['United States of America', 0],
      ['Estados Unidos', 0],
      ['Estados Unidos de América', 0],
    ]);

    const formatted = countriesRaw
      .map((country) => {
        const root = country.idd?.root || '';
        const suffix = country.idd?.suffixes ? country.idd.suffixes[0] : '';
        const fullCode = root + (country.idd?.suffixes?.length > 1 ? '' : suffix);

        let localizedName = country.name?.common || '';
        if (lang === 'es' && country.translations?.spa?.common) {
          localizedName = country.translations.spa.common;
        }

        return {
          code: fullCode,
          flag: country.flag || '🏳️',
          iso: flagToIso(country.flag),
          name: localizedName,
        };
      })
      .filter((c) => c.code && c.code.length <= 5)
      .sort((a, b) => {
        const priorityA = priorityCountries.get(a.name) ?? 99;
        const priorityB = priorityCountries.get(b.name) ?? 99;

        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name, lang);
      });

    if (formatted.length) setCountryCodes(formatted);

    setSelectedLada((prev) => {
      const match = formatted.find((c) => c.code === prev.code && c.flag === prev.flag);
      return match || prev;
    });
  }, [countriesRaw, lang]);

  useHlsSource(heroVideoRef, 'home', heroVideo, !prefersReducedMotion(), 30);

  // Hero video autoplay.
  useEffect(() => {
    if (!prefersReducedMotion()) playMutedVideo(heroVideoRef.current);
  }, []);

  // +100,000 count-up.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    let frame = 0;
    let start = null;
    const duration = 1800;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      setClientsCount(Math.round(clientsTotal * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(step); }, 700);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Scroll reveal.
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in-view)');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang, formStatus]);

  const handlePhoneChange = (event) => {
    const digits = sanitizePhone(event.target.value, selectedLada.code);
    setPhoneValue(capPhoneDigits(digits, phoneRules, selectedLada.code));
  };

  // Switching country trims digits that the new country's number format would not allow.
  const handleLadaChange = (country) => {
    setSelectedLada(country);
    setPhoneValue((current) => capPhoneDigits(current, getPhoneRules(phoneLib, country.iso), country.code));
  };

  const toggleLang = () => setLang((l) => (l === 'en' ? 'es' : 'en'));

  const scrollToId = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      block: 'start',
    });
  };

  const openPrivacy = () => privacyDialogRef.current?.showModal();

  const scrollToForm = () => {
    scrollToId('contact-form');
    document.getElementById('full-name')?.focus({ preventScroll: true });
  };

  const changeGalleryTab = (tab) => {
    setGalleryTab(tab);
    setActiveImage(0);
  };

  const openGalleryImage = (index) => {
    setActiveImage(index);
    galleryDialogRef.current?.showModal();
  };

  const nextImage = () => setActiveImage((i) => (i + 1) % filteredGallery.length);
  const previousImage = () => setActiveImage((i) => (i - 1 + filteredGallery.length) % filteredGallery.length);

  const showFieldError = (field, message) => {
    setFieldError(message);
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    const clear = () => {
      field.removeAttribute('aria-invalid');
      setFieldError('');
    };
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', clear, { once: true });
  };

  const phoneLengthMessage = (rules) => (rules.min === rules.max
    ? t.validation.phoneInvalidExact.replace('{n}', rules.max)
    : t.validation.phoneInvalidRange.replace('{min}', rules.min).replace('{max}', rules.max));

  const validateLeadForm = (form, lib) => {
    const fields = form.elements;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    [fields.fullName, fields.email, fields.phone, fields.consent].forEach((field) => field.removeAttribute('aria-invalid'));
    setFieldError('');
    setFormMessage('');

    if (!fields.fullName.value.trim()) {
      showFieldError(fields.fullName, t.validation.fullNameRequired);
      return false;
    }

    if (!fields.email.value.trim()) {
      showFieldError(fields.email, t.validation.emailRequired);
      return false;
    }

    if (!emailPattern.test(fields.email.value.trim())) {
      showFieldError(fields.email, t.validation.emailInvalid);
      return false;
    }

    if (!fields.phone.value.trim()) {
      showFieldError(fields.phone, t.validation.phoneRequired);
      return false;
    }

    const rules = getPhoneRules(lib, selectedLada.iso);

    if (!isPhoneLengthValid(lib, selectedLada.iso, phoneValue, rules)) {
      showFieldError(fields.phone, phoneLengthMessage(rules));
      return false;
    }

    if (!fields.consent.checked) {
      showFieldError(fields.consent, t.validation.consentRequired);
      return false;
    }

    return true;
  };

  const submitLead = async (event) => {
    event.preventDefault();

    if (isSubmittingLeadRef.current || formStatus === 'sending') {
      return;
    }

    const form = event.currentTarget;

    // Already loaded in practice; if it failed to load, validation falls back to generic length limits.
    const lib = await loadPhoneLib().catch(() => null);

    if (isSubmittingLeadRef.current) {
      return;
    }

    if (!validateLeadForm(form, lib)) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: phoneValue,
      phoneCode: selectedLada.code,
      phoneCountry: selectedLada.name,
      // Legacy API keys remain; location is no longer requested in the form.
      country: '',
      state: '',
      howHeard: new URLSearchParams(window.location.search).get('utm_source') || 'Website',
      consent: formData.get('consent') === 'on',
      language: lang,
      page: window.location.href,
    };

    isSubmittingLeadRef.current = true;
    setFormStatus('sending');
    setFormMessage('');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || 'Lead request failed');
        error.code = errorData.code;
        throw error;
      }

      form.reset();
      setPhoneValue('');
      setFormStatus('sent');
      setFormMessage(t.sent);
      // Conversion event for GTM. No personal data is sent to the dataLayer.
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'lead_success', lead_source: payload.howHeard, form_language: lang });
    } catch (error) {
      console.error('Error sending lead:', error);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_error',
        error_type: error.code === 'LEAD_DUPLICATE' ? 'duplicate' : 'server',
        form_language: lang,
      });
      setFormStatus('error');
      setFormMessage(error.code === 'LEAD_DUPLICATE' ? t.duplicateLead : t.sendError);
    } finally {
      isSubmittingLeadRef.current = false;
    }
  };

  const resetForm = () => {
    setFormStatus('idle');
    setFormMessage('');
    setFieldError('');
    setPhoneValue('');
  };

  const errorText = fieldError || (formStatus === 'error' ? formMessage : '');
  const phoneHint = phoneLib
    ? (phoneRules.min === phoneRules.max
      ? `${phoneValue.length}/${phoneRules.max} ${t.phoneDigits}`
      : `${phoneRules.min}–${phoneRules.max} ${t.phoneDigits}`)
    : '';
  const pad = (n) => n.toString().padStart(2, '0');

  return (
    <main className="page-shell">

      {/* HEADER */}
      <header className="site-header">
        <div className="wrap site-header-inner">
          <img src={t.logo} alt="Ciudad Maderas" className="site-logo" />
          <nav className="site-nav" aria-label={lang === 'es' ? 'Principal' : 'Main'}>
            <button type="button" className="lang-toggle" onClick={toggleLang} aria-label={t.switchLang}>
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
            <button type="button" className="btn btn-gold btn-sm" onClick={scrollToForm} aria-controls="lead-form">{t.register}</button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          <video
            ref={heroVideoRef}
            loop
            muted
            playsInline
            preload="auto"
            poster="/gallery/cancun.webp"
            onCanPlay={() => { if (!prefersReducedMotion()) playMutedVideo(heroVideoRef.current); }}
          />
        </div>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-fade" aria-hidden="true" />

        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="hero-badge fade-up d1">
              <span className="hero-badge-route">USA <ArrowRight size={12} /> MX</span>
              {t.heroBadge}
            </span>
            <h1 className="hero-title fade-up d2">
              {t.heroTitle} <span className="serif-accent">{t.heroTitleAccent}</span>
            </h1>
            <p className="hero-text fade-up d3">
              {t.heroText} <strong>{t.heroTextPrice}</strong>
            </p>
            <div className="hero-actions fade-up d4">
              <button type="button" className="btn btn-gold" onClick={scrollToForm}>
                {t.moreInfo}<span className="btn-arrow"><ArrowRight /></span>
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => scrollToId('galeria')}>{t.viewGallery}</button>
            </div>
            <div className="hero-payments fade-up d5">
              <span className="eyebrow-muted">{t.paymentsLabel}</span>
              <div className="bank-row">
                {banks.map((bank) => (
                  <span className="bank-chip" key={bank.alt}><img src={bank.src} alt={bank.alt} /></span>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-aside fade-up d6">
            <div className="glass-card">
              <div className="stat-block">
                <span className="eyebrow-muted">{t.trustedBy}</span>
                <span className="stat-number">+{clientsCount.toLocaleString('en-US')}</span>
                <span className="stat-label">{t.satisfiedClients}</span>
                <span className="stat-sub">{t.clientsPurchased}</span>
              </div>
              <div className="glass-divider" />
              <div className="glass-price">
                <div className="glass-price-copy">
                  <span className="eyebrow-muted">{t.monthlyFrom}</span>
                  <span className="glass-price-value"><strong>$149</strong><span>USD*</span></span>
                </div>
                <span className="live-chip"><span className="pulse-dot" />{t.lotsAvailable}</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* CARDS */}
      <section className="cards-section" style={{ backgroundImage: "url('/gallery/family-club.webp')" }}>
        <div className="cards-overlay" aria-hidden="true" />
        <div className="wrap cards-grid">
          <HoverVideoCard image="/gallery/mapa.webp" imageAlt={t.mapAlt} video={mapVideo} slot="hover2">
            <div className="card-top">
              <span className="card-kicker">{t.anOptionFor}</span>
              <span className="card-heading">{t.everyone}</span>
            </div>
            <div className="card-bottom card-bottom--stat">
              <span className="card-big-number">30+</span>
              <span className="card-stat-copy">
                <span className="card-stat-title">{t.developments}</span>
                <span className="card-stat-sub">{t.acrossMexico}</span>
              </span>
            </div>
          </HoverVideoCard>

          <HoverVideoCard image="/gallery/amenidades.webp" imageAlt={t.amenitiesAlt} video={resortVideo} slot="hover1">
            <div className="card-top">
              <span className="card-kicker">{t.builtYour}</span>
              <span className="card-heading">{t.home}</span>
            </div>
            <div className="card-bottom card-bottom--resort">
              <span className="card-small">{t.live}</span>
              <span className="card-resort serif-accent">{t.resort}</span>
              <span className="card-small">{t.style}</span>
            </div>
          </HoverVideoCard>
        </div>
      </section>

      {/* GALLERY */}
      <section id="galeria" className="gallery-section" aria-labelledby="gallery-title">
        <div className="wrap gallery-inner">
          <div className="gallery-head reveal">
            <div className="gallery-head-copy">
              <span className="eyebrow-gold">{t.galleryEyebrow}</span>
              <h2 id="gallery-title">{t.galleryTitle} <span className="serif-accent">{t.galleryTitleAccent}</span></h2>
              <p>{t.gallerySubtitle}</p>
            </div>
            <div className="segmented" role="tablist" aria-label={t.galleryTabsLabel}>
              <span className={`segmented-indicator${galleryTab === 'amenities' ? ' is-right' : ''}`} aria-hidden="true" />
              <button
                type="button"
                role="tab"
                id="tab-homes"
                aria-controls="gallery-panel"
                aria-selected={galleryTab === 'homes'}
                className={galleryTab === 'homes' ? 'is-active' : ''}
                onClick={() => changeGalleryTab('homes')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
                {t.galleryHomes} <span className="segmented-count">{homes.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-amenities"
                aria-controls="gallery-panel"
                aria-selected={galleryTab === 'amenities'}
                className={galleryTab === 'amenities' ? 'is-active' : ''}
                onClick={() => changeGalleryTab('amenities')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 19c2 0 2-1.5 4-1.5S8 19 10 19s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /><path d="M7 15V5a2 2 0 014 0" /><path d="M15 15V5a2 2 0 014 0" /><path d="M7 9h8" /></svg>
                {t.galleryAmenities} <span className="segmented-count">{amenities.length}</span>
              </button>
            </div>
          </div>

          <div
            id="gallery-panel"
            className="gallery-grid"
            role="tabpanel"
            aria-labelledby={galleryTab === 'homes' ? 'tab-homes' : 'tab-amenities'}
            key={galleryTab}
          >
            {filteredGallery.map((item, index) => {
              const layout = tileLayout(index, filteredGallery.length);

              return (
                <button
                  type="button"
                  key={item.src}
                  className={`tile ${layout}`}
                  style={{ animationDelay: `${Math.min(index, 6) * 80}ms` }}
                  aria-label={`${t.galleryView}: ${item[lang]}`}
                  onClick={() => openGalleryImage(index)}
                >
                  <picture>
                    {item.cardSet && <source type="image/avif" srcSet={item.cardSet.avif} sizes={tileSizes(layout)} />}
                    <img
                      src={item.src}
                      srcSet={item.cardSet?.webp}
                      sizes={item.cardSet ? tileSizes(layout) : undefined}
                      alt=""
                      width={item.width}
                      height={item.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                  <span className="tile-caption">
                    <span>
                      <strong>{item[lang]}</strong>
                      <small>{item.description[lang]}</small>
                    </span>
                    <span className="tile-zoom" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M7 17L17 7M9 7h8v8" /></svg>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="gallery-foot reveal">
            <small>{t.pricingNote}</small>
            <button type="button" className="btn btn-gold" onClick={scrollToForm}>
              {t.moreInfo}<span className="btn-arrow"><ArrowRight /></span>
            </button>
          </div>
        </div>
      </section>

      {/* LIGHTBOX */}
      <dialog
        ref={galleryDialogRef}
        className="lightbox"
        aria-label={t.galleryTitle}
        onClick={(event) => { if (event.target === event.currentTarget) galleryDialogRef.current?.close(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') nextImage();
          if (event.key === 'ArrowLeft') previousImage();
        }}
      >
        {currentImage && (
          <figure className="lightbox-figure">
            <div className="lightbox-top">
              <span>{t.galleryCollection} / {galleryTab === 'homes' ? t.galleryHomes.toUpperCase() : t.galleryAmenities.toUpperCase()}</span>
              <span className="lightbox-top-right">
                <span className="lightbox-counter">{pad(activeImage + 1)} / {pad(filteredGallery.length)}</span>
                <button type="button" className="round-btn" aria-label={t.galleryClose} onClick={() => galleryDialogRef.current?.close()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </span>
            </div>
            <picture key={currentImage.src}>
              {currentImage.detailSet && <source type="image/avif" srcSet={currentImage.detailSet.avif} sizes="100vw" />}
              <img
                className="lightbox-image"
                src={currentImage.detailSrc || currentImage.src}
                srcSet={currentImage.detailSet?.webp}
                sizes={currentImage.detailSet ? '100vw' : undefined}
                alt={currentImage[lang]}
              />
            </picture>
            <figcaption className="lightbox-caption" aria-live="polite">
              <span className="lightbox-caption-copy">
                <strong>{currentImage[lang]}</strong>
                <span>{currentImage.description[lang]}</span>
                <small>{currentImage.render ? t.renderLabel : t.photoLabel}</small>
              </span>
              {filteredGallery.length > 1 && (
                <span className="lightbox-nav">
                  <button type="button" className="round-btn" aria-label={t.galleryPrevious} onClick={previousImage}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                  </button>
                  <button type="button" className="round-btn" aria-label={t.galleryNext} onClick={nextImage}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </span>
              )}
            </figcaption>
          </figure>
        )}
      </dialog>

      {/* PRIVACY NOTICE */}
      <dialog
        ref={privacyDialogRef}
        className="privacy-dialog"
        aria-labelledby="privacy-title"
        onClick={(event) => { if (event.target === event.currentTarget) privacyDialogRef.current?.close(); }}
      >
        <div className="privacy-head">
          <h2 id="privacy-title">{t.privacyNotice.title}</h2>
          <button type="button" className="round-btn" aria-label={t.privacyClose} onClick={() => privacyDialogRef.current?.close()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="privacy-body">
          <small className="privacy-updated">{t.privacyNotice.updated}</small>
          {t.privacyNotice.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
              {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
          <p className="privacy-closing">{t.privacyNotice.closing}</p>
        </div>
      </dialog>

      {/* FORM */}
      <section id="contact-form" className="form-section">
        <div className="form-bg" style={{ backgroundImage: "url('/gallery/cancun.webp')" }} aria-hidden="true" />
        <div className="form-shade" aria-hidden="true" />

        <div className="wrap form-grid">
          <div className="form-pitch reveal">
            <span className="eyebrow-gold">{t.formEyebrow}</span>
            <h2>{t.formTitle1} <span className="serif-accent">{t.formTitle2}</span></h2>
            <div className="big-price">
              <span className="eyebrow-muted">{t.monthlyFrom}</span>
              <span className="big-price-row">
                <span className="big-price-dollar">$</span>
                <span className="big-price-main">149</span>
                <span className="big-price-side"><strong>USD*</strong><span>{t.perMonth}</span></span>
              </span>
            </div>
            <ul className="benefit-list">
              {t.benefits.map((benefit) => (
                <li key={benefit}><b><CheckIcon /></b>{benefit}</li>
              ))}
            </ul>
            <small className="form-note">{t.pricingNote}</small>
          </div>

          <div className="form-card reveal">
            {formStatus === 'sent' ? (
              <div className="form-success" role="status">
                <span className="form-success-icon"><CheckIcon size={32} strokeWidth={2.6} /></span>
                <span className="form-success-title">{t.thanksTitle}</span>
                <span className="form-success-text">{formMessage}</span>
                <button type="button" className="btn btn-outline" onClick={resetForm}>{t.sendAnother}</button>
              </div>
            ) : (
              <form id="lead-form" className="lead-form" onSubmit={submitLead} noValidate>
                <div className="form-card-head">
                  <span className="form-card-title">{t.formCardTitle}</span>
                  <span className="form-card-text">{t.formCardText}</span>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="full-name">{t.fullName}</label>
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                    <input id="full-name" name="fullName" autoComplete="name" required type="text" placeholder={t.fullNamePlaceholder} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="email">{t.email}</label>
                  <div className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                    <input id="email" name="email" required type="email" inputMode="email" autoComplete="email" placeholder={t.emailPlaceholder} />
                  </div>
                </div>

                <div className="field">
                  <div className="field-label-row">
                    <label className="field-label" htmlFor="phone-number">{t.phone}</label>
                    {phoneHint && <small id="phone-hint" className="phone-hint" aria-live="polite">{phoneHint}</small>}
                  </div>
                  <div className={`phone-field${pickerOpen ? ' is-open' : ''}`}>
                    <PhoneCodePicker
                      options={countryCodes}
                      value={selectedLada}
                      onChange={handleLadaChange}
                      onOpenChange={setPickerOpen}
                      label={t.phoneCodeLabel}
                      searchLabel={t.phoneSearch}
                      emptyLabel={t.phoneNoResults}
                    />
                    <input
                      id="phone-number"
                      name="phone"
                      required
                      autoComplete="tel-national"
                      inputMode="numeric"
                      type="tel"
                      value={phoneValue}
                      onChange={handlePhoneChange}
                      placeholder={phoneRules.example}
                      aria-describedby={phoneHint ? 'phone-hint' : undefined}
                    />
                  </div>
                </div>

                <label className="consent">
                  <input name="consent" required type="checkbox" />
                  <span className="consent-box"><CheckIcon size={13} strokeWidth={3.4} /></span>
                  <span>{t.consent} <button type="button" className="link-btn" onClick={openPrivacy}>{t.privacy}</button></span>
                </label>

                {errorText && (
                  <div className="form-error" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
                    {errorText}
                  </div>
                )}

                <button type="submit" className="submit-btn" disabled={formStatus === 'sending'}>
                  {formStatus === 'sending' ? t.sending : t.send}
                  {formStatus !== 'sending' && <span className="btn-arrow btn-arrow--gold"><ArrowRight /></span>}
                </button>
                <span className="form-privacy">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
                  <span>{t.privacyLead} <button type="button" className="link-btn" onClick={openPrivacy}>{t.privacy}</button>.</span>
                </span>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          {t.footer.split(' | ').map((part, index) => (
            <span key={part}>
              {index > 0 && ' | '}
              {part === t.privacy
                ? <button type="button" className="link-btn link-btn--footer" onClick={openPrivacy}>{part}</button>
                : part}
            </span>
          ))}
        </div>
      </footer>

      <button type="button" className="float-cta" onClick={scrollToForm} aria-controls="lead-form" aria-label={t.moreInfo}>
        <span className="float-cta-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" /></svg>
        </span>
        <span className="float-cta-label">{t.moreInfo}</span>
      </button>
    </main>
  );
}

export default App;
