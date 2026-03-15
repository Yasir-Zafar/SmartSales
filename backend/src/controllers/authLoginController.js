import { supabase, supabaseAdmin } from '../config/db.js';

export async function loginEndpointSupabaseAuth(req, res) {
    const { email, password } = req.body;
  try {
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Get user profile with role using ADMIN/service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return res.status(401).json({ message: 'Profile not found' });
    }

    if (profile.active === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Update last logged in timestamp (best-effort, don’t block login)
    const lastLoggedIn = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ last_logged_in: lastLoggedIn })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Last login update error:', updateError);
    }

    // Return Supabase session token
    res.json({
      token: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
        name: profile.name,
        last_logged_in: lastLoggedIn
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

