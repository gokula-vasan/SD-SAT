const authService = require('../services/authService');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');

class AuthController {
  async register(req, res, next) {
    try {
      const validation = validateRegisterInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors[0],
          errors: validation.errors,
        });
      }

      const { fullName, email, password } = req.body;
      const result = await authService.register({ fullName, email, password });

      return res.status(201).json({
        success: true,
        message: 'Registration successful! Simulated bank account created.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const validation = validateLoginInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors[0],
          errors: validation.errors,
        });
      }

      const { email, password } = req.body;
      const result = await authService.login({ email, password });

      return res.status(200).json({
        success: true,
        message: 'Login successful!',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      const result = await authService.getMe(req.user.id);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }
}

module.exports = new AuthController();
