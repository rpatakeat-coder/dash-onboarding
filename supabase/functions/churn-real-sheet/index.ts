import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SPREADSHEET_ID = '10A9YnskShPPZ2Xz9d-kN2SHCv-qN-48-94rQBbCNWIo';
const RANGE = "'Mensal 2026'!B2";
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
  if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing connector credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_SHEETS_API_KEY,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Sheets API ${res.status}`, details: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = data?.values?.[0]?.[0];
    // B2 = MRR início do mês (número ou string com R$ / pontos / vírgula)
    let mrrBase: number | null = null;
    if (typeof raw === 'number') {
      mrrBase = raw;
    } else if (typeof raw === 'string') {
      const cleaned = raw
        .replace(/r\$/i, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();
      const n = Number(cleaned);
      if (!Number.isNaN(n)) mrrBase = n;
    }

    return new Response(
      JSON.stringify({
        mrrBase,
        raw,
        pct: mrrBase,
        range: RANGE,
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
