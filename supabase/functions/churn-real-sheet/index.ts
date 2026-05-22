import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SPREADSHEET_ID = '10A9YnskShPPZ2Xz9d-kN2SHCv-qN-48-94rQBbCNWIo';
// Aba "Dados 2026": coluna A = mês (Janeiro..Dezembro), coluna B = Receita Inicial
const RANGE = "'Dados 2026'!A3:B14";
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';

const MONTH_INDEX: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

const parseNum = (raw: unknown): number | null => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const cleaned = raw
      .replace(/r\$/i, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  return null;
};

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

    const rows: unknown[][] = data?.values ?? [];
    const mrrBaseByMonth: (number | null)[] = Array.from({ length: 12 }, () => null);
    for (const row of rows) {
      const mesRaw = String(row?.[0] ?? '').trim().toLowerCase();
      const idx = MONTH_INDEX[mesRaw];
      if (idx === undefined) continue;
      mrrBaseByMonth[idx] = parseNum(row?.[1]);
    }

    const currentMonth = new Date().getMonth();
    const mrrBase = mrrBaseByMonth[currentMonth];

    return new Response(
      JSON.stringify({
        mrrBase,
        mrrBaseByMonth,
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
