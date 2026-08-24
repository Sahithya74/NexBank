'use strict';

/**
 * One response envelope for the whole API.
 *   success: { success: true,  data, message }
 *   failure: { success: false, error: { code, message, details } }
 */

function ok(res, data = null, message = '') {
  return res.status(200).json({ success: true, data, message });
}

function created(res, data = null, message = '') {
  return res.status(201).json({ success: true, data, message });
}

function noContent(res) {
  return res.status(204).send();
}

function paginated(res, items, { page, limit, total }, message = '') {
  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    },
    message,
  });
}

module.exports = { ok, created, noContent, paginated };
