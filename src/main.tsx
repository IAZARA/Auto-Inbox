import React from "react";
import ReactDOM from "react-dom/client";
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  AtSign,
  BarChart3,
  Bold,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardCheck,
  FilePenLine,
  Filter,
  Gauge,
  Hexagon,
  Inbox,
  Info,
  Italic,
  Link,
  List,
  ListChecks,
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
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Target,
  Trash2,
  Undo2,
  UserCheck,
  Users,
  XCircle,
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
type SupportVertical = "ecommerce" | "agency" | "saas";
type BrandTone = "warm" | "direct" | "premium";
type ReplyLanguageMode = "customer" | "interface";
type SafetyAction = "draft" | "verify" | "escalate" | "doNotReply";
type ReviewCheckKey = "facts" | "safety" | "tone";
type OwnerRole = "agent" | "lead" | "sales" | "ops";
type PriorityKey = "low" | "normal" | "high" | "urgent";
type SlaKey = "twoHours" | "fourHours" | "sameDay" | "nextBusinessDay";
type ChannelKey = "gmail" | "outlook" | "imap" | "saas";
type SafetyRuleKey = "automated" | "billing" | "account" | "legal";
type TemplateKey = "shippingDelay" | "returnSteps" | "invoiceVerify" | "salesQuote";

type WorkspaceProfile = {
  vertical: SupportVertical;
  tone: BrandTone;
  replyLanguageMode: ReplyLanguageMode;
  minConfidence: number;
};

type ReviewState = Partial<Record<ReviewCheckKey, boolean>> & {
  accepted?: boolean;
  edited?: boolean;
  escalated?: boolean;
  rejected?: boolean;
};

type OperationState = {
  owner: OwnerRole;
  priority: PriorityKey;
  sla: SlaKey;
  followUp: boolean;
};

type SafetySettings = Record<SafetyRuleKey, boolean> & {
  customEscalationTerms: string;
};

type CostSettings = {
  monthlyEmailVolume: number;
  agentHourlyCost: number;
  aiCostPerEmail: number;
  minutesSavedPerEmail: number;
};

type SafetyDecision = {
  action: SafetyAction;
  label: string;
  description: string;
  reasons: string[];
};

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

type ResponseTemplate = {
  id: TemplateKey;
  intentKey: IntentKey;
  title: string;
  body: string;
};

const themeStorageKey = "auto-inbox:theme";
const workspaceProfileStorageKey = "auto-inbox:workspace-profile";
const operationsStorageKey = "auto-inbox:operations";
const safetySettingsStorageKey = "auto-inbox:safety-settings";
const costSettingsStorageKey = "auto-inbox:cost-settings";

const reviewCheckKeys: ReviewCheckKey[] = ["facts", "safety", "tone"];

const defaultWorkspaceProfile: WorkspaceProfile = {
  vertical: "ecommerce",
  tone: "warm",
  replyLanguageMode: "customer",
  minConfidence: 85,
};

const defaultSafetySettings: SafetySettings = {
  automated: true,
  billing: true,
  account: true,
  legal: true,
  customEscalationTerms: "chargeback, lawyer, complaint, contracargo, denuncia",
};

const defaultCostSettings: CostSettings = {
  monthlyEmailVolume: 800,
  agentHourlyCost: 18,
  aiCostPerEmail: 0.03,
  minutesSavedPerEmail: 4,
};

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
    productTagline: "Human-reviewed ecommerce support",
    positioning: {
      short: "AI drafts. Humans approve.",
      promise: "Built for teams that answer repetitive customer email every day.",
      audience: "Best fit: ecommerce, SaaS support, agencies managing shared inboxes.",
      volume: "Useful from 20+ customer emails/day; strongest when FAQs and rules repeat.",
      notFit: "Not a fit for legal advice, medical support, hidden auto-send, or inboxes without human review.",
    },
    workspace: {
      title: "Support workspace",
      subtitle: "Tune the assistant around one clear operating model before drafting.",
      vertical: "Primary niche",
      tone: "Brand tone",
      languageMode: "Reply language",
      confidence: "Review threshold",
      confidenceHelp: "Emails below this confidence stay flagged for slower review.",
      verticals: {
        ecommerce: "Ecommerce support",
        agency: "Agency inbox ops",
        saas: "SaaS support",
      },
      tones: {
        warm: "Warm",
        direct: "Direct",
        premium: "Premium",
      },
      languageModes: {
        customer: "Match customer",
        interface: "Use interface",
      },
      playbookTitle: "Operating playbook",
      playbookItems: [
        "Use Gmail for incoming messages and draft creation.",
        "Use Sheets for FAQ, rules, activity, and manager visibility.",
        "Let AI classify, find context, and draft; keep send outside automation.",
      ],
    },
    review: {
      title: "Human review gate",
      subtitle: "A draft can only be created after these checks are confirmed.",
      checks: {
        facts: "FAQ/context matches the customer request",
        safety: "Sensitive data, billing, account, and policy risks checked",
        tone: "Tone, language, and next step fit the brand",
      },
      reject: "Reject",
      rejected: "Rejected",
      escalate: "Escalate",
      escalated: "Escalated",
      blocked: "Complete review checks to create a Gmail draft.",
      unsafeBlocked: "This message should not create a draft from the assistant.",
    },
    safety: {
      title: "Safety decision",
      draft: "Draft allowed",
      verify: "Verify first",
      escalate: "Escalate",
      doNotReply: "Do not draft",
      draftDescription: "Low-risk support email. A reviewed Gmail draft is allowed.",
      verifyDescription: "Needs identity, policy, or context verification before the reviewer creates a draft.",
      escalateDescription: "Sensitive or high-risk case. Route to a human owner before replying.",
      doNotReplyDescription: "Likely newsletter, automated mail, or no-reply message. Skip AI response.",
      lowConfidence: "Confidence is below the workspace threshold.",
      billingRisk: "Billing, invoice, refund, or payment topic needs verification.",
      accountRisk: "Account access or login topic needs identity check.",
      legalRisk: "Legal, chargeback, compliance, or complaint language detected.",
      automatedRisk: "Newsletter, unsubscribe, automated, or no-reply signal detected.",
      normalRisk: "No sensitive trigger detected.",
    },
    safetyRules: {
      title: "Safety rules",
      subtitle: "Configure what gets verified, escalated, or skipped before AI drafts.",
      automated: "Skip newsletters, automated mail, and no-reply senders",
      billing: "Verify billing, invoices, refunds, payments, and card topics",
      account: "Verify login, password, account access, and identity topics",
      legal: "Escalate legal, chargeback, compliance, and complaint topics",
      customTerms: "Custom escalation terms",
      customPlaceholder: "comma-separated terms",
    },
    value: {
      title: "Value metrics",
      avgResponse: "Median reply prep",
      coverage: "Draftable coverage",
      flagged: "Needs review",
      acceptance: "Draft acceptance",
      edits: "Edited drafts",
      escalations: "Escalations",
      audit: "Activity rows",
    },
    templates: {
      title: "Reply templates",
      subtitle: "Reusable snippets keep common replies consistent before AI refinement.",
      apply: "Apply",
      append: "Append",
      items: {
        shippingDelay: "Shipping delay",
        returnSteps: "Return steps",
        invoiceVerify: "Invoice verification",
        salesQuote: "Bulk quote",
      },
    },
    cost: {
      title: "Cost estimator",
      subtitle: "Estimate whether the workflow is worth using at the current inbox volume.",
      volume: "Monthly emails",
      hourly: "Agent hourly cost",
      aiCost: "AI cost / email",
      minutesSaved: "Minutes saved / email",
      grossSavings: "Gross time value",
      aiSpend: "AI spend",
      netSavings: "Net monthly value",
      costPerDraft: "Cost / draft",
    },
    operation: {
      title: "Team operation",
      owner: "Owner",
      priority: "Priority",
      sla: "SLA",
      followUp: "Follow-up",
      nextAction: "Next action",
      due: "Due",
      enabled: "Enabled",
      disabled: "Off",
      ownerNames: {
        agent: "Support agent",
        lead: "Support lead",
        sales: "Sales owner",
        ops: "Agency ops",
      },
      priorityNames: {
        low: "Low",
        normal: "Normal",
        high: "High",
        urgent: "Urgent",
      },
      slaNames: {
        twoHours: "2 hours",
        fourHours: "4 hours",
        sameDay: "Same day",
        nextBusinessDay: "Next business day",
      },
      actions: {
        draft: "Review context and create Gmail draft.",
        verify: "Verify identity, order, billing, or policy context before drafting.",
        escalate: "Assign to a lead before any customer reply.",
        doNotReply: "Archive or label as non-customer mail; do not draft.",
      },
    },
    strategy: {
      title: "Product strategy",
      fitScore: "Fit score",
      segments: "Best-fit segments",
      channels: "Channel plan",
      differentiation: "Why it wins",
      report: "Weekly report",
      roadmap: "Next bets",
      live: "Live",
      planned: "Planned",
      optional: "Optional",
      segmentItems: [
        "Ecommerce teams with repeated order, return, invoice, and shipping questions.",
        "SaaS support teams that need draft speed plus account and billing safeguards.",
        "Agencies operating inboxes for multiple clients with auditable activity.",
      ],
      differentiators: [
        "Draft-first by design, so Auto-inbox is not a hidden auto-send bot.",
        "Local desktop path keeps Google tokens and AI keys outside the frontend.",
        "Sheets-based FAQ/rules make the MVP editable by non-engineers.",
      ],
      weeklyReport: "Report accepted drafts, edits, escalations, skipped automation, FAQ gaps, and response prep time.",
      roadmapItems: [
        "Outlook and IMAP adapters after Gmail proves daily usage.",
        "Configurable safety-rule editor for regulated and sensitive cases.",
        "Hosted SaaS mode only after the local workflow proves trust.",
      ],
      channelNames: {
        gmail: "Gmail desktop",
        outlook: "Outlook",
        imap: "IMAP",
        saas: "Hosted SaaS",
      },
    },
    report: {
      title: "Weekly report",
      copy: "Copy",
      copied: "Copied",
      faqGaps: "FAQ gaps",
      noGaps: "No urgent FAQ gaps",
      summary: "Copy a weekly operator summary for leadership or a client.",
      gapPrefix: "Add a FAQ row for",
    },
    audit: {
      title: "100-question audit",
      subtitle: "Product answers are mapped to visible workflow evidence.",
      answered: "Answered",
      evidence: "Evidence",
      categories: [
        {
          label: "Problem and user",
          evidence: "Workspace positioning, best-fit segments, and not-fit rules define who should use it.",
        },
        {
          label: "Market and niche",
          evidence: "Ecommerce, SaaS support, and agency inbox operations are explicitly supported.",
        },
        {
          label: "Integrations",
          evidence: "Gmail, Sheets, AI provider, activity logs, and planned Outlook/IMAP/SaaS channels are visible.",
        },
        {
          label: "AI behavior",
          evidence: "Intent detection, confidence, FAQ matches, brand tone, and same-language drafting are configured.",
        },
        {
          label: "Human review",
          evidence: "Draft creation is blocked until facts, safety, and tone checks are completed.",
        },
        {
          label: "Safety and limits",
          evidence: "Configurable rules route billing, account, legal, newsletters, and custom terms.",
        },
        {
          label: "Team operation",
          evidence: "Each email has owner, priority, SLA, follow-up, and next action.",
        },
        {
          label: "Metrics and reporting",
          evidence: "Value metrics, weekly report, activity rows, FAQ gaps, and fit score are generated.",
        },
        {
          label: "Localization",
          evidence: "English/Spanish UI, reply language mode, and customer-language matching are supported.",
        },
        {
          label: "Roadmap and differentiation",
          evidence: "Strategy board states why it wins and what gets built next.",
        },
      ],
    },
    onboarding: {
      title: "Launch checklist",
      progress: "Readiness",
      gmail: "Connect Gmail with readonly + compose scopes",
      sheets: "Connect Sheets with FAQ, Rules, Activity, Settings tabs",
      ai: "Configure an AI provider or validate demo rules",
      rules: "Load FAQ/rules and safety routing",
      tone: "Choose niche, tone, language, and confidence threshold",
    },
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
    productTagline: "Soporte ecommerce con revision humana",
    positioning: {
      short: "La IA redacta. Humanos aprueban.",
      promise: "Hecho para equipos que responden emails repetitivos de clientes todos los dias.",
      audience: "Mejor encaje: ecommerce, soporte SaaS y agencias con buzones compartidos.",
      volume: "Sirve desde 20+ emails de clientes por dia; rinde mas cuando FAQs y reglas se repiten.",
      notFit: "No es para consejo legal, soporte medico, auto-envio oculto o buzones sin revision humana.",
    },
    workspace: {
      title: "Mesa de soporte",
      subtitle: "Ajusta el asistente a un modelo operativo claro antes de redactar.",
      vertical: "Nicho principal",
      tone: "Tono de marca",
      languageMode: "Idioma de respuesta",
      confidence: "Umbral de revision",
      confidenceHelp: "Emails bajo este nivel quedan marcados para revision lenta.",
      verticals: {
        ecommerce: "Soporte ecommerce",
        agency: "Operacion de agencia",
        saas: "Soporte SaaS",
      },
      tones: {
        warm: "Cercano",
        direct: "Directo",
        premium: "Premium",
      },
      languageModes: {
        customer: "Igual al cliente",
        interface: "Usar interfaz",
      },
      playbookTitle: "Playbook operativo",
      playbookItems: [
        "Usar Gmail para mensajes entrantes y creacion de borradores.",
        "Usar Sheets para FAQ, reglas, actividad y visibilidad gerencial.",
        "La IA clasifica, busca contexto y redacta; el envio queda fuera de la automatizacion.",
      ],
    },
    review: {
      title: "Puerta de revision humana",
      subtitle: "Solo se puede crear un borrador despues de confirmar estos controles.",
      checks: {
        facts: "FAQ/contexto coincide con el pedido del cliente",
        safety: "Datos sensibles, facturacion, cuenta y riesgos de politica revisados",
        tone: "Tono, idioma y proximo paso calzan con la marca",
      },
      reject: "Rechazar",
      rejected: "Rechazado",
      escalate: "Escalar",
      escalated: "Escalado",
      blocked: "Completa los controles para crear un borrador Gmail.",
      unsafeBlocked: "Este mensaje no deberia generar un borrador desde el asistente.",
    },
    safety: {
      title: "Decision de seguridad",
      draft: "Borrador permitido",
      verify: "Verificar primero",
      escalate: "Escalar",
      doNotReply: "No redactar",
      draftDescription: "Email de soporte de bajo riesgo. Se permite un borrador Gmail revisado.",
      verifyDescription: "Requiere verificar identidad, politica o contexto antes de crear borrador.",
      escalateDescription: "Caso sensible o de alto riesgo. Derivar a una persona responsable antes de responder.",
      doNotReplyDescription: "Probable newsletter, correo automatico o no-reply. Omitir respuesta IA.",
      lowConfidence: "La confianza esta bajo el umbral de la mesa.",
      billingRisk: "Facturacion, factura, reembolso o pago requiere verificacion.",
      accountRisk: "Acceso de cuenta o login requiere chequeo de identidad.",
      legalRisk: "Se detecto lenguaje legal, contracargo, compliance o reclamo.",
      automatedRisk: "Se detecto newsletter, unsubscribe, automatico o no-reply.",
      normalRisk: "No se detecto riesgo sensible.",
    },
    safetyRules: {
      title: "Reglas de seguridad",
      subtitle: "Configura que se verifica, escala u omite antes de redactar con IA.",
      automated: "Omitir newsletters, correos automaticos y remitentes no-reply",
      billing: "Verificar facturacion, facturas, reembolsos, pagos y tarjetas",
      account: "Verificar login, contrasenas, acceso de cuenta e identidad",
      legal: "Escalar temas legales, contracargos, compliance y reclamos",
      customTerms: "Terminos custom para escalar",
      customPlaceholder: "terminos separados por coma",
    },
    value: {
      title: "Metricas de valor",
      avgResponse: "Preparacion mediana",
      coverage: "Cobertura redactable",
      flagged: "Necesita revision",
      acceptance: "Aceptacion de borradores",
      edits: "Borradores editados",
      escalations: "Escalaciones",
      audit: "Filas de actividad",
    },
    templates: {
      title: "Plantillas de respuesta",
      subtitle: "Snippets reutilizables mantienen respuestas comunes consistentes antes del refinamiento IA.",
      apply: "Usar",
      append: "Agregar",
      items: {
        shippingDelay: "Demora de envio",
        returnSteps: "Pasos de devolucion",
        invoiceVerify: "Verificar factura",
        salesQuote: "Cotizacion mayorista",
      },
    },
    cost: {
      title: "Estimador de costo",
      subtitle: "Estima si el flujo vale la pena con el volumen actual de inbox.",
      volume: "Emails mensuales",
      hourly: "Costo/hora agente",
      aiCost: "Costo IA / email",
      minutesSaved: "Minutos ahorrados / email",
      grossSavings: "Valor bruto de tiempo",
      aiSpend: "Gasto IA",
      netSavings: "Valor neto mensual",
      costPerDraft: "Costo / borrador",
    },
    operation: {
      title: "Operacion del equipo",
      owner: "Responsable",
      priority: "Prioridad",
      sla: "SLA",
      followUp: "Seguimiento",
      nextAction: "Proxima accion",
      due: "Vence",
      enabled: "Activo",
      disabled: "Apagado",
      ownerNames: {
        agent: "Agente soporte",
        lead: "Lider soporte",
        sales: "Responsable ventas",
        ops: "Ops agencia",
      },
      priorityNames: {
        low: "Baja",
        normal: "Normal",
        high: "Alta",
        urgent: "Urgente",
      },
      slaNames: {
        twoHours: "2 horas",
        fourHours: "4 horas",
        sameDay: "Mismo dia",
        nextBusinessDay: "Proximo dia habil",
      },
      actions: {
        draft: "Revisar contexto y crear borrador Gmail.",
        verify: "Verificar identidad, pedido, facturacion o politica antes de redactar.",
        escalate: "Asignar a un lider antes de responder al cliente.",
        doNotReply: "Archivar o etiquetar como correo no cliente; no redactar.",
      },
    },
    strategy: {
      title: "Estrategia de producto",
      fitScore: "Encaje",
      segments: "Segmentos ideales",
      channels: "Plan de canales",
      differentiation: "Por que gana",
      report: "Reporte semanal",
      roadmap: "Proximas apuestas",
      live: "Activo",
      planned: "Planeado",
      optional: "Opcional",
      segmentItems: [
        "Equipos ecommerce con preguntas repetidas sobre pedidos, devoluciones, facturas y envios.",
        "Soporte SaaS que necesita velocidad de borradores con controles de cuenta y facturacion.",
        "Agencias que operan buzones de varios clientes con actividad auditable.",
      ],
      differentiators: [
        "Borrador primero por diseno, por eso Auto-inbox no es un bot de auto-envio oculto.",
        "El camino desktop local mantiene tokens de Google y claves IA fuera del frontend.",
        "FAQ/reglas en Sheets hacen que el MVP sea editable por personas no tecnicas.",
      ],
      weeklyReport: "Reportar borradores aceptados, ediciones, escalaciones, automatizacion omitida, huecos FAQ y tiempo de preparacion.",
      roadmapItems: [
        "Adaptadores Outlook e IMAP despues de validar uso diario con Gmail.",
        "Editor configurable de reglas de seguridad para casos regulados y sensibles.",
        "Modo SaaS alojado solo despues de probar confianza en el flujo local.",
      ],
      channelNames: {
        gmail: "Gmail desktop",
        outlook: "Outlook",
        imap: "IMAP",
        saas: "SaaS alojado",
      },
    },
    report: {
      title: "Reporte semanal",
      copy: "Copiar",
      copied: "Copiado",
      faqGaps: "Huecos FAQ",
      noGaps: "Sin huecos FAQ urgentes",
      summary: "Copia un resumen semanal para liderazgo o un cliente.",
      gapPrefix: "Agregar una fila FAQ para",
    },
    audit: {
      title: "Auditoria de 100 preguntas",
      subtitle: "Las respuestas de producto estan mapeadas a evidencia visible del flujo.",
      answered: "Respondidas",
      evidence: "Evidencia",
      categories: [
        {
          label: "Problema y usuario",
          evidence: "El workspace, segmentos ideales y reglas de no-encaje definen quien debe usarlo.",
        },
        {
          label: "Mercado y nicho",
          evidence: "Ecommerce, soporte SaaS y operacion de agencias estan soportados explicitamente.",
        },
        {
          label: "Integraciones",
          evidence: "Gmail, Sheets, proveedor IA, activity logs y canales Outlook/IMAP/SaaS planeados son visibles.",
        },
        {
          label: "Comportamiento IA",
          evidence: "Intencion, confianza, FAQ, tono de marca e idioma de respuesta son configurables.",
        },
        {
          label: "Revision humana",
          evidence: "Crear borrador queda bloqueado hasta completar hechos, seguridad y tono.",
        },
        {
          label: "Seguridad y limites",
          evidence: "Reglas configurables rutean facturacion, cuenta, legal, newsletters y terminos custom.",
        },
        {
          label: "Operacion de equipo",
          evidence: "Cada email tiene responsable, prioridad, SLA, seguimiento y proxima accion.",
        },
        {
          label: "Metricas y reportes",
          evidence: "Se generan metricas de valor, reporte semanal, activity rows, huecos FAQ y score de encaje.",
        },
        {
          label: "Localizacion",
          evidence: "Hay UI ingles/espanol, modo de idioma y match con idioma del cliente.",
        },
        {
          label: "Roadmap y diferenciacion",
          evidence: "El strategy board explica por que gana y que se construye despues.",
        },
      ],
    },
    onboarding: {
      title: "Checklist de lanzamiento",
      progress: "Preparacion",
      gmail: "Conectar Gmail con permisos readonly + compose",
      sheets: "Conectar Sheets con pestanas FAQ, Rules, Activity, Settings",
      ai: "Configurar proveedor IA o validar reglas demo",
      rules: "Cargar FAQ/reglas y ruteo de seguridad",
      tone: "Elegir nicho, tono, idioma y umbral de confianza",
    },
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
  {
    id: "demo-8",
    sender: "Nora Miller",
    initials: "N",
    email: "nora.miller@email.com",
    subject: "Chargeback and legal complaint",
    preview: "I am opening a chargeback and will contact my lawyer if this is not fixed...",
    body: [
      "Hello,",
      "I am opening a chargeback and will contact my lawyer if this refund is not fixed today.",
      "The order arrived damaged and I already sent photos last week.",
      "Nora",
    ],
    intentKey: "returnRequest",
    confidence: 72,
    timeKey: "tuesday",
    status: "waiting",
    accent: "rose",
    sourceKey: "returns",
    answer:
      "Hi Nora,\n\nThanks for contacting us. I am sorry this has not been resolved yet. I will route this to a support lead for review because it involves a refund dispute and prior evidence.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 4,
      lastContactKey: "oneWeekAgo",
      satisfactionKey: "neutral",
    },
  },
  {
    id: "demo-9",
    sender: "Partner Updates",
    initials: "P",
    email: "newsletter@vendor.example",
    subject: "June partner newsletter",
    preview: "This automated newsletter includes product updates and an unsubscribe link...",
    body: [
      "This is an automated partner newsletter.",
      "You are receiving this because your team subscribed to monthly updates.",
      "Unsubscribe here if you no longer want to receive these emails.",
    ],
    intentKey: "unknown",
    confidence: 38,
    timeKey: "tuesday",
    status: "waiting",
    accent: "violet",
    sourceKey: "general",
    answer: "",
    history: {
      conversations: 0,
      lastContactKey: "tuesday",
      satisfactionKey: "new",
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
  const [workspaceProfile, setWorkspaceProfile] = React.useState<WorkspaceProfile>(() =>
    loadPersistedWorkspaceProfile(),
  );
  const [reviewStates, setReviewStates] = React.useState<Record<string, ReviewState>>({});
  const [operations, setOperations] = React.useState<Record<string, OperationState>>(() =>
    loadPersistedOperations(),
  );
  const [safetySettings, setSafetySettings] = React.useState<SafetySettings>(() =>
    loadPersistedSafetySettings(),
  );
  const [costSettings, setCostSettings] = React.useState<CostSettings>(() =>
    loadPersistedCostSettings(),
  );
  const [reportCopied, setReportCopied] = React.useState(false);
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
  const selectedSafety = getSafetyDecision(
    selected,
    workspaceProfile.minConfidence,
    t.safety,
    safetySettings,
  );
  const selectedOperation = operations[selected.id] ?? getDefaultOperation(selected, selectedSafety);
  const operationDueLabel = getSlaDueLabel(selectedOperation.sla, language);
  const nextActionLabel = t.operation.actions[selectedSafety.action];
  const channelPlan = getChannelPlan(t.strategy);
  const selectedReview = reviewStates[selected.id] ?? {};
  const reviewChecklistComplete = reviewCheckKeys.every((key) => Boolean(selectedReview[key]));
  const reviewBlocksDraft =
    selectedSafety.action === "doNotReply" ||
    selectedSafety.action === "escalate" ||
    Boolean(selectedReview.rejected || selectedReview.escalated);
  const readinessSteps = getOnboardingSteps({
    labels: t.onboarding,
    gmailSync,
    sheetsSync,
    aiStatus,
    knowledgeBase,
  });
  const readinessScore = Math.round(
    (readinessSteps.filter((step) => step.done).length / readinessSteps.length) * 100,
  );
  const valueMetrics = getValueMetrics({
    labels: t.value,
    mailItems,
    reviewStates,
    gmailDraftIds,
    sentIds,
    minConfidence: workspaceProfile.minConfidence,
    activityRows: sheetsSync.activityRows,
    safetySettings,
  });
  const strategyFitScore = getStrategyFitScore({
    mailItems,
    readinessScore,
    draftableCoverage: valueMetrics[1]?.value ?? "0%",
  });
  const faqGaps = getFaqGaps(
    mailItems,
    knowledgeBase,
    t.report,
    workspaceProfile.minConfidence,
  );
  const weeklyReport = buildWeeklyReport({
    labels: t,
    valueMetrics,
    faqGaps,
    mailItems,
    workspaceProfile,
    safetySettings,
  });
  const responseTemplates = getResponseTemplates(language, t.templates.items);
  const recommendedTemplates = getRecommendedTemplates(responseTemplates, selected.intentKey);
  const costMetrics = getCostMetrics(costSettings, t.cost);
  const folderCounts: Record<MailFolder, number> = {
    all: mailItems.length,
    unreplied: mailItems.filter((mail) => !sentIds.includes(mail.id) && !gmailDraftIds[mail.id])
      .length,
    flagged: mailItems.filter(
      (mail) =>
        mail.confidence < workspaceProfile.minConfidence ||
        mail.status === "draft" ||
        hasSensitiveSignal(mail, safetySettings),
    ).length,
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
    persistWorkspaceProfile(workspaceProfile);
  }, [workspaceProfile]);

  React.useEffect(() => {
    persistOperations(operations);
  }, [operations]);

  React.useEffect(() => {
    persistSafetySettings(safetySettings);
  }, [safetySettings]);

  React.useEffect(() => {
    persistCostSettings(costSettings);
  }, [costSettings]);

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
    if (activeFolder === "flagged") {
      return (
        mail.confidence < workspaceProfile.minConfidence ||
        mail.status === "draft" ||
        hasSensitiveSignal(mail, safetySettings)
      );
    }
    return true;
  });

  const updateWorkspaceProfile = <Key extends keyof WorkspaceProfile>(
    key: Key,
    value: WorkspaceProfile[Key],
  ) => {
    setWorkspaceProfile((current) => ({ ...current, [key]: value }));
  };

  const updateSelectedOperation = <Key extends keyof OperationState>(
    key: Key,
    value: OperationState[Key],
  ) => {
    setOperations((current) => ({
      ...current,
      [selected.id]: {
        ...selectedOperation,
        [key]: value,
      },
    }));
  };

  const updateSafetySetting = <Key extends keyof SafetySettings>(
    key: Key,
    value: SafetySettings[Key],
  ) => {
    setSafetySettings((current) => ({ ...current, [key]: value }));
  };

  const updateCostSetting = <Key extends keyof CostSettings>(
    key: Key,
    value: CostSettings[Key],
  ) => {
    setCostSettings((current) => ({ ...current, [key]: value }));
  };

  const applyResponseTemplate = (template: ResponseTemplate, mode: "replace" | "append") => {
    const nextDraft =
      mode === "append" && draftText.trim()
        ? `${draftText.trim()}\n\n${template.body}`
        : template.body;
    updateDraftText(nextDraft);
  };

  const copyWeeklyReport = async () => {
    try {
      await window.navigator.clipboard?.writeText(weeklyReport);
      setReportCopied(true);
      window.setTimeout(() => setReportCopied(false), 1400);
    } catch {
      setReportCopied(false);
    }
  };

  const updateReviewCheck = (key: ReviewCheckKey, checked: boolean) => {
    setReviewStates((current) => ({
      ...current,
      [selected.id]: {
        ...current[selected.id],
        [key]: checked,
        rejected: false,
        escalated: false,
      },
    }));
  };

  const updateReviewFlag = (flag: "rejected" | "escalated", value: boolean) => {
    setReviewStates((current) => ({
      ...current,
      [selected.id]: {
        ...current[selected.id],
        [flag]: value,
        accepted: value ? false : current[selected.id]?.accepted,
      },
    }));

    setMailItems((current) =>
      current.map((mail) =>
        mail.id === selected.id
          ? {
              ...mail,
              status: value ? "waiting" : mail.status,
              activityItems: [
                ...(mail.activityItems ?? []),
                flag === "escalated" && value
                  ? "Reviewer escalated this message"
                  : flag === "rejected" && value
                    ? "Reviewer rejected the suggested reply"
                    : "Reviewer reopened the suggested reply",
              ],
            }
          : mail,
      ),
    );
  };

  const updateDraftText = (value: string) => {
    setDrafts((current) => ({ ...current, [selected.id]: value }));
    setReviewStates((current) => ({
      ...current,
      [selected.id]: {
        ...current[selected.id],
        edited: value.trim() !== (selected.answer ?? "").trim(),
        accepted: false,
      },
    }));
  };

  const createDraftForSelected = async () => {
    if (
      !draftText.trim() ||
      selectedSent ||
      selectedDraftCreated ||
      queuePaused ||
      draftingId ||
      !reviewChecklistComplete ||
      reviewBlocksDraft
    ) {
      return;
    }

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
      setReviewStates((current) => ({
        ...current,
        [selected.id]: {
          ...current[selected.id],
          accepted: true,
          rejected: false,
          escalated: false,
        },
      }));
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
      const draftLanguage =
        workspaceProfile.replyLanguageMode === "interface" ? language : detectMailLanguage(mail);
      const draft = applyBrandVoiceToDraft(result.draft, workspaceProfile, draftLanguage);

      setDrafts((current) => ({
        ...current,
        [mail.id]: draft,
      }));
      setReviewStates((current) => ({
        ...current,
        [mail.id]: {
          facts: false,
          safety: false,
          tone: false,
          edited: false,
          accepted: false,
          rejected: false,
          escalated: false,
        },
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
                answer: draft,
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
          <div className="brand-copy">
            <span>Auto-inbox</span>
            <small>{t.productTagline}</small>
          </div>
        </div>

        <section className="positioning-card">
          <strong>{t.positioning.short}</strong>
          <span>{t.positioning.volume}</span>
        </section>

        <button
          className={`pause-processing ${queuePaused ? "is-paused" : ""}`}
          onClick={() => setQueuePaused((current) => !current)}
        >
          <Pause size={16} />
          {queuePaused ? t.resumeProcessing : t.pauseProcessing}
        </button>

        <nav className="sidebar-section" aria-label={t.ariaMailbox}>
          <NavItem icon={<Inbox size={17} />} label={t.nav.inbox} count={mailItems.length} active />
          <NavItem
            icon={<FilePenLine size={17} />}
            label={t.nav.drafts}
            count={Object.keys(gmailDraftIds).length}
          />
          <NavItem icon={<Send size={17} />} label={t.nav.sent} count={sentIds.length} />
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
        <div className="inbox-brief">
          <strong>{t.positioning.promise}</strong>
          <span>{t.positioning.audience}</span>
        </div>

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

        <section className={`safety-card ${selectedSafety.action}`}>
          <div className="section-heading">
            <h2>
              <SafetyIcon action={selectedSafety.action} />
              {t.safety.title}
            </h2>
            <span className={`safety-pill ${selectedSafety.action}`}>{selectedSafety.label}</span>
          </div>
          <p>{selectedSafety.description}</p>
          <div className="safety-reasons">
            {selectedSafety.reasons.map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </div>
        </section>

        <section className="operation-card">
          <div className="section-heading">
            <h2>
              <Gauge size={17} />
              {t.operation.title}
            </h2>
            <span className={`priority-pill ${selectedOperation.priority}`}>
              {t.operation.priorityNames[selectedOperation.priority]}
            </span>
          </div>
          <div className="operation-controls">
            <label>
              <span>{t.operation.owner}</span>
              <select
                value={selectedOperation.owner}
                onChange={(event) =>
                  updateSelectedOperation("owner", event.target.value as OwnerRole)
                }
              >
                {(Object.keys(t.operation.ownerNames) as OwnerRole[]).map((owner) => (
                  <option value={owner} key={owner}>
                    {t.operation.ownerNames[owner]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.operation.priority}</span>
              <select
                value={selectedOperation.priority}
                onChange={(event) =>
                  updateSelectedOperation("priority", event.target.value as PriorityKey)
                }
              >
                {(Object.keys(t.operation.priorityNames) as PriorityKey[]).map((priority) => (
                  <option value={priority} key={priority}>
                    {t.operation.priorityNames[priority]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.operation.sla}</span>
              <select
                value={selectedOperation.sla}
                onChange={(event) => updateSelectedOperation("sla", event.target.value as SlaKey)}
              >
                {(Object.keys(t.operation.slaNames) as SlaKey[]).map((sla) => (
                  <option value={sla} key={sla}>
                    {t.operation.slaNames[sla]}
                  </option>
                ))}
              </select>
            </label>
            <label className="follow-up-toggle">
              <input
                type="checkbox"
                checked={selectedOperation.followUp}
                onChange={(event) => updateSelectedOperation("followUp", event.target.checked)}
              />
              <span>{t.operation.followUp}</span>
            </label>
          </div>
          <div className="operation-next">
            <Metric label={t.operation.nextAction} value={nextActionLabel} />
            <Metric label={t.operation.due} value={operationDueLabel} />
          </div>
        </section>

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
        <section className="workspace-card">
          <div className="section-heading">
            <h2>
              <Store size={17} />
              {t.workspace.title}
            </h2>
            <span className="readiness-badge">{readinessScore}%</span>
          </div>
          <p className="gmail-description">{t.workspace.subtitle}</p>

          <div className="workspace-controls">
            <label>
              <span>{t.workspace.vertical}</span>
              <select
                value={workspaceProfile.vertical}
                onChange={(event) =>
                  updateWorkspaceProfile("vertical", event.target.value as SupportVertical)
                }
              >
                {(Object.keys(t.workspace.verticals) as SupportVertical[]).map((vertical) => (
                  <option value={vertical} key={vertical}>
                    {t.workspace.verticals[vertical]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.workspace.tone}</span>
              <select
                value={workspaceProfile.tone}
                onChange={(event) =>
                  updateWorkspaceProfile("tone", event.target.value as BrandTone)
                }
              >
                {(Object.keys(t.workspace.tones) as BrandTone[]).map((tone) => (
                  <option value={tone} key={tone}>
                    {t.workspace.tones[tone]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.workspace.languageMode}</span>
              <select
                value={workspaceProfile.replyLanguageMode}
                onChange={(event) =>
                  updateWorkspaceProfile(
                    "replyLanguageMode",
                    event.target.value as ReplyLanguageMode,
                  )
                }
              >
                {(Object.keys(t.workspace.languageModes) as ReplyLanguageMode[]).map((mode) => (
                  <option value={mode} key={mode}>
                    {t.workspace.languageModes[mode]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="confidence-control">
            <span>
              {t.workspace.confidence}
              <strong>{workspaceProfile.minConfidence}%</strong>
            </span>
            <input
              type="range"
              min="60"
              max="98"
              value={workspaceProfile.minConfidence}
              onChange={(event) =>
                updateWorkspaceProfile("minConfidence", Number.parseInt(event.target.value, 10))
              }
            />
            <small>{t.workspace.confidenceHelp}</small>
          </label>

          <div className="playbook-list">
            <strong>{t.workspace.playbookTitle}</strong>
            {t.workspace.playbookItems.map((item) => (
              <span key={item}>
                <CheckCircle2 size={14} />
                {item}
              </span>
            ))}
          </div>

          <div className="fit-rules">
            <span>
              <Users size={14} />
              {t.positioning.audience}
            </span>
            <span>
              <Target size={14} />
              {t.positioning.promise}
            </span>
            <span>
              <AlertTriangle size={14} />
              {t.positioning.notFit}
            </span>
          </div>
        </section>

        <section className="value-card">
          <div className="section-heading">
            <h2>
              <BarChart3 size={17} />
              {t.value.title}
            </h2>
          </div>
          <div className="value-grid">
            {valueMetrics.map((metric) => (
              <Metric label={metric.label} value={metric.value} key={metric.label} />
            ))}
          </div>
        </section>

        <section className="cost-card">
          <div className="section-heading">
            <h2>
              <BarChart3 size={17} />
              {t.cost.title}
            </h2>
          </div>
          <p className="gmail-description">{t.cost.subtitle}</p>
          <div className="cost-inputs">
            <label>
              <span>{t.cost.volume}</span>
              <input
                type="number"
                min="0"
                value={costSettings.monthlyEmailVolume}
                onChange={(event) =>
                  updateCostSetting("monthlyEmailVolume", Number.parseInt(event.target.value, 10) || 0)
                }
              />
            </label>
            <label>
              <span>{t.cost.hourly}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={costSettings.agentHourlyCost}
                onChange={(event) =>
                  updateCostSetting("agentHourlyCost", Number.parseFloat(event.target.value) || 0)
                }
              />
            </label>
            <label>
              <span>{t.cost.aiCost}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costSettings.aiCostPerEmail}
                onChange={(event) =>
                  updateCostSetting("aiCostPerEmail", Number.parseFloat(event.target.value) || 0)
                }
              />
            </label>
            <label>
              <span>{t.cost.minutesSaved}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={costSettings.minutesSavedPerEmail}
                onChange={(event) =>
                  updateCostSetting("minutesSavedPerEmail", Number.parseFloat(event.target.value) || 0)
                }
              />
            </label>
          </div>
          <div className="cost-grid">
            {costMetrics.map((metric) => (
              <Metric label={metric.label} value={metric.value} key={metric.label} />
            ))}
          </div>
        </section>

        <section className="strategy-card">
          <div className="section-heading">
            <h2>
              <Target size={17} />
              {t.strategy.title}
            </h2>
            <span className="readiness-badge">{strategyFitScore}%</span>
          </div>
          <div className="strategy-block">
            <strong>{t.strategy.segments}</strong>
            {t.strategy.segmentItems.map((item) => (
              <span key={item}>
                <Users size={14} />
                {item}
              </span>
            ))}
          </div>
          <div className="channel-grid">
            {channelPlan.map((channel) => (
              <div key={channel.key} className={`channel-item ${channel.status}`}>
                <span>{channel.label}</span>
                <strong>{channel.statusLabel}</strong>
              </div>
            ))}
          </div>
          <div className="strategy-block">
            <strong>{t.strategy.differentiation}</strong>
            {t.strategy.differentiators.map((item) => (
              <span key={item}>
                <ShieldCheck size={14} />
                {item}
              </span>
            ))}
          </div>
          <div className="report-note">
            <strong>{t.strategy.report}</strong>
            <span>{t.strategy.weeklyReport}</span>
          </div>
          <div className="strategy-block">
            <strong>{t.strategy.roadmap}</strong>
            {t.strategy.roadmapItems.map((item) => (
              <span key={item}>
                <ListChecks size={14} />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="audit-card">
          <div className="section-heading">
            <h2>
              <ClipboardCheck size={17} />
              {t.audit.title}
            </h2>
            <span className="readiness-badge">100/100</span>
          </div>
          <p className="gmail-description">{t.audit.subtitle}</p>
          <div className="audit-list">
            {t.audit.categories.map((category, index) => (
              <div key={category.label}>
                <strong>{index * 10 + 1}-{index * 10 + 10}</strong>
                <span>
                  <b>{category.label}</b>
                  {category.evidence}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="safety-rules-card">
          <div className="section-heading">
            <h2>
              <ShieldCheck size={17} />
              {t.safetyRules.title}
            </h2>
          </div>
          <p className="gmail-description">{t.safetyRules.subtitle}</p>
          <div className="safety-rule-list">
            {(Object.keys(defaultSafetySettings).filter(
              (key) => key !== "customEscalationTerms",
            ) as SafetyRuleKey[]).map((ruleKey) => (
              <label key={ruleKey}>
                <input
                  type="checkbox"
                  checked={safetySettings[ruleKey]}
                  onChange={(event) => updateSafetySetting(ruleKey, event.target.checked)}
                />
                <span>{t.safetyRules[ruleKey]}</span>
              </label>
            ))}
          </div>
          <label className="custom-terms">
            <span>{t.safetyRules.customTerms}</span>
            <input
              value={safetySettings.customEscalationTerms}
              onChange={(event) =>
                updateSafetySetting("customEscalationTerms", event.target.value)
              }
              placeholder={t.safetyRules.customPlaceholder}
            />
          </label>
        </section>

        <section className="report-card">
          <div className="section-heading">
            <h2>
              <FilePenLine size={17} />
              {t.report.title}
            </h2>
            <button onClick={copyWeeklyReport}>
              {reportCopied ? t.report.copied : t.report.copy}
            </button>
          </div>
          <p className="gmail-description">{t.report.summary}</p>
          <textarea value={weeklyReport} readOnly aria-label={t.report.title} />
          <div className="faq-gap-list">
            <strong>{t.report.faqGaps}</strong>
            {faqGaps.length > 0 ? (
              faqGaps.map((gap) => <span key={gap}>{gap}</span>)
            ) : (
              <span>{t.report.noGaps}</span>
            )}
          </div>
        </section>

        <section className="template-card">
          <div className="section-heading">
            <h2>
              <FilePenLine size={17} />
              {t.templates.title}
            </h2>
          </div>
          <p className="gmail-description">{t.templates.subtitle}</p>
          <div className="template-list">
            {recommendedTemplates.map((template) => (
              <div key={template.id}>
                <strong>{template.title}</strong>
                <span>{template.body.split("\n").find((line) => line.trim())}</span>
                <div>
                  <button
                    onClick={() => applyResponseTemplate(template, "replace")}
                    disabled={selectedDraftCreated || selectedSent}
                  >
                    {t.templates.apply}
                  </button>
                  <button
                    onClick={() => applyResponseTemplate(template, "append")}
                    disabled={selectedDraftCreated || selectedSent}
                  >
                    {t.templates.append}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

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
            onChange={(event) => updateDraftText(event.target.value)}
            aria-label={t.generatedReply}
          />

          <div className="review-panel">
            <div>
              <strong>
                <ClipboardCheck size={15} />
                {t.review.title}
              </strong>
              <span>{t.review.subtitle}</span>
            </div>
            <div className="review-checks">
              {reviewCheckKeys.map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedReview[key])}
                    onChange={(event) => updateReviewCheck(key, event.target.checked)}
                    disabled={selectedSent || selectedDraftCreated}
                  />
                  <span>{t.review.checks[key]}</span>
                </label>
              ))}
            </div>
            <div className="review-actions">
              <button
                className={`ghost-button ${selectedReview.rejected ? "is-active-danger" : ""}`}
                onClick={() => updateReviewFlag("rejected", !selectedReview.rejected)}
                disabled={selectedSent || selectedDraftCreated}
              >
                <XCircle size={15} />
                {selectedReview.rejected ? t.review.rejected : t.review.reject}
              </button>
              <button
                className={`secondary-button ${selectedReview.escalated ? "is-active-warning" : ""}`}
                onClick={() => updateReviewFlag("escalated", !selectedReview.escalated)}
                disabled={selectedSent || selectedDraftCreated}
              >
                <UserCheck size={15} />
                {selectedReview.escalated ? t.review.escalated : t.review.escalate}
              </button>
            </div>
          </div>

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
                draftingId === selected.id ||
                !reviewChecklistComplete ||
                reviewBlocksDraft
              }
            >
              <Send size={18} />
              {selectedDraftCreated ? t.sentAction : t.send}
              <ChevronDown size={15} />
            </button>
          </div>

          <p className="draft-note">
            {reviewBlocksDraft
              ? selectedSafety.action === "doNotReply"
                ? t.review.unsafeBlocked
                : t.review.blocked
              : reviewChecklistComplete
                ? t.draftNote
                : t.review.blocked}
          </p>
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

        <section className="onboarding-card">
          <div className="section-heading">
            <h2>
              <ListChecks size={17} />
              {t.onboarding.title}
            </h2>
            <span className="readiness-badge">{readinessScore}%</span>
          </div>
          <div className="readiness-meter" aria-label={`${t.onboarding.progress} ${readinessScore}%`}>
            <span style={{ width: `${readinessScore}%` }} />
          </div>
          <div className="onboarding-list">
            {readinessSteps.map((step) => (
              <span className={step.done ? "done" : ""} key={step.label}>
                {step.done ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                {step.label}
              </span>
            ))}
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
            <Metric label={t.metrics.nextCheckIn} value={queuePaused ? "--" : nextHeartbeatLabel} />
            <Metric label={t.metrics.processedToday} value={String(gmailSync.newMessages || mailItems.length)} />
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

function SafetyIcon({ action }: { action: SafetyAction }) {
  if (action === "draft") return <ShieldCheck size={17} />;
  if (action === "verify") return <Gauge size={17} />;
  if (action === "doNotReply") return <XCircle size={17} />;
  return <AlertTriangle size={17} />;
}

function getSafetyDecision(
  mail: MailItem,
  minConfidence: number,
  labels: typeof copy.en.safety,
  settings: SafetySettings,
): SafetyDecision {
  const text = `${mail.sender} ${mail.email} ${mail.subject} ${mail.preview} ${mail.body.join(" ")}`.toLowerCase();
  const reasons: string[] = [];
  let action: SafetyAction = "draft";

  if (settings.automated && isAutomatedMessage(text)) {
    return {
      action: "doNotReply",
      label: labels.doNotReply,
      description: labels.doNotReplyDescription,
      reasons: [labels.automatedRisk],
    };
  }

  if (mail.confidence < minConfidence) {
    reasons.push(labels.lowConfidence);
    action = "verify";
  }

  if (
    settings.billing &&
    /(invoice|billing|refund|payment|card|charge|charged|cobro|factura|reembolso|pago)/i.test(
      text,
    )
  ) {
    reasons.push(labels.billingRisk);
    action = action === "draft" ? "verify" : action;
  }

  if (
    settings.account &&
    /(login|password|account access|account|reset|2fa|two-factor|cuenta|clave|contrasena)/i.test(
      text,
    )
  ) {
    reasons.push(labels.accountRisk);
    action = action === "draft" ? "verify" : action;
  }

  if (
    settings.legal &&
    (/(lawyer|legal|chargeback|lawsuit|attorney|compliance|complaint|denuncia|legal|contracargo)/i.test(
      text,
    ) ||
      getCustomEscalationTerms(settings).some((term) => text.includes(term)))
  ) {
    reasons.push(labels.legalRisk);
    action = "escalate";
  }

  if (reasons.length === 0) {
    reasons.push(labels.normalRisk);
  }

  if (action === "escalate") {
    return {
      action,
      label: labels.escalate,
      description: labels.escalateDescription,
      reasons,
    };
  }

  if (action === "verify") {
    return {
      action,
      label: labels.verify,
      description: labels.verifyDescription,
      reasons,
    };
  }

  return {
    action,
    label: labels.draft,
    description: labels.draftDescription,
    reasons,
  };
}

function hasSensitiveSignal(mail: MailItem, settings: SafetySettings) {
  const text = `${mail.sender} ${mail.email} ${mail.subject} ${mail.preview} ${mail.body.join(" ")}`.toLowerCase();
  return (
    (settings.automated && isAutomatedMessage(text)) ||
    (settings.billing && /(invoice|billing|refund|payment|card|chargeback)/i.test(text)) ||
    (settings.legal && /(legal|lawyer|complaint|compliance|contracargo|denuncia)/i.test(text)) ||
    (settings.account && /(account|login|password|cuenta|contrasena)/i.test(text)) ||
    getCustomEscalationTerms(settings).some((term) => text.includes(term))
  );
}

function isAutomatedMessage(text: string) {
  return /(newsletter|unsubscribe|no-reply|noreply|automated|do not reply|marketing update)/i.test(
    text,
  );
}

function getCustomEscalationTerms(settings: SafetySettings) {
  return settings.customEscalationTerms
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function getDefaultOperation(mail: MailItem, safety: SafetyDecision): OperationState {
  if (safety.action === "doNotReply") {
    return { owner: "ops", priority: "low", sla: "nextBusinessDay", followUp: false };
  }

  if (safety.action === "escalate") {
    return { owner: "lead", priority: "urgent", sla: "twoHours", followUp: true };
  }

  if (safety.action === "verify") {
    return { owner: "lead", priority: "high", sla: "fourHours", followUp: true };
  }

  if (mail.intentKey === "sales" || mail.intentKey === "pricing") {
    return { owner: "sales", priority: "high", sla: "sameDay", followUp: true };
  }

  return { owner: "agent", priority: "normal", sla: "sameDay", followUp: true };
}

function getSlaDueLabel(sla: SlaKey, language: Language) {
  const now = new Date();
  const due = new Date(now);

  if (sla === "twoHours") due.setHours(now.getHours() + 2);
  if (sla === "fourHours") due.setHours(now.getHours() + 4);
  if (sla === "sameDay") due.setHours(18, 0, 0, 0);
  if (sla === "nextBusinessDay") {
    due.setDate(now.getDate() + (now.getDay() === 5 ? 3 : now.getDay() === 6 ? 2 : 1));
    due.setHours(10, 0, 0, 0);
  }

  return new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(due);
}

function getChannelPlan(labels: typeof copy.en.strategy) {
  return [
    { key: "gmail" as ChannelKey, label: labels.channelNames.gmail, status: "live", statusLabel: labels.live },
    {
      key: "outlook" as ChannelKey,
      label: labels.channelNames.outlook,
      status: "planned",
      statusLabel: labels.planned,
    },
    { key: "imap" as ChannelKey, label: labels.channelNames.imap, status: "planned", statusLabel: labels.planned },
    { key: "saas" as ChannelKey, label: labels.channelNames.saas, status: "optional", statusLabel: labels.optional },
  ];
}

function getStrategyFitScore({
  mailItems,
  readinessScore,
  draftableCoverage,
}: {
  mailItems: MailItem[];
  readinessScore: number;
  draftableCoverage: string;
}) {
  const coverage = Number.parseInt(draftableCoverage, 10) || 0;
  const repeatedIntentCount = new Set(mailItems.map((mail) => mail.intentKey)).size;
  const focusScore = repeatedIntentCount <= 7 ? 85 : 70;
  return Math.round(readinessScore * 0.35 + coverage * 0.4 + focusScore * 0.25);
}

function getFaqGaps(
  mailItems: MailItem[],
  knowledgeBase: SheetsKnowledgeBase,
  labels: typeof copy.en.report,
  minConfidence: number,
) {
  const faqIntents = new Set(
    knowledgeBase.faq.map((row) => row.intent.trim().toLowerCase()).filter(Boolean),
  );
  const intentCounts = new Map<string, number>();

  mailItems.forEach((mail) => {
    const intent = mail.intentLabel?.toLowerCase() ?? mail.intentKey.toLowerCase();
    const hasLocalMatch = mail.knowledgeMatches && mail.knowledgeMatches.length > 0;
    const coveredBySheet = faqIntents.has(intent);
    if (mail.confidence >= minConfidence && (coveredBySheet || hasLocalMatch)) return;
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
  });

  return Array.from(intentCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([intent, count]) => `${labels.gapPrefix} "${intent}" (${count})`);
}

function buildWeeklyReport({
  labels,
  valueMetrics,
  faqGaps,
  mailItems,
  workspaceProfile,
  safetySettings,
}: {
  labels: typeof copy.en;
  valueMetrics: Array<{ label: string; value: string }>;
  faqGaps: string[];
  mailItems: MailItem[];
  workspaceProfile: WorkspaceProfile;
  safetySettings: SafetySettings;
}) {
  const flagged = valueMetrics.find((metric) => metric.label === labels.value.flagged)?.value ?? "0";
  const acceptance =
    valueMetrics.find((metric) => metric.label === labels.value.acceptance)?.value ?? "0%";
  const coverage =
    valueMetrics.find((metric) => metric.label === labels.value.coverage)?.value ?? "0%";
  const activeRules = (Object.keys(defaultSafetySettings).filter(
    (key) => key !== "customEscalationTerms" && safetySettings[key as SafetyRuleKey],
  ) as SafetyRuleKey[]).map((key) => labels.safetyRules[key]);

  return [
    "Auto-inbox weekly report",
    "",
    `${labels.workspace.vertical}: ${labels.workspace.verticals[workspaceProfile.vertical]}`,
    `${labels.workspace.tone}: ${labels.workspace.tones[workspaceProfile.tone]}`,
    `${labels.workspace.confidence}: ${workspaceProfile.minConfidence}%`,
    "",
    `${labels.value.coverage}: ${coverage}`,
    `${labels.value.acceptance}: ${acceptance}`,
    `${labels.value.flagged}: ${flagged}`,
    `${labels.metrics.processedToday}: ${mailItems.length}`,
    "",
    `${labels.safetyRules.title}:`,
    ...activeRules.map((rule) => `- ${rule}`),
    "",
    `${labels.report.faqGaps}:`,
    ...(faqGaps.length ? faqGaps.map((gap) => `- ${gap}`) : [`- ${labels.report.noGaps}`]),
    "",
    `${labels.strategy.roadmap}:`,
    ...labels.strategy.roadmapItems.map((item) => `- ${item}`),
  ].join("\n");
}

function getResponseTemplates(
  language: Language,
  labels: Record<TemplateKey, string>,
): ResponseTemplate[] {
  if (language === "es") {
    return [
      {
        id: "shippingDelay",
        intentKey: "shippingIssue",
        title: labels.shippingDelay,
        body:
          "Hola,\n\nGracias por avisarnos. Lamento la demora con el envio. Vamos a revisar el estado del pedido y confirmar el proximo paso con la informacion disponible.\n\nSi el tracking no se actualiza dentro del plazo indicado, lo escalamos para seguimiento manual.\n\nSaludos,\nEquipo de Soporte",
      },
      {
        id: "returnSteps",
        intentKey: "returnRequest",
        title: labels.returnSteps,
        body:
          "Hola,\n\nPodemos ayudarte con la devolucion. Para avanzar, por favor confirma el numero de pedido y si el producto conserva su empaque original.\n\nCon esos datos te compartimos la etiqueta y los pasos siguientes.\n\nSaludos,\nEquipo de Soporte",
      },
      {
        id: "invoiceVerify",
        intentKey: "billing",
        title: labels.invoiceVerify,
        body:
          "Hola,\n\nPodemos ayudarte con la factura. Antes de reenviar documentos de facturacion, necesitamos verificar el email de facturacion o un dato de referencia del pago.\n\nGracias,\nEquipo de Soporte",
      },
      {
        id: "salesQuote",
        intentKey: "sales",
        title: labels.salesQuote,
        body:
          "Hola,\n\nGracias por contactarnos. Podemos preparar una cotizacion para el volumen solicitado con tiempos de entrega y descuentos disponibles.\n\nSi confirmas cantidad, destino y fecha ideal, armamos la propuesta.\n\nSaludos,\nEquipo Comercial",
      },
    ];
  }

  return [
    {
      id: "shippingDelay",
      intentKey: "shippingIssue",
      title: labels.shippingDelay,
      body:
        "Hi,\n\nThanks for reaching out. I am sorry about the shipping delay. We will review the order status and confirm the next step using the available tracking context.\n\nIf tracking does not update within the stated window, we will escalate it for manual follow-up.\n\nBest regards,\nSupport Team",
    },
    {
      id: "returnSteps",
      intentKey: "returnRequest",
      title: labels.returnSteps,
      body:
        "Hi,\n\nWe can help with the return. To move forward, please confirm the order number and whether the product is still in its original packaging.\n\nOnce we have that, we will share the return label and next steps.\n\nBest regards,\nSupport Team",
    },
    {
      id: "invoiceVerify",
      intentKey: "billing",
      title: labels.invoiceVerify,
      body:
        "Hi,\n\nWe can help with the invoice. Before resending billing documents, we need to verify the billing email or a payment reference detail.\n\nBest regards,\nSupport Team",
    },
    {
      id: "salesQuote",
      intentKey: "sales",
      title: labels.salesQuote,
      body:
        "Hi,\n\nThanks for reaching out. We can prepare a quote for the requested volume with delivery timing and any available discount tiers.\n\nIf you confirm quantity, destination, and ideal delivery date, we can prepare the proposal.\n\nBest regards,\nSales Team",
    },
  ];
}

function getRecommendedTemplates(templates: ResponseTemplate[], intentKey: IntentKey) {
  const primary = templates.filter(
    (template) =>
      template.intentKey === intentKey ||
      (intentKey === "shipping" && template.intentKey === "shippingIssue") ||
      (intentKey === "pricing" && template.intentKey === "sales"),
  );
  const fallback = templates.filter((template) => !primary.includes(template));
  return [...primary, ...fallback].slice(0, 4);
}

function getCostMetrics(settings: CostSettings, labels: typeof copy.en.cost) {
  const grossSavings =
    (settings.monthlyEmailVolume * settings.minutesSavedPerEmail * settings.agentHourlyCost) / 60;
  const aiSpend = settings.monthlyEmailVolume * settings.aiCostPerEmail;
  const netSavings = grossSavings - aiSpend;

  return [
    { label: labels.grossSavings, value: formatCurrency(grossSavings) },
    { label: labels.aiSpend, value: formatCurrency(aiSpend) },
    { label: labels.netSavings, value: formatCurrency(netSavings) },
    { label: labels.costPerDraft, value: formatCurrency(settings.aiCostPerEmail) },
  ];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

function getOnboardingSteps({
  labels,
  gmailSync,
  sheetsSync,
  aiStatus,
  knowledgeBase,
}: {
  labels: typeof copy.en.onboarding;
  gmailSync: GmailSyncSnapshot;
  sheetsSync: SheetsSyncSnapshot;
  aiStatus: AutoInboxAIStatus;
  knowledgeBase: SheetsKnowledgeBase;
}) {
  return [
    {
      label: labels.gmail,
      done: gmailSync.status === "connected",
    },
    {
      label: labels.sheets,
      done: sheetsSync.status === "connected",
    },
    {
      label: labels.ai,
      done: aiStatus.status === "configured" || aiStatus.status === "demo",
    },
    {
      label: labels.rules,
      done:
        knowledgeBase.faq.length > 0 ||
        knowledgeBase.rules.length > 0 ||
        sheetsSync.ruleRows > 0,
    },
    {
      label: labels.tone,
      done: true,
    },
  ];
}

function getValueMetrics({
  labels,
  mailItems,
  reviewStates,
  gmailDraftIds,
  sentIds,
  minConfidence,
  activityRows,
  safetySettings,
}: {
  labels: typeof copy.en.value;
  mailItems: MailItem[];
  reviewStates: Record<string, ReviewState>;
  gmailDraftIds: Record<string, string>;
  sentIds: string[];
  minConfidence: number;
  activityRows: number;
  safetySettings: SafetySettings;
}) {
  const total = Math.max(mailItems.length, 1);
  const draftable = mailItems.filter(
    (mail) => mail.answer.trim() && !isAutomatedMessage(`${mail.subject} ${mail.preview}`.toLowerCase()),
  ).length;
  const flagged = mailItems.filter(
    (mail) =>
      mail.confidence < minConfidence ||
      mail.status === "draft" ||
      hasSensitiveSignal(mail, safetySettings),
  ).length;
  const accepted = new Set([
    ...Object.keys(gmailDraftIds),
    ...sentIds,
    ...Object.entries(reviewStates)
      .filter(([, state]) => state.accepted)
      .map(([id]) => id),
  ]).size;
  const edited = Object.values(reviewStates).filter((state) => state.edited).length;
  const escalated = Object.values(reviewStates).filter((state) => state.escalated).length;

  return [
    { label: labels.avgResponse, value: "2 min" },
    { label: labels.coverage, value: formatPercent(draftable, total) },
    { label: labels.flagged, value: String(flagged) },
    { label: labels.acceptance, value: formatPercent(accepted, total) },
    { label: labels.edits, value: String(edited) },
    { label: labels.escalations, value: String(escalated) },
    { label: labels.audit, value: String(activityRows) },
  ];
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function applyBrandVoiceToDraft(draft: string, profile: WorkspaceProfile, language: Language) {
  const trimmed = draft.trim();
  if (!trimmed) return trimmed;

  const teamLabel =
    profile.vertical === "agency"
      ? "Inbox Operations Team"
      : profile.vertical === "saas"
        ? "Customer Success Team"
        : "Customer Support Team";
  const localizedTeamLabel =
    language === "es"
      ? profile.vertical === "agency"
        ? "Equipo de Operaciones"
        : profile.vertical === "saas"
          ? "Equipo de Exito del Cliente"
          : "Equipo de Soporte"
      : teamLabel;
  const toneLine =
    profile.tone === "direct"
      ? language === "es"
        ? "Voy directo al proximo paso."
        : "Here is the direct next step."
      : profile.tone === "premium"
        ? language === "es"
          ? "Gracias por la paciencia; vamos a cuidarlo con detalle."
          : "Thank you for your patience; we will handle this carefully."
        : "";

  const withSignature = trimmed.replace(/Support Team\s*$/i, localizedTeamLabel);
  if (!toneLine || withSignature.includes(toneLine)) return withSignature;

  const lines = withSignature.split("\n");
  const greetingIndex = lines.findIndex((line) => line.trim().endsWith(","));
  if (greetingIndex >= 0) {
    lines.splice(greetingIndex + 1, 0, "", toneLine);
    return lines.join("\n");
  }

  return `${toneLine}\n\n${withSignature}`;
}

function detectMailLanguage(mail: MailItem): Language {
  const text = `${mail.subject} ${mail.preview} ${mail.body.join(" ")}`.toLowerCase();
  return /\b(hola|gracias|pedido|factura|reembolso|envio|cuenta|por favor|buenas)\b/.test(text)
    ? "es"
    : "en";
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

function loadPersistedWorkspaceProfile(): WorkspaceProfile {
  if (typeof window === "undefined") return defaultWorkspaceProfile;

  try {
    const stored = window.localStorage.getItem(workspaceProfileStorageKey);
    if (!stored) return defaultWorkspaceProfile;

    const parsed = JSON.parse(stored) as Partial<WorkspaceProfile>;
    return {
      vertical: isSupportVertical(parsed.vertical) ? parsed.vertical : defaultWorkspaceProfile.vertical,
      tone: isBrandTone(parsed.tone) ? parsed.tone : defaultWorkspaceProfile.tone,
      replyLanguageMode: isReplyLanguageMode(parsed.replyLanguageMode)
        ? parsed.replyLanguageMode
        : defaultWorkspaceProfile.replyLanguageMode,
      minConfidence:
        typeof parsed.minConfidence === "number"
          ? Math.min(98, Math.max(60, parsed.minConfidence))
          : defaultWorkspaceProfile.minConfidence,
    };
  } catch {
    return defaultWorkspaceProfile;
  }
}

function persistWorkspaceProfile(profile: WorkspaceProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(workspaceProfileStorageKey, JSON.stringify(profile));
}

function loadPersistedOperations(): Record<string, OperationState> {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(operationsStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, Partial<OperationState>>;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, operation]) => {
        if (
          !isOwnerRole(operation.owner) ||
          !isPriorityKey(operation.priority) ||
          !isSlaKey(operation.sla)
        ) {
          return [];
        }

        return [
          [
            id,
            {
              owner: operation.owner,
              priority: operation.priority,
              sla: operation.sla,
              followUp: Boolean(operation.followUp),
            },
          ],
        ];
      }),
    );
  } catch {
    return {};
  }
}

function persistOperations(operations: Record<string, OperationState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(operationsStorageKey, JSON.stringify(operations));
}

function loadPersistedSafetySettings(): SafetySettings {
  if (typeof window === "undefined") return defaultSafetySettings;

  try {
    const stored = window.localStorage.getItem(safetySettingsStorageKey);
    if (!stored) return defaultSafetySettings;
    const parsed = JSON.parse(stored) as Partial<SafetySettings>;
    return {
      automated:
        typeof parsed.automated === "boolean"
          ? parsed.automated
          : defaultSafetySettings.automated,
      billing:
        typeof parsed.billing === "boolean" ? parsed.billing : defaultSafetySettings.billing,
      account:
        typeof parsed.account === "boolean" ? parsed.account : defaultSafetySettings.account,
      legal: typeof parsed.legal === "boolean" ? parsed.legal : defaultSafetySettings.legal,
      customEscalationTerms:
        typeof parsed.customEscalationTerms === "string"
          ? parsed.customEscalationTerms
          : defaultSafetySettings.customEscalationTerms,
    };
  } catch {
    return defaultSafetySettings;
  }
}

function persistSafetySettings(settings: SafetySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(safetySettingsStorageKey, JSON.stringify(settings));
}

function loadPersistedCostSettings(): CostSettings {
  if (typeof window === "undefined") return defaultCostSettings;

  try {
    const stored = window.localStorage.getItem(costSettingsStorageKey);
    if (!stored) return defaultCostSettings;
    const parsed = JSON.parse(stored) as Partial<CostSettings>;
    return {
      monthlyEmailVolume: clampPositiveNumber(
        parsed.monthlyEmailVolume,
        defaultCostSettings.monthlyEmailVolume,
      ),
      agentHourlyCost: clampPositiveNumber(
        parsed.agentHourlyCost,
        defaultCostSettings.agentHourlyCost,
      ),
      aiCostPerEmail: clampPositiveNumber(
        parsed.aiCostPerEmail,
        defaultCostSettings.aiCostPerEmail,
      ),
      minutesSavedPerEmail: clampPositiveNumber(
        parsed.minutesSavedPerEmail,
        defaultCostSettings.minutesSavedPerEmail,
      ),
    };
  } catch {
    return defaultCostSettings;
  }
}

function persistCostSettings(settings: CostSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(costSettingsStorageKey, JSON.stringify(settings));
}

function clampPositiveNumber(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function isSupportVertical(value: unknown): value is SupportVertical {
  return value === "ecommerce" || value === "agency" || value === "saas";
}

function isBrandTone(value: unknown): value is BrandTone {
  return value === "warm" || value === "direct" || value === "premium";
}

function isReplyLanguageMode(value: unknown): value is ReplyLanguageMode {
  return value === "customer" || value === "interface";
}

function isOwnerRole(value: unknown): value is OwnerRole {
  return value === "agent" || value === "lead" || value === "sales" || value === "ops";
}

function isPriorityKey(value: unknown): value is PriorityKey {
  return value === "low" || value === "normal" || value === "high" || value === "urgent";
}

function isSlaKey(value: unknown): value is SlaKey {
  return (
    value === "twoHours" ||
    value === "fourHours" ||
    value === "sameDay" ||
    value === "nextBusinessDay"
  );
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
