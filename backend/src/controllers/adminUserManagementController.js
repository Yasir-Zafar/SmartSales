import { supabaseAdmin } from '../config/db.js';
import { validatePasswordStrength } from '../config/security.js';
import { bumpTokenVersion } from './authLoginController.js';
import { revokeAllSessionsForUser } from '../utils/sessionStore.js';
import { invalidateProfileCache } from '../middleware/auth.js';

/**
 * Any admin action that changes what a user is allowed to do must also end the
 * sessions they already hold — otherwise a demoted or deactivated account keeps
 * its old powers until its access token happens to expire.
 */
async function endAllSessions(userId, reason) {
  try {
    await bumpTokenVersion(userId);
    await revokeAllSessionsForUser(userId, reason);
    invalidateProfileCache(userId);
  } catch (err) {
    console.error(`[admin] Could not revoke sessions for ${userId}:`, err?.message || err);
    throw err;
  }
}

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

  const problems = validatePasswordStrength(password);
  if (problems.length) {
    return res.status(400).json({
      message: `Password ${problems.join(', ')}`,
      code: 'WEAK_PASSWORD',
      problems,
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password
    });

    if (error) {
      console.error('Reset password error:', error);
      return res.status(400).json({ message: error.message || 'Failed to reset password' });
    }

    // Force every device holding the old password's session back to the login screen.
    await endAllSessions(id, 'admin_password_reset');

    return res.json({
      message: 'Password reset. The user has been signed out everywhere.',
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

    // A token still carries the old role claim, so the user must re-authenticate.
    await endAllSessions(id, 'role_changed');

    return res.json({
      message: 'Role updated. The user has been signed out so the new role takes effect.',
      user: await getUserWithProfileById(id)
    });
  } catch (err) {
    console.error('Update role exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error('Profiles lookup error:', profileError);
      return res.status(500).json({ message: 'Failed to fetch profiles' });
    }

    const profileIds = profiles.map((p) => p.id).filter((id) => typeof id === 'string');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (authError) {
      console.error('List users error:', authError);
      return res.status(500).json({ message: 'Failed to list users' });
    }

    const authById = (authData.users || [])
      .filter((u) => profileIds.includes(u.id))
      .reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});

    const users = profiles.map((profile) => {
      const authUser = authById[profile.id] || {};
      const safeRole = typeof profile.role === 'string' ? profile.role.trim().toUpperCase() : 'UNKNOWN';

      return {
        id: profile.id,
        email: typeof authUser.email === 'string' ? authUser.email.trim() : '',
        name: typeof profile.name === 'string' ? profile.name.trim() : '—',
        role: ['ADMIN', 'OWNER', 'ANALYST', 'STAFF'].includes(safeRole) ? safeRole : 'UNKNOWN',
        active: profile.active === undefined ? true : Boolean(profile.active),
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

    // Deactivation has to cut existing sessions immediately, not just block the
    // next sign-in. Reactivation bumps too, so the state is unambiguous.
    await endAllSessions(id, active ? 'reactivated' : 'deactivated');

    return res.json({
      message: active
        ? 'User reactivated. They can sign in again.'
        : 'User deactivated and signed out of every device.',
      user: await getUserWithProfileById(id)
    });
  } catch (err) {
    console.error('Update status exception:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

