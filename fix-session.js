import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.resolve(__dirname, 'auth_store');

async function fixSession() {
  console.log('🔧 Fixing WhatsApp session...');
  console.log('📁 Auth dir:', authDir);

  // Check if auth store exists
  if (!fs.existsSync(authDir)) {
    console.log('❌ auth_store not found. Need to scan fresh QR.');
    return;
  }

  // List files
  const files = fs.readdirSync(authDir);
  console.log('📋 Files in auth_store:', files);

  // Try to load session
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    console.log('✅ Session loaded successfully');
    console.log('📊 Me:', state.creds.me);
    console.log('🔑 Pre-keys:', Object.keys(state.keys.preKeys || {}).length);
    
    // Check if we have valid me
    if (state.creds.me && state.creds.me.id) {
      console.log('✅ Session has valid me.id:', state.creds.me.id);
      
      // Clean up old prekeys to prevent conflict
      const prekeyDir = path.join(authDir, 'pre-key');
      if (fs.existsSync(prekeyDir)) {
        const prekeys = fs.readdirSync(prekeyDir);
        console.log('🗝️ Pre-keys count:', prekeys.length);
        
        if (prekeys.length > 0) {
          console.log('🧹 Cleaning old pre-keys...');
          fs.rmSync(prekeyDir, { recursive: true, force: true });
          console.log('✅ Pre-keys cleaned');
        }
      }

      console.log('\n✨ Session fixed! Restart bot now.');
    } else {
      console.log('⚠️ Session has no me.id - need fresh QR scan');
    }
  } catch (error) {
    console.error('❌ Failed to load session:', error.message);
    console.log('💡 Try clearing auth_store and scanning fresh QR');
  }
}

fixSession().then(() => process.exit(0));
