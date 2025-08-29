// backend/src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import config from '../config/config.js';

// ✅ The function must be declared as a constant named 'authMiddleware'
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ This line then exports that constant
export default authMiddleware;