import React from "react";
import ReactDOM from "react-dom/client";
import {
  Archive,
  ArrowLeft,
  AtSign,
  Bold,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  FilePenLine,
  Filter,
  Hexagon,
  Inbox,
  Info,
  Italic,
  Link,
  List,
  Mail,
  MoreVertical,
  Pause,
  PenLine,
  RefreshCcw,
  Reply,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
} from "lucide-react";
import { canRunGmailSync, runGmailInboxSync } from "./automation/inboxEngine";
import {
  defaultHeartbeatIntervalSeconds,
  formatSeconds,
  getNextSyncAt,
  heartbeatIntervals,
  loadPersistedGmailHeartbeat,
  persistGmailHeartbeat,
} from "./automation/syncScheduler";
import { loadPersistedInboxState, persistInboxState } from "./automation/localState";
import { createGmailDraft, getMessageMetadata, listInboxMessages, listNewInboxHistory } from "./gmail/gmailApi";
import { analyzeEmail, getAutoInboxAIStatus, hasDesktopAIBridge } from "./ai/aiBridge";
import type { AutoInboxAIStatus } from "./ai/types";
import {
  connectGmailOAuth,
  disconnectGmailOAuth,
  getDesktopGmailStatus,
  getGmailAccessToken,
  hasDesktopGmailBridge,
  simulateInboxSync,
} from "./gmail/oauthBridge";
import {
  GMAIL_SCOPES,
  type GmailBridgeMode,
  type GmailConnectionStatus,
  type GmailMessageSummary,
  type GmailSyncSnapshot,
} from "./gmail/types";
import { extractSpreadsheetId } from "./sheets/sheetsApi";
import {
  appendSheetActivityLog,
  connectSheets,
  disconnectSheets,
  getDesktopSheetsStatus,
  hasDesktopSheetsBridge,
  readSheetsKnowledgeBase,
} from "./sheets/sheetsBridge";
import {
  AUTO_INBOX_SHEET_TABS,
  SHEETS_SCOPES,
  type SheetActivityRow,
  type SheetsKnowledgeBase,
  type SheetsBridgeMode,
  type SheetsConnectionStatus,
  type SheetsSyncSnapshot,
} from "./sheets/types";
import "./styles.css";

type Language = "en" | "es";
type Theme = "light" | "dark";
type MailStatus = "draft" | "ready" | "waiting" | "sent" | "gmailDraft";
type MailFolder = "all" | "unreplied" | "flagged";
type IntentKey =
  | "unknown"
  | "shippingIssue"
  | "returnRequest"
  | "pricing"
  | "billing"
  | "accountAccess"
  | "sales"
  | "shipping";
type TimeKey = "tenTwentyFour" | "nineFifteen" | "yesterday" | "tuesday";
type SourceKey =
  | "general"
  | "shipping"
  | "returns"
  | "pricing"
  | "billing"
  | "account"
  | "sales"
  | "googleSheets";
type SatisfactionKey = "positive" | "neutral" | "new";
type LastContactKey = "today" | "yesterday" | "twoDaysAgo" | "threeDaysAgo" | "oneWeekAgo" | "tuesday";
type IntegrationTone = "connected" | "syncing" | "idle" | "error";

type MailItem = {
  id: string;
  gmailMessageId?: string;
  threadId?: string;
  gmailDraftId?: string;
  sender: string;
  initials: string;
  email: string;
  subject: string;
  preview: string;
  body: string[];
  intentKey: IntentKey;
  intentLabel?: string;
  confidence: number;
  timeKey?: TimeKey;
  timeLabel?: string;
  status: MailStatus;
  unread?: boolean;
  accent: string;
  sourceKey: SourceKey;
  answer: string;
  knowledgeMatches?: KnowledgeMatch[];
  activityItems?: string[];
  history: {
    conversations: number;
    lastContactKey: LastContactKey;
    satisfactionKey: SatisfactionKey;
  };
};

type KnowledgeMatch = {
  question: string;
  answer: string;
  sourceKey?: SourceKey;
  source?: string;
};

type LocaleContent = {
  knowledgeMatches: KnowledgeMatch[];
  activityItems: string[];
};

const themeStorageKey = "auto-inbox:theme";

const copy = {
  en: {
    ariaMailbox: "Mailbox",
    formattingToolbar: "Formatting toolbar",
    pauseProcessing: "Pause processing",
    resumeProcessing: "Resume processing",
    folders: {
      all: "All",
      unreplied: "Unreplied",
      flagged: "Flagged",
    },
    nav: {
      inbox: "Inbox",
      drafts: "Drafts",
      sent: "Sent",
      allMail: "All Mail",
      spam: "Spam",
      trash: "Trash",
      rules: "Rules",
      signatures: "Signatures",
      settings: "Settings",
    },
    sections: {
      automation: "Automation",
      integrations: "Integrations",
      mode: "Mode",
      settings: "Settings",
      knowledge: "FAQ / Knowledge base matches",
      customerHistory: "Customer history",
      suggestedReply: "AI suggested reply",
      activityLog: "Activity log",
    },
    connected: "Connected",
    gmail: {
      title: "Gmail connection",
      description:
        "Ready for Google OAuth in the desktop app. The browser build uses a safe demo bridge until Tauri or Electron provides the secure token flow.",
      desktopReady: "Desktop OAuth bridge detected",
      demoReady: "Demo bridge active",
      connect: "Connect Gmail",
      syncNow: "Sync now",
      disconnect: "Disconnect",
      autoSync: "Auto-sync",
      checkEvery: "Check every",
      account: "Account",
      lastSync: "Last sync",
      historyId: "History ID",
      loadedMessages: "Loaded messages",
      newMessages: "New emails",
      duplicatesSkipped: "Duplicates skipped",
      seenMessages: "Seen IDs",
      nextCheck: "Next check",
      pausedByQueue: "Paused",
      duplicateGuard: "Duplicate guard",
      scopes: "Scopes",
      neverSynced: "Not synced yet",
      noAccount: "No account",
      noHistory: "Waiting for first sync",
      errorHelp: "The Gmail connection needs attention. Try reconnecting.",
      mode: {
        "desktop-oauth": "Desktop OAuth",
        "demo-bridge": "Demo bridge",
      },
      status: {
        disconnected: "Disconnected",
        connecting: "Connecting",
        connected: "Connected",
        syncing: "Syncing",
        error: "Needs attention",
      },
    },
    sheets: {
      title: "Google Sheets",
      description:
        "MVP mode: paste a Google Sheet URL or spreadsheet ID to load FAQ, rules, and activity logs.",
      desktopReady: "Desktop Sheets bridge detected",
      demoReady: "Demo sheet active",
      connect: "Connect sheet",
      reload: "Reload FAQ",
      logDemo: "Log selected email",
      disconnect: "Disconnect",
      spreadsheetId: "Spreadsheet ID",
      spreadsheetPlaceholder: "Paste Google Sheet URL or ID",
      spreadsheet: "Spreadsheet",
      lastSync: "Last sync",
      faqRows: "FAQ rows",
      ruleRows: "Rule rows",
      activityRows: "Activity rows",
      expectedTabs: "Expected tabs",
      scopes: "Scopes",
      neverSynced: "Not synced yet",
      noSpreadsheet: "No spreadsheet",
      errorHelp: "Sheets could not connect. Check the spreadsheet ID and permissions.",
      mode: {
        "desktop-oauth": "Desktop OAuth",
        "demo-bridge": "Demo bridge",
      },
      status: {
        disconnected: "Disconnected",
        connecting: "Connecting",
        connected: "Connected",
        syncing: "Syncing",
        error: "Needs attention",
      },
    },
    ai: {
      configured: "Configured",
      missingKey: "Missing API key",
      demo: "Demo AI",
      error: "Needs attention",
      analyzing: "Analyzing",
      title: "AI provider",
      provider: "Provider",
      model: "Model",
      apiKey: "API key env",
      baseUrl: "Base URL",
      noBaseUrl: "Default endpoint",
    },
    draftFirstMode: "Draft-first (review required)",
    language: "Language",
    languageName: {
      en: "English",
      es: "Spanish",
    },
    theme: "Theme",
    themeName: {
      light: "Light",
      dark: "Dark",
    },
    searchPlaceholder: "Search emails...",
    filter: "Filter",
    toolbar: {
      back: "Back",
      archive: "Archive",
      info: "Info",
      snooze: "Snooze",
      trash: "Trash",
      markUnread: "Mark unread",
      tag: "Tag",
      more: "More",
      reply: "Reply",
      undo: "Undo",
      regenerate: "Regenerate",
      bold: "Bold",
      italic: "Italic",
      bulletedList: "Bulleted list",
      link: "Link",
    },
    to: "to",
    chips: {
      intent: "Intent",
      confidence: "Confidence",
    },
    table: {
      question: "Question",
      answer: "Answer",
      source: "Source",
    },
    metrics: {
      totalConversations: "Total conversations",
      lastContact: "Last contact",
      satisfaction: "Satisfaction",
      nextCheckIn: "Next check in",
      processedToday: "Processed today",
    },
    status: {
      draft: "Draft",
      ready: "Ready",
      waiting: "Ignored",
      sent: "Sent",
      gmailDraft: "Gmail draft",
    },
    intents: {
      unknown: "Unknown",
      shippingIssue: "Shipping Issue",
      returnRequest: "Return Request",
      pricing: "Pricing",
      billing: "Billing",
      accountAccess: "Account Access",
      sales: "Sales",
      shipping: "Shipping",
    },
    sources: {
      general: "Knowledge base",
      shipping: "Shipping_FAQ",
      returns: "Returns_FAQ",
      pricing: "Pricing_FAQ",
      billing: "Billing_FAQ",
      account: "Account_FAQ",
      sales: "Sales_FAQ",
      googleSheets: "Google Sheets",
    },
    time: {
      tenTwentyFour: "10:24 AM",
      nineFifteen: "9:15 AM",
      yesterday: "Yesterday",
      tuesday: "Tuesday",
    },
    lastContact: {
      today: "Today",
      yesterday: "Yesterday",
      twoDaysAgo: "2 days ago",
      threeDaysAgo: "3 days ago",
      oneWeekAgo: "1 week ago",
      tuesday: "Tuesday",
    },
    satisfaction: {
      positive: "Positive",
      neutral: "Neutral",
      new: "New",
    },
    running: "Running",
    paused: "Paused",
    draft: "Draft",
    generatedReply: "Generated reply",
    regenerate: "Regenerate",
    send: "Create draft",
    sentAction: "Draft created",
    draftNote: "Draft-first mode - A Gmail draft is created for manual review.",
    viewAll: "View all",
    noDraft: "No suggested reply is available for this message.",
    minuteValue: "2 min",
  },
  es: {
    ariaMailbox: "Buz\u00f3n",
    formattingToolbar: "Barra de formato",
    pauseProcessing: "Pausar proceso",
    resumeProcessing: "Reanudar proceso",
    folders: {
      all: "Todo",
      unreplied: "Sin responder",
      flagged: "Marcados",
    },
    nav: {
      inbox: "Bandeja",
      drafts: "Borradores",
      sent: "Enviados",
      allMail: "Todo el correo",
      spam: "Spam",
      trash: "Papelera",
      rules: "Reglas",
      signatures: "Firmas",
      settings: "Configuraci\u00f3n",
    },
    sections: {
      automation: "Automatizaci\u00f3n",
      integrations: "Integraciones",
      mode: "Modo",
      settings: "Configuraci\u00f3n",
      knowledge: "FAQ / Base de conocimiento",
      customerHistory: "Historial del cliente",
      suggestedReply: "Respuesta sugerida por IA",
      activityLog: "Registro de actividad",
    },
    connected: "Conectado",
    gmail: {
      title: "Conexi\u00f3n Gmail",
      description:
        "Preparado para Google OAuth en la app de escritorio. La versi\u00f3n web usa un bridge demo seguro hasta que Tauri o Electron provea el flujo de token.",
      desktopReady: "Bridge OAuth de escritorio detectado",
      demoReady: "Bridge demo activo",
      connect: "Conectar Gmail",
      syncNow: "Sincronizar",
      disconnect: "Desconectar",
      autoSync: "Sincronizaci\u00f3n autom\u00e1tica",
      checkEvery: "Revisar cada",
      account: "Cuenta",
      lastSync: "\u00daltima sincronizaci\u00f3n",
      historyId: "ID de historial",
      loadedMessages: "Mensajes cargados",
      newMessages: "Emails nuevos",
      duplicatesSkipped: "Duplicados omitidos",
      seenMessages: "IDs vistos",
      nextCheck: "Pr\u00f3xima revisi\u00f3n",
      pausedByQueue: "Pausado",
      duplicateGuard: "Control de duplicados",
      scopes: "Permisos",
      neverSynced: "A\u00fan sin sincronizar",
      noAccount: "Sin cuenta",
      noHistory: "Esperando primera sincronizaci\u00f3n",
      errorHelp: "La conexi\u00f3n Gmail necesita atenci\u00f3n. Prob\u00e1 reconectar.",
      mode: {
        "desktop-oauth": "OAuth de escritorio",
        "demo-bridge": "Bridge demo",
      },
      status: {
        disconnected: "Desconectado",
        connecting: "Conectando",
        connected: "Conectado",
        syncing: "Sincronizando",
        error: "Revisar",
      },
    },
    sheets: {
      title: "Google Sheets",
      description:
        "Modo MVP: peg\u00e1 una URL de Google Sheet o un ID de spreadsheet para cargar FAQ, reglas y registros de actividad.",
      desktopReady: "Bridge Sheets de escritorio detectado",
      demoReady: "Sheet demo activo",
      connect: "Conectar sheet",
      reload: "Recargar FAQ",
      logDemo: "Registrar email seleccionado",
      disconnect: "Desconectar",
      spreadsheetId: "ID del spreadsheet",
      spreadsheetPlaceholder: "Peg\u00e1 la URL o ID de Google Sheet",
      spreadsheet: "Spreadsheet",
      lastSync: "\u00daltima sincronizaci\u00f3n",
      faqRows: "Filas FAQ",
      ruleRows: "Filas de reglas",
      activityRows: "Registros",
      expectedTabs: "Pesta\u00f1as esperadas",
      scopes: "Permisos",
      neverSynced: "A\u00fan sin sincronizar",
      noSpreadsheet: "Sin spreadsheet",
      errorHelp: "No se pudo conectar Sheets. Revis\u00e1 el ID y los permisos.",
      mode: {
        "desktop-oauth": "OAuth de escritorio",
        "demo-bridge": "Bridge demo",
      },
      status: {
        disconnected: "Desconectado",
        connecting: "Conectando",
        connected: "Conectado",
        syncing: "Sincronizando",
        error: "Revisar",
      },
    },
    ai: {
      configured: "Configurado",
      missingKey: "Falta API key",
      demo: "IA demo",
      error: "Revisar",
      analyzing: "Analizando",
      title: "Proveedor IA",
      provider: "Proveedor",
      model: "Modelo",
      apiKey: "Variable API key",
      baseUrl: "Base URL",
      noBaseUrl: "Endpoint por defecto",
    },
    draftFirstMode: "Borrador primero (requiere revisi\u00f3n)",
    language: "Idioma",
    languageName: {
      en: "Ingl\u00e9s",
      es: "Espa\u00f1ol",
    },
    theme: "Tema",
    themeName: {
      light: "Claro",
      dark: "Oscuro",
    },
    searchPlaceholder: "Buscar emails...",
    filter: "Filtrar",
    toolbar: {
      back: "Volver",
      archive: "Archivar",
      info: "Informaci\u00f3n",
      snooze: "Posponer",
      trash: "Eliminar",
      markUnread: "Marcar como no le\u00eddo",
      tag: "Etiqueta",
      more: "M\u00e1s",
      reply: "Responder",
      undo: "Deshacer",
      regenerate: "Regenerar",
      bold: "Negrita",
      italic: "Cursiva",
      bulletedList: "Lista",
      link: "Enlace",
    },
    to: "para",
    chips: {
      intent: "Intenci\u00f3n",
      confidence: "Confianza",
    },
    table: {
      question: "Pregunta",
      answer: "Respuesta",
      source: "Fuente",
    },
    metrics: {
      totalConversations: "Conversaciones totales",
      lastContact: "\u00daltimo contacto",
      satisfaction: "Satisfacci\u00f3n",
      nextCheckIn: "Pr\u00f3xima revisi\u00f3n",
      processedToday: "Procesados hoy",
    },
    status: {
      draft: "Borrador",
      ready: "Listo",
      waiting: "Ignorado",
      sent: "Enviado",
      gmailDraft: "Borrador Gmail",
    },
    intents: {
      unknown: "Sin clasificar",
      shippingIssue: "Problema de env\u00edo",
      returnRequest: "Solicitud de devoluci\u00f3n",
      pricing: "Precios",
      billing: "Facturaci\u00f3n",
      accountAccess: "Acceso a cuenta",
      sales: "Ventas",
      shipping: "Env\u00edo",
    },
    sources: {
      general: "Base de conocimiento",
      shipping: "Env\u00edos_FAQ",
      returns: "Devoluciones_FAQ",
      pricing: "Precios_FAQ",
      billing: "Facturaci\u00f3n_FAQ",
      account: "Cuenta_FAQ",
      sales: "Ventas_FAQ",
      googleSheets: "Google Sheets",
    },
    time: {
      tenTwentyFour: "10:24 AM",
      nineFifteen: "9:15 AM",
      yesterday: "Ayer",
      tuesday: "Martes",
    },
    lastContact: {
      today: "Hoy",
      yesterday: "Ayer",
      twoDaysAgo: "hace 2 d\u00edas",
      threeDaysAgo: "hace 3 d\u00edas",
      oneWeekAgo: "hace 1 semana",
      tuesday: "Martes",
    },
    satisfaction: {
      positive: "Positiva",
      neutral: "Neutral",
      new: "Nueva",
    },
    running: "Activo",
    paused: "Pausado",
    draft: "Borrador",
    generatedReply: "Respuesta generada",
    regenerate: "Regenerar",
    send: "Crear borrador",
    sentAction: "Borrador creado",
    draftNote: "Modo borrador primero - Se crea un borrador Gmail para revisi\u00f3n manual.",
    viewAll: "Ver todo",
    noDraft: "No hay una respuesta sugerida disponible para este mensaje.",
    minuteValue: "2 min",
  },
};

const demoMails: MailItem[] = [
  {
    id: "demo-1",
    sender: "Alex Johnson",
    initials: "A",
    email: "alex.johnson@email.com",
    subject: "Issue with my recent order",
    preview: "Hi, I haven't received my order yet. The tracking link hasn't updated...",
    body: [
      "Hi,",
      "I haven't received my order yet. The tracking link hasn't updated in 5 days and I'm not sure what's going on.",
      "Order number: #12345",
      "Could you please help me with this?",
      "Thanks,\nAlex",
    ],
    intentKey: "shippingIssue",
    confidence: 92,
    timeKey: "tenTwentyFour",
    status: "ready",
    unread: true,
    accent: "teal",
    sourceKey: "shipping",
    answer:
      "Hi Alex,\n\nThanks for reaching out. I'm sorry to hear about the delay.\n\nI've checked your order #12345 and see that it's currently in transit. Tracking updates can take up to 48 hours to appear.\n\nYou can track your package here: [tracking link]\n\nIf you don't see any updates by tomorrow, just let me know and I'll gladly look into this further.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 3,
      lastContactKey: "twoDaysAgo",
      satisfactionKey: "positive",
    },
  },
  {
    id: "demo-2",
    sender: "Sarah Lee",
    initials: "S",
    email: "sarah.lee@email.com",
    subject: "Return request",
    preview: "I'd like to return the lamp I purchased last week. Can you help?",
    body: [
      "Hello,",
      "I'd like to return the lamp I purchased last week. It arrived in good condition but does not fit the room.",
      "Can you tell me what the next steps are?",
      "Thanks,\nSarah",
    ],
    intentKey: "returnRequest",
    confidence: 88,
    timeKey: "nineFifteen",
    status: "draft",
    unread: true,
    accent: "blue",
    sourceKey: "returns",
    answer:
      "Hi Sarah,\n\nThanks for contacting us. We can help with the return.\n\nPlease send your order number and confirm whether the lamp is still in its original packaging. Once we have that, we will share the return label and next steps.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 1,
      lastContactKey: "today",
      satisfactionKey: "new",
    },
  },
  {
    id: "demo-3",
    sender: "Michael Chen",
    initials: "M",
    email: "michael.chen@email.com",
    subject: "Product question",
    preview: "Can you help me understand the difference between the two plans?",
    body: [
      "Hi team,",
      "Can you help me understand the difference between the starter and growth plans?",
      "We are deciding this week and want to make sure we choose correctly.",
      "Michael",
    ],
    intentKey: "pricing",
    confidence: 94,
    timeKey: "yesterday",
    status: "ready",
    unread: true,
    accent: "blue",
    sourceKey: "pricing",
    answer:
      "Hi Michael,\n\nHappy to help. The starter plan is best for small teams that need the core inbox workflow, while the growth plan adds shared rules, advanced reporting, and higher usage limits.\n\nIf you share your team size and expected monthly volume, I can recommend the best fit.",
    history: {
      conversations: 2,
      lastContactKey: "yesterday",
      satisfactionKey: "positive",
    },
  },
  {
    id: "demo-4",
    sender: "Priya Patel",
    initials: "P",
    email: "priya.patel@email.com",
    subject: "Invoice not received",
    preview: "Can you resend the invoice for my last payment?",
    body: [
      "Hello,",
      "Can you resend the invoice for my last payment? I need it for accounting before Friday.",
      "Thanks,\nPriya",
    ],
    intentKey: "billing",
    confidence: 90,
    timeKey: "yesterday",
    status: "draft",
    accent: "amber",
    sourceKey: "billing",
    answer:
      "Hi Priya,\n\nOf course. I can help resend the invoice. Please confirm the billing email or the last four digits of the payment method so we can locate the correct record.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 5,
      lastContactKey: "oneWeekAgo",
      satisfactionKey: "positive",
    },
  },
  {
    id: "demo-5",
    sender: "David Kim",
    initials: "D",
    email: "david.kim@email.com",
    subject: "Account access issue",
    preview: "I'm unable to log in to my account after resetting my password...",
    body: [
      "Hi,",
      "I'm unable to log in to my account after resetting my password. The reset email arrived, but login still fails.",
      "Can someone check this?",
      "David",
    ],
    intentKey: "accountAccess",
    confidence: 86,
    timeKey: "yesterday",
    status: "ready",
    accent: "green",
    sourceKey: "account",
    answer:
      "Hi David,\n\nThanks for letting us know. Please try clearing your browser cache or using a private window first. If the issue continues, send us the email linked to your account and we will check the login status from our side.",
    history: {
      conversations: 2,
      lastContactKey: "threeDaysAgo",
      satisfactionKey: "neutral",
    },
  },
  {
    id: "demo-6",
    sender: "Emma Wilson",
    initials: "E",
    email: "emma.wilson@email.com",
    subject: "Bulk order inquiry",
    preview: "We're interested in placing a bulk order for our office...",
    body: [
      "Hi,",
      "We're interested in placing a bulk order for our office. Do you offer volume pricing for 40 units?",
      "Emma",
    ],
    intentKey: "sales",
    confidence: 96,
    timeKey: "tuesday",
    status: "ready",
    accent: "rose",
    sourceKey: "sales",
    answer:
      "Hi Emma,\n\nThanks for reaching out. We do offer volume pricing for bulk orders. For 40 units, our team can prepare a custom quote with delivery estimates and any available discount tiers.\n\nWould you like us to send a quote to this email?",
    history: {
      conversations: 1,
      lastContactKey: "tuesday",
      satisfactionKey: "new",
    },
  },
  {
    id: "demo-7",
    sender: "James Brown",
    initials: "J",
    email: "james.brown@email.com",
    subject: "Shipping to Canada",
    preview: "Do you ship to Canada? What are the costs?",
    body: [
      "Hello,",
      "Do you ship to Canada? What are the costs and typical delivery times?",
      "James",
    ],
    intentKey: "shipping",
    confidence: 91,
    timeKey: "tuesday",
    status: "sent",
    accent: "violet",
    sourceKey: "shipping",
    answer:
      "Hi James,\n\nYes, we ship to Canada. Shipping costs and delivery estimates are calculated during checkout based on destination and package size.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 4,
      lastContactKey: "tuesday",
      satisfactionKey: "positive",
    },
  },
];

const localizedContent: Record<Language, LocaleContent> = {
  en: {
    knowledgeMatches: [
      {
        question: "Where is my order?",
        answer: "Orders typically ship within 1-2 business days.",
        sourceKey: "shipping",
      },
      {
        question: "How can I track my order?",
        answer: "Once your order ships, you will receive a tracking link.",
        sourceKey: "shipping",
      },
      {
        question: "What if my tracking is not updating?",
        answer: "Tracking updates may take up to 48 hours to appear.",
        sourceKey: "shipping",
      },
    ],
    activityItems: [
      "Email received from Alex Johnson",
      "Intent identified: Shipping Issue (92%)",
      "FAQ matches found (3)",
      "AI reply generated",
      "Awaiting review",
    ],
  },
  es: {
    knowledgeMatches: [
      {
        question: "D\u00f3nde est\u00e1 mi pedido?",
        answer: "Los pedidos normalmente se despachan en 1-2 d\u00edas h\u00e1biles.",
        sourceKey: "shipping",
      },
      {
        question: "C\u00f3mo puedo seguir mi pedido?",
        answer: "Cuando el pedido se despacha, recib\u00eds un enlace de seguimiento.",
        sourceKey: "shipping",
      },
      {
        question: "Qu\u00e9 pasa si el seguimiento no se actualiza?",
        answer: "Las actualizaciones pueden tardar hasta 48 horas en aparecer.",
        sourceKey: "shipping",
      },
    ],
    activityItems: [
      "Email recibido de Alex Johnson",
      "Intenci\u00f3n detectada: Problema de env\u00edo (92%)",
      "Coincidencias FAQ encontradas (3)",
      "Respuesta de IA generada",
      "Esperando revisi\u00f3n",
    ],
  },
};

const initialDrafts = Object.fromEntries(demoMails.map((mail) => [mail.id, mail.answer])) as Record<
  string,
  string
>;

const initialKnowledgeBase: SheetsKnowledgeBase = {
  faq: [],
  rules: [],
};

const initialAIStatus: AutoInboxAIStatus = {
  status: "demo",
  mode: "demo-bridge",
  provider: "demo",
  providerLabel: "Demo rules",
  model: "demo-rules",
  apiKeyEnv: "",
};

const initialGmailSync: GmailSyncSnapshot = {
  status: "disconnected",
  mode: "demo-bridge",
  accountEmail: "",
  lastSyncAt: "",
  nextSyncInSeconds: defaultHeartbeatIntervalSeconds,
  nextSyncAt: "",
  heartbeatEnabled: true,
  heartbeatIntervalSeconds: defaultHeartbeatIntervalSeconds,
  historyId: "",
  loadedMessages: 0,
  newMessages: 0,
  duplicateSkips: 0,
  seenMessageIds: [],
};

const initialSheetsSync: SheetsSyncSnapshot = {
  status: "disconnected",
  mode: "demo-bridge",
  spreadsheetId: "",
  spreadsheetTitle: "",
  lastSyncAt: "",
  faqRows: 0,
  ruleRows: 0,
  activityRows: 0,
  tabs: [],
};

function AutoInboxApp() {
  const persistedInboxState = React.useMemo(() => loadPersistedInboxState(), []);
  const [language, setLanguage] = React.useState<Language>("en");
  const [theme, setTheme] = React.useState<Theme>(() => loadPersistedTheme());
  const [mailItems, setMailItems] = React.useState<MailItem[]>(() =>
    demoMails.map((mail) => ({
      ...mail,
      gmailDraftId: persistedInboxState.gmailDraftIds[mail.id],
    })),
  );
  const [selectedId, setSelectedId] = React.useState(demoMails[0].id);
  const [query, setQuery] = React.useState("");
  const [activeFolder, setActiveFolder] = React.useState<MailFolder>("all");
  const [queuePaused, setQueuePaused] = React.useState(false);
  const [sentIds, setSentIds] = React.useState<string[]>(() =>
    persistedInboxState.sentIds.length > 0 ? persistedInboxState.sentIds : ["demo-7"],
  );
  const [gmailDraftIds, setGmailDraftIds] = React.useState<Record<string, string>>(
    persistedInboxState.gmailDraftIds,
  );
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() => ({
    ...initialDrafts,
    ...persistedInboxState.drafts,
  }));
  const [gmailSync, setGmailSync] = React.useState<GmailSyncSnapshot>(() => ({
    ...initialGmailSync,
    ...loadPersistedGmailHeartbeat(),
  }));
  const [sheetsSync, setSheetsSync] = React.useState<SheetsSyncSnapshot>(initialSheetsSync);
  const [knowledgeBase, setKnowledgeBase] =
    React.useState<SheetsKnowledgeBase>(initialKnowledgeBase);
  const [aiStatus, setAiStatus] = React.useState<AutoInboxAIStatus>(initialAIStatus);
  const [processingIds, setProcessingIds] = React.useState<string[]>([]);
  const [draftingId, setDraftingId] = React.useState<string | null>(null);
  const [sheetInput, setSheetInput] = React.useState("demo-auto-inbox-sheet");
  const [, setClockNow] = React.useState(() => Date.now());

  const t = copy[language];
  const content = localizedContent[language];
  const selected = mailItems.find((mail) => mail.id === selectedId) ?? mailItems[0] ?? demoMails[0];
  const draftText = drafts[selected.id] ?? "";
  const selectedSent = sentIds.includes(selected.id);
  const selectedDraftCreated = Boolean(gmailDraftIds[selected.id] || selected.gmailDraftId);
  const selectedIntent = selected.intentLabel || t.intents[selected.intentKey];
  const selectedStatus: MailStatus = selectedDraftCreated ? "gmailDraft" : selected.status;
  const selectedKnowledgeMatches =
    selected.knowledgeMatches && selected.knowledgeMatches.length > 0
      ? selected.knowledgeMatches
      : content.knowledgeMatches;
  const selectedActivityItems =
    selected.activityItems && selected.activityItems.length > 0
      ? selected.activityItems
      : content.activityItems;
  const folderCounts: Record<MailFolder, number> = {
    all: mailItems.length,
    unreplied: mailItems.filter((mail) => !sentIds.includes(mail.id) && !gmailDraftIds[mail.id])
      .length,
    flagged: mailItems.filter((mail) => mail.confidence < 90 || mail.status === "draft").length,
  };
  const aiBridgeAvailable = hasDesktopAIBridge();
  const aiIntegrationStatus = getAIStatusLabel(aiStatus, t.ai);
  const aiIntegrationTone = getAIIntegrationTone(aiStatus.status);
  const gmailBridgeAvailable = hasDesktopGmailBridge();
  const gmailIntegrationTone = getIntegrationTone(gmailSync.status);
  const gmailModeLabel = t.gmail.mode[gmailSync.mode];
  const lastSyncLabel = gmailSync.lastSyncAt
    ? new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(gmailSync.lastSyncAt))
    : t.gmail.neverSynced;
  const nextHeartbeatLabel =
    queuePaused && gmailSync.heartbeatEnabled
      ? t.gmail.pausedByQueue
      : gmailSync.nextSyncAt && gmailSync.status === "connected" && gmailSync.heartbeatEnabled
        ? formatSeconds(
            Math.max(0, Math.ceil((new Date(gmailSync.nextSyncAt).getTime() - Date.now()) / 1000)),
          )
        : formatSeconds(gmailSync.heartbeatIntervalSeconds);
  const sheetsBridgeAvailable = hasDesktopSheetsBridge();
  const sheetsIntegrationTone = getSheetsIntegrationTone(sheetsSync.status);
  const sheetsModeLabel = t.sheets.mode[sheetsSync.mode];
  const normalizedSheetId = extractSpreadsheetId(sheetInput);
  const sheetsLastSyncLabel = sheetsSync.lastSyncAt
    ? new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(sheetsSync.lastSyncAt))
    : t.sheets.neverSynced;

  React.useEffect(() => {
    let mounted = true;

    if (!gmailBridgeAvailable) {
      return () => {
        mounted = false;
      };
    }

    void getDesktopGmailStatus().then((status) => {
      if (!mounted || !status) return;

      setGmailSync((current) => ({
        ...current,
        ...status,
        mode: status.mode ?? "desktop-oauth",
        status: status.status ?? current.status,
        accountEmail: status.accountEmail ?? current.accountEmail,
        lastSyncAt: status.lastSyncAt ?? current.lastSyncAt,
        nextSyncInSeconds: status.nextSyncInSeconds ?? current.nextSyncInSeconds,
        nextSyncAt: status.nextSyncAt ?? current.nextSyncAt,
        heartbeatEnabled: status.heartbeatEnabled ?? current.heartbeatEnabled,
        heartbeatIntervalSeconds:
          status.heartbeatIntervalSeconds ?? current.heartbeatIntervalSeconds,
        historyId: status.historyId ?? current.historyId,
        loadedMessages: status.loadedMessages ?? current.loadedMessages,
        newMessages: status.newMessages ?? current.newMessages,
        duplicateSkips: status.duplicateSkips ?? current.duplicateSkips,
        seenMessageIds: status.seenMessageIds ?? current.seenMessageIds,
      }));
    });

    return () => {
      mounted = false;
    };
  }, [gmailBridgeAvailable]);

  React.useEffect(() => {
    persistGmailHeartbeat(gmailSync);
  }, [
    gmailSync.heartbeatEnabled,
    gmailSync.heartbeatIntervalSeconds,
    gmailSync.nextSyncAt,
    gmailSync.seenMessageIds,
    gmailSync.duplicateSkips,
    gmailSync.newMessages,
  ]);

  React.useEffect(() => {
    persistInboxState({
      drafts,
      sentIds,
      gmailDraftIds,
    });
  }, [drafts, sentIds, gmailDraftIds]);

  React.useEffect(() => {
    applyDocumentTheme(theme);
    persistTheme(theme);
  }, [theme]);

  React.useEffect(() => {
    let mounted = true;

    void getAutoInboxAIStatus()
      .then((status) => {
        if (mounted) setAiStatus(status);
      })
      .catch(() => {
        if (mounted) {
          setAiStatus((current) => ({ ...current, status: "error" }));
        }
      });

    return () => {
      mounted = false;
    };
  }, [aiBridgeAvailable]);

  React.useEffect(() => {
    if (!gmailSync.heartbeatEnabled || gmailSync.status !== "connected") return;

    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gmailSync.heartbeatEnabled, gmailSync.status]);

  React.useEffect(() => {
    let mounted = true;

    if (!sheetsBridgeAvailable) {
      return () => {
        mounted = false;
      };
    }

    void getDesktopSheetsStatus().then((status) => {
      if (!mounted || !status) return;

      setSheetsSync((current) => ({
        ...current,
        ...status,
        mode: status.mode ?? "desktop-oauth",
        status: status.status ?? current.status,
        spreadsheetId: status.spreadsheetId ?? current.spreadsheetId,
        spreadsheetTitle: status.spreadsheetTitle ?? current.spreadsheetTitle,
        lastSyncAt: status.lastSyncAt ?? current.lastSyncAt,
        faqRows: status.faqRows ?? current.faqRows,
        ruleRows: status.ruleRows ?? current.ruleRows,
        activityRows: status.activityRows ?? current.activityRows,
        tabs: status.tabs ?? current.tabs,
      }));

      if (status.spreadsheetId) {
        setSheetInput(status.spreadsheetId);
      }
    });

    return () => {
      mounted = false;
    };
  }, [sheetsBridgeAvailable]);

  const filtered = mailItems.filter((mail) => {
    const translatedIntent = mail.intentLabel || t.intents[mail.intentKey];
    const matchesQuery = `${mail.sender} ${mail.subject} ${mail.preview} ${translatedIntent}`
      .toLowerCase()
      .includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (activeFolder === "unreplied") return !sentIds.includes(mail.id) && !gmailDraftIds[mail.id];
    if (activeFolder === "flagged") return mail.confidence < 90 || mail.status === "draft";
    return true;
  });

  const createDraftForSelected = async () => {
    if (!draftText.trim() || selectedSent || selectedDraftCreated || queuePaused || draftingId) return;

    setDraftingId(selected.id);

    try {
      const accessToken = await getGmailAccessToken();
      let draftId = `demo-draft-${selected.id}`;

      if (accessToken && selected.email && !selected.id.startsWith("demo-")) {
        const draft = await createGmailDraft(accessToken, {
          to: selected.email,
          subject: getReplySubject(selected.subject),
          body: draftText,
          threadId: selected.threadId,
        });
        draftId = draft.id;
      }

      setGmailDraftIds((current) => ({ ...current, [selected.id]: draftId }));
      setMailItems((current) =>
        current.map((mail) =>
          mail.id === selected.id
            ? {
                ...mail,
                status: "gmailDraft",
                gmailDraftId: draftId,
                activityItems: [
                  ...(mail.activityItems ?? []),
                  accessToken ? "Gmail draft created" : "Demo draft created",
                ],
              }
            : mail,
        ),
      );
    } catch {
      setMailItems((current) =>
        current.map((mail) =>
          mail.id === selected.id
            ? {
                ...mail,
                activityItems: [...(mail.activityItems ?? []), "Draft creation failed"],
              }
            : mail,
        ),
      );
    } finally {
      setDraftingId(null);
    }
  };

  const connectGmail = async () => {
    const mode: GmailBridgeMode = gmailBridgeAvailable ? "desktop-oauth" : "demo-bridge";
    setGmailSync((current) => ({ ...current, status: "connecting", mode, error: undefined }));

    try {
      const session = await connectGmailOAuth();
      setGmailSync((current) => ({
        ...current,
        status: "connected",
        mode: session.mode,
        accountEmail: session.accountEmail,
        lastSyncAt: new Date().toISOString(),
        nextSyncInSeconds: current.heartbeatIntervalSeconds,
        nextSyncAt: getNextSyncAt(current.heartbeatIntervalSeconds),
        historyId: session.historyId ?? "",
        loadedMessages: Math.max(current.loadedMessages, mailItems.length),
      }));
    } catch {
      setGmailSync((current) => ({ ...current, status: "error" }));
    }
  };

  const syncGmail = async () => {
    const previous = gmailSync;
    if (!canRunGmailSync(previous)) return;

    setGmailSync((current) => ({ ...current, status: "syncing", error: undefined }));

    try {
      const nextSync = await runGmailInboxSync(previous, {
        getAccessToken: getGmailAccessToken,
        getMessage: getMessageMetadata,
        listInboxMessages,
        listNewInboxHistory,
        simulateInboxSync,
      });

      const importedMessages = nextSync.messages.map(mapGmailMessageToMailItem);
      if (importedMessages.length > 0) {
        setMailItems((current) => mergeMailItems(current, importedMessages, gmailDraftIds));
        setDrafts((current) => ({
          ...Object.fromEntries(importedMessages.map((mail) => [mail.id, current[mail.id] ?? ""])),
          ...current,
        }));
        if (selected.id.startsWith("demo-")) {
          setSelectedId(importedMessages[0].id);
        }
        importedMessages.forEach((mail) => {
          void processMailWithAI(mail);
        });
      }

      setGmailSync(nextSync.snapshot);
    } catch {
      setGmailSync((current) => ({ ...current, status: "error" }));
    }
  };

  const disconnectGmail = async () => {
    if (gmailSync.status === "connecting" || gmailSync.status === "syncing") return;
    setGmailSync((current) => ({ ...current, status: "syncing" }));

    try {
      await disconnectGmailOAuth();
      setGmailSync((current) => ({
        ...initialGmailSync,
        heartbeatEnabled: current.heartbeatEnabled,
        heartbeatIntervalSeconds: current.heartbeatIntervalSeconds,
        nextSyncInSeconds: current.heartbeatIntervalSeconds,
      }));
    } catch {
      setGmailSync((current) => ({ ...current, status: "error" }));
    }
  };

  const updateGmailHeartbeatEnabled = (enabled: boolean) => {
    setGmailSync((current) => ({
      ...current,
      heartbeatEnabled: enabled,
      nextSyncAt:
        enabled && current.status === "connected"
          ? getNextSyncAt(current.heartbeatIntervalSeconds)
          : "",
    }));
  };

  const updateGmailHeartbeatInterval = (intervalSeconds: number) => {
    setGmailSync((current) => ({
      ...current,
      heartbeatIntervalSeconds: intervalSeconds,
      nextSyncInSeconds: intervalSeconds,
      nextSyncAt:
        current.heartbeatEnabled && current.status === "connected"
          ? getNextSyncAt(intervalSeconds)
          : "",
    }));
  };

  const connectGoogleSheets = async () => {
    const spreadsheetId = normalizedSheetId;
    if (!spreadsheetId) {
      setSheetsSync((current) => ({ ...current, status: "error" }));
      return;
    }

    const mode: SheetsBridgeMode = sheetsBridgeAvailable ? "desktop-oauth" : "demo-bridge";
    setSheetsSync((current) => ({ ...current, status: "connecting", mode, error: undefined }));

    try {
      const snapshot = await connectSheets(spreadsheetId);
      const knowledge = await readSheetsKnowledgeBase(snapshot.spreadsheetId);
      setKnowledgeBase(knowledge);
      setSheetsSync({
        ...snapshot,
        faqRows: knowledge.faq.length || snapshot.faqRows,
        ruleRows: knowledge.rules.length || snapshot.ruleRows,
        lastSyncAt: new Date().toISOString(),
      });
    } catch {
      setSheetsSync((current) => ({ ...current, status: "error" }));
    }
  };

  const reloadSheets = async () => {
    const spreadsheetId = sheetsSync.spreadsheetId || normalizedSheetId;
    if (!spreadsheetId || sheetsSync.status === "disconnected") return;

    setSheetsSync((current) => ({ ...current, status: "syncing", error: undefined }));

    try {
      const knowledge = await readSheetsKnowledgeBase(spreadsheetId);
      setKnowledgeBase(knowledge);
      setSheetsSync((current) => ({
        ...current,
        status: "connected",
        lastSyncAt: new Date().toISOString(),
        faqRows: knowledge.faq.length,
        ruleRows: knowledge.rules.length,
      }));
    } catch {
      setSheetsSync((current) => ({ ...current, status: "error" }));
    }
  };

  const logSelectedEmailToSheet = async () => {
    const spreadsheetId = sheetsSync.spreadsheetId || normalizedSheetId;
    if (!spreadsheetId || sheetsSync.status !== "connected") return;

    setSheetsSync((current) => ({ ...current, status: "syncing", error: undefined }));

    const activityRow: SheetActivityRow = {
      timestamp: new Date().toISOString(),
      emailId: String(selected.id),
      sender: selected.sender,
      subject: selected.subject,
      intent: selectedIntent,
      confidence: selected.confidence,
      status: selectedDraftCreated ? "gmail_draft" : selectedSent ? "sent" : selected.status,
      draftCreated: Boolean(draftText.trim()),
    };

    try {
      const result = await appendSheetActivityLog(spreadsheetId, activityRow);
      setSheetsSync((current) => ({
        ...current,
        status: "connected",
        lastSyncAt: new Date().toISOString(),
        activityRows: current.activityRows + (result.updatedRows ?? 1),
      }));
    } catch {
      setSheetsSync((current) => ({ ...current, status: "error" }));
    }
  };

  const disconnectGoogleSheets = async () => {
    if (sheetsSync.status === "connecting" || sheetsSync.status === "syncing") return;
    setSheetsSync((current) => ({ ...current, status: "syncing" }));

    try {
      await disconnectSheets();
      setSheetsSync(initialSheetsSync);
      setKnowledgeBase(initialKnowledgeBase);
    } catch {
      setSheetsSync((current) => ({ ...current, status: "error" }));
    }
  };

  async function processMailWithAI(mail: MailItem) {
    if (processingIds.includes(mail.id)) return;

    setProcessingIds((current) => Array.from(new Set([...current, mail.id])));

    try {
      const result = await analyzeEmail({
        email: {
          id: mail.gmailMessageId ?? mail.id,
          sender: mail.sender,
          senderEmail: mail.email,
          subject: mail.subject,
          bodyText: mail.body.join("\n\n"),
        },
        knowledgeBase,
      });

      const intentKey = getIntentKeyFromLabel(result.intent);
      const knowledgeMatches = result.matchedQuestions.map((match) => ({
        question: match.question,
        answer: match.answer,
        source: match.source,
        sourceKey: "googleSheets" as SourceKey,
      }));

      setDrafts((current) => ({
        ...current,
        [mail.id]: result.draft,
      }));
      setMailItems((current) =>
        current.map((item) =>
          item.id === mail.id
            ? {
                ...item,
                intentKey,
                intentLabel: result.intent,
                confidence: Math.round(result.confidence),
                status: result.requiresHumanReview ? "draft" : "ready",
                answer: result.draft,
                knowledgeMatches,
                activityItems: result.activityItems.length
                  ? result.activityItems
                  : [
                      `Email analyzed from ${mail.sender}`,
                      `Intent identified: ${result.intent}`,
                      `FAQ matches found (${knowledgeMatches.length})`,
                      "Draft generated for human review",
                    ],
              }
            : item,
        ),
      );
    } catch {
      setMailItems((current) =>
        current.map((item) =>
          item.id === mail.id
            ? {
                ...item,
                status: "waiting",
                activityItems: [
                  ...(item.activityItems ?? []),
                  "AI analysis skipped or failed; manual review needed",
                ],
              }
            : item,
        ),
      );
    } finally {
      setProcessingIds((current) => current.filter((id) => id !== mail.id));
    }
  }

  React.useEffect(() => {
    if (!gmailSync.heartbeatEnabled || queuePaused || gmailSync.status !== "connected") return;

    if (!gmailSync.nextSyncAt) {
      setGmailSync((current) => ({
        ...current,
        nextSyncAt: getNextSyncAt(current.heartbeatIntervalSeconds),
      }));
      return;
    }

    const delayMs = Math.max(1000, new Date(gmailSync.nextSyncAt).getTime() - Date.now());
    const timer = window.setTimeout(() => {
      void syncGmail();
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    gmailSync.heartbeatEnabled,
    gmailSync.heartbeatIntervalSeconds,
    gmailSync.status,
    gmailSync.nextSyncAt,
    gmailSync.historyId,
    gmailSync.seenMessageIds.length,
    queuePaused,
  ]);

  return (
    <main className="app-frame" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Hexagon size={22} />
          </div>
          <span>Auto-inbox</span>
        </div>

        <button
          className={`pause-processing ${queuePaused ? "is-paused" : ""}`}
          onClick={() => setQueuePaused((current) => !current)}
        >
          <Pause size={16} />
          {queuePaused ? t.resumeProcessing : t.pauseProcessing}
        </button>

        <nav className="sidebar-section" aria-label={t.ariaMailbox}>
          <NavItem icon={<Inbox size={17} />} label={t.nav.inbox} count={12} active />
          <NavItem icon={<FilePenLine size={17} />} label={t.nav.drafts} count={8} />
          <NavItem icon={<Send size={17} />} label={t.nav.sent} />
          <NavItem icon={<Mail size={17} />} label={t.nav.allMail} />
          <NavItem icon={<Shield size={17} />} label={t.nav.spam} />
          <NavItem icon={<Trash2 size={17} />} label={t.nav.trash} />
        </nav>

        <div className="sidebar-group">
          <p>{t.sections.automation}</p>
          <NavItem icon={<Settings size={17} />} label={t.nav.rules} />
          <NavItem icon={<PenLine size={17} />} label={t.nav.signatures} />
          <NavItem icon={<Settings size={17} />} label={t.nav.settings} />
        </div>

        <div className="sidebar-group integrations">
          <p>{t.sections.integrations}</p>
          <IntegrationRow
            icon={<AtSign size={16} />}
            label="Gmail"
            status={t.gmail.status[gmailSync.status]}
            tone={gmailIntegrationTone}
          />
          <IntegrationRow
            icon={<Sparkles size={16} />}
            label="OpenAI"
            status={aiIntegrationStatus}
            tone={aiIntegrationTone}
          />
          <IntegrationRow
            icon={<Archive size={16} />}
            label="Google Sheets"
            status={t.sheets.status[sheetsSync.status]}
            tone={sheetsIntegrationTone}
          />
        </div>

        <div className="mode-box">
          <p>{t.sections.mode}</p>
          <button>
            {t.draftFirstMode}
            <ChevronDown size={15} />
          </button>
        </div>

        <div className="settings-box">
          <p>{t.sections.settings}</p>
          <label className="language-select">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="en">{t.languageName.en}</option>
              <option value="es">{t.languageName.es}</option>
            </select>
          </label>
          <label className="language-select">
            <span>{t.theme}</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="light">{t.themeName.light}</option>
              <option value="dark">{t.themeName.dark}</option>
            </select>
          </label>
        </div>
      </aside>

      <section className="inbox-column">
        <div className="search-row">
          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>
          <button className="square-button" title={t.filter}>
            <Filter size={17} />
          </button>
        </div>

        <div className="mail-tabs">
          {(Object.keys(folderCounts) as MailFolder[]).map((folder) => (
            <button
              key={folder}
              className={activeFolder === folder ? "active" : ""}
              onClick={() => setActiveFolder(folder)}
            >
              {t.folders[folder]}
              <span>{folderCounts[folder]}</span>
            </button>
          ))}
        </div>

        <div className="mail-list">
          {filtered.map((mail) => (
            <button
              className={`mail-card ${mail.id === selected.id ? "selected" : ""}`}
              key={mail.id}
              onClick={() => setSelectedId(mail.id)}
            >
              <Avatar initials={mail.initials} accent={mail.accent} />
              <div className="mail-card-content">
                <div className="mail-card-top">
                  <strong>{mail.sender}</strong>
                  <span>{getMailTime(mail, t.time)}</span>
                </div>
                <h3>{mail.subject}</h3>
                <p>{mail.preview}</p>
              </div>
              {mail.unread ? <span className="unread-dot" /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="reader-column">
        <div className="reader-toolbar">
          <button title={t.toolbar.back}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <button title={t.toolbar.archive}>
              <Archive size={17} />
            </button>
            <button title={t.toolbar.info}>
              <Info size={17} />
            </button>
            <button title={t.toolbar.snooze}>
              <Clock3 size={17} />
            </button>
            <button title={t.toolbar.trash}>
              <Trash2 size={17} />
            </button>
            <button title={t.toolbar.markUnread}>
              <Mail size={17} />
            </button>
            <button title={t.toolbar.tag}>
              <Tag size={17} />
            </button>
            <button title={t.toolbar.more}>
              <MoreVertical size={17} />
            </button>
          </div>
        </div>

        <article className="email-thread">
          <h1>{selected.subject}</h1>

          <div className="message-meta">
            <Avatar initials={selected.initials} accent={selected.accent} />
            <div>
              <strong>{selected.sender}</strong>
              <span>
                {selected.email} {t.to} support@yourstore.com
              </span>
            </div>
            <time>{getMailTime(selected, t.time)}</time>
            <button title={t.toolbar.reply}>
              <Reply size={17} />
            </button>
            <button title={t.toolbar.more}>
              <MoreVertical size={17} />
            </button>
          </div>

          <div className="ai-chips">
            <span>
              {t.chips.intent} <strong>{processingIds.includes(selected.id) ? t.ai.analyzing : selectedIntent}</strong>
            </span>
            <span>
              {t.chips.confidence} <strong>{selected.confidence}%</strong>
            </span>
            <span className={`status-chip ${selectedSent ? "sent" : selectedStatus}`}>
              {selectedSent ? t.status.sent : t.status[selectedStatus]}
            </span>
          </div>

          <div className="message-body">
            {selected.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </article>

        <section className="knowledge-card">
          <div className="section-heading">
            <h2>{t.sections.knowledge}</h2>
          </div>
          <div className="knowledge-table" role="table" aria-label={t.sections.knowledge}>
            <div className="knowledge-row header" role="row">
              <span>{t.table.question}</span>
              <span>{t.table.answer}</span>
              <span>{t.table.source}</span>
            </div>
            {selectedKnowledgeMatches.map((match) => (
              <div className="knowledge-row" role="row" key={match.question}>
                <span>{match.question}</span>
                <span>{match.answer}</span>
                <span>
                  {match.source ?? t.sources[match.sourceKey ?? "general"]}
                  <Link size={13} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="customer-history">
          <h2>{t.sections.customerHistory}</h2>
          <div className="history-grid">
            <Metric label={t.metrics.totalConversations} value={String(selected.history.conversations)} />
            <Metric label={t.metrics.lastContact} value={t.lastContact[selected.history.lastContactKey]} />
            <Metric label={t.metrics.satisfaction} value={t.satisfaction[selected.history.satisfactionKey]} positive />
          </div>
        </section>
      </section>

      <aside className="assistant-column">
        <section className="reply-panel">
          <div className="reply-heading">
            <h2>
              <Bot size={18} />
              {t.sections.suggestedReply}
            </h2>
            <button onClick={() => void processMailWithAI(selected)}>
              <PenLine size={15} />
              {t.draft}
            </button>
          </div>

          <div className="format-toolbar" aria-label={t.formattingToolbar}>
            <button title={t.toolbar.undo}>
              <Undo2 size={16} />
            </button>
            <button title={t.toolbar.regenerate} onClick={() => void processMailWithAI(selected)}>
              <RotateCcw size={16} />
            </button>
            <span />
            <button title={t.toolbar.bold}>
              <Bold size={16} />
            </button>
            <button title={t.toolbar.italic}>
              <Italic size={16} />
            </button>
            <button title={t.toolbar.bulletedList}>
              <List size={16} />
            </button>
            <button title={t.toolbar.link}>
              <Link size={16} />
            </button>
          </div>

          <textarea
            value={draftText}
            placeholder={t.noDraft}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, [selected.id]: event.target.value }))
            }
            aria-label={t.generatedReply}
          />

          <div className="send-actions">
            <button className="secondary-button" onClick={() => void processMailWithAI(selected)}>
              <RefreshCcw size={16} />
              {t.regenerate}
              <ChevronDown size={15} />
            </button>
            <button
              className="send-button"
              onClick={createDraftForSelected}
              disabled={
                !draftText.trim() ||
                selectedSent ||
                selectedDraftCreated ||
                queuePaused ||
                draftingId === selected.id
              }
            >
              <Send size={18} />
              {selectedDraftCreated ? t.sentAction : t.send}
              <ChevronDown size={15} />
            </button>
          </div>

          <p className="draft-note">{t.draftNote}</p>
        </section>

        <section className="gmail-card">
          <div className="section-heading">
            <h2>
              <AtSign size={17} />
              {t.gmail.title}
            </h2>
            <span className={`connection-pill ${gmailSync.status}`}>
              {t.gmail.status[gmailSync.status]}
            </span>
          </div>

          <p className="gmail-description">
            {gmailBridgeAvailable ? t.gmail.desktopReady : t.gmail.demoReady}
            {" - "}
            {t.gmail.description}
          </p>

          <div className="gmail-actions">
            <button
              className="secondary-button"
              onClick={connectGmail}
              disabled={gmailSync.status === "connecting" || gmailSync.status === "syncing"}
            >
              <AtSign size={16} />
              {t.gmail.connect}
            </button>
            <button
              className="secondary-button"
              onClick={syncGmail}
              disabled={
                gmailSync.status === "disconnected" ||
                gmailSync.status === "connecting" ||
                gmailSync.status === "syncing"
              }
            >
              <RefreshCcw size={16} />
              {t.gmail.syncNow}
            </button>
            <button
              className="ghost-button"
              onClick={disconnectGmail}
              disabled={
                gmailSync.status === "disconnected" ||
                gmailSync.status === "connecting" ||
                gmailSync.status === "syncing"
              }
            >
              {t.gmail.disconnect}
            </button>
          </div>

          <div className="heartbeat-controls">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={gmailSync.heartbeatEnabled}
                onChange={(event) => updateGmailHeartbeatEnabled(event.target.checked)}
              />
              <span>{t.gmail.autoSync}</span>
            </label>
            <label className="interval-select">
              <span>{t.gmail.checkEvery}</span>
              <select
                value={gmailSync.heartbeatIntervalSeconds}
                onChange={(event) =>
                  updateGmailHeartbeatInterval(Number.parseInt(event.target.value, 10))
                }
              >
                {heartbeatIntervals.map((seconds) => (
                  <option value={seconds} key={seconds}>
                    {formatSeconds(seconds)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="gmail-grid">
            <Metric label={t.gmail.account} value={gmailSync.accountEmail || t.gmail.noAccount} />
            <Metric label={t.gmail.lastSync} value={lastSyncLabel} />
            <Metric label={t.gmail.nextCheck} value={nextHeartbeatLabel} />
            <Metric label={t.gmail.historyId} value={gmailSync.historyId || t.gmail.noHistory} />
            <Metric label={t.gmail.loadedMessages} value={String(gmailSync.loadedMessages)} />
            <Metric label={t.gmail.newMessages} value={String(gmailSync.newMessages)} />
            <Metric label={t.gmail.duplicatesSkipped} value={String(gmailSync.duplicateSkips)} />
            <Metric label={t.gmail.seenMessages} value={String(gmailSync.seenMessageIds.length)} />
            <Metric label={t.sections.mode} value={gmailModeLabel} />
          </div>

          <div className="scope-list" aria-label={t.gmail.scopes}>
            <span>{t.gmail.scopes}</span>
            {GMAIL_SCOPES.map((scope) => (
              <code key={scope}>{scope.replace("https://www.googleapis.com/auth/", "")}</code>
            ))}
          </div>

          {gmailSync.status === "error" ? (
            <p className="gmail-error">{t.gmail.errorHelp}</p>
          ) : null}
        </section>

        <section className="gmail-card">
          <div className="section-heading">
            <h2>
              <Sparkles size={17} />
              {t.ai.title}
            </h2>
            <span className={`connection-pill ${aiStatus.status === "configured" ? "connected" : aiStatus.status === "missing-key" ? "disconnected" : aiStatus.status}`}>
              {aiIntegrationStatus}
            </span>
          </div>

          <div className="gmail-grid">
            <Metric label={t.ai.provider} value={aiStatus.providerLabel} />
            <Metric label={t.ai.model} value={aiStatus.model} />
            <Metric label={t.ai.apiKey} value={aiStatus.apiKeyEnv || "--"} />
            <Metric label={t.ai.baseUrl} value={aiStatus.baseUrl || t.ai.noBaseUrl} />
          </div>
        </section>

        <section className="sheets-card">
          <div className="section-heading">
            <h2>
              <Archive size={17} />
              {t.sheets.title}
            </h2>
            <span className={`connection-pill ${sheetsSync.status}`}>
              {t.sheets.status[sheetsSync.status]}
            </span>
          </div>

          <p className="gmail-description">
            {sheetsBridgeAvailable ? t.sheets.desktopReady : t.sheets.demoReady}
            {" - "}
            {t.sheets.description}
          </p>

          <label className="sheet-input">
            <span>{t.sheets.spreadsheetId}</span>
            <input
              value={sheetInput}
              onChange={(event) => setSheetInput(event.target.value)}
              placeholder={t.sheets.spreadsheetPlaceholder}
            />
          </label>

          <div className="sheets-actions">
            <button
              className="secondary-button"
              onClick={connectGoogleSheets}
              disabled={
                !normalizedSheetId ||
                sheetsSync.status === "connecting" ||
                sheetsSync.status === "syncing"
              }
            >
              <Archive size={16} />
              {t.sheets.connect}
            </button>
            <button
              className="secondary-button"
              onClick={reloadSheets}
              disabled={
                sheetsSync.status === "disconnected" ||
                sheetsSync.status === "connecting" ||
                sheetsSync.status === "syncing"
              }
            >
              <RefreshCcw size={16} />
              {t.sheets.reload}
            </button>
            <button
              className="secondary-button"
              onClick={logSelectedEmailToSheet}
              disabled={sheetsSync.status !== "connected"}
            >
              <FilePenLine size={16} />
              {t.sheets.logDemo}
            </button>
            <button
              className="ghost-button"
              onClick={disconnectGoogleSheets}
              disabled={
                sheetsSync.status === "disconnected" ||
                sheetsSync.status === "connecting" ||
                sheetsSync.status === "syncing"
              }
            >
              {t.sheets.disconnect}
            </button>
          </div>

          <div className="gmail-grid">
            <Metric
              label={t.sheets.spreadsheet}
              value={sheetsSync.spreadsheetTitle || t.sheets.noSpreadsheet}
            />
            <Metric label={t.sheets.lastSync} value={sheetsLastSyncLabel} />
            <Metric label={t.sheets.faqRows} value={String(sheetsSync.faqRows)} />
            <Metric label={t.sheets.ruleRows} value={String(sheetsSync.ruleRows)} />
            <Metric label={t.sheets.activityRows} value={String(sheetsSync.activityRows)} />
            <Metric label={t.sections.mode} value={sheetsModeLabel} />
          </div>

          <div className="sheet-tabs" aria-label={t.sheets.expectedTabs}>
            <span>{t.sheets.expectedTabs}</span>
            {AUTO_INBOX_SHEET_TABS.map((tabName) => (
              <code
                className={sheetsSync.tabs.includes(tabName) ? "present" : ""}
                key={tabName}
              >
                {tabName}
              </code>
            ))}
          </div>

          <div className="scope-list" aria-label={t.sheets.scopes}>
            <span>{t.sheets.scopes}</span>
            {SHEETS_SCOPES.map((scope) => (
              <code key={scope}>{scope.replace("https://www.googleapis.com/auth/", "")}</code>
            ))}
          </div>

          {sheetsSync.status === "error" ? (
            <p className="gmail-error">{t.sheets.errorHelp}</p>
          ) : null}
        </section>

        <section className="automation-card">
          <div className="section-heading">
            <h2>{t.sections.automation}</h2>
            <span className={`running-pill ${queuePaused ? "paused" : ""}`}>
              {queuePaused ? t.paused : t.running}
            </span>
          </div>
          <div className="automation-grid">
            <Metric label={t.metrics.nextCheckIn} value={queuePaused ? "--" : t.minuteValue} />
            <Metric label={t.metrics.processedToday} value="48" />
          </div>
        </section>

        <section className="activity-card">
          <div className="section-heading">
            <h2>{t.sections.activityLog}</h2>
            <button>{t.viewAll}</button>
          </div>
          <div className="activity-list">
            {selectedActivityItems.map((item) => (
              <div key={item}>
                <time>{t.time.tenTwentyFour}</time>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </main>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`}>
      {icon}
      <span>{label}</span>
      {count ? <strong>{count}</strong> : null}
    </button>
  );
}

function IntegrationRow({
  icon,
  label,
  status,
  tone = "connected",
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  tone?: IntegrationTone;
}) {
  return (
    <div className={`integration-row ${tone}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>
        <Check size={12} />
        {status}
      </strong>
    </div>
  );
}

function getIntegrationTone(status: GmailConnectionStatus): IntegrationTone {
  if (status === "connected") return "connected";
  if (status === "connecting" || status === "syncing") return "syncing";
  if (status === "error") return "error";
  return "idle";
}

function getSheetsIntegrationTone(status: SheetsConnectionStatus): IntegrationTone {
  if (status === "connected") return "connected";
  if (status === "connecting" || status === "syncing") return "syncing";
  if (status === "error") return "error";
  return "idle";
}

function getAIIntegrationTone(status: AutoInboxAIStatus["status"]): IntegrationTone {
  if (status === "configured" || status === "demo") return "connected";
  if (status === "error") return "error";
  return "idle";
}

function getAIStatusLabel(status: AutoInboxAIStatus, labels: typeof copy.en.ai) {
  if (status.status === "configured") return `${labels.configured}: ${status.providerLabel}`;
  if (status.status === "missing-key") return `${labels.missingKey}: ${status.apiKeyEnv}`;
  if (status.status === "error") return labels.error;
  return labels.demo;
}

function loadPersistedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyDocumentTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(themeStorageKey, theme);
}

function mergeMailItems(
  current: MailItem[],
  incoming: MailItem[],
  draftIds: Record<string, string>,
) {
  const byId = new Map(current.map((mail) => [mail.id, mail]));

  incoming.forEach((mail) => {
    const existing = byId.get(mail.id);
    byId.set(mail.id, {
      ...mail,
      ...existing,
      ...mail,
      gmailDraftId: draftIds[mail.id] ?? existing?.gmailDraftId ?? mail.gmailDraftId,
      answer: existing?.answer || mail.answer,
      knowledgeMatches: existing?.knowledgeMatches ?? mail.knowledgeMatches,
      activityItems: existing?.activityItems ?? mail.activityItems,
    });
  });

  return Array.from(byId.values()).sort((left, right) => {
    const leftTime = Date.parse(left.timeLabel ?? "");
    const rightTime = Date.parse(right.timeLabel ?? "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime - leftTime;
    if (left.id.startsWith("gmail-") && right.id.startsWith("demo-")) return -1;
    if (left.id.startsWith("demo-") && right.id.startsWith("gmail-")) return 1;
    return 0;
  });
}

function mapGmailMessageToMailItem(message: GmailMessageSummary): MailItem {
  const senderName = extractSenderName(message.from);
  const bodyText = message.bodyText || message.snippet || "";

  return {
    id: `gmail-${message.id}`,
    gmailMessageId: message.id,
    threadId: message.threadId,
    sender: senderName,
    initials: getInitials(senderName),
    email: message.fromEmail,
    subject: message.subject,
    preview: message.snippet || bodyText.slice(0, 120),
    body: bodyToParagraphs(bodyText),
    intentKey: "unknown",
    confidence: 0,
    timeLabel: message.date,
    status: "waiting",
    unread: message.labelIds.includes("UNREAD"),
    accent: getAccentForId(message.id),
    sourceKey: "general",
    answer: "",
    activityItems: [`Email loaded from Gmail: ${message.subject}`],
    history: {
      conversations: 1,
      lastContactKey: "today",
      satisfactionKey: "new",
    },
  };
}

function bodyToParagraphs(value: string) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 8);

  return paragraphs.length > 0 ? paragraphs : ["No plain-text body was available for this email."];
}

function extractSenderName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return (match?.[1] ?? from.replace(/<[^>]+>/g, "")).trim() || "Unknown sender";
}

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}

function getAccentForId(id: string) {
  const accents = ["teal", "blue", "amber", "green", "rose", "violet"] as const;
  const total = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return accents[total % accents.length];
}

function getReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function getMailTime(mail: MailItem, labels: typeof copy.en.time) {
  if (mail.timeKey) return labels[mail.timeKey];
  if (!mail.timeLabel) return "";

  const parsed = new Date(mail.timeLabel);
  if (Number.isNaN(parsed.getTime())) return mail.timeLabel;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getIntentKeyFromLabel(intent: string): IntentKey {
  const normalized = intent.toLowerCase();
  if (normalized.includes("ship") || normalized.includes("tracking") || normalized.includes("order")) {
    return normalized.includes("issue") ? "shippingIssue" : "shipping";
  }
  if (normalized.includes("return") || normalized.includes("refund")) return "returnRequest";
  if (normalized.includes("price") || normalized.includes("plan")) return "pricing";
  if (normalized.includes("bill") || normalized.includes("invoice")) return "billing";
  if (normalized.includes("account") || normalized.includes("login")) return "accountAccess";
  if (normalized.includes("sales") || normalized.includes("quote") || normalized.includes("bulk")) {
    return "sales";
  }
  return "unknown";
}

function Avatar({ initials, accent }: { initials: string; accent: string }) {
  return <div className={`avatar avatar-${accent}`}>{initials}</div>;
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={positive ? "positive" : ""}>{value}</strong>
    </div>
  );
}

applyDocumentTheme(loadPersistedTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AutoInboxApp />
  </React.StrictMode>,
);
