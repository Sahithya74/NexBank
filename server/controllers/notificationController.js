'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const notificationService = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  return ok(res, await notificationService.list(req.user.id, req.query));
});

const unreadCount = asyncHandler(async (req, res) => {
  return ok(res, { unread: await notificationService.unreadCount(req.user.id) });
});

const markRead = asyncHandler(async (req, res) => {
  return ok(res, await notificationService.markRead(req.user.id, req.params.id), 'Marked as read.');
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.user.id);
  return ok(res, result, 'All notifications marked as read.');
});

const remove = asyncHandler(async (req, res) => {
  return ok(res, await notificationService.remove(req.user.id, req.params.id), 'Notification removed.');
});

module.exports = { list, unreadCount, markRead, markAllRead, remove };
