import { getPool } from '../core/database.js';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }

    const db = getPool();
    const [users] = await db.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;
    req.session.role = user.role;

    res.json({
      success: true,
      data: {
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out' });
  });
}

/**
 * GET /api/auth/me
 */
export async function me(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  res.json({
    success: true,
    data: {
      username: req.session.username,
      displayName: req.session.displayName,
      role: req.session.role,
    },
  });
}

/**
 * GET /api/users
 */
export async function getUsers(req, res) {
  try {
    const db = getPool();
    const [users] = await db.query('SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/users
 */
export async function createUser(req, res) {
  try {
    const { username, password, display_name, role } = req.body;

    if (!username || !password || !display_name) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    const db = getPool();
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      [username, passwordHash, display_name, role || 'operator'],
    );

    res.status(201).json({ success: true, message: 'User berhasil dibuat', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create user error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * PUT /api/users/:id
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { password, display_name, role, is_active } = req.body;

    const db = getPool();

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    }

    const fields = [];
    const values = [];
    if (display_name) { fields.push('display_name = ?'); values.push(display_name); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }

    if (fields.length > 0) {
      values.push(id);
      await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (error) {
    console.error('Update user error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * DELETE /api/users/:id
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' });
    }

    const db = getPool();
    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
