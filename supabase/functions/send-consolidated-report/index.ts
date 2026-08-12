import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

// CORS Headers for client-side invokes
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // SMTP Config from Supabase environment variables (secrets)
    const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
    const user = Deno.env.get("SMTP_USER") || "sanjeev520212@gmail.com";
    const pass = Deno.env.get("SMTP_PASSWORD") || "cqyo jqui drpj oomf";

    // Create SMTP Client
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: {
          enabled: true,
        },
        auth: {
          username: user,
          password: pass,
        },
      },
    });

    // Send Email
    await client.send({
      from: `Barani Reports <${user}>`,
      to: recipients,
      subject: subject || `Consolidated Work Report (${date})`,
      content: body || "Please find attached the consolidated work report.",
      attachments: [
        {
          filename: `Consolidated_Report_${String(date).replace(/ /g, "_")}.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ]
    });

    await client.close();

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
