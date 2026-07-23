import { Resend } from "resend";
import { logger } from "../../utils/logger.js";
import {
  welcomeEmailHtml,
  welcomeEmailSubject,
  welcomeEmailText,
} from "./mail_templates/welcomeTemplate.js";

interface SendWelcomeEmailOptions {
  to: string;
  firstName?: string;
}

const getAppUrl = () => (process.env.FRONTEND_URL || "https://choppr.pro").replace(/\/$/, "");
const getFromEmail = () => process.env.RESEND_FROM_EMAIL || "Shivang Yadav <hi@choppr.pro>";

const serializeResendError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return error;
};

let resendClient: Resend | null = null;

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn("RESEND_API_KEY is not configured; skipping welcome email");
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
};

export const sendWelcomeEmail = async ({ to, firstName }: SendWelcomeEmailOptions) => {
  if (!to || !to.includes("@")) {
    logger.warn("Skipping welcome email because recipient email is invalid", { to });
    return;
  }

  const resend = getResendClient();

  if (!resend) {
    return;
  }

  const appUrl = getAppUrl();
  const from = getFromEmail();

  // [LOG_REDUCED]
  // logger.info("Sending welcome email via Resend", {
  //   to,
  //   from,
  //   subject: welcomeEmailSubject,
  //   hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
  // });

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: welcomeEmailSubject,
      html: welcomeEmailHtml({ firstName, appUrl }),
      text: welcomeEmailText({ firstName, appUrl }),
    });

    if (error) {
      logger.error("Resend rejected welcome email", {
        to,
        from,
        error: serializeResendError(error),
      });
      return;
    }

    // [LOG_REDUCED]
    // logger.info("Email success: welcome email accepted by Resend", {
    //   to,
    //   from,
    //   emailId: data?.id ?? null,
    // });
  } catch (error) {
    logger.error("Resend welcome email request failed", {
      to,
      from,
      error: serializeResendError(error),
    });
  }
};
