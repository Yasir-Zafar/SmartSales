import { supabaseAdmin } from '../config/db.js';

// Helper to combine auth user and profile
async function getUserWithProfileById(id) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authError) {
    throw authError;
  }

  const authUser = authData.users.find((u) => u.id === id);
  if (!authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: authUser.id,
    email: authUser.email,
    name: profile.name,
    role: profile.role,
    active: profile.active
  };
}

export async function findUserByEmail(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (authError) {
      console.error('List users error:', authError);
      return res.status(500).json({ message: 'Failed to search users' });
    }

    const authUser = authData.users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return res.status(404).json({ message: 'User profile not found' });
    }

    return res.json({
      user: {
        id: authUser.id,
        email: authUser.email,
        name: profile.name,
        role: profile.role,
        active: profile.active
      }
    });
  } catch (err) {
    console.error('Find user by email error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function resetUserPassword(req, res) {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password
    });

    if (error) {
      console.error('Reset password error:', error);
      return res.status(400).json({ message: error.message || 'Failed to reset password' });
    }

    return res.json({
      message: 'Password reset successfully',
      userId: data.user.id
    });
  } catch (err) {
    console.error('Reset password exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ['OWNER', 'ANALYST', 'STAFF', 'ADMIN'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role assigned' });
  }

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (profileError || !profile) {
      console.error('Update role error:', profileError);
      return res.status(400).json({ message: 'Failed to update user role' });
    }

    return res.json({
      message: 'Role updated successfully',
      user: await getUserWithProfileById(id)
    });
  } catch (err) {
    console.error('Update role exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (authError) {
      console.error('List users error:', authError);
      return res.status(500).json({ message: 'Failed to list users' });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error('Profiles lookup error:', profileError);
      return res.status(500).json({ message: 'Failed to fetch profiles' });
    }

    const profileById = profiles.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});

    const users = (authData.users || []).map((u) => {
      const profile = profileById[u.id] || {};
      return {
        id: u.id,
        email: u.email,
        name: profile.name || '',
        role: profile.role || 'UNKNOWN',
        active: profile.active === undefined ? true : profile.active,
        last_logged_in: profile.last_logged_in || null
      };
    });

    return res.json({ users });
  } catch (err) {
    console.error('Get all users exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { active } = req.body;

  if (typeof active !== 'boolean') {
    return res.status(400).json({ message: 'Active status must be a boolean' });
  }

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ active })
      .eq('id', id)
      .select()
      .single();

    if (profileError || !profile) {
      console.error('Update status error:', profileError);
      return res.status(400).json({ message: 'Failed to update user status' });
    }

    return res.json({
      message: `User ${active ? 'activated' : 'deactivated'} successfully`,
      user: await getUserWithProfileById(id)
    });
  } catch (err) {
    console.error('Update status exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

