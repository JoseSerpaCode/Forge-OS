import db from '../lib/db';
import crypto from 'crypto';

export type NotificationType = 'assign' | 'mention' | 'sprint' | 'system' | 'info';

export const NotificationService = {
  /**
   * Create a notification for a user, respecting their mute settings.
   *
   * Devuelve si se creó. Quien quiera mandar además un aviso fuera de la app
   * (Web Push) lo hace solo si esto dice que sí: así un silencio vale para las
   * dos cosas.
   */
  notify(userId: string, type: NotificationType, title: string, message: string, linkUrl?: string): boolean {
    // 1. Fetch user mute settings
    const user = db.prepare(`
      SELECT notif_mute_all, notif_mute_assign, notif_mute_mention, notif_mute_sprint, notif_mute_system 
      FROM users WHERE id = ?
    `).get(userId) as any;

    if (!user) return false; // User doesn't exist

    // 2. Check global mute
    if (user.notif_mute_all) return false;

    // 3. Check category mute
    if (type === 'assign' && user.notif_mute_assign) return false;
    if (type === 'mention' && user.notif_mute_mention) return false;
    if (type === 'sprint' && user.notif_mute_sprint) return false;
    if (type === 'system' && user.notif_mute_system) return false;

    // 4. Insert notification
    const notifId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(notifId, userId, type, title, message, linkUrl || null, createdAt);

    // 5. Broadcast to Socket.io
    process.emit('forge_notification', {
      id: notifId,
      userId,
      type,
      title,
      message,
      link_url: linkUrl || null,
      created_at: createdAt
    });
    return true;
  },

  getUnreadCount(userId: string) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`).get(userId) as any;
    return row.count;
  },

  getNotifications(userId: string, limit = 50) {
    return db.prepare(`
      SELECT id, type, title, message, is_read, link_url, created_at 
      FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);
  },

  markAsRead(userId: string, notifId?: string) {
    if (notifId) {
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(notifId, userId);
    } else {
      // Mark all as read
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(userId);
    }
  }
};
