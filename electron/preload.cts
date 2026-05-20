import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("autoInboxGmail", {
  connect: (request: { scopes: readonly string[] }) =>
    ipcRenderer.invoke("gmail:connect", request),
  disconnect: () => ipcRenderer.invoke("gmail:disconnect"),
  getAccessToken: () => ipcRenderer.invoke("gmail:get-access-token"),
  getStatus: () => ipcRenderer.invoke("gmail:get-status"),
});

contextBridge.exposeInMainWorld("autoInboxSheets", {
  connect: (request: { spreadsheetId: string; scopes: readonly string[] }) =>
    ipcRenderer.invoke("sheets:connect", request),
  disconnect: () => ipcRenderer.invoke("sheets:disconnect"),
  getStatus: () => ipcRenderer.invoke("sheets:get-status"),
  readKnowledgeBase: (request: { spreadsheetId: string }) =>
    ipcRenderer.invoke("sheets:read-knowledge-base", request),
  appendActivityLog: (request: { spreadsheetId: string; row: unknown }) =>
    ipcRenderer.invoke("sheets:append-activity-log", request),
});
