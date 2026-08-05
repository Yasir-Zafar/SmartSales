import { supabaseAdmin } from '../config/db.js';
import { validatePasswordStrength } from '../config/security.js';

export async function adminEndpointCreation(req, res) {
    const { email, password, role, name } = req.body;

  if (!['OWNER', 'ANALYST', 'STAFF'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role assigned' });
  }

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email address is required', code: 'INVALID_EMAIL' });
  }

  const problems = validatePasswordStrength(password);
  if (problems.length) {
    return res.status(400).json({
      message: `Password ${problems.join(', ')}`,
      code: 'WEAK_PASSWORD',
      problems,
    });
  }

  try {
    // Create user in Supabase Auth using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already registered')) {
        return res.status(400).json({ message: 'User already exists' });
      }
      return res.status(400).json({ message: authError.message });
    }

    // Create profile using admin client to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: authData.user.id,
        name: name || email.split('@')[0],
        role,
        active: true
      }])
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return res.status(400).json({ message: profileError.message });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: profile.id,
        email: authData.user.email,
        name: profile.name,
        role: profile.role
      }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}