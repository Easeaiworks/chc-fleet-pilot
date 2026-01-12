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

    const extractionPrompt = `Analyze this receipt/invoice document carefully. 

CRITICAL TAX EXTRACTION - This is for Ontario, Canada where HST (Harmonized Sales Tax) is 13%:
- ALWAYS look for and extract HST, GST, PST, or any tax amounts shown on the invoice
- Common labels: "HST", "HST 13%", "Tax", "GST/HST", "Sales Tax"
- The tax amount is typically 13% of the subtotal in Ontario
- If you see a subtotal and total but no explicit tax line, calculate: tax = total - subtotal
- NEVER leave tax_amount as null/empty if there are amounts on the invoice

IMPORTANT: This invoice may contain MULTIPLE distinct service categories or expense types. Common examples:
- "Oil Change" or "Conventional Oil Change" = Maintenance
- "Brake Repair", "Suspension Work", "Engine Repair" = Repairs
- "Tires", "Tire Installation" = Tires
- "Parts" without labor = Parts

For EACH distinct service section or category on the invoice:
1. Identify the service type/category (Maintenance, Repair, Tires, Parts, etc.)
2. Calculate the total for that section (sum of labor + parts for that service)
3. Note the description of work
4. Allocate proportional tax to each item based on its subtotal

If there is only ONE type of service, return a single expense item.
If there are MULTIPLE service types (like the invoice has both an "Oil Change" section AND a "Repair" section), return MULTIPLE expense items.

Extract all information including:
- Vendor/business name
- Date
- SUBTOTAL (amount before tax)
- TAX AMOUNT (HST/GST/PST - typically 13% in Ontario)
- TOTAL (grand total including tax)
- Each expense item with its category suggestion, subtotal, tax, and total amount`;

    // If we have pre-extracted text content (for DOCX, CSV, etc.)
    if (textContent) {
      console.log("Using pre-extracted text content, length:", textContent.length);
      messages = [
        {
          role: "user",
          content: `${extractionPrompt}

Document name: "${fileName}"

Document content:
${textContent}`
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
              text: extractionPrompt
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
          content: `${extractionPrompt}

Document name: "${fileName}"

Document content:
${decodedText}`
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
          total: null,
          expense_items: []
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
              description: "Extract structured data from a receipt, invoice, or expense document. Can extract multiple expense items if the invoice contains different service categories.",
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
                  date: {
                    type: "string",
                    description: "The document/receipt date in YYYY-MM-DD format"
                  },
                  subtotal: {
                    type: "number",
                    description: "The overall subtotal amount before tax for the entire invoice. This is REQUIRED."
                  },
                  tax_amount: {
                    type: "number",
                    description: "The total tax amount (HST is 13% in Ontario, Canada). Look for HST, GST, PST, Tax, or calculate as total - subtotal. This is REQUIRED - do not leave empty."
                  },
                  total: {
                    type: "number",
                    description: "The grand total amount including tax for the entire invoice"
                  },
                  expense_items: {
                    type: "array",
                    description: "Array of distinct expense items/categories found on the invoice. If only one type of service, return one item. If multiple service types (e.g., oil change AND repairs), return multiple items.",
                    items: {
                      type: "object",
                      properties: {
                        category_suggestion: {
                          type: "string",
                          description: "Suggested expense category: 'Maintenance' for oil changes/routine service, 'Repair' for mechanical repairs, 'Tires' for tire work, 'Parts' for parts only, 'Fuel' for gas, 'Other' otherwise"
                        },
                        description: {
                          type: "string",
                          description: "Description of the service/items in this category"
                        },
                        subtotal: {
                          type: "number",
                          description: "The subtotal for this expense item (before tax allocation). Required for each item."
                        },
                        tax_amount: {
                          type: "number",
                          description: "Proportional HST (13%) tax amount for this expense item. Calculate based on ratio to overall subtotal. Required for each item."
                        },
                        amount: {
                          type: "number",
                          description: "Total amount for this expense item including tax (subtotal + tax_amount)"
                        }
                      },
                      required: ["category_suggestion", "description", "subtotal", "tax_amount", "amount"]
                    }
                  },
                  raw_text: {
                    type: "string",
                    description: "Any additional relevant text found on the document"
                  }
                },
                required: ["vendor_name", "subtotal", "tax_amount", "total", "expense_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt_data" } },
        max_tokens: 3000,
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
      vendor_name: null as string | null,
      vendor_address: null as string | null,
      subtotal: null as number | null,
      tax_amount: null as number | null,
      total: null as number | null,
      date: null as string | null,
      description: null as string | null,
      expense_items: [] as any[],
    };

    // Check for tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        console.log("Parsed tool call arguments:", JSON.stringify(args, null, 2));
        
        extractedData = {
          vendor_name: args.vendor_name || null,
          vendor_address: args.vendor_address || null,
          subtotal: args.subtotal || null,
          tax_amount: args.tax_amount || null,
          total: args.total || null,
          date: args.date || null,
          description: args.expense_items?.[0]?.description || null,
          expense_items: args.expense_items || [],
        };

        // If no expense_items were returned but we have a total, create a single item
        if (extractedData.expense_items.length === 0 && extractedData.total) {
          extractedData.expense_items = [{
            category_suggestion: 'Other',
            description: args.description || 'Invoice expense',
            subtotal: extractedData.subtotal,
            tax_amount: extractedData.tax_amount,
            amount: extractedData.total,
          }];
        }
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
              vendor_address: parsed.vendor_address || null,
              subtotal: parsed.subtotal || null,
              tax_amount: parsed.tax_amount || null,
              total: parsed.total || null,
              date: parsed.date || null,
              description: parsed.description || null,
              expense_items: parsed.expense_items || [],
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
