import type { ContentKey, Locale } from '@painter/shared';
import type { Composition, PaletteName } from './art';

type PerLocale<T> = Record<Locale, T>;

/* ---------------------------------------------------------------------------
 * Categories — catalog filter, services page card and order form choice in one
 * (the same as the migrations create; the artist manages them in the dashboard)
 * ------------------------------------------------------------------------- */

export interface SeedCategory {
  slug: string;
  /** "Show on the site" (catalog filter, services page). */
  isVisible: boolean;
  showInOrderForm: boolean;
  defaultUnit: 'CM' | 'M';
  art: { seed: number; palette: PaletteName; composition: Composition };
  translations: PerLocale<{ name: string; description: string }>;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'horeca',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'M',
    art: { seed: 3101, palette: 'terracotta', composition: 'colorField' },
    translations: {
      'nl-BE': { name: 'Horeca', description: 'Muurschilderingen die een café, restaurant of bar een eigen sfeer geven.' },
      en: { name: 'Cafés & restaurants', description: 'Murals that give a café, restaurant or bar an atmosphere of its own.' },
      tr: { name: 'Horeca', description: 'Kafe, restoran ya da bara kendine has bir hava katan duvar resimleri.' },
    },
  },
  {
    slug: 'gym',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'M',
    art: { seed: 3202, palette: 'ochre', composition: 'strokes' },
    translations: {
      'nl-BE': { name: 'Sportscholen', description: 'Energieke wanden voor sportscholen en studio’s.' },
      en: { name: 'Gyms', description: 'Energetic walls for gyms and studios.' },
      tr: { name: 'Spor salonu', description: 'Spor salonları ve stüdyolar için enerjik duvarlar.' },
    },
  },
  {
    slug: 'shops',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'M',
    art: { seed: 3303, palette: 'gold', composition: 'organic' },
    translations: {
      'nl-BE': { name: 'Winkels en bedrijven', description: 'Wanden die uw winkel of kantoor herkenbaar maken.' },
      en: { name: 'Shops & businesses', description: 'Walls that make your shop or office recognisable.' },
      tr: { name: 'Mağaza ve iş yeri', description: 'Mağazanızı ya da ofisinizi akılda kalıcı kılan duvarlar.' },
    },
  },
  {
    slug: 'home',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'M',
    art: { seed: 3404, palette: 'dusk', composition: 'hills' },
    translations: {
      'nl-BE': { name: 'Woning en kinderkamer', description: 'Een muurschildering voor de woonkamer, slaapkamer of kinderkamer.' },
      en: { name: 'Home & kids’ rooms', description: 'A mural for the living room, bedroom or kids’ room.' },
      tr: { name: 'Ev ve çocuk odası', description: 'Oturma odası, yatak odası ya da çocuk odası için bir duvar resmi.' },
    },
  },
  {
    slug: 'street-art',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'M',
    art: { seed: 1505, palette: 'gold', composition: 'strokes' },
    translations: {
      'nl-BE': { name: 'Street art en vitrines', description: 'Beschilderde rolluiken, gevels en etalages die opvallen, ook als de zaak gesloten is.' },
      en: { name: 'Street art & shop windows', description: 'Painted shutters, façades and shop windows that stand out, even when the business is closed.' },
      tr: { name: 'Sokak sanatı ve vitrin', description: 'İşletme kapalıyken bile göze çarpan boyanmış kepenkler, cepheler ve vitrinler.' },
    },
  },
  {
    slug: 'canvas-portrait',
    isVisible: true,
    showInOrderForm: true,
    defaultUnit: 'CM',
    art: { seed: 1101, palette: 'terracotta', composition: 'organic' },
    translations: {
      'nl-BE': { name: 'Doek en portret', description: 'Een uniek werk op doek of een geschilderd portret van een persoon, gezin of huisdier.' },
      en: { name: 'Canvas & portrait', description: 'A unique work on canvas or a painted portrait of a person, family or pet.' },
      tr: { name: 'Tuval ve portre', description: 'Tuval üzerine tek bir eser ya da bir kişinin, ailenin veya evcil hayvanınızın portresi.' },
    },
  },
  {
    slug: 'custom',
    isVisible: false,
    showInOrderForm: true,
    defaultUnit: 'CM',
    art: { seed: 1606, palette: 'dusk', composition: 'orbits' },
    translations: {
      'nl-BE': { name: 'Werk op maat', description: 'Een idee dat nergens anders bij past? Vertel het ons en we bekijken samen wat mogelijk is.' },
      en: { name: 'Custom piece', description: 'An idea that doesn’t fit anywhere else? Tell us about it and we’ll work out together what’s possible.' },
      tr: { name: 'Kişiye özel eser', description: 'Başka bir başlığa uymayan bir fikriniz mi var? Anlatın, neler yapılabileceğine birlikte bakalım.' },
    },
  },
];

/* ---------------------------------------------------------------------------
 * Sample portfolio (all flagged isSample = true)
 * ------------------------------------------------------------------------- */

export interface SeedPortfolioItem {
  slug: string;
  /** Slug of one of SEED_CATEGORIES. */
  category: string;
  art: { seed: number; palette: PaletteName; composition: Composition; portrait?: boolean };
  width: number;
  height: number;
  unit: 'CM' | 'M';
  year: number;
  isFeatured: boolean;
  translations: PerLocale<{ title: string; description: string }>;
}

export const SEED_PORTFOLIO: SeedPortfolioItem[] = [
  {
    slug: 'sample-warm-earth',
    category: 'canvas-portrait',
    art: { seed: 2101, palette: 'terracotta', composition: 'organic' },
    width: 100,
    height: 75,
    unit: 'CM',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Warme aarde', description: 'Acryl op doek. Organische vormen in aardetinten.' },
      en: { title: 'Warm earth', description: 'Acrylic on canvas. Organic shapes in earth tones.' },
      tr: { title: 'Sıcak toprak', description: 'Tuval üzerine akrilik. Toprak tonlarında organik formlar.' },
    },
  },
  {
    slug: 'sample-tidal-lines',
    category: 'street-art',
    art: { seed: 2202, palette: 'sea', composition: 'horizon' },
    width: 6,
    height: 3,
    unit: 'M',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Getijdenlijnen', description: 'Muurschildering voor een leefruimte, geïnspireerd op de Noordzee.' },
      en: { title: 'Tidal lines', description: 'Mural for a living space, inspired by the North Sea.' },
      tr: { title: 'Gelgit çizgileri', description: 'Kuzey Denizi’nden ilham alan, bir yaşam alanı için duvar resmi.' },
    },
  },
  {
    slug: 'sample-ochre-study',
    category: 'canvas-portrait',
    art: { seed: 2303, palette: 'ochre', composition: 'colorField', portrait: true },
    width: 60,
    height: 80,
    unit: 'CM',
    year: 2024,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Studie in oker', description: 'Olieverf op doek. Rustige kleurvlakken.' },
      en: { title: 'Study in ochre', description: 'Oil on canvas. Calm fields of colour.' },
      tr: { title: 'Okra etüdü', description: 'Tuval üzerine yağlı boya. Sakin renk alanları.' },
    },
  },
  {
    slug: 'sample-evening-figure',
    category: 'canvas-portrait',
    art: { seed: 2404, palette: 'dusk', composition: 'orbits', portrait: true },
    width: 50,
    height: 70,
    unit: 'CM',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Avondfiguur', description: 'Abstract portret in gedempte avondkleuren.' },
      en: { title: 'Evening figure', description: 'Abstract portrait in muted evening colours.' },
      tr: { title: 'Akşam figürü', description: 'Kısık akşam renklerinde soyut bir portre.' },
    },
  },
  {
    slug: 'sample-forest-rhythm',
    category: 'horeca',
    art: { seed: 2505, palette: 'sage', composition: 'strokes' },
    width: 4,
    height: 2.6,
    unit: 'M',
    year: 2024,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Bosritme', description: 'Decoratieve wandafwerking met losse penseelstreken.' },
      en: { title: 'Forest rhythm', description: 'Decorative wall finish with loose brushstrokes.' },
      tr: { title: 'Orman ritmi', description: 'Serbest fırça darbeleriyle dekoratif duvar uygulaması.' },
    },
  },
  {
    slug: 'sample-clay-garden',
    category: 'canvas-portrait',
    art: { seed: 2606, palette: 'clay', composition: 'organic' },
    width: 120,
    height: 90,
    unit: 'CM',
    year: 2023,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Kleituin', description: 'Gemengde technieken op doek.' },
      en: { title: 'Clay garden', description: 'Mixed media on canvas.' },
      tr: { title: 'Kil bahçesi', description: 'Tuval üzerine karışık teknik.' },
    },
  },
  {
    slug: 'sample-night-harbour',
    category: 'horeca',
    art: { seed: 2707, palette: 'nightBlue', composition: 'horizon' },
    width: 8,
    height: 3.5,
    unit: 'M',
    year: 2024,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Nachthaven', description: 'Buitenmuur van een handelszaak, weerbestendige verf.' },
      en: { title: 'Night harbour', description: 'Exterior wall of a shop, weather-resistant paint.' },
      tr: { title: 'Gece limanı', description: 'Bir dükkânın dış duvarı, hava koşullarına dayanıklı boya.' },
    },
  },
  {
    slug: 'sample-sand-strata',
    category: 'shops',
    art: { seed: 2808, palette: 'gold', composition: 'colorField' },
    width: 3.2,
    height: 2.5,
    unit: 'M',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Zandlagen', description: 'Kalkverf in horizontale kleurvlakken.' },
      en: { title: 'Sand strata', description: 'Lime paint in horizontal colour blocks.' },
      tr: { title: 'Kum katmanları', description: 'Yatay renk bloklarında kireç boya.' },
    },
  },
  {
    slug: 'sample-quiet-gaze',
    category: 'canvas-portrait',
    art: { seed: 2909, palette: 'terracotta', composition: 'orbits', portrait: true },
    width: 40,
    height: 50,
    unit: 'CM',
    year: 2023,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Stille blik', description: 'Portretstudie in warme tinten.' },
      en: { title: 'Quiet gaze', description: 'Portrait study in warm tones.' },
      tr: { title: 'Sessiz bakış', description: 'Sıcak tonlarda portre çalışması.' },
    },
  },
  {
    slug: 'sample-paper-wind',
    category: 'home',
    art: { seed: 3010, palette: 'nightBlue', composition: 'strokes' },
    width: 42,
    height: 30,
    unit: 'CM',
    year: 2025,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Papieren wind', description: 'Gouache op papier.' },
      en: { title: 'Paper wind', description: 'Gouache on paper.' },
      tr: { title: 'Kâğıt rüzgâr', description: 'Kâğıt üzerine guaj.' },
    },
  },
  {
    slug: 'sample-moonlit-hills',
    category: 'home',
    art: { seed: 3111, palette: 'nightBlue', composition: 'hills' },
    width: 3.6,
    height: 2.4,
    unit: 'M',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Maanlichtheuvels', description: 'Rustige muurschildering voor een kinder- of slaapkamer.' },
      en: { title: 'Moonlit hills', description: 'A calm mural for a children’s room or bedroom.' },
      tr: { title: 'Ay ışığında tepeler', description: 'Çocuk ya da yatak odası için sakin bir duvar resmi.' },
    },
  },
  {
    slug: 'sample-golden-valley',
    category: 'canvas-portrait',
    art: { seed: 3212, palette: 'gold', composition: 'hills' },
    width: 140,
    height: 100,
    unit: 'CM',
    year: 2025,
    isFeatured: true,
    translations: {
      'nl-BE': { title: 'Gouden vallei', description: 'Acryl op doek. Gelaagde heuvels in warm avondlicht.' },
      en: { title: 'Golden valley', description: 'Acrylic on canvas. Layered hills in warm evening light.' },
      tr: { title: 'Altın vadi', description: 'Tuval üzerine akrilik. Sıcak akşam ışığında katman katman tepeler.' },
    },
  },
];

/* ---------------------------------------------------------------------------
 * Text blocks
 * ------------------------------------------------------------------------- */

export const SEED_CONTENT: Record<ContentKey, PerLocale<string>> = {
  'hero.eyebrow': {
    'nl-BE': 'Schilderijen · Muurschilderingen · Portretten',
    en: 'Paintings · Murals · Portraits',
    tr: 'Tablolar · Duvar resimleri · Portreler',
  },
  'hero.title': {
    'nl-BE': 'Kunst op maat, voor uw muur en uw verhaal',
    en: 'Custom art, made for your wall and your story',
    tr: 'Duvarınız ve hikâyeniz için size özel sanat',
  },
  'hero.subtitle': {
    'nl-BE':
      'Vertel wat u voor ogen hebt. Ik bekijk uw aanvraag persoonlijk en bezorg u een voorstel op maat — vrijblijvend.',
    en: 'Tell me what you have in mind. I review every request personally and send you a tailored proposal — no obligation.',
    tr: 'Aklınızdakini anlatın. Her talebi kişisel olarak inceliyor ve size özel, bağlayıcı olmayan bir teklif gönderiyorum.',
  },
  'about.title': {
    'nl-BE': 'Over het atelier',
    en: 'About the studio',
    tr: 'Atölye hakkında',
  },
  'about.body': {
    'nl-BE':
      'Dit is voorbeeldtekst. Vervang ze door uw eigen verhaal: wie u bent, hoe u werkt en welke technieken u gebruikt. Van schilderijen op doek tot grote muurschilderingen: elk werk wordt met de hand gemaakt.',
    en: 'This is placeholder text. Replace it with your own story: who you are, how you work and which techniques you use. From paintings on canvas to large murals: every piece is made by hand.',
    tr: 'Bu bir örnek metindir. Kendi hikâyenizle değiştirin: kim olduğunuz, nasıl çalıştığınız ve hangi teknikleri kullandığınız. Tuval resimlerinden büyük duvar resimlerine kadar her eser elde yapılır.',
  },
  'instagram.text': {
    'nl-BE': 'Volg het atelier op Instagram voor werk in uitvoering en nieuwe projecten.',
    en: 'Follow the studio on Instagram for work in progress and new projects.',
    tr: 'Devam eden çalışmalar ve yeni projeler için atölyeyi Instagram’da takip edin.',
  },
  'contact.intro': {
    'nl-BE':
      'Hebt u een vraag of een idee? Stuur gerust een bericht of dien meteen een aanvraag op maat in.',
    en: 'Have a question or an idea? Feel free to get in touch, or submit a custom request right away.',
    tr: 'Bir sorunuz ya da fikriniz mi var? Bize yazın ya da hemen size özel bir talep gönderin.',
  },
  'contact.businessHours': {
    'nl-BE': 'Maandag tot vrijdag: 9.00 – 17.00 uur\nZaterdag: op afspraak',
    en: 'Monday to Friday: 9:00 – 17:00\nSaturday: by appointment',
    tr: 'Pazartesi – Cuma: 09.00 – 17.00\nCumartesi: randevu ile',
  },
  'footer.tagline': {
    'nl-BE': 'Handgeschilderde kunst en muurschilderingen op maat.',
    en: 'Hand-painted art and custom murals.',
    tr: 'El yapımı tablolar ve size özel duvar resimleri.',
  },
  'welcome.tagline': {
    'nl-BE': 'Handgeschilderde kunst, gemaakt voor uw ruimte.',
    en: 'Hand-painted art, made for your space.',
    tr: 'Mekânınız için el yapımı sanat.',
  },
  'privacy.body': {
    'nl-BE':
      'VOORBEELDTEKST — door de zaakvoerder na te kijken en aan te passen vóór de lancering.\n\nWelke gegevens verzamelen we?\nWanneer u een aanvraag indient, verwerken we uw naam, e-mailadres, gsm-nummer, adres, de gegevens van uw project en de afbeeldingen die u opstuurt.\n\nWaarvoor gebruiken we die?\nUitsluitend om uw aanvraag te behandelen, u een voorstel te bezorgen en met u te communiceren over uw bestelling.\n\nVertaling van berichten\nBerichten over uw bestelling kunnen voor vertaling naar DeepL SE (Duitsland) worden gestuurd, alleen wanneer u of de kunstenaar op „Vertalen” klikt. De vertaling wordt bij het bericht bewaard.\n\nHoe lang bewaren we ze?\nVul hier de bewaartermijn in.\n\nUw rechten\nU kunt uw gegevens inkijken, laten verbeteren of laten verwijderen. Neem hiervoor contact met ons op.',
    en: 'PLACEHOLDER TEXT — to be reviewed and adapted by the business owner before launch.\n\nWhat data do we collect?\nWhen you submit a request, we process your name, email address, phone number, address, your project details and the images you upload.\n\nWhat do we use it for?\nOnly to handle your request, send you a proposal and communicate with you about your order.\n\nMessage translation\nMessages about your order may be sent to DeepL SE (Germany) for translation, only when you or the artist click “Translate”. The translation is stored with the message.\n\nHow long do we keep it?\nFill in the retention period here.\n\nYour rights\nYou can view, correct or delete your data. Please contact us to do so.',
    tr: 'ÖRNEK METİN — yayına almadan önce işletme sahibi tarafından gözden geçirilmeli ve uyarlanmalıdır.\n\nHangi verileri topluyoruz?\nBir talep gönderdiğinizde adınızı, e-posta adresinizi, telefon numaranızı, adresinizi, proje bilgilerinizi ve yüklediğiniz görselleri işleriz.\n\nBu verileri ne için kullanıyoruz?\nYalnızca talebinizi değerlendirmek, size teklif göndermek ve siparişinizle ilgili sizinle iletişim kurmak için.\n\nMesaj çevirisi\nSiparişinizle ilgili mesajlar, yalnızca siz ya da sanatçı “Çevir” düğmesine bastığında çeviri için DeepL SE’ye (Almanya) gönderilebilir. Çeviri mesajla birlikte saklanır.\n\nNe kadar süre saklıyoruz?\nSaklama süresini buraya yazın.\n\nHaklarınız\nVerilerinizi görüntüleyebilir, düzeltilmesini ya da silinmesini isteyebilirsiniz. Bunun için bizimle iletişime geçin.',
  },
};

/** Earlier seed defaults: the seed replaces a text only while it is still one of these, never the owner's own edits. */
export const SUPERSEDED_CONTENT: Partial<Record<ContentKey, Record<Locale, string[]>>> = {
  'privacy.body': {
    'nl-BE': [
      'VOORBEELDTEKST — door de zaakvoerder na te kijken en aan te passen vóór de lancering.\n\nWelke gegevens verzamelen we?\nWanneer u een aanvraag indient, verwerken we uw naam, e-mailadres, gsm-nummer, adres, de gegevens van uw project en de afbeeldingen die u opstuurt.\n\nWaarvoor gebruiken we die?\nUitsluitend om uw aanvraag te behandelen, u een voorstel te bezorgen en met u te communiceren over uw bestelling.\n\nHoe lang bewaren we ze?\nVul hier de bewaartermijn in.\n\nUw rechten\nU kunt uw gegevens inkijken, laten verbeteren of laten verwijderen. Neem hiervoor contact met ons op.',
    ],
    en: [
      'PLACEHOLDER TEXT — to be reviewed and adapted by the business owner before launch.\n\nWhat data do we collect?\nWhen you submit a request, we process your name, email address, phone number, address, your project details and the images you upload.\n\nWhat do we use it for?\nOnly to handle your request, send you a proposal and communicate with you about your order.\n\nHow long do we keep it?\nFill in the retention period here.\n\nYour rights\nYou can view, correct or delete your data. Please contact us to do so.',
    ],
    tr: [
      'ÖRNEK METİN — yayına almadan önce işletme sahibi tarafından gözden geçirilmeli ve uyarlanmalıdır.\n\nHangi verileri topluyoruz?\nBir talep gönderdiğinizde adınızı, e-posta adresinizi, telefon numaranızı, adresinizi, proje bilgilerinizi ve yüklediğiniz görselleri işleriz.\n\nBu verileri ne için kullanıyoruz?\nYalnızca talebinizi değerlendirmek, size teklif göndermek ve siparişinizle ilgili sizinle iletişim kurmak için.\n\nNe kadar süre saklıyoruz?\nSaklama süresini buraya yazın.\n\nHaklarınız\nVerilerinizi görüntüleyebilir, düzeltilmesini ya da silinmesini isteyebilirsiniz. Bunun için bizimle iletişime geçin.',
    ],
  },
};

/* ---------------------------------------------------------------------------
 * Default settings (placeholders — replace before launch)
 * ------------------------------------------------------------------------- */

/** Earlier placeholder settings the seed replaces while they are unchanged. */
export const SUPERSEDED_SETTINGS = { instagramUrl: ['https://www.instagram.com/'] };

export const SEED_SETTINGS = {
  businessName: 'MeysArt',
  instagramUrl: 'https://www.instagram.com/meysart__',
  contactEmail: 'contact@example.com',
  contactPhone: '+32 470 00 00 00',
  contactAddress: 'Voorbeeldstraat 1, 9000 Gent, België',
};
