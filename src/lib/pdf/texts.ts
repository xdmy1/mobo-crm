// Textele documentelor în RO și RU.

export type Lang = "RO" | "RU";

export const T: Record<Lang, Record<string, string>> = {
  RO: {
    contractTitle: "CONTRACT DE EXECUTARE A MOBILIERULUI LA COMANDĂ",
    contractNo: "Nr.",
    date: "Data",
    client: "Client",
    company: "Persoană juridică",
    executor: "Executant",
    idnp: "IDNP",
    idno: "IDNO",
    address: "Adresa",
    phone: "Telefon",
    object: "1. OBIECTUL CONTRACTULUI",
    objectText:
      "Executantul se obligă să proiecteze, să producă, să livreze și să monteze mobilierul la comandă conform anexelor la prezentul contract, iar Beneficiarul se obligă să recepționeze și să achite lucrările în condițiile stabilite mai jos.",
    priceTitle: "2. PREȚUL CONTRACTULUI ȘI MODALITATEA DE PLATĂ",
    priceText:
      "Valoarea totală a contractului constituie {price} EUR (echivalentul în MDL la cursul BNM din ziua plății). Avansul se achită la semnarea contractului, iar restul conform graficului de plăți convenit de părți.",
    guaranteeTitle: "3. GARANȚII",
    guaranteeText:
      "Garanția financiară constituie {guarantee}% din valoarea contractului. Procentele beneficiarului constituie {beneficiary}%. Termenul de garanție pentru mobilier este de 5 ani de la data semnării procesului-verbal de predare-primire.",
    termsTitle: "4. TERMENE DE EXECUȚIE",
    termsText:
      "Termenul de execuție se calculează de la data achitării avansului și confirmării măsurărilor finale. Livrarea și montarea se efectuează la adresa indicată de Beneficiar.",
    annexTitle: "ANEXĂ — CAMERE ȘI PROIECTE INCLUSE",
    room: "Cameră",
    project: "Proiect",
    sum: "Sumă",
    signatures: "SEMNĂTURILE PĂRȚILOR",
    sigExecutor: "Executant",
    sigClient: "Beneficiar",
    offerTitle: "OFERTĂ COMERCIALĂ",
    offerFor: "Pentru",
    offerRoom: "Cameră",
    offerIntro:
      "Vă mulțumim pentru interesul acordat! Mai jos găsiți oferta noastră pentru mobilierul la comandă.",
    stagePrices: "Grafic de plăți pe etape",
    stageAdvance: "Avans la semnarea contractului (50%)",
    stageMeasure: "La măsurările finale (30%)",
    stageDelivery: "La livrare și montare (20%)",
    total: "TOTAL",
    quoteTitle: "ESTIMARE TEHNICĂ",
    validUntil: "Valabilă până la",
    component: "Componentă",
    details: "Detalii",
    cost: "Cost (MDL)",
    minPrice: "Preț minim (cost producție)",
    offerPrice: "Preț de ofertare",
    discount: "Reducere",
    totalAfter: "Total după reducere",
    generatedBy: "Generat de MOBO CRM",
  },
  RU: {
    contractTitle: "ДОГОВОР НА ИЗГОТОВЛЕНИЕ МЕБЕЛИ НА ЗАКАЗ",
    contractNo: "№",
    date: "Дата",
    client: "Клиент",
    company: "Юридическое лицо",
    executor: "Исполнитель",
    idnp: "IDNP",
    idno: "IDNO",
    address: "Адрес",
    phone: "Телефон",
    object: "1. ПРЕДМЕТ ДОГОВОРА",
    objectText:
      "Исполнитель обязуется спроектировать, изготовить, доставить и установить мебель на заказ согласно приложениям к настоящему договору, а Заказчик обязуется принять и оплатить работы на условиях, установленных ниже.",
    priceTitle: "2. ЦЕНА ДОГОВОРА И ПОРЯДОК ОПЛАТЫ",
    priceText:
      "Общая стоимость договора составляет {price} EUR (эквивалент в MDL по курсу НБМ на день оплаты). Аванс оплачивается при подписании договора, остальное — согласно согласованному графику платежей.",
    guaranteeTitle: "3. ГАРАНТИИ",
    guaranteeText:
      "Финансовая гарантия составляет {guarantee}% от стоимости договора. Процент заказчика составляет {beneficiary}%. Гарантийный срок на мебель — 5 лет с даты подписания акта приёма-передачи.",
    termsTitle: "4. СРОКИ ИСПОЛНЕНИЯ",
    termsText:
      "Срок исполнения исчисляется с даты оплаты аванса и подтверждения финальных замеров. Доставка и монтаж осуществляются по адресу, указанному Заказчиком.",
    annexTitle: "ПРИЛОЖЕНИЕ — КОМНАТЫ И ПРОЕКТЫ",
    room: "Комната",
    project: "Проект",
    sum: "Сумма",
    signatures: "ПОДПИСИ СТОРОН",
    sigExecutor: "Исполнитель",
    sigClient: "Заказчик",
    offerTitle: "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ",
    offerFor: "Для",
    offerRoom: "Комната",
    offerIntro:
      "Благодарим за проявленный интерес! Ниже наше предложение на мебель на заказ.",
    stagePrices: "График платежей по этапам",
    stageAdvance: "Аванс при подписании договора (50%)",
    stageMeasure: "При финальных замерах (30%)",
    stageDelivery: "При доставке и монтаже (20%)",
    total: "ИТОГО",
    quoteTitle: "ТЕХНИЧЕСКАЯ СМЕТА",
    validUntil: "Действительна до",
    component: "Компонент",
    details: "Детали",
    cost: "Стоимость (MDL)",
    minPrice: "Минимальная цена (себестоимость)",
    offerPrice: "Цена предложения",
    discount: "Скидка",
    totalAfter: "Итого со скидкой",
    generatedBy: "Сгенерировано MOBO CRM",
  },
};

export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
