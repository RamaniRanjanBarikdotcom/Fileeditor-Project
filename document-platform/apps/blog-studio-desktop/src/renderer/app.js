'use strict';

const blogs = document.querySelector('#blogs');
const dialog = document.querySelector('#settings-dialog');
const activationDialog = document.querySelector('#activation-dialog');
const editorSection = document.querySelector('#editor');
const editorTitle = document.querySelector('#editor-title');
const editorContent = document.querySelector('#editor-content');
const editorStatus = document.querySelector('#editor-status');
let activeBlog = null;
document.querySelector('#settings').addEventListener('click', () => dialog.showModal());
document.querySelector('#activate').addEventListener('click', () => activationDialog.showModal());
document.querySelector('#save-key').addEventListener('click', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#provider-key');
  await window.blogStudio.setProviderKey(input.value);
  input.value = '';
  dialog.close();
});
document.querySelector('#activate-license').addEventListener('click', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#license-key');
  const status = document.querySelector('#activation-status');
  status.textContent = 'Contacting AppToolkitLab…';
  try {
    await window.blogStudio.activateLicense(input.value);
    input.value = '';
    status.textContent = '';
    activationDialog.close();
    await renderLicenseStatus();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Activation failed.';
  }
});
document.querySelector('#generate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const topic = document.querySelector('#topic').value.trim();
  const status = document.querySelector('#generation-status');
  status.textContent = 'Running the checkpointed generation pipeline…';
  try {
    await window.blogStudio.generateBlog({
      topic,
      keywords: [],
      language: 'English',
      writingStyle: 'Educational',
      tone: 'Professional',
      targetLength: 1200,
    });
    status.textContent = 'Article created locally.';
    await render();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Generation failed.';
  }
});
document.querySelector('#close-editor').addEventListener('click', () => {
  editorSection.hidden = true;
  activeBlog = null;
});
document.querySelector('#save-blog').addEventListener('click', async () => {
  if (!activeBlog) return;
  editorStatus.textContent = 'Saving locally…';
  try {
    activeBlog = await window.blogStudio.saveBlog({
      id: activeBlog.id,
      title: editorTitle.value,
      html: editorContent.innerHTML,
      metadata: parseMetadata(activeBlog.metadata),
    });
    editorStatus.textContent = 'Saved on this device.';
    await render();
  } catch (error) {
    editorStatus.textContent = error instanceof Error ? error.message : 'Save failed.';
  }
});
document.querySelector('#export-html').addEventListener('click', () => exportActive('html'));
document.querySelector('#export-markdown').addEventListener('click', () => exportActive('md'));

async function render() {
  const rows = await window.blogStudio.listBlogs();
  blogs.replaceChildren(
    ...rows.map((blog) => {
      const article = document.createElement('article');
      const title = document.createElement('strong');
      const updated = document.createElement('span');
      title.textContent = blog.title;
      updated.textContent = new Date(blog.updatedAt).toLocaleString();
      article.tabIndex = 0;
      article.addEventListener('click', () => openEditor(blog.id));
      article.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void openEditor(blog.id);
      });
      article.append(title, updated);
      return article;
    }),
  );
}
async function openEditor(id) {
  activeBlog = await window.blogStudio.getBlog(id);
  if (!activeBlog) return;
  editorTitle.value = activeBlog.title;
  editorContent.innerHTML = activeBlog.html;
  editorStatus.textContent = '';
  editorSection.hidden = false;
  editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function exportActive(format) {
  if (!activeBlog) return;
  const title = editorTitle.value || activeBlog.title;
  const html = editorContent.innerHTML;
  const content =
    format === 'html'
      ? `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`
      : htmlToMarkdown(html);
  const result = await window.blogStudio.saveExport({ title, format, content });
  editorStatus.textContent = result.saved ? `Saved to ${result.filePath}` : 'Export cancelled.';
}
function parseMetadata(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || {};
  } catch {
    return {};
  }
}
function htmlToMarkdown(value) {
  return value
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<[^>]+>/g, '')
    .trim();
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character],
  );
}
async function renderLicenseStatus() {
  const state = await window.blogStudio.licenseStatus();
  const label = document.querySelector('#license-state');
  label.textContent = state.valid ? 'Activated' : 'Activation required';
  label.classList.toggle('valid', Boolean(state.valid));
}
void renderLicenseStatus();
void render();
