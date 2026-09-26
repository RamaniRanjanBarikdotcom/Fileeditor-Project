'use strict';

const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { BlogEngine, sanitizeGeneratedHtml } = require('@docconv/blog-engine');
const { BlogDatabase } = require('./database.cjs');
const { verifyOfflineCertificate, machineFingerprint } = require('./license.cjs');
const { autoUpdater } = require('electron-updater');

let database;
const apiBaseUrl = (
  process.env.APPTOOLKITLAB_API_URL || 'https://apptoolkitlab.com/api/v1'
).replace(/\/$/, '');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  window.removeMenu();
  void window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  const dataDirectory = app.getPath('userData');
  database = new BlogDatabase(path.join(dataDirectory, 'blog-studio.sqlite'));
  registerIpc(dataDirectory);
  createWindow();

  // Setup auto-updater
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Auto-updater error:', err);
  });
});

app.on('window-all-closed', () => app.quit());

function registerIpc(dataDirectory) {
  ipcMain.handle('settings:set-provider-key', async (_event, value) => {
    assertString(value, 'Provider key', 4096);
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('OS-backed credential encryption is unavailable.');
    database.setSetting('providerKey', safeStorage.encryptString(value).toString('base64'));
    return { saved: true };
  });

  ipcMain.handle('settings:has-provider-key', () => Boolean(database.getSetting('providerKey')));
  ipcMain.handle('license:status', () => currentLicenseStatus());
  ipcMain.handle('license:activate', async (_event, rawKey) => {
    const key = assertString(rawKey, 'License key', 200);
    const response = await fetch(`${apiBaseUrl}/licenses/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'BlogStudioDesktop' },
      body: JSON.stringify({
        key,
        machineHash: machineFingerprint(),
        deviceInfo: `${process.platform} ${process.arch} / Blog Studio ${app.getVersion()}`,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data?.offlineCertificate) {
      throw new Error(
        payload?.message || payload?.error?.message || `Activation failed (${response.status}).`,
      );
    }
    const verification = verifyOfflineCertificate(
      payload.data.offlineCertificate,
      machineFingerprint(),
    );
    if (!verification.valid)
      throw new Error(verification.reason || 'The activation certificate is invalid.');
    database.setSetting('offlineLicenseCertificate', payload.data.offlineCertificate);
    return verification;
  });
  ipcMain.handle('providers:list', () => database.listProviders());
  ipcMain.handle('providers:save', (_event, provider) => {
    // Basic validation
    if (!provider.id || !provider.name) throw new Error('Invalid provider payload');
    database.saveProvider(provider);
    return true;
  });

  ipcMain.handle('prompts:list', () => database.listPrompts());
  ipcMain.handle('prompts:save', (_event, prompt) => {
    if (!prompt.id || !prompt.name) throw new Error('Invalid prompt payload');
    database.savePrompt(prompt);
    return true;
  });

  ipcMain.handle('destinations:list', () => database.listDestinations());
  ipcMain.handle('destinations:save', (_event, dest) => {
    if (!dest.id || !dest.name || !dest.platform) throw new Error('Invalid destination payload');
    database.saveDestination(dest);
    return true;
  });

  ipcMain.handle('blogs:list', () => database.listBlogs());
  ipcMain.handle('blogs:get', (_event, id) => database.getBlog(assertId(id)));
  ipcMain.handle('blogs:save', (_event, blog) => database.saveBlog(validateBlog(blog)));
  ipcMain.handle('blogs:generate', async (_event, rawInput) => {
    const license = currentLicenseStatus();
    if (!license.valid)
      throw new Error(
        license.reason || 'Activate Blog Studio Desktop before generating an article.',
      );
    const input = validateGenerationInput(rawInput);
    
    // Multi-provider BYOK support
    let apiKey = '';
    let apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    let modelName = 'gpt-5-mini';
    let isAnthropic = false;

    if (input.providerId && input.providerId !== 'default') {
      const provider = database.getProvider(input.providerId);
      if (!provider || !provider.config.apiKey) throw new Error('Selected provider has no API key configured.');
      if (safeStorage.isEncryptionAvailable()) {
         try {
           apiKey = safeStorage.decryptString(Buffer.from(provider.config.apiKey, 'base64'));
         } catch {
           apiKey = provider.config.apiKey; // Fallback if not base64/encrypted
         }
      } else {
         apiKey = provider.config.apiKey;
      }
      modelName = provider.config.model || modelName;
      if (provider.name.toLowerCase().includes('anthropic')) {
         apiEndpoint = 'https://api.anthropic.com/v1/messages';
         isAnthropic = true;
      }
    } else {
      const encrypted = database.getSetting('providerKey');
      if (!encrypted || !safeStorage.isEncryptionAvailable())
        throw new Error('Configure an encrypted AI provider key first.');
      apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    }

    const jobId = crypto.randomUUID();
    const engine = new BlogEngine({
      ai: {
        async generateStructured({ stage, system, prompt, schema }) {
          let requestBody = {};
          let headers = { 'Content-Type': 'application/json' };

          if (isAnthropic) {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            requestBody = {
              model: modelName,
              max_tokens: 4096,
              system: system,
              messages: [{ role: 'user', content: prompt }],
              // Claude doesn't directly support OpenAI json_schema yet natively without tools,
              // but we stub the format for compatibility in this demo
            };
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
            requestBody = {
              model: modelName,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
              ],
              response_format: {
                type: 'json_schema',
                json_schema: { name: `desktop_blog_${stage}`, strict: true, schema },
              },
            };
          }

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(90_000),
          });
          if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
          const payload = await response.json();
          let content = '';
          if (isAnthropic) {
             content = payload.content?.[0]?.text;
          } else {
             content = payload.choices?.[0]?.message?.content;
          }
          
          if (!content) throw new Error('AI provider returned no content.');
          return {
            value: JSON.parse(content),
            inputTokens: payload.usage?.prompt_tokens || payload.usage?.input_tokens || 0,
            outputTokens: payload.usage?.completion_tokens || payload.usage?.output_tokens || 0,
            model: payload.model || modelName,
          };
        },
      },
      checkpoint: {
        load: async () => database.getCheckpoint(jobId),
        save: async (checkpoint) =>
          database.saveCheckpoint(jobId, checkpoint.completedStages.at(-1) || 'queued', checkpoint),
      },
    });
    const result = await engine.generate(input);
    const blog = database.saveBlog({
      id: crypto.randomUUID(),
      title: result.title,
      html: sanitizeGeneratedHtml(result.html),
      metadata: JSON.stringify({
        ...result.metadata,
        keywords: result.keywords,
        seoScore: result.seoScore,
        usage: result.usage,
      }),
    });
    database.deleteCheckpoint(jobId);
    return blog;
  });

  ipcMain.handle('license:verify', (_event, certificate) => {
    assertString(certificate, 'Certificate', 32_000);
    return verifyOfflineCertificate(certificate, machineFingerprint());
  });

  ipcMain.handle('exports:save', async (_event, request) => {
    const content = assertString(request?.content, 'Export content', 10_000_000);
    const format = ['md', 'html'].includes(request?.format) ? request.format : null;
    if (!format) throw new Error('Unsupported local export format.');
    const result = await dialog.showSaveDialog({
      defaultPath: `${safeFilename(request?.title || 'article')}.${format}`,
      filters: [{ name: format === 'md' ? 'Markdown' : 'HTML', extensions: [format] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, content, { encoding: 'utf8', mode: 0o600 });
    return { saved: true, filePath: result.filePath };
  });

  ipcMain.handle('app:data-directory', () => path.join(dataDirectory, 'article-images'));

  function currentLicenseStatus() {
    const certificate = database.getSetting('offlineLicenseCertificate');
    if (!certificate) return { valid: false, reason: 'Blog Studio Desktop is not activated.' };
    try {
      return verifyOfflineCertificate(certificate, machineFingerprint());
    } catch {
      return { valid: false, reason: 'The stored activation certificate is invalid.' };
    }
  }
}

function validateBlog(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid blog payload.');
  return {
    id: value.id ? assertId(value.id) : crypto.randomUUID(),
    title: assertString(value.title, 'Title', 200),
    html: sanitizeGeneratedHtml(assertString(value.html, 'Article', 10_000_000)),
    metadata: JSON.stringify(value.metadata || {}),
  };
}

function validateGenerationInput(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid generation request.');
  return {
    providerId: value.providerId,
    promptTemplateId: value.promptTemplateId,
    topic: assertString(value.topic, 'Topic', 300),
    keywords: Array.isArray(value.keywords)
      ? value.keywords.slice(0, 20).map((item) => assertString(item, 'Keyword', 80))
      : [],
    focusKeyword: value.focusKeyword
      ? assertString(value.focusKeyword, 'Focus keyword', 120)
      : undefined,
    language: assertString(value.language || 'English', 'Language', 80),
    writingStyle: assertString(value.writingStyle || 'Educational', 'Writing style', 80),
    tone: assertString(value.tone || 'Professional', 'Tone', 80),
    targetLength:
      Number.isInteger(value.targetLength) &&
      value.targetLength >= 300 &&
      value.targetLength <= 10000
        ? value.targetLength
        : 1200,
  };
}

function assertId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new Error('Invalid identifier.');
  return value;
}

function assertString(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new Error(`${label} is invalid.`);
  return value;
}

function safeFilename(value) {
  return (
    String(value)
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'article'
  );
}
