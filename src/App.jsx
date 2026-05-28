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

// BASE DE DATOS DE ESTADOS DINÁMICOS
const mexicoStates = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 
  'Coahuila', 'Colima', 'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 
  'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 
  'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 
  'Veracruz', 'Yucatán', 'Zacatecas'
];

const usStates = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 
  'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
  'Wisconsin', 'Wyoming'
];

const content = {
  en: {
    logo: '/CIUDAD MADERAS BLANCO INGLÉS.png',
    langLabel: 'EN',
    headerTitle: "Mexico's largest real estate development company",
    trustedBy: 'TRUSTED BY',
    satisfiedClients: 'SATISFIED CLIENTS',
    paymentsLabel: 'Secure payments through',
    residentLabel: 'RESIDENT',
    storiesLabel: 'STORIES',
    anOptionFor: 'AN OPTION FOR',
    everyone: 'EVERYONE',
    developments: 'DEVELOPMENTS',
    acrossMexico: 'ACROSS MEXICO',
    builtYour: 'BUILT YOUR',
    home: 'HOME',
    live: 'LIVE',
    resort: 'RESORT',
    style: 'STYLE',
    formTitle1: 'Tell us a bit about you',
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone number',
    country: 'Country',
    state: 'State',
    howHeard: 'How did you hear about us?',
    selectCountry: 'Select Country',
    selectState: 'Select State',
    selectHow: 'Select an option',
    consent: 'I agree to be contacted through any of the provided means to receive information.',
    send: 'SEND',
    sending: 'SENDING...',
    sent: 'Thanks. We will contact you soon.',
    sendError: 'Something went wrong. Please try again.',
    validation: {
      fullNameRequired: 'Please enter your full name.',
      emailRequired: 'Please enter your email.',
      emailInvalid: 'Please enter a valid email address.',
      phoneRequired: 'Please enter your phone number.',
      countryRequired: 'Please select your country.',
      stateRequired: 'Please select your state.',
      howRequired: 'Please select how you heard about us.',
      consentRequired: 'Please accept the contact authorization.',
    },
    from: 'FROM',
    monthlyPayment: 'MONTHLY PAYMENT',
    noCredit: 'NO CREDIT CHECK | OWNER FINANCING',
    footer: 'Copyright Ciudad Maderas | Representative information and images subject to change without prior notice. Suggested furniture. Restrictions apply. | Blvd. Bernardo Quintana #160, Suite 5 and 6, Carretas Neighborhood, Querétaro, Qro. | Privacy Notice | Terms and Conditions',
    carouselImages: [
      'testimonio eng1.png', 
      'Luis Castillo Eng.png',
      'miriam eng.png',
      'Carlos alcántara eng.png',
    ],
    countries: ['Mexico', 'United States'], // Solo estos dos países
    howOptions: ['Cris & Trey', 'Paisa y Gringa', 'Social media (Instagram, TikTok, etc.)', 'Other']
  },
  es: {
    logo: '/CIUDAD MADERAS ESP BL.png',
    langLabel: 'ES',
    headerTitle: 'La empresa inmobiliaria más grande de México',
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
    country: 'País',
    state: 'Estado',
    howHeard: '¿Cómo te enteraste de nosotros?',
    selectCountry: 'Selecciona País',
    selectState: 'Selecciona Estado',
    selectHow: 'Selecciona una opción',
    consent: 'Acepto ser contactado a través de cualquiera de los medios proporcionados para recibir información.',
    send: 'ENVIAR',
    sending: 'ENVIANDO...',
    sent: 'Gracias. Te contactaremos pronto.',
    sendError: 'Algo salió mal. Inténtalo de nuevo.',
    validation: {
      fullNameRequired: 'Ingresa tu nombre completo.',
      emailRequired: 'Ingresa tu correo electrónico.',
      emailInvalid: 'Ingresa un correo electrónico válido.',
      phoneRequired: 'Ingresa tu número de teléfono.',
      countryRequired: 'Selecciona tu país.',
      stateRequired: 'Selecciona tu estado.',
      howRequired: 'Selecciona cómo te enteraste de nosotros.',
      consentRequired: 'Acepta la autorización de contacto.',
    },
    from: 'DESDE',
    monthlyPayment: 'PAGO MENSUAL',
    noCredit: 'SIN VERIFICACIÓN DE CRÉDITO | FINANCIAMIENTO PROPIO',
    footer: 'Copyright Ciudad Maderas | Información e imágenes representativas sujetas a cambio sin previo aviso. Mobiliario sugerido. Aplican restricciones. | Blvd. Bernardo Quintana #160, Suite 5 y 6, Col. Carretas, Querétaro, Qro. | Aviso de Privacidad | Términos y Condiciones',
    carouselImages: [
      'testimonio esp.png', 
      'Luis Castillo Esp.png',
      'miriam esp.png',
      'Carlos alcántara esp.png',
    ],
    countries: ['México', 'Estados Unidos'], // Solo estos dos países
    howOptions: ['Cris & Trey', 'Paisa y Gringa', 'Redes sociales (Instagram, TikTok, etc.)', 'Otro']
  },
};

function App() {
  const [lang, setLang] = useState('en');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselAnimating, setCarouselAnimating] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [centerHovered, setCenterHovered] = useState(false);
  const [rightHovered, setRightHovered] = useState(false);
  const [heroVideoLoaded, setHeroVideoLoaded] = useState(false);
  const [formInView, setFormInView] = useState(false);
  const heroVideoRef = useRef(null);
  const videoRef = useRef(null);
  const centerCardRef = useRef(null);
  const rightCardRef = useRef(null);

  // LADAS DESDE LA API
  const [countriesRaw, setCountriesRaw] = useState([]);
  const [countryCodes, setCountryCodes] = useState([]);
  const [selectedLada, setSelectedLada] = useState({ code: '+52', flag: '🇲🇽', name: 'México' });
  const [openLadaDrop, setOpenLadaDrop] = useState(false);
  const ladaRef = useRef(null);

  // DROPDOWNS PERSONALIZADOS ACTUALIZADOS
  const [selectedCountry, setSelectedCountry] = useState('');
  const [openCountryDrop, setOpenCountryDrop] = useState(false);
  const countryRef = useRef(null);

  const [selectedState, setSelectedState] = useState('');
  const [openStateDrop, setOpenStateDrop] = useState(false);
  const stateRef = useRef(null);
  
  // Listado dinámico de estados según el país seleccionado
  const [availableStates, setAvailableStates] = useState([]);

  const [selectedHow, setSelectedHow] = useState('');
  const [openHowDrop, setOpenHowDrop] = useState(false);
  const howRef = useRef(null);
  const [formStatus, setFormStatus] = useState('idle');
  const [formMessage, setFormMessage] = useState('');

  const t = content[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'My Lot in Mexico' : 'Mi Terreno en México';
  }, [lang]);

  // 1. Efecto para escuchar el cambio de País y actualizar la lista de Estados
  useEffect(() => {
    setSelectedState(''); // Resetea el estado previo cada vez que cambia el país
    
    if (selectedCountry === 'México' || selectedCountry === 'Mexico') {
      setAvailableStates(mexicoStates);
    } else if (selectedCountry === 'Estados Unidos' || selectedCountry === 'United States') {
      setAvailableStates(usStates);
    } else {
      setAvailableStates([]);
    }
  }, [selectedCountry]);

  // 2. Traer ladas de la API al montar
  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,idd,flag,translations')
      .then((res) => res.json())
      .then((data) => {
        setCountriesRaw(data);
      })
      .catch((err) => console.error('Error al consultar ladas de la API:', err));
  }, []);

  // 3. Procesar ladas según idioma
  useEffect(() => {
    if (!countriesRaw.length) return;

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
      .sort((a, b) => a.name.localeCompare(b.name, lang));

    setCountryCodes(formatted);

    setSelectedLada((prev) => {
      const match = formatted.find((c) => c.code === prev.code && c.flag === prev.flag);
      return match || prev;
    });
  }, [countriesRaw, lang]);

  const toggleLang = () => {
    setLang((l) => (l === 'en' ? 'es' : 'en'));
    setCarouselIdx(0);
    setShowVideo(false);
    setSelectedCountry('');
    setSelectedState('');
    setSelectedHow('');
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

  const closeVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowVideo(false);
  };

  const scrollToForm = () => {
    document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' });
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

    if (!selectedCountry) {
      setFormStatus('error');
      setFormMessage(t.validation.countryRequired);
      return false;
    }

    if (!selectedState) {
      setFormStatus('error');
      setFormMessage(t.validation.stateRequired);
      return false;
    }

    if (!selectedHow) {
      setFormStatus('error');
      setFormMessage(t.validation.howRequired);
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

    const form = event.currentTarget;

    if (!validateLeadForm(form)) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      phoneCode: selectedLada.code,
      phoneCountry: selectedLada.name,
      country: selectedCountry,
      state: selectedState,
      howHeard: selectedHow,
      consent: formData.get('consent') === 'on',
      language: lang,
      page: window.location.href,
    };

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
        throw new Error('Lead request failed');
      }

      form.reset();
      setSelectedCountry('');
      setSelectedState('');
      setSelectedHow('');
      setFormStatus('sent');
      setFormMessage(t.sent);
    } catch (error) {
      console.error('Error sending lead:', error);
      setFormStatus('error');
      setFormMessage(t.sendError);
    }
  };

  useEffect(() => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const io = new IntersectionObserver(
      ([entry]) => setFormInView(entry.isIntersecting),
      { threshold: 0.12 }
    );

    io.observe(form);
    return () => io.disconnect();
  }, []);

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

  // Clics externos para cerrar dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (ladaRef.current && !ladaRef.current.contains(event.target)) setOpenLadaDrop(false);
      if (countryRef.current && !countryRef.current.contains(event.target)) setOpenCountryDrop(false);
      if (stateRef.current && !stateRef.current.contains(event.target)) setOpenStateDrop(false);
      if (howRef.current && !howRef.current.contains(event.target)) setOpenHowDrop(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
        else e.target.classList.remove('in-view');
      }),
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  // Autoplay Hero
  useEffect(() => {
    if (heroVideoRef.current && heroVideoLoaded) {
      heroVideoRef.current.play().catch(e => console.log('Autoplay blocked:', e));
    }
  }, [heroVideoLoaded]);

  return (
    <main className="page-shell">

      <button className={`float-btn ${formInView ? 'is-hidden-on-form' : ''}`} onClick={scrollToForm}>
        <svg className="float-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor"/>
        </svg>
        <span className="float-label">
          {lang === 'en' ? 'Want to contact us for more info?' : '¿Quieres contactarnos para más información?'}
        </span>
      </button>

      <header className="header-bar">
        <img src={t.logo} alt="Ciudad Maderas" className="logo-header" />
        <span className="header-title">{t.headerTitle}</span>
        <div className="header-right">
          <button className="lang-toggle" onClick={toggleLang}>
            <img
              src={lang === 'en' ? 'https://flagcdn.com/w40/us.png' : 'https://flagcdn.com/w40/mx.png'}
              alt={lang === 'en' ? 'US' : 'MX'}
              className="lang-flag-img"
            />
            <span>{t.langLabel}</span>
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section">
        <video
          ref={heroVideoRef}
          className="hero-video-background"
          src={heroVideo}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setHeroVideoLoaded(true)}
        />
        <div className="hero-overlay-top" />
        <div className="hero-overlay-bottom" />
        <div className="hero-content">
          <div className="hero-stats">
            <span className="trusted reveal" style={{ transitionDelay: '0.05s' }}>{t.trustedBy}</span>
            <span className="hero-number reveal" style={{ transitionDelay: '0.18s' }}>+120,000</span>
            <span className="satisfied reveal" style={{ transitionDelay: '0.31s' }}>{t.satisfiedClients}</span>
          </div>
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
        style={{ backgroundImage: "url('/FAMILY CLUB AMENITIES CANCÚN.jpg')" }}
      >
        <div className="cards-overlay" />
        <div className="cards-row">

          {/* CARD 1 - CARRUSEL */}
          <div className={`card-carousel-wrapper ${showVideo ? 'expanded' : ''}`}>
            {!showVideo ? (
              <div className="card-carousel">
                <div className="card-label-top">{t.residentLabel}</div>
                <div className="card-label-big">{t.storiesLabel}</div>
                <button className="carousel-btn left" onClick={(e) => { e.stopPropagation(); prev(); }}>&#8249;</button>
                <img
                  src={`/${t.carouselImages[carouselIdx]}`}
                  alt="Testimonio"
                  className={`carousel-img${carouselAnimating ? ' animating' : ''}`}
                />
                <div className="carousel-play-btn" onClick={openVideo}>
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.45)"/>
                    <polygon points="19,14 38,24 19,34" fill="white"/>
                  </svg>
                </div>
                <button className="carousel-btn right" onClick={(e) => { e.stopPropagation(); next(); }}>&#8250;</button>
                <div className="carousel-dots">
                  {t.carouselImages.map((_, i) => (
                    <span
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
                <button className="carousel-video-close" onClick={closeVideo}>✕</button>
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
            className={`card-miniature card-center ${showVideo ? 'faded' : ''}`}
            onMouseEnter={() => !showVideo && setCenterHovered(true)}
            onMouseLeave={() => setCenterHovered(false)}
          >
            <img src="/mapa portada.png" alt="Mapa" />
            <div className="card-center-text">
              <span className="card-center-top">{t.anOptionFor}</span>
              <span className="card-center-big">{t.everyone}</span>
              <span className="card-center-num">30+</span>
              <span className="card-center-dev">{t.developments}</span>
              <span className="card-center-across">{t.acrossMexico}</span>
            </div>
            {centerHovered && !showVideo && (
              <div className="card-hover-video">
                <video src={mapVideo} autoPlay loop muted playsInline />
              </div>
            )}
          </div>

          {/* CARD 3 - LIVE RESORT STYLE */}
          <div
            ref={rightCardRef}
            className={`card-miniature card-right ${showVideo ? 'faded' : ''}`}
            onMouseEnter={() => !showVideo && setRightHovered(true)}
            onMouseLeave={() => setRightHovered(false)}
          >
            <img src="/portada amenidades.png" alt="Amenidades" />
            <div className="card-right-text">
              <span className="card-right-top">{t.builtYour}</span>
              <span className="card-right-big">{t.home}</span>
              <span className="card-right-live">{t.live}</span>
              <span className="card-right-resort">{t.resort}</span>
              <span className="card-right-style">{t.style}</span>
            </div>
            {rightHovered && !showVideo && (
              <div className="card-hover-video">
                <video src={resortVideo} autoPlay loop muted playsInline />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FORM SECTION */}
      <section
        id="contact-form"
        className="form-section"
        style={{ backgroundImage: "url('/CMCQROO_CD_CONJUNTO_HD -view playa de olas.jpg')" }}
      >
        <div className="form-overlay" />
        <div className="form-inner">
          <form className="form-form reveal" style={{ transitionDelay: '0s' }} onSubmit={submitLead} noValidate>
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
              <label>{t.fullName}<input name="fullName" type="text" placeholder={t.fullName} /></label>
              <label>{t.email}<input name="email" type="text" inputMode="email" autoComplete="email" placeholder={t.email} /></label>
              
              {/* LADAS COMPONENTE PREMIUM DESPLEGABLE */}
              <label>{t.phone}
                <div className="phone-input-container">
                  <div className="lux-dropdown" ref={ladaRef}>
                    <div className="lux-trigger" onClick={() => setOpenLadaDrop(!openLadaDrop)}>
                      <span className="lux-flag">{selectedLada.flag}</span>
                      <span className="lux-code-text">{selectedLada.code}</span>
                      <span className="lux-arrow"></span>
                    </div>
                    {openLadaDrop && (
                      <ul className="lux-menu scrollable">
                        {countryCodes.map((country, idx) => (
                          <li 
                            key={idx} 
                            className={`lux-item ${selectedLada.code === country.code && selectedLada.name === country.name ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedLada(country);
                              setOpenLadaDrop(false);
                            }}
                          >
                            <span className="lux-flag">{country.flag}</span>
                            <span className="lux-code-text">{country.code}</span>
                            <span className="lux-item-text"> - {country.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <input name="phone" type="tel" placeholder="(201) 555-0123" />
                </div>
              </label>

              <div className="form-row">
                {/* PAÍS - FILTRADO SOLO MÉXICO Y USA */}
                <label>{t.country}
                  <div className="lux-dropdown" ref={countryRef}>
                    <div className="lux-trigger" onClick={() => setOpenCountryDrop(!openCountryDrop)}>
                      <span>{selectedCountry || t.selectCountry}</span>
                      <span className="lux-arrow"></span>
                    </div>
                    {openCountryDrop && (
                      <ul className="lux-menu">
                        {t.countries.map((c) => (
                          <li 
                            key={c} 
                            className={`lux-item ${selectedCountry === c ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedCountry(c);
                              setOpenCountryDrop(false);
                            }}
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>

                {/* ESTADO - TOTALMENTE DINÁMICO CON SCROLL CONECTADO AL PAÍS */}
                <label>{t.state}
                  <div className="lux-dropdown" ref={stateRef}>
                    <div className="lux-trigger" onClick={() => {
                      if (availableStates.length > 0) {
                        setOpenStateDrop(!openStateDrop);
                      }
                    }} style={{ opacity: availableStates.length === 0 ? 0.6 : 1, cursor: availableStates.length === 0 ? 'not-allowed' : 'pointer' }}>
                      <span>{selectedState || t.selectState}</span>
                      <span className="lux-arrow"></span>
                    </div>
                    {openStateDrop && availableStates.length > 0 && (
                      <ul className="lux-menu scrollable">
                        {availableStates.map((s) => (
                          <li 
                            key={s} 
                            className={`lux-item ${selectedState === s ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedState(s);
                              setOpenStateDrop(false);
                            }}
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>
              </div>

              <label>{t.howHeard}
                <div className="lux-dropdown" ref={howRef}>
                  <div className="lux-trigger" onClick={() => setOpenHowDrop(!openHowDrop)}>
                    <span>{selectedHow || t.selectHow}</span>
                    <span className="lux-arrow"></span>
                  </div>
                  {openHowDrop && (
                    <ul className="lux-menu">
                      {t.howOptions.map((opt) => (
                        <li 
                          key={opt} 
                          className={`lux-item ${selectedHow === opt ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedHow(opt);
                            setOpenHowDrop(false);
                          }}
                        >
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
            </div>

            <div className="form-actions">
              <label className="checkbox-label">
                <input name="consent" type="checkbox" />
                <span>{t.consent}</span>
              </label>
              {formMessage && (
                <span className={`form-message ${formStatus}`}>{formMessage}</span>
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
              <span className="price-main">89</span>
              <div className="price-right">
                <span className="usd-label">USD *</span>
                <span className="monthly-label">{t.monthlyPayment}</span>
              </div>
            </div>
            <span className="no-credit">{t.noCredit}</span>
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
