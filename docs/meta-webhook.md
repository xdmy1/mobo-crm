# Integrarea Meta — Facebook Lead Ads, Messenger, Instagram DM

Fiecare lead care vine din Meta intră automat în CRM: **Bord Vânzări → etapa „Lead”**, la Persoane Fizice,
cu sursa Facebook sau Instagram, responsabilul implicit (opțional) și un comentariu care spune de unde a venit.
Totul se vede și în secțiunea **Meta Leads** din meniu (`/admin/meta`), iar pe fișa clientului apare blocul „Meta”
cu reclama și istoricul mesajelor.

| Sursă | Ce primim | Ce face CRM-ul |
|---|---|---|
| Formular instant (Lead Ads) | webhook `leadgen` → luăm lead-ul din Graph API (`field_data`, `ad_name`…) | client nou cu nume, telefon (+373…), email, comentariu `📋 Formular Facebook · {reclamă}` + Tip / Buget. Dacă telefonul există deja, clientul nu se dublează: primește un mesaj „Formular Facebook (client existent)”. |
| Messenger / Instagram DM | webhook `messages`, `messaging_postbacks`, `messaging_referrals` | la primul mesaj: client nou (telefon gol) cu comentariu `💬 Messenger · ad {id}` + primul mesaj. Mesajele următoare intră doar în istoric. Ecourile paginii sunt ignorate. |

Endpoint: `https://app.mobo.md/api/meta/webhook` (`src/app/api/meta/webhook/route.ts`).
Deduplicare: `MetaLead.metaId` (leadgen_id sau PSID/IGSID) și `MetaMessage.mid` sunt unice — Meta retrimite evenimentele, clienții nu se dublează.

## Variabile de mediu (`crm.env` pe VPS / `.env` local)

| Variabilă | De unde |
|---|---|
| `META_VERIFY_TOKEN` | un șir ales de noi (ex. `openssl rand -hex 24`); se introduce identic la Webhooks → „Verify token” |
| `META_APP_SECRET` | App Dashboard → App settings → Basic → **App secret** |
| `META_PAGE_TOKEN` | Page Access Token generat pentru un **system user** (nu expiră) — pașii de mai jos |
| `META_GRAPH_VERSION` | opțional, implicit `v21.0` |
| `CRM_DEFAULT_RESPONSIBLE_ID` | opțional: `Staff.id` al angajatului care devine responsabil pe lead-urile din Meta (Setup → Lista Angajați) |

Fără `META_APP_SECRET` webhook-ul răspunde 503 la POST (nu procesează nimic nesemnat). Fără `META_PAGE_TOKEN`
formularele rămân neprocesate (apar în Meta Leads cu eroarea), iar mesajele creează clientul fără nume.

## Pașii din Meta (o singură dată)

1. **Aplicația.** [developers.facebook.com](https://developers.facebook.com) → Create App → tip **Business**, legată de
   Business Manager-ul MOBO (`777011347550838`). Adaugă produsele **Webhooks**, **Messenger** și **Instagram**.
2. **Page Access Token fără expirare.** Business Settings → Users → **System users** → Add (rol Admin) →
   *Assign assets*: pagina „Mobo kitchens&home” (control total) și aplicația → **Generate new token** pentru aplicație, cu permisiunile:
   `pages_manage_metadata`, `pages_messaging`, `leads_retrieval`, `pages_show_list`, `instagram_basic`,
   `instagram_manage_messages`, `pages_read_engagement`. Copiază token-ul în `META_PAGE_TOKEN`.
3. **Webhook-ul.** App Dashboard → Webhooks → obiectul **Page** → Edit subscription:
   Callback URL `https://app.mobo.md/api/meta/webhook`, Verify token = `META_VERIFY_TOKEN` → Verify and save.
   Abonează câmpurile `leadgen`, `messages`, `messaging_postbacks`, `messaging_referrals`.
   Apoi obiectul **Instagram** → aceeași adresă → câmpul `messages` (+ `messaging_postbacks`, `messaging_referrals`).
4. **Pagina trebuie abonată la aplicație** (altfel Meta nu trimite nimic):
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/{PAGE_ID}/subscribed_apps" \
     -d "subscribed_fields=leadgen,messages,messaging_postbacks,messaging_referrals" \
     -d "access_token=$META_PAGE_TOKEN"
   ```
   Verificare: `GET /{PAGE_ID}/subscribed_apps?access_token=…` trebuie să listeze aplicația cu câmpurile de mai sus.
5. **Test formular.** [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing) → alege pagina și formularul →
   „Create lead” → în câteva secunde clientul apare în Bord Vânzări și în Meta Leads. „Delete lead” șterge doar la Meta.
6. **Test mesaje.** Scrie paginii din Messenger / Instagram de pe un cont adăugat ca **tester** al aplicației.

> **Development vs Live.** Cât timp aplicația e în *Development Mode*, mesajele ajung doar de la administratorii/testerii
> aplicației. Pentru trafic real trebuie trecută în *Live* și e nevoie de **App Review** pentru `pages_messaging` și
> `instagram_manage_messages` (cu o înregistrare video a fluxului). `leadgen` funcționează și în Development pentru pagina proprie.

## Verificări rapide

- `curl "https://app.mobo.md/api/meta/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"` → `123`.
- POST fără semnătură → 401; cu semnătură validă → `{"ok":true}` imediat, procesarea continuă în fundal.
- În jurnalul containerului (`docker compose logs -f crm`) apar linii `[meta] formular … → client #…` / `[meta] Messenger … → client #…`.
- Local, simulezi Meta cu `META_GRAPH_BASE=http://127.0.0.1:4545` îndreptat spre un server fals de Graph API și semnezi body-ul cu
  `signMetaBody()` din `src/lib/meta/signature.ts`.
