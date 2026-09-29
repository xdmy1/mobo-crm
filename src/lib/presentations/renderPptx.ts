// Randarea scenei în PPTX (pptxgenjs) + ce nu știe pptxgenjs: tranziții între slide-uri și
// animații de intrare. Acestea se adaugă direct în XML-ul fișierului, după generare.
//
// Animațiile pornesc singure când apare slide-ul (nu cer click pentru fiecare element):
// prezentatorul apasă o dată → slide-ul „se așază” în cascadă, ca într-un film scurt.

import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { prepareImage, rasterizeSvg, type PreparedImage } from "./assets";
import { imageSize } from "./renderPdf";
import { SH, SW, type Deck, type Node, type Slide, type Weight } from "./scene";

// Helvetica Neue există pe orice Mac (Keynote / PowerPoint); pe Windows PowerPoint o înlocuiește
// cu Arial, care are aceleași proporții — macheta rămâne pe loc. (PDF-ul are fontul încorporat.)
const FACE: Record<Weight, { face: string; bold: boolean }> = {
  light: { face: "Helvetica Neue Light", bold: false },
  regular: { face: "Helvetica Neue", bold: false },
  medium: { face: "Helvetica Neue Medium", bold: false },
  semibold: { face: "Helvetica Neue", bold: true },
  bold: { face: "Helvetica Neue", bold: true },
};

const dataUri = (img: PreparedImage) => `${img.mime};base64,${img.data.toString("base64")}`;

interface AnimTarget {
  name: string;
  order: number;
  fx: "rise" | "fade" | "wipe";
}

async function addNode(s: PptxGenJS.Slide, n: Node, name: string) {
  const box = { x: n.x, y: n.y, w: n.w, h: n.h, objectName: name };
  switch (n.t) {
    case "rect":
      s.addShape(n.radius ? "roundRect" : "rect", {
        ...box,
        rectRadius: n.radius,
        fill: n.fill
          ? { color: n.fill, transparency: n.opacity != null ? Math.round((1 - n.opacity) * 100) : 0 }
          : { type: "none" },
        line: n.stroke ? { color: n.stroke, width: n.strokeW ?? 1 } : { type: "none" },
      });
      break;
    case "ellipse":
      s.addShape("ellipse", {
        ...box,
        fill: n.fill ? { color: n.fill } : { type: "none" },
        line: n.stroke ? { color: n.stroke, width: n.strokeW ?? 1 } : { type: "none" },
      });
      break;
    case "line":
      s.addShape("line", {
        ...box,
        line: { color: n.color, width: n.width ?? 1, transparency: n.color === "FFFFFF" ? 78 : 0 },
      });
      break;
    case "text": {
      const base = FACE[n.weight ?? "regular"];
      const runs = typeof n.text === "string" ? [{ text: n.text }] : n.text;
      s.addText(
        runs.map((r) => {
          const f = r.weight ? FACE[r.weight] : base;
          return {
            text: r.text,
            options: { color: r.color ?? n.color, fontFace: f.face, bold: f.bold, breakLine: !!r.br },
          };
        }),
        {
          ...box,
          fontFace: base.face,
          bold: base.bold,
          fontSize: n.size,
          color: n.color,
          align: n.align ?? "left",
          valign: n.valign ?? "top",
          charSpacing: n.tracking,
          // spațiere exactă în puncte: aceeași în PowerPoint și Keynote
          lineSpacing: n.lh ? Math.round(n.size * n.lh * 10) / 10 : undefined,
          margin: 0,
          wrap: true,
          fit: "none",
        }
      );
      break;
    }
    case "image": {
      let img: PreparedImage | null = null;
      if (n.svg) img = await rasterizeSvg(n.svg, n.w, n.h);
      else if (n.data) img = { data: n.data, mime: "image/png" };
      else if (n.src) img = await prepareImage(n.src, n.w, n.h, n);
      if (!img) return;
      let { x, y, w, h } = n;
      // pptxgenjs întinde imaginea pe toată caseta — „contain” îl calculăm noi
      if (n.fit === "contain") {
        const real = await imageSize(img.data);
        const k = Math.min(n.w / real.w, n.h / real.h);
        w = real.w * k;
        h = real.h * k;
        x = n.x + (n.w - w) / 2;
        y = n.y + (n.h - h) / 2;
      }
      s.addImage({ data: dataUri(img), x, y, w, h, objectName: name });
      break;
    }
  }
}

export async function renderDeckPptx(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "MOBO", width: SW, height: SH });
  pptx.layout = "MOBO";
  pptx.author = deck.author;
  pptx.company = deck.author;
  pptx.title = deck.title;

  const targets: AnimTarget[][] = [];
  for (const [si, slide] of deck.slides.entries()) {
    const s = pptx.addSlide();
    s.background = { color: slide.bg };
    const anims: AnimTarget[] = [];
    for (const [ni, n] of slide.nodes.entries()) {
      const name = `mobo-${si + 1}-${ni + 1}`;
      await addNode(s, n, name);
      if (n.anim) anims.push({ name, order: n.anim, fx: n.fx ?? "rise" });
    }
    targets.push(anims);
  }

  const raw = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return addMotion(raw, deck.slides, targets);
}

/* ───────────────────── mișcare: tranziții + animații de intrare ───────────────────── */

const STAGGER_MS = 170; // pauza dintre grupuri — scurtă, ca slide-ul să nu te țină în loc
const START_MS = 250; // lasă tranziția slide-ului să se termine

function transitionXml(kind: Slide["transition"]): string {
  if (kind === "push") return '<p:transition spd="med"><p:push dir="l"/></p:transition>';
  if (kind === "cover") return '<p:transition spd="med"><p:cover dir="l"/></p:transition>';
  return '<p:transition spd="med"><p:fade/></p:transition>';
}

function effectXml(ids: { next: number }, spid: string, fx: AnimTarget["fx"], delay: number, first: boolean): string {
  const id = () => ids.next++;
  const tgt = `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
  const show = `<p:set><p:cBhvr><p:cTn id="${id()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
  const node = first ? "afterEffect" : "withEffect";
  const head = (preset: number, subtype: number) =>
    `<p:par><p:cTn id="${id()}" presetID="${preset}" presetClass="entr" presetSubtype="${subtype}" fill="hold" grpId="0" nodeType="${node}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>`;
  const tail = "</p:childTnLst></p:cTn></p:par>";

  if (fx === "wipe") {
    return `${head(22, 8)}${show}<p:animEffect transition="in" filter="wipe(left)"><p:cBhvr><p:cTn id="${id()}" dur="600"/>${tgt}</p:cBhvr></p:animEffect>${tail}`;
  }
  if (fx === "fade") {
    return `${head(10, 0)}${show}<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${id()}" dur="550"/>${tgt}</p:cBhvr></p:animEffect>${tail}`;
  }
  // „rise”: apare și urcă ușor (presetul Ascend, cu o cursă mai scurtă) — încetinește spre final
  const anim = (attr: string, from: string) =>
    `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${id()}" dur="650" decel="100000" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="#${attr}"/></p:val></p:tav></p:tavLst></p:anim>`;
  return `${head(42, 0)}${show}<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${id()}" dur="650"/>${tgt}</p:cBhvr></p:animEffect>${anim("ppt_x", "#ppt_x")}${anim("ppt_y", "#ppt_y+.045")}${tail}`;
}

function timingXml(found: Array<AnimTarget & { spid: string; tag: string }>): string {
  if (found.length === 0) return "";
  const ids = { next: 3 }; // 1 = rădăcina, 2 = secvența principală
  const sorted = [...found].sort((a, b) => a.order - b.order);
  const groupId = ids.next++;
  const innerId = ids.next++;
  const effects = sorted
    .map((t, i) => effectXml(ids, t.spid, t.fx, START_MS + (t.order - 1) * STAGGER_MS, i === 0))
    .join("");
  const bld = [...new Set(sorted.filter((t) => t.tag === "sp").map((t) => t.spid))]
    .map((spid) => `<p:bldP spid="${spid}" grpId="0" animBg="1"/>`)
    .join("");
  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    // grupul pornește singur la intrarea slide-ului (primul efect e „după precedentul”)
    `<p:par><p:cTn id="${groupId}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${innerId}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>` +
    (bld ? `<p:bldLst>${bld}</p:bldLst>` : "") +
    `</p:timing>`
  );
}

async function addMotion(raw: Buffer, slides: Slide[], targets: AnimTarget[][]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(raw);
  for (const [i, slide] of slides.entries()) {
    const file = zip.file(`ppt/slides/slide${i + 1}.xml`);
    if (!file) continue;
    let xml = await file.async("string");

    // numele dat obiectului → id-ul lui real din slide
    const byName = new Map<string, { spid: string; tag: string }>();
    const re = /<p:(sp|pic|cxnSp)>[\s\S]*?<p:cNvPr id="(\d+)" name="([^"]*)"/g;
    for (let m = re.exec(xml); m; m = re.exec(xml)) byName.set(m[3], { tag: m[1], spid: m[2] });

    const found = targets[i].flatMap((t) => {
      const hit = byName.get(t.name);
      return hit ? [{ ...t, ...hit }] : [];
    });

    const motion = transitionXml(slide.transition) + timingXml(found);
    // ordinea cerută de schemă: cSld, clrMapOvr, transition, timing
    if (xml.includes("</p:clrMapOvr>")) xml = xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${motion}`);
    else xml = xml.replace("</p:sld>", `${motion}</p:sld>`);
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
