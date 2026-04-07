import { getPool } from '../core/database.js';

/**
 * GET /api/rules
 */
export async function getRules(req, res) {
  try {
    const db = getPool();
    const [rules] = await db.query('SELECT * FROM reply_rules ORDER BY created_at DESC');
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Get rules error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/rules
 */
export async function createRule(req, res) {
  try {
    const { type, pattern, reply_text, image_url } = req.body;

    if (!type || !pattern || !reply_text) {
      return res.status(400).json({ success: false, message: 'Type, pattern, dan reply_text wajib diisi' });
    }

    if (!['keyword', 'regex'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type harus "keyword" atau "regex"' });
    }

    // Validate regex if type is regex
    if (type === 'regex') {
      try {
        new RegExp(pattern);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Pattern regex tidak valid' });
      }
    }

    const db = getPool();
    const [result] = await db.query(
      'INSERT INTO reply_rules (type, pattern, reply_text, image_url) VALUES (?, ?, ?, ?)',
      [type, pattern, reply_text, image_url || null],
    );

    res.status(201).json({ success: true, message: 'Rule berhasil dibuat', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create rule error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * PUT /api/rules/:id
 */
export async function updateRule(req, res) {
  try {
    const { id } = req.params;
    const { type, pattern, reply_text, image_url, is_active } = req.body;

    const db = getPool();

    // Validate regex if type is regex
    if (type === 'regex' && pattern) {
      try {
        new RegExp(pattern);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Pattern regex tidak valid' });
      }
    }

    const fields = [];
    const values = [];
    if (type) { fields.push('type = ?'); values.push(type); }
    if (pattern) { fields.push('pattern = ?'); values.push(pattern); }
    if (reply_text) { fields.push('reply_text = ?'); values.push(reply_text); }
    if (image_url !== undefined) { fields.push('image_url = ?'); values.push(image_url || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    }

    values.push(id);
    await db.query(`UPDATE reply_rules SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Rule berhasil diupdate' });
  } catch (error) {
    console.error('Update rule error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * DELETE /api/rules/:id
 */
export async function deleteRule(req, res) {
  try {
    const { id } = req.params;
    const db = getPool();
    await db.query('DELETE FROM reply_rules WHERE id = ?', [id]);
    res.json({ success: true, message: 'Rule berhasil dihapus' });
  } catch (error) {
    console.error('Delete rule error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * PATCH /api/rules/:id/toggle
 */
export async function toggleRule(req, res) {
  try {
    const { id } = req.params;
    const db = getPool();
    await db.query('UPDATE reply_rules SET is_active = NOT is_active WHERE id = ?', [id]);
    res.json({ success: true, message: 'Rule berhasil di-toggle' });
  } catch (error) {
    console.error('Toggle rule error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
