'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'blogStudio',
  Object.freeze({
    hasProviderKey: () => ipcRenderer.invoke('settings:has-provider-key'),
    setProviderKey: (key) => ipcRenderer.invoke('settings:set-provider-key', key),
    
    // Configs & Entities
    listProviders: () => ipcRenderer.invoke('providers:list'),
    saveProvider: (provider) => ipcRenderer.invoke('providers:save', provider),
    listPrompts: () => ipcRenderer.invoke('prompts:list'),
    savePrompt: (prompt) => ipcRenderer.invoke('prompts:save', prompt),
    listDestinations: () => ipcRenderer.invoke('destinations:list'),
    saveDestination: (dest) => ipcRenderer.invoke('destinations:save', dest),

    // Blogs & Generation
    listBlogs: () => ipcRenderer.invoke('blogs:list'),
    getBlog: (id) => ipcRenderer.invoke('blogs:get', id),
    saveBlog: (blog) => ipcRenderer.invoke('blogs:save', blog),
    generateBlog: (input) => ipcRenderer.invoke('blogs:generate', input),
    
    // License
    licenseStatus: () => ipcRenderer.invoke('license:status'),
    activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
    verifyLicense: (certificate) => ipcRenderer.invoke('license:verify', certificate),
    
    // Exports
    saveExport: (request) => ipcRenderer.invoke('exports:save', request),
  }),
);
