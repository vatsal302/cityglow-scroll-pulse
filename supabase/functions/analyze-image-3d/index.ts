// Analyze an uploaded image and return structured 3D-build instructions.
// Uses Lovable AI Gateway (Gemini) with tool calling for structured output.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const tools = [
      {
        type: "function",
        function: {
          name: "describe_3d_model",
          description:
            "Analyze the uploaded image of a building, structure or vehicle and return parameters to compose a low-poly PBR 3D preview.",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["building", "vehicle", "structure"] },
              width: { type: "number", description: "Width in arbitrary units, 1.5-6" },
              depth: { type: "number", description: "Depth in arbitrary units, 1.5-6" },
              height: { type: "number", description: "Height in units. Buildings 3-10, vehicles 1-2." },
              baseColor: { type: "string", description: "Hex color for body/façade, e.g. #4a5680" },
              accentColor: { type: "string", description: "Hex color for trim/roof/plinth" },
              windowDensity: { type: "number", description: "0..1 fraction of lit windows for buildings; 0 for vehicles." },
              roofStyle: { type: "string", enum: ["flat", "pitched", "domed"] },
              notes: { type: "string", description: "1-2 sentence summary of what was seen." },
            },
            required: ["kind", "width", "depth", "height", "baseColor", "accentColor", "windowDensity", "roofStyle", "notes"],
            additionalProperties: false,
          },
        },
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a CV-to-3D analyst. Look at the image and call describe_3d_model with realistic parameters. Use moderate sizes; pick palette colors that match what you actually see.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and produce 3D model parameters." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "describe_3d_model" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("No tool call returned");
    }
    const analysis = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-image-3d error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
