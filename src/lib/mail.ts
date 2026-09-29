import nodemailer from "nodemailer";
import { prisma } from "./db";

export async function getMailer() {
  const cfg = await prisma.emailConfig.findUnique({ where: { id: 1 } });
  if (!cfg?.host || !cfg.user) return null;
  return {
    transporter: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port ?? 587,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass ?? "" },
    }),
    from: cfg.from || cfg.user,
  };
}

export async function sendEmail(to: string, subject: string, body: string) {
  const mailer = await getMailer();
  if (!mailer) throw new Error("SMTP neconfigurat. Setați-l în Setup → Configurare Email.");
  await mailer.transporter.sendMail({
    from: mailer.from,
    to,
    subject,
    text: body,
  });
}
