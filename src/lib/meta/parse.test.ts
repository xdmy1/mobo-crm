import { describe, expect, it } from "vitest";
import {
  extractLeadgenChanges,
  extractMessagingEvents,
  leadgenComment,
  messageComment,
  nameFromProfile,
  parseFieldData,
} from "./parse";

describe("parseFieldData (formular instant)", () => {
  it("citește formularul MOBO: nume complet, telefon, email, tip mobilă, buget", () => {
    const lead = parseFieldData([
      { name: "full_name", values: ["Ion Rusu"] },
      { name: "phone_number", values: ["069 123 456"] },
      { name: "email", values: ["Ion.Rusu@Mail.md"] },
      { name: "ce_tip_de_mobilă_căutați?", values: ["Bucătărie la comandă"] },
      { name: "ce_buget_aproximativ_aveți?_(eur)", values: ["3000-5000"] },
    ]);
    expect(lead).toEqual({
      firstName: "Ion",
      lastName: "Rusu",
      phone: "+37369123456",
      email: "ion.rusu@mail.md",
      furnitureType: "Bucătărie la comandă",
      budget: "3000-5000",
    });
  });
  it("preferă first_name/last_name când există și normalizează +373 scris cu spații", () => {
    const lead = parseFieldData([
      { name: "first_name", values: ["Ana"] },
      { name: "last_name", values: ["Popescu"] },
      { name: "full_name", values: ["Altceva Complet"] },
      { name: "phone_number", values: ["+373 78 333 444"] },
    ]);
    expect(lead.firstName).toBe("Ana");
    expect(lead.lastName).toBe("Popescu");
    expect(lead.phone).toBe("+37378333444");
    expect(lead.email).toBeNull();
    expect(lead.budget).toBeNull();
  });
  it("nu confundă întrebările custom cu câmpurile standard și pune un nume implicit când lipsește", () => {
    const lead = parseFieldData([
      { name: "phone_number", values: ["+40 721 000 111"] },
      { name: "what_type_of_furniture?", values: ["Dressing"] },
      { name: "budget_eur", values: ["2000"] },
    ]);
    expect(lead.firstName).toBe("Client");
    expect(lead.lastName).toBe("Facebook");
    // numerele din alte țări rămân cum au fost scrise
    expect(lead.phone).toBe("+40 721 000 111");
    expect(lead.furnitureType).toBe("Dressing");
    expect(lead.budget).toBe("2000");
  });
  it("rezistă la field_data gol sau lipsă", () => {
    expect(parseFieldData(undefined).firstName).toBe("Client");
    expect(parseFieldData([{ name: "email", values: [null] }]).email).toBeNull();
  });
});

describe("extractLeadgenChanges", () => {
  it("ia doar schimbările cu field=leadgen", () => {
    const changes = extractLeadgenChanges({
      object: "page",
      entry: [
        {
          id: "111",
          time: 1,
          changes: [
            { field: "leadgen", value: { leadgen_id: "900", page_id: "111", form_id: "77", ad_id: "55", created_time: 1700000000 } },
            { field: "feed", value: {} },
          ],
        },
      ],
    });
    expect(changes).toEqual([{ leadgenId: "900", pageId: "111", formId: "77", adId: "55", createdTime: 1700000000 }]);
  });
  it("ignoră body-uri care nu sunt de la o pagină", () => {
    expect(extractLeadgenChanges({ object: "instagram", entry: [] })).toEqual([]);
    expect(extractLeadgenChanges(null)).toEqual([]);
  });
});

describe("extractMessagingEvents", () => {
  it("Messenger: text, mid, ad_id din referral; ecoul paginii e marcat; livrările sunt sărite", () => {
    const res = extractMessagingEvents({
      object: "page",
      entry: [
        {
          id: "111",
          messaging: [
            {
              sender: { id: "psid-1" },
              recipient: { id: "111" },
              timestamp: 1700000000000,
              message: { mid: "m1", text: "Bună, cât costă?" },
              referral: { ref: "x", source: "ADS", type: "OPEN_THREAD", ad_id: "55" },
            },
            { sender: { id: "111" }, recipient: { id: "psid-1" }, timestamp: 2, message: { mid: "m2", text: "Salut!", is_echo: true } },
            { sender: { id: "psid-1" }, recipient: { id: "111" }, timestamp: 3, delivery: { mids: ["m2"] } },
          ],
        },
      ],
    });
    expect(res?.platform).toBe("facebook");
    expect(res?.events).toHaveLength(2);
    expect(res?.events[0]).toEqual({
      senderId: "psid-1",
      recipientId: "111",
      timestamp: 1700000000000,
      text: "Bună, cât costă?",
      mid: "m1",
      adId: "55",
      isEcho: false,
    });
    expect(res?.events[1].isEcho).toBe(true);
  });
  it("postback: titlul butonului devine text, ad_id vine din postback.referral", () => {
    const res = extractMessagingEvents({
      object: "page",
      entry: [{ id: "111", messaging: [{ sender: { id: "psid-2" }, postback: { title: "Bucătărie la comandă", payload: "KITCHEN", referral: { ad_id: "56", source: "ADS", type: "OPEN_THREAD" } } }] }],
    });
    expect(res?.events[0].text).toBe("Bucătărie la comandă");
    expect(res?.events[0].adId).toBe("56");
    expect(res?.events[0].mid).toBeNull();
  });
  it("Instagram: object=instagram, quick reply și atașament fără text", () => {
    const res = extractMessagingEvents({
      object: "instagram",
      entry: [
        {
          id: "ig-page",
          messaging: [
            { sender: { id: "igsid-1" }, message: { mid: "q1", quick_reply: { payload: "DRESSING" } } },
            { sender: { id: "igsid-1" }, message: { mid: "a1", attachments: [{ type: "image" }] } },
          ],
        },
      ],
    });
    expect(res?.platform).toBe("instagram");
    expect(res?.events.map((e) => e.text)).toEqual(["DRESSING", "[atașament]"]);
  });
  it("alte obiecte (ex. whatsapp) nu sunt tratate", () => {
    expect(extractMessagingEvents({ object: "whatsapp_business_account", entry: [] })).toBeNull();
  });
});

describe("texte pentru comentariul clientului", () => {
  it("formular", () => {
    expect(leadgenComment({ adName: "Bucătării toamnă", furnitureType: "Dressing / dulap", budget: "2000" })).toBe(
      "📋 Formular Facebook · Bucătării toamnă\nTip: Dressing / dulap\nBuget: 2000"
    );
    expect(leadgenComment({})).toBe("📋 Formular Facebook");
  });
  it("mesaj", () => {
    expect(messageComment({ platform: "instagram", adId: "55", text: "Salut" })).toBe(
      "💬 Instagram DM · ad 55\nPrimul mesaj: „Salut”\nRăspunde din Inbox (Business Suite)"
    );
    expect(messageComment({ platform: "facebook" })).toBe("💬 Messenger\nRăspunde din Inbox (Business Suite)");
  });
});

describe("nameFromProfile", () => {
  it("Messenger și Instagram, cu fallback-uri", () => {
    expect(nameFromProfile("facebook", { first_name: "Ion", last_name: "Rusu" })).toEqual({ firstName: "Ion", lastName: "Rusu" });
    expect(nameFromProfile("instagram", { name: "Ana Maria Pop", username: "anapop" })).toEqual({ firstName: "Ana", lastName: "Maria Pop" });
    expect(nameFromProfile("instagram", { username: "anapop" })).toEqual({ firstName: "@anapop", lastName: "Instagram" });
    expect(nameFromProfile("facebook", null)).toEqual({ firstName: "Client", lastName: "Facebook" });
  });
});
