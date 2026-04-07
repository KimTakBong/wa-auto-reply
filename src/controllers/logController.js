import { getPool } from '../core/database.js';

/**
 * GET /api/logs
 * Query params: page, limit, direction, from_number
 */
export async function getLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { direction, from_number } = req.query;

    const db = getPool();

    // Build where clause
    const whereClauses = [];
    const whereValues = [];
    if (direction) { whereClauses.push('direction = ?'); whereValues.push(direction); }
    if (from_number) { whereClauses.push('from_number = ?'); whereValues.push(from_number); }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM message_logs ${whereSql}`, whereValues);
    const total = countRows[0].total;

    // Get data
    const [rows] = await db.query(
      `SELECT * FROM message_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...whereValues, limit, offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * DELETE /api/logs
 * Query params: days (optional) - hapus log lebih lama dari X hari
 */
export async function flushLogs(req, res) {
  try {
    const db = getPool();
    const { days } = req.query;

    if (days) {
      // Hapus log lebih lama dari X hari
      const [result] = await db.query(
        'DELETE FROM message_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [parseInt(days)],
      );
      res.json({ success: true, message: `Berhasil menghapus ${result.affectedRows} log (lebih lama dari ${days} hari)` });
    } else {
      // Hapus semua log
      const [result] = await db.query('DELETE FROM message_logs');
      res.json({ success: true, message: `Berhasil menghapus ${result.affectedRows} log` });
    }
  } catch (error) {
    console.error('Flush logs error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
