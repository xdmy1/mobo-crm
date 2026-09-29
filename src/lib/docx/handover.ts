// Proces-verbal Predat/Preluat (DOCX, RO/RU) — pachetul `docx`.

import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { fmtDate } from "@/lib/format";
import type { Lang } from "@/lib/pdf/texts";

const L: Record<Lang, Record<string, string>> = {
  RO: {
    title: "PROCES-VERBAL DE PREDARE-PRIMIRE",
    intro:
      "Prezentul proces-verbal este încheiat între Executant și Beneficiar privind predarea-primirea mobilierului executat la comandă.",
    client: "Beneficiar",
    idnp: "IDNP",
    room: "Camera",
    projects: "Proiecte predate",
    date: "Data",
    declaration:
      "Beneficiarul confirmă recepționarea mobilierului în stare bună, complet și fără defecte vizibile. Eventualele observații se consemnează mai jos.",
    remarks: "Observații: ____________________________________________",
    handedBy: "Predat (Executant)",
    receivedBy: "Preluat (Beneficiar)",
    signature: "Semnătura",
  },
  RU: {
    title: "АКТ ПРИЁМА-ПЕРЕДАЧИ",
    intro:
      "Настоящий акт составлен между Исполнителем и Заказчиком о приёме-передаче мебели, изготовленной на заказ.",
    client: "Заказчик",
    idnp: "IDNP",
    room: "Комната",
    projects: "Переданные проекты",
    date: "Дата",
    declaration:
      "Заказчик подтверждает приём мебели в хорошем состоянии, в полном комплекте и без видимых дефектов. Замечания указываются ниже.",
    remarks: "Замечания: ____________________________________________",
    handedBy: "Передал (Исполнитель)",
    receivedBy: "Принял (Заказчик)",
    signature: "Подпись",
  },
};

export interface HandoverData {
  lang: Lang;
  orgName: string;
  clientName: string;
  idnp: string;
  roomName: string;
  projects: string[];
  /** Semnătura clientului de pe tabletă (PNG) [NOU] */
  signaturePng?: Buffer | null;
}

export async function generateHandoverDocx(d: HandoverData): Promise<Buffer> {
  const t = L[d.lang];
  const p = (text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      alignment: opts.align,
      spacing: { after: 160 },
      children: [
        new TextRun({ text, bold: opts.bold, size: (opts.size ?? 11) * 2 }),
      ],
    });

  const infoRow = (k: string, v: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [p(k, { bold: true })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [p(v)],
        }),
      ],
    });

  const docx = new Document({
    sections: [
      {
        children: [
          p(d.orgName, { bold: true, size: 14 }),
          p(t.title, { bold: true, size: 13, align: AlignmentType.CENTER }),
          p(`${t.date}: ${fmtDate(new Date())}`, { align: AlignmentType.CENTER }),
          p(t.intro),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow(t.client, d.clientName),
              infoRow(t.idnp, d.idnp),
              infoRow(t.room, d.roomName),
              infoRow(t.projects, d.projects.join(", ") || "—"),
            ],
          }),
          p(""),
          p(t.declaration),
          p(t.remarks),
          p(""),
          p(""),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      p(t.handedBy, { bold: true }),
                      p(`${t.signature}: ______________`),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      p(t.receivedBy, { bold: true }),
                      ...(d.signaturePng
                        ? [
                            new Paragraph({
                              children: [
                                new ImageRun({
                                  type: "png",
                                  data: d.signaturePng,
                                  transformation: { width: 180, height: 70 },
                                }),
                              ],
                            }),
                          ]
                        : [p(`${t.signature}: ______________`)]),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(docx) as Promise<Buffer>;
}
