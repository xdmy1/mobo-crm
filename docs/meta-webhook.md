# Integrarea Meta — Facebook Lead Ads, Messenger, Instagram DM

Fiecare lead care vine din Meta intră în secțiunea **Meta Ads** din meniu (`/admin/meta`), cu numele, telefonul,
emailul, răspunsurile la întrebările formularului și mesajele primite. Lead-ul **nu devine client automat**: rămâne
acolo până când cineva apasă **„Creează client”** — atunci intră în Bord Vânzări → etapa „Lead”, la Persoane Fizice,
cu sursa Facebook sau Instagram, responsabil = cine a apăsat, și comentariul de origine. „Respinge” ascunde un lead
greșit (rămâne în bază). Pe fișa clientului creat apare blocul „Meta” cu reclama și istoricul mesajelor.

| Sursă | Ce primim | Ce face CRM-ul |
|---|---|---|
| Formular instant (Lead Ads) | webhook `leadgen` → luăm lead-ul din Graph API (`field_data`, `ad_name`…) și întrebările formularului (etichetele) | lead în Meta Ads cu nume, telefon (+373…), email și toate răspunsurile. La „Creează client”: dacă telefonul există deja, lead-ul se leagă de clientul existent (cu un mesaj „Formular Facebook (client existent)”), altfel se creează clientul cu comentariul `📋 Formular Facebook · {reclamă}` + răspunsurile. |
| Messenger / Instagram DM | webhook `messages`, `messaging_postbacks`, `messaging_referrals` | la primul mesaj: lead în Meta Ads cu numele din profil; mesajele următoare intră în istoric. Ecourile paginii sunt ignorate. „Creează client” → client fără telefon, cu comentariul `💬 Messenger · ad {id}` + primul mesaj. |

Endpoint: `https://app.mobo.md/api/meta/webhook` (`src/app/api/meta/webhook/route.ts`).
Deduplicare: `MetaLead.metaId` (leadgen_id sau PSID/IGSID) și `MetaMessage.mid` sunt unice — Meta retrimite evenimentele, clienții nu se dublează.

## Variabile de mediu (`crm.env` pe VPS / `.env` local)

| Variabilă | De unde |
|---|---|
| `META_VERIFY_TOKEN` | un șir ales de noi (ex. `openssl rand -hex 24`); se introduce identic la Webhooks → „Verify token” |
| `META_APP_SECRET` | App Dashboard → App settings → Basic → **App secret** |
| `META_PAGE_TOKEN` | Page Access Token generat pentru un **system user** (nu expiră) — pașii de mai jos |
| `META_GRAPH_VERSION` | opțional, implicit `v26.0` (versiunea curentă din dashboard) |
| `CRM_DEFAULT_RESPONSIBLE_ID` | opțional: `Staff.id` al angajatului care devine responsabil pe lead-urile din Meta (Setup → Lista Angajați) |

Fără `META_APP_SECRET` webhook-ul răspunde 503 la POST (nu procesează nimic nesemnat). Fără `META_PAGE_TOKEN`
formularele rămân neprocesate (apar în Meta Ads cu eroarea), iar mesajele creează clientul fără nume.

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
   curl -X POST "https://graph.facebook.com/v26.0/{PAGE_ID}/subscribed_apps" \
     -d "subscribed_fields=leadgen,messages,messaging_postbacks,messaging_referrals" \
     -d "access_token=$META_PAGE_TOKEN"
   ```
   Verificare: `GET /{PAGE_ID}/subscribed_apps?access_token=…` trebuie să listeze aplicația cu câmpurile de mai sus.
5. **Test formular.** [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing) → alege pagina și formularul →
   „Create lead” → în câteva secunde lead-ul apare în Meta Ads. „Delete lead” șterge doar la Meta.
6. **Test mesaje.** Scrie paginii din Messenger / Instagram de pe un cont adăugat ca **tester** al aplicației.

> **Development vs Live.** Cât timp aplicația e în *Development Mode*, mesajele ajung doar de la administratorii/testerii
> aplicației. Pentru trafic real trebuie trecută în *Live* și e nevoie de **App Review** pentru `pages_messaging` și
> `instagram_manage_messages` (cu o înregistrare video a fluxului). `leadgen` funcționează și în Development pentru pagina proprie.

## Verificări rapide

- `curl "https://app.mobo.md/api/meta/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"` → `123`.
- POST fără semnătură → 401; cu semnătură validă → `{"ok":true}` imediat, procesarea continuă în fundal.
- În jurnalul containerului (`docker compose logs -f crm`) apar linii `[meta] formular … → lead #…` / `[meta] Messenger … → lead #…`.
- Local, simulezi Meta cu `META_GRAPH_BASE=http://127.0.0.1:4545` îndreptat spre un server fals de Graph API și semnezi body-ul cu
  `signMetaBody()` din `src/lib/meta/signature.ts`.

## Token-ul de pagină, pe scurt (varianta care a mers)

Generarea din Business Settings cere clic în interfața Meta; cea mai simplă cale: [Graph API Explorer](https://developers.facebook.com/tools/explorer/?app_id=2349233715840022)
→ Add a permission (lista de mai sus) → Generate Access Token (token de utilizator, ~1 h). Apoi, pe VPS, se schimbă în token de pagină fără expirare:

```bash
L=$(curl -s "https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=2349233715840022&client_secret=$META_APP_SECRET&fb_exchange_token=$USER_TOKEN" | jq -r .access_token)
curl -s "https://graph.facebook.com/v26.0/me/accounts?fields=id,name,access_token&access_token=$L"   # token-ul paginii 100829023073042
```
Verificare: `GET /debug_token?input_token=…&access_token=…` → `expires_at: 0`, `scopes` cu permisiunile cerute.
Apoi `META_PAGE_TOKEN` în `crm.env`, `docker compose up -d crm`, și abonarea paginii la aplicație (pasul 4).
