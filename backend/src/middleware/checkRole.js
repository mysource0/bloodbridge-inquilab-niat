// backend/src/middleware/checkRole.js

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: No role assigned' });
    }
    const userRole = req.user.role;
    if (roles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

export default checkRole; // <-- CORRECTED LINE
