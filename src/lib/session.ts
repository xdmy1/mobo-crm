import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  staffId?: number;
  username?: string;
  /**
   * Stratul financiar e deblocat (parolă + cod 2FA) până la acest moment (epoch ms).
   * Lipsă sau în trecut = blocat. Cookie-ul e criptat (iron-session), deci nu poate fi falsificat.
   */
  financeUntil?: number;
  /** secret TOTP generat la „Configurează 2FA”, nesalvat încă în baza de date (base32) */
  pendingTotp?: string;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "mobo-crm-secret-schimba-ma-in-productie-minim-32ch",
  cookieName: "mobo_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14, // 14 zile
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
