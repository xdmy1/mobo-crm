// Datele + textele prezentării de ofertă (RO/RU), partajate de PPTX și PDF.

import path from "path";
import type { Lang } from "@/lib/pdf/texts";
import { fmtEurLei } from "@/lib/format";

export const BRAND = {
  ink: "20211B",
  inkSoft: "292A22",
  inkLine: "3A3B31",
  lime: "CCDF10",
  limeInk: "1A1D02",
  bone: "F6F5EE",
  boneDim: "DEDBCB",
  oliva: "5A6300",
  white: "FFFFFF",
  muted: "6E7067",
  mutedOnInk: "A9AC9C",
};

export const PUB = (f: string) => path.join(process.cwd(), "public", f);

export const PHOTOS = [
  PUB("wizard/premium.jpg"),
  PUB("wizard/bucatarie.jpg"),
  PUB("wizard/garderoba.jpg"),
  PUB("wizard/dulap.jpg"),
  PUB("wizard/standard.jpg"),
  PUB("wizard/piese_mici.jpg"),
];

/** Fotografiile fixe ale șablonului (portofoliu real Mobo). */
export const TEMPLATE_PHOTOS = {
  cover: PUB("wizard/premium.jpg"),
  about: PUB("presentation/bucatarie-vitrina.jpg"),
  closing: PUB("presentation/living-marmura.jpg"),
  gallery: [
    PUB("presentation/living-marmura.jpg"),
    PUB("wizard/garderoba.jpg"),
    PUB("wizard/dulap.jpg"),
  ],
};

export interface PresentationProject {
  name: string;
  room: string;
  specs: string[];
  priceEur: number;
  priceMdl: number;
  photo?: string;
}

export interface PresentationConsultant {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface PresentationData {
  lang: Lang;
  org: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  clientName: string;
  humanId: number;
  dateText: string;
  projects: PresentationProject[];
  totalEur: number;
  totalMdl: number;
  includePhotos: boolean;
  includeStages: boolean;
  cursEuro: number;
  /** responsabilul clientului — apare ca „Consultantul tău” pe ultimul slide */
  consultant?: PresentationConsultant | null;
  /** până când e valabilă oferta (text deja formatat) */
  validUntilText?: string;
}

export const PT: Record<Lang, Record<string, string>> = {
  RO: {
    coverKicker: "PREZENTARE PROIECT · OFERTĂ PERSONALIZATĂ",
    coverFor: "Pregătită pentru",
    aboutTitle: "De ce Mobo?",
    aboutLead:
      "Proiectăm, producem și montăm mobilier la comandă pentru casa ta — de la bucătării premium la dressinguri și băi.",
    stat1t: "5 ani",
    stat1s: "garanție la toate bucătăriile și mobilierul",
    stat2t: "La comandă",
    stat2s: "fiecare proiect e proiectat milimetric pentru spațiul tău",
    stat3t: "Totul inclus",
    stat3s: "măsurare, proiectare 3D, producție, livrare și montaj",
    projectKicker: "PROIECT",
    specs: "Specificații",
    price: "Investiție",
    invTitle: "Rezumatul investiției",
    invProject: "Proiect",
    invRoom: "Cameră",
    invPrice: "Preț",
    invTotal: "TOTAL",
    stagesTitle: "Grafic de plăți în 3 etape",
    stage1: "Avans la semnarea contractului",
    stage2: "La confirmarea măsurărilor finale",
    stage3: "La livrare și montaj",
    nextTitle: "Următorii pași",
    next1: "Confirmăm împreună detaliile și semnăm contractul",
    next2: "Facem măsurările finale la tine acasă",
    next3: "Producem, livrăm și montăm — tu doar te bucuri de rezultat",
    thanks: "Mulțumim!",
    contactTitle: "Hai să construim împreună",
    validity: "Ofertă valabilă 30 de zile de la data prezentării.",
    coverTag: "Mobilier la comandă · proiectat, produs și montat de Mobo",
    offerNo: "Ofertă personalizată",
    secAbout: "Despre noi",
    secProcess: "Cum lucrăm",
    secIncluded: "Ce primești",
    secInvest: "Investiția",
    secPayments: "Plăți",
    badgeWarranty: "5 ani garanție",
    processTitle: "De la idee la montaj, în 5 pași",
    p1t: "Consultare și măsurare",
    p1s: "Venim la tine, măsurăm spațiul și înțelegem cum trăiești în el.",
    p2t: "Proiect 3D",
    p2s: "Îți vezi mobilierul în casa ta înainte să fie produs.",
    p3t: "Ofertă și contract",
    p3s: "Preț clar, fără costuri ascunse, termene asumate în scris.",
    p4t: "Producție",
    p4s: "Fabricăm la comandă, milimetric, pentru spațiul tău.",
    p5t: "Livrare și montaj",
    p5s: "Echipa noastră montează tot. Tu doar te bucuri de rezultat.",
    includedTitle: "Totul este inclus în preț",
    includedLead: "Un singur partener, de la prima schiță până la ultimul șurub.",
    i1t: "Măsurare la domiciliu",
    i1s: "Precizie milimetrică, fără surprize la montaj.",
    i2t: "Proiectare 3D",
    i2s: "Vezi și ajustezi totul înainte de producție.",
    i3t: "Producție la comandă",
    i3s: "Fiecare piesă e făcută pentru spațiul tău.",
    i4t: "Livrare",
    i4s: "Transport sigur până la tine acasă.",
    i5t: "Montaj profesionist",
    i5s: "Echipă proprie, lucru curat și la termen.",
    i6t: "Garanție 5 ani",
    i6s: "La toate bucătăriile și mobilierul.",
    noSpecs: "Detaliile tehnice le stabilim împreună, la consultare.",
    moreProjects: "alte proiecte",
    validUntil: "Ofertă valabilă până la",
    consultant: "Consultantul tău",
    scanSite: "Scanează și vezi portofoliul",
    ofTotal: "din total",
    secPortfolio: "Portofoliu",
    portfolioTitle: "Lucrări realizate de noi",
    portfolioLead: "Fiecare proiect pleacă de la felul în care trăiești tu — nu de la un catalog.",
    g1: "Living",
    g2: "Dressing",
    g3: "Dormitor",
    stageWord: "Etapa",
    alsoIncluded: "Inclus în acest proiect",
  },
  RU: {
    coverKicker: "ПРЕЗЕНТАЦИЯ ПРОЕКТА · ПЕРСОНАЛЬНОЕ ПРЕДЛОЖЕНИЕ",
    coverFor: "Подготовлено для",
    aboutTitle: "Почему Mobo?",
    aboutLead:
      "Мы проектируем, производим и устанавливаем мебель на заказ — от премиальных кухонь до гардеробных и ванных комнат.",
    stat1t: "5 лет",
    stat1s: "гарантии на все кухни и мебель",
    stat2t: "На заказ",
    stat2s: "каждый проект спроектирован точно под ваше пространство",
    stat3t: "Всё включено",
    stat3s: "замер, 3D-проект, производство, доставка и монтаж",
    projectKicker: "ПРОЕКТ",
    specs: "Спецификации",
    price: "Инвестиция",
    invTitle: "Итог инвестиции",
    invProject: "Проект",
    invRoom: "Комната",
    invPrice: "Цена",
    invTotal: "ИТОГО",
    stagesTitle: "График платежей в 3 этапа",
    stage1: "Аванс при подписании договора",
    stage2: "При подтверждении финальных замеров",
    stage3: "При доставке и монтаже",
    nextTitle: "Следующие шаги",
    next1: "Согласуем детали и подпишем договор",
    next2: "Сделаем финальные замеры у вас дома",
    next3: "Производим, доставляем и монтируем — вы наслаждаетесь результатом",
    thanks: "Спасибо!",
    contactTitle: "Давайте строить вместе",
    validity: "Предложение действительно 30 дней с даты презентации.",
    coverTag: "Мебель на заказ · проектируем, производим и устанавливаем",
    offerNo: "Персональное предложение",
    secAbout: "О нас",
    secProcess: "Как мы работаем",
    secIncluded: "Что вы получаете",
    secInvest: "Инвестиция",
    secPayments: "Платежи",
    badgeWarranty: "5 лет гарантии",
    processTitle: "От идеи до монтажа за 5 шагов",
    p1t: "Консультация и замер",
    p1s: "Приезжаем к вам, замеряем пространство и узнаём, как вы в нём живёте.",
    p2t: "3D-проект",
    p2s: "Вы видите мебель в своём доме ещё до производства.",
    p3t: "Предложение и договор",
    p3s: "Понятная цена без скрытых расходов, сроки закреплены письменно.",
    p4t: "Производство",
    p4s: "Изготавливаем на заказ, с точностью до миллиметра.",
    p5t: "Доставка и монтаж",
    p5s: "Наша команда всё установит. Вам остаётся наслаждаться результатом.",
    includedTitle: "Всё включено в стоимость",
    includedLead: "Один партнёр — от первого эскиза до последнего винта.",
    i1t: "Замер на дому",
    i1s: "Миллиметровая точность, без сюрпризов при монтаже.",
    i2t: "3D-проектирование",
    i2s: "Смотрите и корректируйте всё до производства.",
    i3t: "Производство на заказ",
    i3s: "Каждая деталь сделана под ваше пространство.",
    i4t: "Доставка",
    i4s: "Бережная перевозка до вашего дома.",
    i5t: "Профессиональный монтаж",
    i5s: "Своя команда, чистая работа и точно в срок.",
    i6t: "Гарантия 5 лет",
    i6s: "На все кухни и мебель.",
    noSpecs: "Технические детали определим вместе на консультации.",
    moreProjects: "других проектов",
    validUntil: "Предложение действительно до",
    consultant: "Ваш консультант",
    scanSite: "Отсканируйте и посмотрите портфолио",
    ofTotal: "от суммы",
    secPortfolio: "Портфолио",
    portfolioTitle: "Наши реализованные проекты",
    portfolioLead: "Каждый проект начинается с того, как живёте вы, — а не с каталога.",
    g1: "Гостиная",
    g2: "Гардеробная",
    g3: "Спальня",
    stageWord: "Этап",
    alsoIncluded: "Включено в этот проект",
  },
};

// aceeași scriere a sumei ca în aplicație, în ofertă și în contract: „2.877,45 € (57.879,00 lei)”
export const money = (eur: number, mdl: number) => fmtEurLei(eur, mdl);
