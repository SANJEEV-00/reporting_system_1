import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipients, pdfBase64, date, subject, body } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("Missing or invalid recipients array.");
    }
    if (!pdfBase64) {
      throw new Error("Missing pdfBase64 attachment content.");
    }

    // Get Brevo API Key from Supabase secrets
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not configured in Supabase secrets.");
    }

    // Default sender (their Gmail address)
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "sanjeev520212@gmail.com";

    // Format recipients for Brevo API: [{ email: "..." }, { email: "..." }]
    const toField = recipients.map(email => ({ email: email.trim() }));

    // Call Brevo's HTTPS transactional mail API
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "Barani Reports",
          email: senderEmail
        },
        to: toField,
        subject: subject || `Consolidated Work Report (${date})`,
        htmlContent: `<p>${(body || "Please find attached the consolidated work report.").replace(/\n/g, "<br>")}</p>`,
        attachment: [
          {
            name: `Consolidated_Report_${String(date).replace(/ /g, "_")}.pdf`,
            content: pdfBase64,
          }
        ]
      })
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.message || "Failed to send email via Brevo API.");
    }

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully via Brevo!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
