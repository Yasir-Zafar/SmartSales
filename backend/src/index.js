import 'dotenv/config';
import express from "express";
import cors from "cors";
import jwt from 'jsonwebtoken';
import authLoginRoutes from "./routes/authLoginRoutes.js";
import adminEndpointRoutes from "./routes/adminEndpointRoutes.js";
import currentUserRoutes from "./routes/currentUserRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Login endpoint using Supabase Auth
app.use('/api/auth/login', authLoginRoutes);

// Admin-only user creation endpoint
app.use('/api/admin/create-user', adminEndpointRoutes);

// Get current user profile
app.use('/api/me', currentUserRoutes);

//Temporary get request
app.get('/', (req, res) => {
  res.send('SmartSales API is running');
});

//--------------------------------------------------------------------------------------------------
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
//--------------------------------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
});
