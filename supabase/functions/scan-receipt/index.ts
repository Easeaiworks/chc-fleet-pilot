import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File types that can be sent directly as images to the vision model
const VISION_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf', // Gemini supports PDF directly
];

// Text-based file types that need text extraction
const TEXT_MIME_TYPES = [
  'text/plain',
  'text/csv',
  'application/csv',
  'text/tab-separated-values',
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { fileBase64, mimeType, fileName, textContent } = await req.json();

    if (!fileBase64 && !textContent) {
      console.error("No file or text content provided");
      return new Response(
        JSON.stringify({ error: "No file or text content provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Processing document:", fileName, "mimeType:", mimeType, "has textContent:", !!textContent);

    let messages: any[];

    // If we have pre-extracted text content (for DOCX, CSV, etc.)
    if (textContent) {
      console.log("Using pre-extracted text content, length:", textContent.length);
      messages = [
        {
          role: "user",
          content: `Analyze this document content and extract receipt/invoice information. The document is named "${fileName}".

Document content:
${textContent}

Extract all relevant financial information including vendor name, amounts, dates, and item descriptions.`
        }
      ];
    } 
    // For vision-compatible files (images and PDFs)
    else if (VISION_MIME_TYPES.includes(mimeType)) {
      console.log("Using vision model for:", mimeType);
      messages = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${fileBase64}`
              }
            },
            {
              type: "text",
              text: "Analyze this receipt/invoice document carefully. Extract ALL text you can see including the vendor/business name, address, phone number, all line items, subtotal, taxes, and total amount. Look for dates in any format. Extract the receipt details using the extract_receipt_data function."
            }
          ]
        }
      ];
    }
    // For text-based files, decode and send as text
    else if (TEXT_MIME_TYPES.includes(mimeType) || mimeType?.startsWith('text/')) {
      console.log("Decoding text-based file:", mimeType);
      const decodedText = atob(fileBase64);
      messages = [
        {
          role: "user",
          content: `Analyze this document content and extract receipt/invoice information. The file is named "${fileName}".

Document content:
${decodedText}

Extract all relevant financial information including vendor name, amounts, dates, and item descriptions.`
        }
      ];
    }
    // Unsupported file type
    else {
      console.error("Unsupported file type:", mimeType);
      return new Response(
        JSON.stringify({ 
          error: `Unsupported file type: ${mimeType}. Supported types: images (JPEG, PNG, GIF, WebP), PDF, and text files (TXT, CSV).`,
          vendor_name: null,
          total: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the AI gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt_data",
              description: "Extract structured data from a receipt, invoice, or expense document",
              parameters: {
                type: "object",
                properties: {
                  vendor_name: {
                    type: "string",
                    description: "The business/store/company name shown on the document"
                  },
                  vendor_address: {
                    type: "string",
                    description: "The address of the business if visible"
                  },
                  subtotal: {
                    type: "number",
                    description: "The subtotal amount before tax"
                  },
                  tax_amount: {
                    type: "number",
                    description: "The tax amount (HST, GST, PST, VAT, or combined)"
                  },
                  total: {
                    type: "number",
                    description: "The total amount including tax"
                  },
                  date: {
                    type: "string",
                    description: "The document/receipt date in YYYY-MM-DD format"
                  },
                  description: {
                    type: "string",
                    description: "Brief summary of items purchased or services rendered"
                  },
                  raw_text: {
                    type: "string",
                    description: "Any additional relevant text found on the document"
                  }
                },
                required: ["vendor_name", "total"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt_data" } },
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received:", JSON.stringify(data, null, 2));

    // Extract data from tool call response
    let extractedData = {
      vendor_name: null,
      subtotal: null,
      tax_amount: null,
      total: null,
      date: null,
      description: null,
    };

    // Check for tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log("Parsed tool call arguments:", JSON.stringify(args, null, 2));
        extractedData = {
          vendor_name: args.vendor_name || null,
          subtotal: args.subtotal || null,
          tax_amount: args.tax_amount || null,
          total: args.total || null,
          date: args.date || null,
          description: args.description || null,
        };
      } catch (parseError) {
        console.error("Failed to parse tool call arguments:", parseError);
      }
    } else {
      // Fallback: try to extract JSON from content
      const content = data.choices?.[0]?.message?.content;
      console.log("No tool call found, checking content:", content);
      
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            extractedData = {
              vendor_name: parsed.vendor_name || null,
              subtotal: parsed.subtotal || null,
              tax_amount: parsed.tax_amount || null,
              total: parsed.total || null,
              date: parsed.date || null,
              description: parsed.description || null,
            };
          }
        } catch (parseError) {
          console.error("Failed to parse content as JSON:", parseError);
        }
      }
    }

    console.log("Final extracted data:", JSON.stringify(extractedData));

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scan-receipt function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
