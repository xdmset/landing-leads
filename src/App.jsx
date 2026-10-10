import { useState, useEffect, useRef } from 'react';
import './App.css';

const videoApiBase = import.meta.env.VITE_VIDEO_API_BASE_URL || '';
const privateVideo = (fileName) => `${videoApiBase}/api/videos/${encodeURIComponent(fileName)}`;

const heroVideo = privateVideo('Video Home – Versión 3.0.mp4');

const carouselVideos = [
  privateVideo('Primer residente CM Península.mp4'),
  privateVideo('Luis Subt.mp4'),
  privateVideo('MiriamAraujo Subt.mp4'),
  privateVideo('Carlos Subt.mp4'),
];

const mapVideo    = privateVideo('DESARROLLOS ENG.mp4');          
const resortVideo = privateVideo('tomas desarrollos eng.mp4');    

const defaultPhoneCodes = [
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+52', flag: '🇲🇽', name: 'México' },
];
const galleryImages = [
  {"src": "/gallery/family-club.webp", "type": "developments", "es": "Family Club · Cancún", "en": "Family Club · Cancún", "description": {"es": "La vida que imaginabas, en el Caribe mexicano.", "en": "The lifestyle you imagined, in the Mexican Caribbean."}, "width": 1600, "height": 900, "render": true, "featured": true},
  {"src": "/gallery/antara.webp", "type": "homes", "es": "Casa modelo Antara", "en": "Antara home model", "description": {"es": "Arquitectura para una nueva etapa.", "en": "Architecture for a new chapter."}, "width": 1600, "height": 1600, "render": true, "featured": false},
  {"src": "/gallery/interior.webp", "type": "homes", "es": "Espacios para vivir", "en": "Spaces to live in", "description": {"es": "Tu hogar, desde adentro.", "en": "Your home, from the inside."}, "width": 905, "height": 517, "render": true, "featured": false},
  {"src": "/gallery/aqua.webp", "type": "homes", "es": "Casa modelo Aqua", "en": "Aqua home model", "description": {"es": "Una fachada con personalidad propia.", "en": "A home with its own personality."}, "width": 1202, "height": 1600, "render": true, "featured": false},
];

const mobileHoverVideoDelayMs = 900;

const getHoverVideoDelay = () => {
  if (typeof window === 'undefined') return 0;
  return window.matchMedia('(hover: none), (pointer: coarse), (max-width: 700px)').matches
    ? mobileHoverVideoDelayMs
    : 0;
};


const content = {
  en: {
    moreInfo: 'I want more information',
    clientsPurchased: 'WHO HAVE ALREADY PURCHASED A LOT OR HOME WITH US',
    galleryEyebrow: 'YOUR NEXT CHAPTER STARTS HERE',
    galleryTitle: 'Homes and lots in Mexico',
    gallerySubtitle: 'No credit check. No banks. Direct financing from $149 USD per month.*',
    galleryAll: 'All',
    galleryHomes: 'Homes',
    galleryDevelopments: 'Developments',
    galleryView: 'View image',
    galleryClose: 'Close gallery',
    galleryPrevious: 'Previous image',
    galleryNext: 'Next image',
    renderLabel: 'Representative render',
    pricingNote: '*Starting monthly payment applies to selected lots. Home pricing is quoted separately. Subject to availability, down payment, term and exchange rate. Restrictions apply.',
    logo: '/CIUDAD MADERAS BLANCO INGLÉS.png',
    headerTitle: "The largest real estate developer in Mexico",
    trustedBy: 'TRUSTED BY',
    satisfiedClients: 'SATISFIED CLIENTS',
    paymentsLabel: 'Secure payments through',
    residentLabel: 'RESIDENT',
    storiesLabel: 'STORIES',
    anOptionFor: 'AN OPTION FOR',
    everyone: 'EVERYONE',
    developments: 'DEVELOPMENTS',
    acrossMexico: 'ACROSS MEXICO',
    builtYour: 'BUILD YOUR',
    home: 'HOME',
    live: 'LIVE',
    resort: 'RESORT',
    style: 'STYLE',
    formTitle1: 'Tell us a bit about you',
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone number',
    consent: 'I agree to be contacted through any of the provided means to receive information.',
    send: 'SEND',
    sending: 'SENDING...',
    sent: 'Thanks. We will contact you soon.',
    sendError: 'Something went wrong. Please try again.',
    duplicateLead: 'This name or email has already been registered.',
    validation: {
      fullNameRequired: 'Please enter your full name.',
      emailRequired: 'Please enter your email.',
      emailInvalid: 'Please enter a valid email address.',
      phoneRequired: 'Please enter your phone number.',
      consentRequired: 'Please accept the contact authorization.',
    },
    from: 'FROM',
    monthlyPayment: 'MONTHLY PAYMENT',
    noCredit: 'NO CREDIT CHECK | OWNER FINANCING',
    footer: 'Copyright Ciudad Maderas | Representative information and images subject to change without prior notice. Suggested furniture. Restrictions apply. | Blvd. Bernardo Quintana #160, Suite 5 and 6, Carretas Neighborhood, Querétaro, Qro. | Privacy Notice | Terms and Conditions',
    carouselImages: [
      'gallery/testimonio-en.webp',
      'gallery/luis-en.webp',
      'gallery/miriam-en.webp',
      'gallery/carlos-en.webp',
    ],
  },
  es: {
    moreInfo: 'Quiero más información',
    clientsPurchased: 'QUE YA COMPRARON SU TERRENO O CASA CON NOSOTROS',
    galleryEyebrow: 'TU PRÓXIMA HISTORIA EMPIEZA AQUÍ',
    galleryTitle: 'Casas y terrenos en México',
    gallerySubtitle: 'Sin revisión de buró. Sin bancos. Con financiamiento directo desde $149 USD al mes.*',
    galleryAll: 'Todo',
    galleryHomes: 'Casas',
    galleryDevelopments: 'Desarrollos',
    galleryView: 'Ver imagen',
    galleryClose: 'Cerrar galería',
    galleryPrevious: 'Imagen anterior',
    galleryNext: 'Siguiente imagen',
    renderLabel: 'Render representativo',
    pricingNote: '*Mensualidad desde para terrenos seleccionados. Las casas se cotizan por separado. Sujeto a disponibilidad, enganche, plazo y tipo de cambio. Aplican restricciones.',
    logo: '/CIUDAD MADERAS ESP BL.png',
    headerTitle: 'La desarrolladora inmobiliaria más grande de México',
    trustedBy: 'CON LA CONFIANZA DE',
    satisfiedClients: 'CLIENTES SATISFECHOS',
    paymentsLabel: 'Pagos seguros a través de',
    residentLabel: 'HISTORIAS',
    storiesLabel: 'DE RESIDENTES',
    anOptionFor: 'UNA OPCIÓN PARA',
    everyone: 'TODOS',
    developments: 'DESARROLLOS',
    acrossMexico: 'EN TODO MÉXICO',
    builtYour: 'CONSTRUYE TU',
    home: 'HOGAR',
    live: 'VIVE',
    resort: 'RESORT',
    style: 'ESTILO',
    formTitle1: 'Cuéntanos un poco sobre ti',
    fullName: 'Nombre completo',
    email: 'Correo electrónico',
    phone: 'Número de teléfono',
    consent: 'Acepto ser contactado a través de cualquiera de los medios proporcionados para recibir información.',
    send: 'ENVIAR',
    sending: 'ENVIANDO...',
    sent: 'Gracias. Te contactaremos pronto.',
    sendError: 'Algo salió mal. Inténtalo de nuevo.',
    duplicateLead: 'Este nombre o correo ya fue registrado.',
    validation: {
      fullNameRequired: 'Ingresa tu nombre completo.',
      emailRequired: 'Ingresa tu correo electrónico.',
      emailInvalid: 'Ingresa un correo electrónico válido.',
      phoneRequired: 'Ingresa tu número de teléfono.',
      consentRequired: 'Acepta la autorización de contacto.',
    },
    from: 'DESDE',
    monthlyPayment: 'PAGO MENSUAL',
    noCredit: 'SIN VERIFICACIÓN DE CRÉDITO | FINANCIAMIENTO PROPIO',
    footer: 'Copyright Ciudad Maderas | Información e imágenes representativas sujetas a cambio sin previo aviso. Mobiliario sugerido. Aplican restricciones. | Blvd. Bernardo Quintana #160, Suite 5 y 6, Col. Carretas, Querétaro, Qro. | Aviso de Privacidad | Términos y Condiciones',
    carouselImages: [
      'gallery/testimonio-es.webp',
      'gallery/luis-es.webp',
      'gallery/miriam-es.webp',
      'gallery/carlos-es.webp',
    ],
  },
};

function App() {
  const [lang, setLang] = useState('es');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselAnimating, setCarouselAnimating] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [centerHovered, setCenterHovered] = useState(false);
  const [rightHovered, setRightHovered] = useState(false);
  const [centerVideoActive, setCenterVideoActive] = useState(false);
  const [rightVideoActive, setRightVideoActive] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const galleryDialogRef = useRef(null);
  const filteredGallery = galleryImages;
  const heroVideoRef = useRef(null);
  const videoRef = useRef(null);
  const centerHoverVideoRef = useRef(null);
  const rightHoverVideoRef = useRef(null);
  const centerHoverDelayRef = useRef(null);
  const rightHoverDelayRef = useRef(null);
  const centerCardRef = useRef(null);
  const rightCardRef = useRef(null);

  // LADAS DESDE LA API
  const [countriesRaw, setCountriesRaw] = useState([]);
  const [countryCodes, setCountryCodes] = useState(defaultPhoneCodes);
  const [selectedLada, setSelectedLada] = useState({ code: '+1', flag: '🇺🇸', name: 'United States' });


  const [formStatus, setFormStatus] = useState('idle');
  const [formMessage, setFormMessage] = useState('');
  const isSubmittingLeadRef = useRef(false);

  const t = content[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'My Lot in Mexico' : 'Mi Terreno en México';
  }, [lang]);

 
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
          name: localizedName
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

  const toggleLang = () => {
    setLang((l) => (l === 'en' ? 'es' : 'en'));
    setCarouselIdx(0);
    setShowVideo(false);
  };

  const triggerCarousel = (newIdx) => {
    setCarouselAnimating(true);
    setCarouselIdx(newIdx);
    setShowVideo(false);
    setTimeout(() => setCarouselAnimating(false), 400);
  };
  
  const next = () => triggerCarousel((carouselIdx + 1) % t.carouselImages.length);
  const prev = () => triggerCarousel((carouselIdx - 1 + t.carouselImages.length) % t.carouselImages.length);

  const openVideo = () => setShowVideo(true);

  const playMutedVideo = (video) => {
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    video.play().catch((error) => {
      console.log('Autoplay blocked:', error);
    });
  };

  const closeVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowVideo(false);
  };

  const openGalleryImage = (item) => {
    setActiveImage(galleryImages.indexOf(item));
    galleryDialogRef.current?.showModal();
  };

  const scrollToForm = () => {
    document.getElementById('lead-form')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
    document.getElementById('full-name')?.focus({ preventScroll: true });
  };

  const showFieldError = (field, message) => {
    field.setCustomValidity(message);
    field.reportValidity();
    field.addEventListener('input', () => field.setCustomValidity(''), { once: true });
  };

  const validateLeadForm = (form) => {
    const fields = form.elements;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    fields.fullName.setCustomValidity('');
    fields.email.setCustomValidity('');
    fields.phone.setCustomValidity('');
    fields.consent.setCustomValidity('');
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

    if (!validateLeadForm(form)) {
      return;
    }

    const formData = new FormData(form);
    const phone = String(formData.get('phone') || '').trim();
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone,
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
            setFormStatus('sent');
      setFormMessage(t.sent);
    } catch (error) {
      console.error('Error sending lead:', error);
      setFormStatus('error');
      setFormMessage(error.code === 'LEAD_DUPLICATE' ? t.duplicateLead : t.sendError);
    } finally {
      isSubmittingLeadRef.current = false;
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    if (!mq.matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isActive = entry.isIntersecting && entry.intersectionRatio >= 0.45 && !showVideo;
          if (entry.target === centerCardRef.current) setCenterHovered(isActive);
          if (entry.target === rightCardRef.current) setRightHovered(isActive);
        });
      },
      { threshold: [0, 0.45, 0.75] }
    );

    if (centerCardRef.current) observer.observe(centerCardRef.current);
    if (rightCardRef.current) observer.observe(rightCardRef.current);

    return () => {
      observer.disconnect();
      setCenterHovered(false);
      setRightHovered(false);
    };
  }, [showVideo]);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
        if (e.isIntersecting) io.unobserve(e.target);
      }),
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) playMutedVideo(heroVideoRef.current);
  }, []);

  useEffect(() => {
    const video = centerHoverVideoRef.current;

    if (!video) return;

    if (centerHovered && !showVideo && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      centerHoverDelayRef.current = setTimeout(() => {
        setCenterVideoActive(true);
        playMutedVideo(video);
      }, getHoverVideoDelay());

      return () => {
        clearTimeout(centerHoverDelayRef.current);
      };
    }

    clearTimeout(centerHoverDelayRef.current);
    setCenterVideoActive(false);
    video.pause();
    video.currentTime = 0;
  }, [centerHovered, showVideo]);

  useEffect(() => {
    const video = rightHoverVideoRef.current;

    if (!video) return;

    if (rightHovered && !showVideo && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rightHoverDelayRef.current = setTimeout(() => {
        setRightVideoActive(true);
        playMutedVideo(video);
      }, getHoverVideoDelay());

      return () => {
        clearTimeout(rightHoverDelayRef.current);
      };
    }

    clearTimeout(rightHoverDelayRef.current);
    setRightVideoActive(false);
    video.pause();
    video.currentTime = 0;
  }, [rightHovered, showVideo]);

  return (
    <main className="page-shell">

      <button type="button" className="float-btn" onClick={scrollToForm} aria-controls="lead-form">
        <svg className="float-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor"/>
        </svg>
        <span className="float-label">
          {t.moreInfo}
        </span>
      </button>

      <header className="header-bar">
        <img src={t.logo} alt="Ciudad Maderas" className="logo-header" />
        <span className="header-title">{t.headerTitle}</span>
        <div className="header-right">
          <button type="button" className="lang-toggle" onClick={toggleLang} aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a español'}>
            <span>{lang === 'es' ? 'EN' : 'ES'}</span>
          </button>
        </div>
      </header>

      <section className="hero-section">
        <video
          ref={heroVideoRef}
          className="hero-video-background"
          src={heroVideo}
          loop
          muted
          playsInline
          preload="metadata"
          poster="/gallery/cancun.webp"
          onCanPlay={() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) playMutedVideo(heroVideoRef.current); }}
        />
        <div className="hero-overlay-top" />
        <div className="hero-overlay-bottom" />
        <div className="hero-content">
          <div className="hero-intro reveal">
            <span className="eyebrow">CIUDAD MADERAS · MÉXICO</span>
            <h1>{t.headerTitle}</h1>
            <p className="hero-translation" lang={lang === 'es' ? 'en' : 'es'}>{content[lang === 'es' ? 'en' : 'es'].headerTitle}</p>
          </div>
          <div className="hero-stats">
            <span className="trusted reveal" style={{ transitionDelay: '0.05s' }}>{t.trustedBy}</span>
            <span className="hero-number reveal" style={{ transitionDelay: '0.18s' }}>+100,000</span>
            <span className="satisfied reveal" style={{ transitionDelay: '0.31s' }}>{t.satisfiedClients}<small>{t.clientsPurchased}</small></span>
          </div>
          <button type="button" className="primary-cta hero-cta reveal" onClick={scrollToForm}>{t.moreInfo}<span aria-hidden="true">↗</span></button>
          <div className="payments-bar reveal" style={{ transitionDelay: '0.44s' }}>
            <span className="payments-label">{t.paymentsLabel}</span>
            <div className="payments-logos">
              <img src="/bank-pnc-cropped.png" alt="PNC Bank" />
              <img src="/bank-of-america-cropped.png" alt="Bank of America" />
              <img src="/zelle-cropped.png" alt="Zelle" />
              <img src="/chase-cropped.png" alt="Chase" />
            </div>
          </div>
        </div>
      </section>

      {/* CARDS SECTION */}
      <section
        className="cards-section"
        style={{ backgroundImage: "url('/gallery/family-club.webp')" }}
      >
        <div className="cards-overlay" />
        <div className="cards-row">

          {/* CARD 1 - CARRUSEL */}
          <div className={`card-carousel-wrapper reveal ${showVideo ? 'expanded' : ''}`}>
            {!showVideo ? (
              <div className="card-carousel">
                <div className="card-label-top">{t.residentLabel}</div>
                <div className="card-label-big">{t.storiesLabel}</div>
                <button aria-label={lang === 'es' ? 'Testimonio anterior' : 'Previous story'} className="carousel-btn left" onClick={(e) => { e.stopPropagation(); prev(); }}>&#8249;</button>
                <img
                  src={`/${t.carouselImages[carouselIdx]}`}
                  alt="Testimonio"
                  className={`carousel-img${carouselAnimating ? ' animating' : ''}`}
                />
                <button type="button" className="carousel-play-btn" onClick={openVideo} aria-label={lang === 'es' ? 'Ver testimonio' : 'Play resident story'}>
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.45)"/>
                    <polygon points="19,14 38,24 19,34" fill="white"/>
                  </svg>
                </button>
                <button aria-label={lang === 'es' ? 'Siguiente testimonio' : 'Next story'} className="carousel-btn right" onClick={(e) => { e.stopPropagation(); next(); }}>&#8250;</button>
                <div className="carousel-dots">
                  {t.carouselImages.map((_, i) => (
                    <button
                      type="button"
                      aria-label={`${lang === 'es' ? 'Testimonio' : 'Story'} ${i + 1}`}
                      aria-pressed={i === carouselIdx}
                      key={i}
                      className={`dot${i === carouselIdx ? ' active' : ''}`}
                      onClick={() => triggerCarousel(i)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="carousel-video-container">
                <video
                  ref={videoRef}
                  src={carouselVideos[carouselIdx]}
                  autoPlay
                  controls
                  playsInline
                  className="carousel-video-player"
                />
                <button aria-label={lang === 'es' ? 'Cerrar video' : 'Close video'} className="carousel-video-close" onClick={closeVideo}>✕</button>
                <div className="carousel-video-brand">
                  <span>Ciudad Maderas</span>
                  <span className="carousel-video-brand-sub">TERRENOS PREMIUM</span>
                </div>
                <div className="carousel-video-badge">{t.noCredit}</div>
              </div>
            )}
          </div>

          {/* CARD 2 - MAPA */}
          <div
            ref={centerCardRef}
            className={`card-miniature card-center reveal ${showVideo ? 'faded' : ''}`}
            onMouseEnter={() => !showVideo && setCenterHovered(true)}
            onMouseLeave={() => setCenterHovered(false)}
          >
            <img src="/gallery/mapa.webp" alt="Mapa" />
            <div className="card-center-text">
              <span className="card-center-top">{t.anOptionFor}</span>
              <span className="card-center-big">{t.everyone}</span>
              <span className="card-center-num">30+</span>
              <span className="card-center-dev">{t.developments}</span>
              <span className="card-center-across">{t.acrossMexico}</span>
            </div>
            <div className={`card-hover-video ${centerVideoActive && !showVideo ? 'is-active' : ''}`}>
              <video
                ref={centerHoverVideoRef}
                src={mapVideo}
                loop
                muted
                playsInline
                preload="metadata"
                poster="/gallery/mapa.webp"
              />
            </div>
          </div>

          {/* CARD 3 - LIVE RESORT STYLE */}
          <div
            ref={rightCardRef}
            className={`card-miniature card-right reveal ${showVideo ? 'faded' : ''}`}
            onMouseEnter={() => !showVideo && setRightHovered(true)}
            onMouseLeave={() => setRightHovered(false)}
          >
            <img src="/gallery/amenidades.webp" alt="Amenidades" />
            <div className="card-right-text">
              <span className="card-right-top">{t.builtYour}</span>
              <span className="card-right-big">{t.home}</span>
              <span className="card-right-live">{t.live}</span>
              <span className="card-right-resort">{t.resort}</span>
              <span className="card-right-style">{t.style}</span>
            </div>
            <div className={`card-hover-video ${rightVideoActive && !showVideo ? 'is-active' : ''}`}>
              <video
                ref={rightHoverVideoRef}
                src={resortVideo}
                loop
                muted
                playsInline
                preload="metadata"
                poster="/gallery/amenidades.webp"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="gallery-section" aria-labelledby="gallery-title">
        <div className="gallery-heading reveal">
          <h2 id="gallery-title">{t.galleryTitle}</h2>
          <p>{t.gallerySubtitle}</p>
        </div>
        <div className="gallery-grid" aria-label={t.galleryTitle}>
          {galleryImages.map((item, index) => (
            <button type="button" key={item.src} className="gallery-tile reveal"
              style={{ transitionDelay: `${index * 50}ms` }}
              aria-label={`${t.galleryView}: ${item[lang]}`}
              onClick={() => openGalleryImage(item)}>
              <span className="gallery-image-frame">
                <img src={item.src} alt={item[lang]} width={item.width} height={item.height} loading="lazy" decoding="async" />
              </span>
              <span className="gallery-tile-caption"><strong>{item[lang]}</strong><span aria-hidden="true">↗</span></span>
            </button>
          ))}
        </div>
        <div className="gallery-bottom">
          <small>{t.pricingNote}</small>
          <button type="button" className="primary-cta gallery-cta" onClick={scrollToForm}>{t.moreInfo}<span aria-hidden="true">↗</span></button>
        </div>
      </section>

      <dialog ref={galleryDialogRef} className="gallery-dialog" aria-label={t.galleryTitle}
        onClick={(event) => { if (event.target === event.currentTarget) galleryDialogRef.current?.close(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') setActiveImage((i) => (i + 1) % filteredGallery.length);
          if (event.key === 'ArrowLeft') setActiveImage((i) => (i - 1 + filteredGallery.length) % filteredGallery.length);
        }}>
        <div className="gallery-dialog-inner">
          <div className="gallery-dialog-top"><span>CIUDAD MADERAS / {lang === 'es' ? 'LA COLECCIÓN' : 'THE COLLECTION'}</span><span>{(activeImage + 1).toString().padStart(2, '0')} / {filteredGallery.length.toString().padStart(2, '0')}</span></div>
          <button type="button" className="gallery-close" aria-label={t.galleryClose} onClick={() => galleryDialogRef.current?.close()}>✕</button>
          <figure>
            <img key={filteredGallery[activeImage].src} src={filteredGallery[activeImage].src} alt={filteredGallery[activeImage][lang]} />
            <figcaption aria-live="polite"><strong>{filteredGallery[activeImage][lang]}</strong><span>{filteredGallery[activeImage].description[lang]}</span><small>{filteredGallery[activeImage].render ? t.renderLabel : (lang === 'es' ? 'Fotografía del destino' : 'Destination photography')}</small></figcaption>
          </figure>
          <button type="button" className="gallery-nav gallery-prev" aria-label={t.galleryPrevious} onClick={() => setActiveImage((i) => (i - 1 + filteredGallery.length) % filteredGallery.length)}>‹</button>
          <button type="button" className="gallery-nav gallery-next" aria-label={t.galleryNext} onClick={() => setActiveImage((i) => (i + 1) % filteredGallery.length)}>›</button>
          <div className="gallery-thumbnails" role="group" aria-label={lang === 'es' ? 'Seleccionar imagen' : 'Choose image'}>
            {filteredGallery.map((item, index) => <button type="button" key={item.src} aria-label={`${t.galleryView}: ${item[lang]}`} aria-pressed={index === activeImage} onClick={() => setActiveImage(index)}><img src={item.src} alt="" /></button>)}
          </div>
        </div>
      </dialog>

      {/* FORM SECTION */}
      <section
        id="contact-form"
        className="form-section"
        style={{ backgroundImage: "url('/gallery/cancun.webp')" }}
      >
        <div className="form-overlay" />
        <div className="form-inner">
          <form id="lead-form" className="form-form reveal" style={{ transitionDelay: '0s' }} onSubmit={submitLead} noValidate>
            <div className="form-titles">
              <span className="form-title1">{t.formTitle1}</span>
              <span className="form-title2">
                {lang === 'en'
                  ? <>and <strong>we'll take it from there.</strong></>
                  : <>y <strong>nosotros nos encargamos del resto.</strong></>
                }
              </span>
            </div>
            
            <div className="form-inputs">
              <label>{t.fullName}<input id="full-name" name="fullName" autoComplete="name" required type="text" placeholder={t.fullName} /></label>
              <label>{t.email}<input name="email" required type="email" inputMode="email" autoComplete="email" placeholder={t.email} /></label>
              
              <div className="form-field">
                <label htmlFor="phone-number">{t.phone}</label>
                <div className="phone-input-container">
                  <select className="phone-code-select" aria-label={lang === 'es' ? 'Código de país del teléfono' : 'Phone country code'}
                    value={`${selectedLada.code}|${selectedLada.flag}`}
                    onChange={(event) => {
                      const country = countryCodes.find((item) => `${item.code}|${item.flag}` === event.target.value);
                      if (country) setSelectedLada(country);
                    }}>
                    {countryCodes.map((country) => <option key={`${country.code}|${country.flag}|${country.name}`} value={`${country.code}|${country.flag}`}>{country.code} · {country.name}</option>)}
                  </select>
                  <input id="phone-number" name="phone" required autoComplete="tel-national" inputMode="tel" type="tel" placeholder="(201) 555-0123" />
                </div>
              </div>

            </div>

            <div className="form-actions">
              <label className="checkbox-label">
                <input name="consent" required type="checkbox" />
                <span>{t.consent}</span>
              </label>
              {formMessage && (
                <span role="status" aria-live="polite" className={`form-message ${formStatus}`}>{formMessage}</span>
              )}
              <button type="submit" disabled={formStatus === 'sending'}>
                {formStatus === 'sending' ? t.sending : t.send}
              </button>
            </div>
          </form>

          <div className="form-pricing reveal" style={{ transitionDelay: '0.18s' }}>
            <div className="price-container">
              <span className="from-label">{t.from}</span>
              <span className="price-dollar">$</span>
              <span className="price-main">149</span>
              <div className="price-right">
                <span className="usd-label">USD *</span>
                <span className="monthly-label">{t.monthlyPayment}</span>
              </div>
            </div>
            <span className="no-credit">{t.noCredit}</span>
            <p className="pricing-note">{t.pricingNote}</p>
          </div>
        </div>
      </section>

      <footer className="footer-note">
        {t.footer}
      </footer>
    </main>
  );
}

export default App;
