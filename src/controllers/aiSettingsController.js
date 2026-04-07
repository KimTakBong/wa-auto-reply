import { getAISettings, updateAISettings, resetAISettings } from '../services/aiSettingsService.js';

/**
 * GET /api/ai-settings
 */
export async function getSettings(req, res) {
  try {
    const settings = await getAISettings();
    if (!settings) {
      return res.status(404).json({ success: false, message: 'AI settings not found' });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get AI settings error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * PUT /api/ai-settings
 */
export async function updateSettings(req, res) {
  try {
    await updateAISettings(req.body);
    res.json({ success: true, message: 'AI settings berhasil diupdate' });
  } catch (error) {
    console.error('Update AI settings error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/ai-settings/reset
 */
export async function resetSettings(req, res) {
  try {
    await resetAISettings();
    res.json({ success: true, message: 'AI settings berhasil direset' });
  } catch (error) {
    console.error('Reset AI settings error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
