import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { expenseId } = await req.json();
    
    if (!expenseId) {
      throw new Error('Expense ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch expense details with related data
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, vin),
        category:expense_categories(name, type),
        submitter:profiles!expenses_created_by_fkey(full_name, email)
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      console.error('Error fetching expense:', expenseError);
      throw new Error('Failed to fetch expense details');
    }

    console.log('Expense fetched:', expense);

    // Prepare webhook payload
    const webhookPayload = {
      expense_id: expense.id,
      amount: expense.amount,
      date: expense.date,
      description: expense.description || 'No description provided',
      category: expense.category?.name || 'Uncategorized',
      category_type: expense.category?.type || 'N/A',
      vehicle_plate: expense.vehicle?.plate,
      vehicle_make: expense.vehicle?.make,
      vehicle_model: expense.vehicle?.model,
      vehicle_vin: expense.vehicle?.vin,
      odometer_reading: expense.odometer_reading,
      submitted_by: expense.submitter?.full_name || expense.submitter?.email || 'Unknown',
      submitted_at: expense.created_at,
      approval_status: expense.approval_status,
      recipient_email: 'info@chcpaint.com',
      notification_type: 'expense_approval_request'
    };

    // Get Zapier webhook URL
    const zapierWebhookUrl = Deno.env.get('ZAPIER_WEBHOOK_URL');
    
    if (!zapierWebhookUrl) {
      console.error('ZAPIER_WEBHOOK_URL not configured');
      throw new Error('Webhook URL not configured');
    }

    console.log('Sending to Zapier webhook...');

    // Send to Zapier webhook
    const webhookResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    console.log('Zapier webhook response status:', webhookResponse.status);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Zapier webhook error:', errorText);
      throw new Error(`Webhook request failed: ${webhookResponse.status}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent to managers' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in notify-managers function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
