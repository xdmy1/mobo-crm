/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATALOG } from "../src/lib/calc/catalog";

const prisma = new PrismaClient();

const PERMISSION_MODULES = [
  "contact",
  "company",
  "opportunity",
  "quote",
  "product",
  "productCategory",
  "contract",
  "offer",
  "note",
  "attachment",
  "task",
  "email",
  "dashboard",
  "finances",
  "calendar",
  "staff",
  "role",
  "permission",
  "rolePermission",
  "account",
  "transaction",
  "room",
  "setup",
  "calcSettings",
  "notification",
  "announcement",
  "award",
  "organization",
];
const PERMISSION_ACTIONS = ["create", "readAll", "readSingle", "update", "delete"];

async function main() {
  console.log("Seeding MOBO CRM…");

  // ── Permisiuni ──
  const permNames: string[] = [];
  for (const m of PERMISSION_MODULES)
    for (const a of PERMISSION_ACTIONS) permNames.push(`${a}-${m}`);
  for (const name of permNames) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }
  const allPerms = await prisma.permission.findMany();
  const permByName = new Map(allPerms.map((p) => [p.name, p.id]));

  // ── Roluri ──
  const roleNames = [
    "admin",
    "Administrator",
    "Manager Operațional",
    "Manager Vânzări",
    "Designer",
    "Manager Producere",
    "Quality Control",
    "Tehnician Prețuri",
    "Operator Producere",
    "Contabil",
  ];
  const roles: Record<string, number> = {};
  for (const name of roleNames) {
    const r = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roles[name] = r.id;
  }

  const grant = async (roleName: string, perms: string[]) => {
    const roleId = roles[roleName];
    for (const p of perms) {
      const pid = permByName.get(p);
      if (!pid) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: pid } },
        update: {},
        create: { roleId, permissionId: pid },
      });
    }
  };
  const modulePerms = (mods: string[], actions = PERMISSION_ACTIONS) =>
    mods.flatMap((m) => actions.map((a) => `${a}-${m}`));

  await grant("admin", permNames);
  await grant("Administrator", permNames);
  await grant(
    "Manager Operațional",
    modulePerms([
      "contact","company","opportunity","quote","product","contract","offer","note",
      "attachment","task","email","dashboard","finances","calendar","room","notification",
    ])
  );
  await grant(
    "Manager Vânzări",
    modulePerms(
      ["contact","company","opportunity","quote","contract","offer","note","attachment","task","email","dashboard","calendar","room","notification"],
      ["create", "readAll", "readSingle", "update"]
    )
  );
  await grant(
    "Designer",
    modulePerms(["contact","opportunity","quote","note","attachment","task","calendar","room","notification"], ["create","readAll","readSingle","update"])
  );
  await grant(
    "Manager Producere",
    modulePerms(["opportunity","contact","note","attachment","task","calendar","room","notification","dashboard"], ["create","readAll","readSingle","update"])
  );
  await grant("Quality Control", modulePerms(["opportunity","task","note","attachment","calendar","notification"], ["readAll","readSingle","update","create"]));
  await grant("Tehnician Prețuri", modulePerms(["quote","product","productCategory","calcSettings","calendar","notification"], ["create","readAll","readSingle","update"]));
  await grant("Operator Producere", modulePerms(["opportunity","task","note","calendar","notification"], ["readAll","readSingle","update"]));
  await grant(
    "Contabil",
    modulePerms(["finances","account","transaction","contract","dashboard","contact","company","calendar","notification"], ["create","readAll","readSingle","update"])
  );

  // ── Departamente / Desemnări / Statute / Schimburi ──
  const seedSimple = async (model: "department" | "designation" | "employmentStatus" | "shift", names: string[]) => {
    for (const name of names) {
      const existing = await (prisma[model] as any).findFirst({ where: { name } });
      if (!existing) await (prisma[model] as any).create({ data: { name } });
    }
  };
  await seedSimple("department", ["Vânzări", "Producere", "Design", "Contabilitate", "Administrare"]);
  await seedSimple("designation", ["Manager", "Designer", "Operator", "Contabil", "Director"]);
  await seedSimple("employmentStatus", ["Activ", "Concediu", "Suspendat", "Plecat"]);
  await seedSimple("shift", ["Schimbul 1 (08–17)", "Schimbul 2 (10–19)"]);

  const dept = await prisma.department.findFirst({ where: { name: "Administrare" } });

  // ── Utilizatori ──
  const pass = await bcrypt.hash("admin123", 10);
  const users: Array<[string, string, string, string]> = [
    ["admin", "Administrator", "general", "admin"],
    ["stoian.iurii", "Stoian", "Iurii", "Administrator"],
    ["manager.vanzari", "Manager", "Vânzări", "Manager Vânzări"],
    ["producere", "Producere", "Producere", "Manager Producere"],
    ["analiza", "Analiză", "Statistică", "Quality Control"],
    ["producere1", "Producere", "Nr. 1", "Operator Producere"],
    ["contabil", "Contabil", "Contabil", "Contabil"],
    ["designer.corina", "Designer", "Corina", "Designer"],
  ];
  for (const [username, firstName, lastName, roleName] of users) {
    await prisma.staff.upsert({
      where: { username },
      update: {},
      create: {
        username,
        firstName,
        lastName,
        passwordHash: pass,
        roleId: roles[roleName],
        departmentId: dept?.id,
        email: `${username}@mobo.md`,
        joinDate: new Date("2024-01-15"),
        active: true,
      },
    });
  }
  const admin = await prisma.staff.findUnique({ where: { username: "admin" } });
  const managerV = await prisma.staff.findUnique({ where: { username: "manager.vanzari" } });

  // ── Etape client (vânzări) — cu reguli de tranziție ──
  const contactStages: Array<[string, Partial<{ requireContract: boolean; require2D: boolean; require3D: boolean; requireFailureCause: boolean; notifyOnEnter: boolean }>]> = [
    ["Lead", {}],
    ["Apelat", {}],
    ["Măsurare", {}],
    ["Proiectare", {}],
    ["Calcule", {}],
    ["Prezentare", { notifyOnEnter: true }],
    ["Contractat", { requireContract: true, require2D: true, require3D: true }],
    ["Predat Producere", { requireContract: true, require2D: true, require3D: true }],
    ["Eșuat", { requireFailureCause: true }],
    ["Concretizări", {}],
  ];
  for (let i = 0; i < contactStages.length; i++) {
    const [name, flags] = contactStages[i];
    const existing = await prisma.contactStage.findFirst({ where: { name } });
    if (!existing)
      await prisma.contactStage.create({ data: { name, order: i, ...flags } });
  }

  // ── Etape proiect (producție) ──
  const oppStages = [
    "Predat Producere","Preluat Producere","Concretizări","Măsurări Finale","Asamblare",
    "Livrare","Montare","Finisat","Garanție","Asistență Juridică",
  ];
  for (let i = 0; i < oppStages.length; i++) {
    const existing = await prisma.opportunityStage.findFirst({ where: { name: oppStages[i] } });
    if (!existing)
      await prisma.opportunityStage.create({
        data: {
          name: oppStages[i],
          order: i,
          phase: i < 5 ? "producție" : i < 7 ? "logistică" : "post-vânzare",
        },
      });
  }

  // ── Surse client (cu cod pentru ID-ul uman), în ordinea din liste ──
  // codurile 05 (Tik-tok) și 08 (Recomandare Internă) au fost retrase pe 06.10.2026 — nu le refolosi
  const sources: Array<[string, string]> = [
    ["Site", "01"],
    ["Apel direct", "02"],
    ["Showroom", "09"],
    ["Instagram", "03"],
    ["Facebook", "04"],
    ["Partener", "07"],
    ["Recomandare", "06"],
  ];
  for (const [i, [name, code]] of sources.entries()) {
    const existing = await prisma.contactSource.findFirst({ where: { name } });
    if (!existing) await prisma.contactSource.create({ data: { name, code, order: i + 1 } });
  }

  // ── Cauzele eșecului ──
  for (const name of ["Eșuat", "Nu se încadrează în buget", "Nu i-a plăcut"]) {
    const existing = await prisma.failureCause.findFirst({ where: { name } });
    if (!existing) await prisma.failureCause.create({ data: { name } });
  }

  // ── Succesiune producție ──
  {
    const existing = await prisma.productionSequence.findFirst({ where: { name: "Producție" } });
    if (!existing) await prisma.productionSequence.create({ data: { name: "Producție" } });
  }

  // ── Nomenclator camere + elemente ──
  const roomTypes: Array<[string, string[]]> = [
    ["Default", []],
    ["Cameră Bucătărie", ["Bucătărie","Insulă","Masă","Scaune","Tv Set","Blat","Brâu","Canapea","Vitrină","Dulap Centrală"]],
    ["Cameră Living", ["Canapea","Pat","Masă","Scaune","Masă machiaj","Puf","Oglindă","Vitrină","Dulap","Masă cafea"]],
    ["Cameră Dormitor", ["Dormitor","Dulap","Noptieră","Masă","Comod","Panou"]],
    ["Cameră Dormitor Matrimonial", ["Dormitor","Noptieră","Dulap","Tv Set","Panou","Comod","Masă Machiaj","Oglindă"]],
    ["Cameră Baie", ["Dulap Lavoar","Oglindă","Blat","Dulap M.S.R","Dulap M.U.R","Dulap","Dulap WC"]],
    ["Cameră Baie Oaspeți", ["Lavoar","Dulap WC","Oglindă","Consolă"]],
    ["Cameră Garderobă", ["Dulap","Garderob","Comod","Oglindă","Masă Machiaj","Puf"]],
    ["Cameră Antreu", ["Oglindă","Puf","Consolă","Oglindă cu consolă"]],
    ["Cameră Balcon", ["Dulap","Mini bucătărie","Dulap M.S.R","Puf","Consolă","Oglindă"]],
    ["Cameră Birou", ["Dulap","Masă","Oglindă","Canapea","Panou","Puf"]],
  ];
  for (const [name, elements] of roomTypes) {
    const existing = await prisma.roomType.findFirst({ where: { name } });
    if (!existing) await prisma.roomType.create({ data: { name, elements } });
  }

  // ── Tipuri / surse proiect, etape estimare ──
  for (const name of ["Bucătărie la comandă", "Dulap", "Garderobă", "Mobilier living", "Piese mici"]) {
    const existing = await prisma.opportunityType.findFirst({ where: { name } });
    if (!existing) await prisma.opportunityType.create({ data: { name } });
  }
  for (const name of ["Estimare din Calculator", "Cerere de pe site", "Vânzare directă", "Recomandare"]) {
    const existing = await prisma.opportunitySource.findFirst({ where: { name } });
    if (!existing) await prisma.opportunitySource.create({ data: { name } });
  }
  for (const name of ["Nouă", "Trimisă", "Acceptată", "Respinsă"]) {
    const existing = await prisma.quoteStage.findFirst({ where: { name } });
    if (!existing) await prisma.quoteStage.create({ data: { name } });
  }

  // ── Sarcini: tip / stare / prioritate ──
  for (const name of ["Todo", "Apel", "Măsurare", "Livrare"]) {
    const existing = await prisma.taskType.findFirst({ where: { name } });
    if (!existing) await prisma.taskType.create({ data: { name } });
  }
  for (const name of ["todo", "in progress", "done"]) {
    const existing = await prisma.taskStatus.findFirst({ where: { name } });
    if (!existing) await prisma.taskStatus.create({ data: { name } });
  }
  for (const name of ["low", "medium", "high"]) {
    const existing = await prisma.taskPriority.findFirst({ where: { name } });
    if (!existing) await prisma.taskPriority.create({ data: { name } });
  }

  // ── Persoane juridice: tip & industrie ──
  for (const name of ["Private", "Public", "ONG"]) {
    const existing = await prisma.companyType.findFirst({ where: { name } });
    if (!existing) await prisma.companyType.create({ data: { name } });
  }
  for (const name of ["Automotive", "Construcții", "HoReCa", "IT", "Retail", "Imobiliare"]) {
    const existing = await prisma.industry.findFirst({ where: { name } });
    if (!existing) await prisma.industry.create({ data: { name } });
  }

  // ── Categorii produse + produse ──
  const categories = ["Fronturi","Carcasă","Brâu","Blat","Decor","Accesorii Furnitură","Sticlă–Oglindă","Servicii"];
  const catIds: Record<string, number> = {};
  for (const name of categories) {
    let c = await prisma.productCategory.findFirst({ where: { name } });
    if (!c) c = await prisma.productCategory.create({ data: { name } });
    catIds[name] = c.id;
  }
  const products: Array<[string, string, "M2" | "ML" | "BUC", number, string]> = [
    ["Front MDF vopsit mat", "MDF", "M2", 1800, "Fronturi"],
    ["Front MDF vopsit lucios", "MDF", "M2", 2040, "Fronturi"],
    ["Front AGT 1P", "AGT", "M2", 650, "Fronturi"],
    ["Front AGT 2P", "AGT", "M2", 750, "Fronturi"],
    ["Front PAL Egger", "PAL", "M2", 250, "Fronturi"],
    ["Front Furnir stejar", "Furnir", "M2", 2800, "Fronturi"],
    ["Front Furnir 2P nuc", "Furnir", "M2", 3200, "Fronturi"],
    ["Front riflat frezat", "Riflat", "M2", 3600, "Fronturi"],
    ["Corp PAL Egger 18mm Alb", "PAL Egger", "M2", 220, "Carcasă"],
    ["Corp PAL Egger 18mm Color", "PAL Egger", "M2", 260, "Carcasă"],
    ["Corp PAL Egger 18mm Lemn", "PAL Egger", "M2", 300, "Carcasă"],
    ["Corp PAL Krono 18mm Alb", "PAL Krono", "M2", 180, "Carcasă"],
    ["Corp PAL Krono 18mm Color", "PAL Krono", "M2", 210, "Carcasă"],
    ["Brâu aluminiu", "Aluminiu", "ML", 320, "Brâu"],
    ["Brâu MDF", "MDF", "ML", 260, "Brâu"],
    ["Blat PAL Egger 38mm", "PAL", "M2", 850, "Blat"],
    ["Blat HPL Negru", "HPL", "M2", 1450, "Blat"],
    ["Blat HPL Alb", "HPL", "M2", 1450, "Blat"],
    ["Panou decorativ riflat", "Decor", "M2", 1900, "Decor"],
    ["Bandă LED profil aluminiu", "Iluminare", "ML", 210, "Decor"],
    ["Sertar Blum LEGRABOX metal", "Blum", "BUC", 1100, "Accesorii Furnitură"],
    ["Sertar Blum TANDEMBOX lemn", "Blum", "BUC", 380, "Accesorii Furnitură"],
    ["Sertar Hettich AvanTech metal", "Hettich", "BUC", 750, "Accesorii Furnitură"],
    ["Sertar Hettich lemn", "Hettich", "BUC", 350, "Accesorii Furnitură"],
    ["Aventos HK-XS", "Blum", "BUC", 400, "Accesorii Furnitură"],
    ["Piston gaz", "Blum", "BUC", 2100, "Accesorii Furnitură"],
    ["Balama Blum ClipTop", "Blum", "BUC", 45, "Accesorii Furnitură"],
    ["Mecanism colț Kessebohmer 450", "Kessebohmer", "BUC", 5200, "Accesorii Furnitură"],
    ["Mecanism colț Kessebohmer 600", "Kessebohmer", "BUC", 5900, "Accesorii Furnitură"],
    ["Organizator încălțăminte 8", "Kessebohmer", "BUC", 6100, "Accesorii Furnitură"],
    ["Organizator încălțăminte 12", "Kessebohmer", "BUC", 7050, "Accesorii Furnitură"],
    ["Organizator pantaloni 600", "Kessebohmer", "BUC", 2300, "Accesorii Furnitură"],
    ["Organizator pantaloni 800", "Kessebohmer", "BUC", 2650, "Accesorii Furnitură"],
    ["Organizator pantaloni 900", "Kessebohmer", "BUC", 3000, "Accesorii Furnitură"],
    ["Sticlă simplă 4mm", "Sticlă", "M2", 950, "Sticlă–Oglindă"],
    ["Sticlă Diamond", "Sticlă", "M2", 1400, "Sticlă–Oglindă"],
    ["Sticlă tonată", "Sticlă", "M2", 1200, "Sticlă–Oglindă"],
    ["Oglindă simplă", "Oglindă", "M2", 780, "Sticlă–Oglindă"],
    ["Oglindă Diamond", "Oglindă", "M2", 1250, "Sticlă–Oglindă"],
    ["Oglindă tonată", "Oglindă", "M2", 1100, "Sticlă–Oglindă"],
    ["Măsurare la domiciliu", "Serviciu", "BUC", 0, "Servicii"],
    ["Livrare Chișinău", "Serviciu", "BUC", 500, "Servicii"],
    ["Montare bucătărie", "Serviciu", "BUC", 2500, "Servicii"],
    ["Proiectare 3D", "Serviciu", "BUC", 1500, "Servicii"],
  ];
  for (const [name, subcategory, unit, price, cat] of products) {
    const existing = await prisma.product.findFirst({ where: { name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          name,
          subcategory,
          unit,
          pricePerUnit: price,
          categories: { create: [{ categoryId: catIds[cat] }] },
        },
      });
    }
  }

  // ── Plan de conturi ──
  const accounts: Array<[string, "ASSET" | "LIABILITY" | "CAPITAL" | "WITHDRAWAL" | "REVENUE" | "EXPENSE"]> = [
    ["Cash", "ASSET"],["Bank", "ASSET"],["Inventory", "ASSET"],["Accounts Receivable", "ASSET"],
    ["Accounts Payable", "LIABILITY"],["Capital", "CAPITAL"],["Withdrawal", "WITHDRAWAL"],
    ["Sales", "REVENUE"],["Cost of Sales", "EXPENSE"],["Salary", "EXPENSE"],["Rent", "EXPENSE"],
    ["Utilities", "EXPENSE"],["Discount Earned", "REVENUE"],["Discount Given", "EXPENSE"],
  ];
  for (const [name, type] of accounts) {
    const existing = await prisma.account.findFirst({ where: { name } });
    if (!existing) await prisma.account.create({ data: { name, type } });
  }

  // ── Organizație + Config Email + Catalog calcule ──
  await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Mobo kitchens & home",
      idno: "1020600012345",
      address: "str. Uzinelor 1, Chișinău, Moldova",
      phone: "+373 69 000 000",
      email: "info@mobo.md",
      partnerPercent: 10,
      designerPercent: 5,
      qcDefault: 1200,
    },
  });
  await prisma.emailConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  {
    const existing = await prisma.calcCatalog.findFirst({ where: { active: true } });
    if (!existing) {
      await prisma.calcCatalog.create({
        data: { active: true, data: DEFAULT_CATALOG as object },
      });
    }
  }

  // ── Parteneri / Designeri / Anunțuri / Premii ──
  for (const [name, pct] of [["Partener Imobiliare MD", 10], ["Studio Arhitect", 10]] as Array<[string, number]>) {
    const existing = await prisma.partner.findFirst({ where: { name } });
    if (!existing) await prisma.partner.create({ data: { name, commissionPercent: pct } });
  }
  for (const [name, pct] of [["Designer Corina", 5], ["Design Extern SRL", 5]] as Array<[string, number]>) {
    const existing = await prisma.designerPartner.findFirst({ where: { name } });
    if (!existing) await prisma.designerPartner.create({ data: { name, commissionPercent: pct } });
  }
  {
    const existing = await prisma.announcement.findFirst();
    if (!existing) {
      await prisma.announcement.create({
        data: {
          title: "Bun venit în MOBO CRM",
          body: "Noua versiune a CRM-ului este activă. Verificați Setup → Setări de Calcule pentru catalogul de prețuri.",
        },
      });
    }
  }
  {
    const existing = await prisma.award.findFirst();
    if (!existing)
      await prisma.award.create({ data: { name: "Angajatul lunii", description: "Premiu lunar pentru performanță" } });
  }

  // ── Clienți demo ──
  const stageByName = async (name: string) =>
    (await prisma.contactStage.findFirst({ where: { name } }))!.id;
  const srcByName = async (name: string) =>
    (await prisma.contactSource.findFirst({ where: { name } }))!.id;
  const roomTypeByName = async (name: string) =>
    (await prisma.roomType.findFirst({ where: { name } }))!.id;
  const oppStageByName = async (name: string) =>
    (await prisma.opportunityStage.findFirst({ where: { name } }))!.id;

  const demoContacts = [
    { first: "Mobo", last: "Kitchens", phone: "+37369556615", email: "client1@mail.md", stage: "Lead", source: "Site" },
    { first: "Dorin", last: "Testescu", phone: "+37369111222", email: "dorin@mail.md", stage: "Prezentare", source: "Instagram" },
    { first: "Ana", last: "Popescu", phone: "+37378333444", email: "ana.popescu@mail.md", stage: "Măsurare", source: "Facebook" },
    { first: "Ion", last: "Rusu", phone: "+37360555666", email: "ion.rusu@mail.md", stage: "Contractat", source: "Recomandare" },
    { first: "Stoian", last: "Iurii", phone: "+37369777888", email: "stoian@mail.md", stage: "Predat Producere", source: "Apel direct" },
  ];

  const contactsExist = await prisma.contact.count();
  if (contactsExist === 0) {
    for (const d of demoContacts) {
      const sourceId = await srcByName(d.source);
      // ID-ul vizibil (1, 2, 3…) îl dă baza, din secvență
      const stageId = await stageByName(d.stage);
      const contact = await prisma.contact.create({
        data: {
          firstName: d.first,
          lastName: d.last,
          phone: d.phone,
          email: d.email,
          stageId,
          sourceId,
          staffId: managerV?.id ?? admin?.id,
          stageHistory: { create: { stageId } },
        },
      });

      // camere + proiecte
      const defaultRoom = await prisma.room.create({
        data: { name: "Default", contactId: contact.id, roomTypeId: await roomTypeByName("Default") },
      });
      const kitchenRoom = await prisma.room.create({
        data: { name: "Cameră Bucătărie", contactId: contact.id, roomTypeId: await roomTypeByName("Cameră Bucătărie") },
      });

      const opp = await prisma.opportunity.create({
        data: {
          name: d.stage === "Lead" ? "Estimare din Calculator" : `Bucătărie ${d.last}`,
          roomId: kitchenRoom.id,
          contactId: contact.id,
          staffId: managerV?.id ?? admin?.id,
          startDate: new Date(),
          closeDate: new Date(Date.now() + 45 * 86400000),
          stageId:
            d.stage === "Predat Producere"
              ? await oppStageByName("Predat Producere")
              : d.stage === "Contractat"
                ? await oppStageByName("Preluat Producere")
                : null,
          onProductionBoard: d.stage === "Predat Producere" || d.stage === "Contractat",
          deliveryDate: d.stage === "Predat Producere" ? new Date(Date.now() + 20 * 86400000) : null,
          sourceId: (await prisma.opportunitySource.findFirst({ where: { name: "Estimare din Calculator" } }))?.id,
          typeId: (await prisma.opportunityType.findFirst({ where: { name: "Bucătărie la comandă" } }))?.id,
        },
      });
      if (opp.stageId) {
        await prisma.opportunityStageHistory.create({
          data: { opportunityId: opp.id, stageId: opp.stageId },
        });
      }
      void defaultRoom;
    }
    console.log("Demo contacts created.");
  }

  console.log("Seed complet. Login: admin / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
