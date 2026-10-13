/**
 * Role-based authorization middleware
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization check.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. You do not have '${allowedRoles.join(' or ')}' privileges.`,
      });
    }

    next();
  };
}

module.exports = authorize;
