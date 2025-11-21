/**
 * Email service using Resend API
 * Works in both Node.js (Next.js API routes) and Deno (Supabase Edge Functions)
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
}

export interface SendEmailResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Send email using Resend API
 * @param options Email options
 * @param apiKey Resend API key (defaults to RESEND_API_KEY env var)
 * @returns Result with email ID or error
 */
export async function sendEmail(
  options: SendEmailOptions,
  apiKey?: string
): Promise<SendEmailResult> {
  const resendApiKey = apiKey || process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    return {
      id: "",
      success: false,
      error: "RESEND_API_KEY is not set"
    };
  }

  // Default from address (can be overridden)
  const from = options.from || "onboarding@resend.dev";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        id: "",
        success: false,
        error: data.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      id: data.id || "",
      success: true,
    };
  } catch (error) {
    return {
      id: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

