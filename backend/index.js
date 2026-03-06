const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Supabase client initialization
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Admin client with service role for user management
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

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

    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      name: profile.name
    };
    next();
  } catch (err) {
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

// --- AUTH ENDPOINTS ---

// Login endpoint using Supabase Auth
app.post('/api/auth/login', async (req, res) => {
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

    // Return Supabase session token
    res.json({
      token: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
        name: profile.name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only user creation endpoint
app.post('/api/admin/create-user', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  const { email, password, role, name } = req.body;

  if (!['OWNER', 'ANALYST', 'STAFF'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role assigned' });
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
});

// Get current user profile
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get('/', (req, res) => {
  res.send('SmartSales API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
});
