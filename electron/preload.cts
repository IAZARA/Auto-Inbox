import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("autoInboxGmail", {
  connect: (request: { scopes: readonly string[] }) =>
    ipcRenderer.invoke("gmail:connect", request),
  disconnect: () => ipcRenderer.invoke("gmail:disconnect"),
  getAccessToken: () => ipcRenderer.invoke("gmail:get-access-token"),
  getStatus: () => ipcRenderer.invoke("gmail:get-status"),
});
