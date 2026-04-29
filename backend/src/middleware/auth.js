import { supabase, supabaseAdmin } from '../config/db.js';

// Middleware to verify JWT token from Supabase
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Get user profile with role using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ message: 'Profile not found' });
    }

    if (profile.active === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      name: profile.name
    };
    next();
  } catch (err) {
    const code = err?.cause?.code || err?.code;
    if (code === 'ENOTFOUND') {
      return res.status(503).json({
        message: 'Authentication service unreachable (Supabase DNS lookup failed). Check SUPABASE_URL/network.',
      });
    }
    return res.status(403).json({ message: 'Authentication failed' });
  }
};

// Middleware to check for roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }
    next();
  };
};

export { authenticateToken, authorizeRoles };