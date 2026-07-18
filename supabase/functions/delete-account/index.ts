import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { corsHeaders } from '@supabase/supabase-js/cors';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const deleteAccount = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'Method not allowed.' }, 405);

  const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Your session is no longer valid.' }, 401);

  // This RPC owns the financial checks, household exit, chore cleanup, and
  // profile anonymization. It runs as the caller, so another user cannot target it.
  const { data: preparedUserId, error: prepareError } = await ctx.supabase.rpc('prepare_account_deletion');
  if (prepareError) return json({ error: prepareError.message }, 409);
  if (preparedUserId !== userData.user.id) return json({ error: 'Account deletion identity mismatch.' }, 409);

  const { error: deleteError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error('Auth identity deletion failed after account preparation', deleteError);
    return json({ error: 'Your account was locked and anonymized, but Auth cleanup needs to be retried.' }, 500);
  }

  return json({ deleted: true });
});

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return deleteAccount(req);
  },
};
