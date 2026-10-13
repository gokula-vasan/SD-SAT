const notificationRepository = require('../repositories/notificationRepository');

class NotificationService {
  async getUserNotifications(userId, limit = 50) {
    const notifications = await notificationRepository.findByUserId(userId, { limit });
    const unreadCount = await notificationRepository.countUnread(userId);
    return {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
        relatedTransferId: n.relatedTransferId ? n.relatedTransferId.toString() : null,
      })),
      unreadCount,
    };
  }

  async markAsRead(id, userId) {
    const updated = await notificationRepository.markAsRead(id, userId);
    if (!updated) {
      const error = new Error('Notification not found or unauthorized.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }
    return { success: true, message: 'Notification marked as read.' };
  }

  async markAllAsRead(userId) {
    await notificationRepository.markAllAsRead(userId);
    return { success: true, message: 'All notifications marked as read.' };
  }
}

module.exports = new NotificationService();
