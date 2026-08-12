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

    // Get Resend API Key from Supabase secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured in Supabase secrets.");
    }

    // Default sender (onboarding@resend.dev works for testing to your own account email)
    const sender = Deno.env.get("SENDER_EMAIL") || "onboarding@resend.dev";

    // Call Resend's HTTPS API (fully allowed in Supabase sandbox)
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `Barani Reports <${sender}>`,
        to: recipients,
        subject: subject || `Consolidated Work Report (${date})`,
        html: `<p>${(body || "Please find attached the consolidated work report.").replace(/\n/g, "<br>")}</p>`,
        attachments: [
          {
            filename: `Consolidated_Report_${String(date).replace(/ /g, "_")}.pdf`,
            content: pdfBase64,
          }
        ]
      })
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.message || "Failed to send email via Resend API.");
    }

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully!" }), {
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
