import type { ContentKey, Locale } from '@painter/shared';
import type { Composition, PaletteName } from './art';

type PerLocale<T> = Record<Locale, T>;

/* ---------------------------------------------------------------------------
 * Services
 * ------------------------------------------------------------------------- */

export interface SeedService {
  slug: string;
  isWallService: boolean;
  art: { seed: number; palette: PaletteName; composition: Composition };
  translations: PerLocale<{ name: string; description: string }>;
}

export const SEED_SERVICES: SeedService[] = [
  {
    slug: 'canvas-painting',
    isWallService: false,
    art: { seed: 1101, palette: 'terracotta', composition: 'organic' },
    translations: {
      'nl-BE': {
        name: 'Schilderij op maat',
        description:
          'Een uniek werk op doek, afgestemd op uw ruimte, kleuren en verhaal. Van klein formaat tot groot statement-stuk.',
      },
      en: {
        name: 'Custom painting',
        description:
          'A unique work on canvas, tailored to your space, colours and story. From small formats to large statement pieces.',
      },
      tr: {
        name: 'Size özel tablo',
        description:
          'Mekânınıza, renklerinize ve hikâyenize göre tuval üzerine tek bir eser. Küçük boyutlardan büyük, iddialı parçalara kadar.',
      },
    },
  },
  {
    slug: 'mural',
    isWallService: true,
    art: { seed: 1202, palette: 'sea', composition: 'horizon' },
    translations: {
      'nl-BE': {
        name: 'Muurschildering',
        description:
          'Een kunstwerk rechtstreeks op de muur, binnen of buiten: voor woningen, handelszaken, scholen en kantoren.',
      },
      en: {
        name: 'Mural',
        description:
          'An artwork painted directly on the wall, indoors or outdoors: for homes, shops, schools and offices.',
      },
      tr: {
        name: 'Duvar resmi (mural)',
        description:
          'Doğrudan duvara, iç ya da dış mekâna yapılan bir sanat eseri: evler, dükkânlar, okullar ve ofisler için.',
      },
    },
  },
  {
    slug: 'portrait',
    isWallService: false,
    art: { seed: 1303, palette: 'dusk', composition: 'orbits' },
    translations: {
      'nl-BE': {
        name: 'Portret',
        description:
          'Een geschilderd portret van een persoon, koppel, gezin of huisdier, op basis van uw foto’s.',
      },
      en: {
        name: 'Portrait',
        description: 'A painted portrait of a person, couple, family or pet, based on your photos.',
      },
      tr: {
        name: 'Portre',
        description: 'Fotoğraflarınızdan yola çıkarak bir kişinin, çiftin, ailenin ya da evcil hayvanınızın portresi.',
      },
    },
  },
  {
    slug: 'decorative-wall-painting',
    isWallService: true,
    art: { seed: 1404, palette: 'sand', composition: 'colorField' },
    translations: {
      'nl-BE': {
        name: 'Decoratief schilderwerk',
        description:
          'Kalkverf, kleurvlakken, patronen en decoratieve afwerkingen die een ruimte karakter geven.',
      },
      en: {
        name: 'Decorative wall painting',
        description: 'Lime paint, colour blocks, patterns and decorative finishes that give a room its character.',
      },
      tr: {
        name: 'Dekoratif duvar boyama',
        description: 'Bir mekâna karakter katan kireç boya, renk blokları, desenler ve dekoratif yüzey işlemleri.',
      },
    },
  },
];

/* ---------------------------------------------------------------------------
 * Sample portfolio (all flagged isSample = true)
 * ------------------------------------------------------------------------- */

export interface SeedPortfolioItem {
  slug: string;
  category: 'PAINTING' | 'MURAL' | 'WALL_PAINTING' | 'PORTRAIT' | 'OTHER';
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
    category: 'PAINTING',
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
    category: 'MURAL',
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
    category: 'PAINTING',
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
    category: 'PORTRAIT',
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
    category: 'WALL_PAINTING',
    art: { seed: 2505, palette: 'forest', composition: 'strokes' },
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
    category: 'PAINTING',
    art: { seed: 2606, palette: 'clay', composition: 'organic' },
    width: 120,
    height: 90,
    unit: 'CM',
    year: 2023,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Kleituin', description: 'Gemengde technieken op doek.' },
      en: { title: 'Clay garden', description: 'Mixed media on canvas.' },
      tr: { title: 'Kil bahçesi', description: 'Tuval üzerine karışık teknik.' },
    },
  },
  {
    slug: 'sample-night-harbour',
    category: 'MURAL',
    art: { seed: 2707, palette: 'indigo', composition: 'horizon' },
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
    category: 'WALL_PAINTING',
    art: { seed: 2808, palette: 'sand', composition: 'colorField' },
    width: 3.2,
    height: 2.5,
    unit: 'M',
    year: 2025,
    isFeatured: false,
    translations: {
      'nl-BE': { title: 'Zandlagen', description: 'Kalkverf in horizontale kleurvlakken.' },
      en: { title: 'Sand strata', description: 'Lime paint in horizontal colour blocks.' },
      tr: { title: 'Kum katmanları', description: 'Yatay renk bloklarında kireç boya.' },
    },
  },
  {
    slug: 'sample-quiet-gaze',
    category: 'PORTRAIT',
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
    category: 'OTHER',
    art: { seed: 3010, palette: 'indigo', composition: 'strokes' },
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
  'privacy.body': {
    'nl-BE':
      'VOORBEELDTEKST — door de zaakvoerder na te kijken en aan te passen vóór de lancering.\n\nWelke gegevens verzamelen we?\nWanneer u een aanvraag indient, verwerken we uw naam, e-mailadres, gsm-nummer, adres, de gegevens van uw project en de afbeeldingen die u opstuurt.\n\nWaarvoor gebruiken we die?\nUitsluitend om uw aanvraag te behandelen, u een voorstel te bezorgen en met u te communiceren over uw bestelling.\n\nHoe lang bewaren we ze?\nVul hier de bewaartermijn in.\n\nUw rechten\nU kunt uw gegevens inkijken, laten verbeteren of laten verwijderen. Neem hiervoor contact met ons op.',
    en: 'PLACEHOLDER TEXT — to be reviewed and adapted by the business owner before launch.\n\nWhat data do we collect?\nWhen you submit a request, we process your name, email address, phone number, address, your project details and the images you upload.\n\nWhat do we use it for?\nOnly to handle your request, send you a proposal and communicate with you about your order.\n\nHow long do we keep it?\nFill in the retention period here.\n\nYour rights\nYou can view, correct or delete your data. Please contact us to do so.',
    tr: 'ÖRNEK METİN — yayına almadan önce işletme sahibi tarafından gözden geçirilmeli ve uyarlanmalıdır.\n\nHangi verileri topluyoruz?\nBir talep gönderdiğinizde adınızı, e-posta adresinizi, telefon numaranızı, adresinizi, proje bilgilerinizi ve yüklediğiniz görselleri işleriz.\n\nBu verileri ne için kullanıyoruz?\nYalnızca talebinizi değerlendirmek, size teklif göndermek ve siparişinizle ilgili sizinle iletişim kurmak için.\n\nNe kadar süre saklıyoruz?\nSaklama süresini buraya yazın.\n\nHaklarınız\nVerilerinizi görüntüleyebilir, düzeltilmesini ya da silinmesini isteyebilirsiniz. Bunun için bizimle iletişime geçin.',
  },
};

/* ---------------------------------------------------------------------------
 * Default settings (placeholders — replace before launch)
 * ------------------------------------------------------------------------- */

export const SEED_SETTINGS = {
  businessName: 'Atelier Voorbeeld',
  instagramUrl: 'https://www.instagram.com/',
  contactEmail: 'contact@example.com',
  contactPhone: '+32 470 00 00 00',
  contactAddress: 'Voorbeeldstraat 1, 9000 Gent, België',
};
