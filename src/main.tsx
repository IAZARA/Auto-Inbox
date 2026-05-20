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
import "./styles.css";

type MailStatus = "draft" | "ready" | "waiting" | "sent";
type MailFolder = "All" | "Unreplied" | "Flagged";

type MailItem = {
  id: number;
  sender: string;
  initials: string;
  email: string;
  subject: string;
  preview: string;
  body: string[];
  intent: string;
  confidence: number;
  time: string;
  status: MailStatus;
  unread?: boolean;
  accent: string;
  source: string;
  answer: string;
  history: {
    conversations: number;
    lastContact: string;
    satisfaction: string;
  };
};

const mails: MailItem[] = [
  {
    id: 1,
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
    intent: "Shipping Issue",
    confidence: 92,
    time: "10:24 AM",
    status: "ready",
    unread: true,
    accent: "teal",
    source: "Shipping_FAQ",
    answer:
      "Hi Alex,\n\nThanks for reaching out. I'm sorry to hear about the delay.\n\nI've checked your order #12345 and see that it's currently in transit. Tracking updates can take up to 48 hours to appear.\n\nYou can track your package here: [tracking link]\n\nIf you don't see any updates by tomorrow, just let me know and I'll gladly look into this further.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 3,
      lastContact: "2 days ago",
      satisfaction: "Positive",
    },
  },
  {
    id: 2,
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
    intent: "Return Request",
    confidence: 88,
    time: "9:15 AM",
    status: "draft",
    unread: true,
    accent: "blue",
    source: "Returns_FAQ",
    answer:
      "Hi Sarah,\n\nThanks for contacting us. We can help with the return.\n\nPlease send your order number and confirm whether the lamp is still in its original packaging. Once we have that, we will share the return label and next steps.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 1,
      lastContact: "Today",
      satisfaction: "New",
    },
  },
  {
    id: 3,
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
    intent: "Pricing",
    confidence: 94,
    time: "Yesterday",
    status: "ready",
    unread: true,
    accent: "blue",
    source: "Pricing_FAQ",
    answer:
      "Hi Michael,\n\nHappy to help. The starter plan is best for small teams that need the core inbox workflow, while the growth plan adds shared rules, advanced reporting, and higher usage limits.\n\nIf you share your team size and expected monthly volume, I can recommend the best fit.",
    history: {
      conversations: 2,
      lastContact: "Yesterday",
      satisfaction: "Positive",
    },
  },
  {
    id: 4,
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
    intent: "Billing",
    confidence: 90,
    time: "Yesterday",
    status: "draft",
    accent: "amber",
    source: "Billing_FAQ",
    answer:
      "Hi Priya,\n\nOf course. I can help resend the invoice. Please confirm the billing email or the last four digits of the payment method so we can locate the correct record.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 5,
      lastContact: "1 week ago",
      satisfaction: "Positive",
    },
  },
  {
    id: 5,
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
    intent: "Account Access",
    confidence: 86,
    time: "Yesterday",
    status: "ready",
    accent: "green",
    source: "Account_FAQ",
    answer:
      "Hi David,\n\nThanks for letting us know. Please try clearing your browser cache or using a private window first. If the issue continues, send us the email linked to your account and we will check the login status from our side.",
    history: {
      conversations: 2,
      lastContact: "3 days ago",
      satisfaction: "Neutral",
    },
  },
  {
    id: 6,
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
    intent: "Sales",
    confidence: 96,
    time: "Tuesday",
    status: "ready",
    accent: "rose",
    source: "Sales_FAQ",
    answer:
      "Hi Emma,\n\nThanks for reaching out. We do offer volume pricing for bulk orders. For 40 units, our team can prepare a custom quote with delivery estimates and any available discount tiers.\n\nWould you like us to send a quote to this email?",
    history: {
      conversations: 1,
      lastContact: "Tuesday",
      satisfaction: "New",
    },
  },
  {
    id: 7,
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
    intent: "Shipping",
    confidence: 91,
    time: "Tuesday",
    status: "sent",
    accent: "violet",
    source: "Shipping_FAQ",
    answer:
      "Hi James,\n\nYes, we ship to Canada. Shipping costs and delivery estimates are calculated during checkout based on destination and package size.\n\nBest regards,\nSupport Team",
    history: {
      conversations: 4,
      lastContact: "Tuesday",
      satisfaction: "Positive",
    },
  },
];

const knowledgeMatches = [
  {
    question: "Where is my order?",
    answer: "Orders typically ship within 1-2 business days.",
    source: "Shipping_FAQ",
  },
  {
    question: "How can I track my order?",
    answer: "Once your order ships, you will receive a tracking link.",
    source: "Shipping_FAQ",
  },
  {
    question: "What if my tracking is not updating?",
    answer: "Tracking updates may take up to 48 hours to appear.",
    source: "Shipping_FAQ",
  },
];

const statusLabel: Record<MailStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  waiting: "Ignored",
  sent: "Sent",
};

const folderCounts: Record<MailFolder, number> = {
  All: 12,
  Unreplied: 7,
  Flagged: 2,
};

const activityItems = [
  "Email received from Alex Johnson",
  "Intent identified: Shipping Issue (92%)",
  "FAQ matches found (3)",
  "AI reply generated",
  "Awaiting review",
];

function AutoInboxApp() {
  const [selectedId, setSelectedId] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [activeFolder, setActiveFolder] = React.useState<MailFolder>("All");
  const [queuePaused, setQueuePaused] = React.useState(false);
  const [sentIds, setSentIds] = React.useState<number[]>([7]);
  const [drafts, setDrafts] = React.useState<Record<number, string>>(
    Object.fromEntries(mails.map((mail) => [mail.id, mail.answer])),
  );

  const selected = mails.find((mail) => mail.id === selectedId) ?? mails[0];
  const draftText = drafts[selected.id] ?? "";
  const selectedSent = sentIds.includes(selected.id);

  const filtered = mails.filter((mail) => {
    const matchesQuery = `${mail.sender} ${mail.subject} ${mail.preview}`
      .toLowerCase()
      .includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (activeFolder === "Unreplied") return !sentIds.includes(mail.id);
    if (activeFolder === "Flagged") return mail.confidence < 90 || mail.status === "draft";
    return true;
  });

  const sendReply = () => {
    if (!draftText.trim() || selectedSent || queuePaused) return;
    setSentIds((current) => Array.from(new Set([...current, selected.id])));
  };

  return (
    <main className="app-frame">
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
          {queuePaused ? "Resume processing" : "Pause processing"}
        </button>

        <nav className="sidebar-section" aria-label="Mailbox">
          <NavItem icon={<Inbox size={17} />} label="Inbox" count={12} active />
          <NavItem icon={<FilePenLine size={17} />} label="Drafts" count={8} />
          <NavItem icon={<Send size={17} />} label="Sent" />
          <NavItem icon={<Mail size={17} />} label="All Mail" />
          <NavItem icon={<Shield size={17} />} label="Spam" />
          <NavItem icon={<Trash2 size={17} />} label="Trash" />
        </nav>

        <div className="sidebar-group">
          <p>Automation</p>
          <NavItem icon={<Settings size={17} />} label="Rules" />
          <NavItem icon={<PenLine size={17} />} label="Signatures" />
          <NavItem icon={<Settings size={17} />} label="Settings" />
        </div>

        <div className="sidebar-group integrations">
          <p>Integrations</p>
          <IntegrationRow icon={<AtSign size={16} />} label="Gmail" />
          <IntegrationRow icon={<Sparkles size={16} />} label="OpenAI" />
          <IntegrationRow icon={<Archive size={16} />} label="Google Sheets" />
        </div>

        <div className="mode-box">
          <p>Mode</p>
          <button>
            Draft-first (review required)
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <section className="inbox-column">
        <div className="search-row">
          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search emails..."
            />
          </label>
          <button className="square-button" title="Filter">
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
              {folder}
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
                  <span>{mail.time}</span>
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
          <button title="Back">
            <ArrowLeft size={19} />
          </button>
          <div>
            <button title="Archive">
              <Archive size={17} />
            </button>
            <button title="Info">
              <Info size={17} />
            </button>
            <button title="Snooze">
              <Clock3 size={17} />
            </button>
            <button title="Trash">
              <Trash2 size={17} />
            </button>
            <button title="Mark unread">
              <Mail size={17} />
            </button>
            <button title="Tag">
              <Tag size={17} />
            </button>
            <button title="More">
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
                {selected.email} to support@yourstore.com
              </span>
            </div>
            <time>{selected.time}</time>
            <button title="Reply">
              <Reply size={17} />
            </button>
            <button title="More">
              <MoreVertical size={17} />
            </button>
          </div>

          <div className="ai-chips">
            <span>
              Intent <strong>{selected.intent}</strong>
            </span>
            <span>
              Confidence <strong>{selected.confidence}%</strong>
            </span>
            <span className={`status-chip ${selectedSent ? "sent" : selected.status}`}>
              {selectedSent ? "Sent" : statusLabel[selected.status]}
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
            <h2>FAQ / Knowledge base matches</h2>
          </div>
          <div className="knowledge-table" role="table" aria-label="FAQ matches">
            <div className="knowledge-row header" role="row">
              <span>Question</span>
              <span>Answer</span>
              <span>Source</span>
            </div>
            {knowledgeMatches.map((match) => (
              <div className="knowledge-row" role="row" key={match.question}>
                <span>{match.question}</span>
                <span>{match.answer}</span>
                <span>
                  {match.source}
                  <Link size={13} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="customer-history">
          <h2>Customer history</h2>
          <div className="history-grid">
            <Metric label="Total conversations" value={String(selected.history.conversations)} />
            <Metric label="Last contact" value={selected.history.lastContact} />
            <Metric label="Satisfaction" value={selected.history.satisfaction} positive />
          </div>
        </section>
      </section>

      <aside className="assistant-column">
        <section className="reply-panel">
          <div className="reply-heading">
            <h2>
              <Bot size={18} />
              AI suggested reply
            </h2>
            <button>
              <PenLine size={15} />
              Draft
            </button>
          </div>

          <div className="format-toolbar" aria-label="Formatting toolbar">
            <button title="Undo">
              <Undo2 size={16} />
            </button>
            <button title="Regenerate">
              <RotateCcw size={16} />
            </button>
            <span />
            <button title="Bold">
              <Bold size={16} />
            </button>
            <button title="Italic">
              <Italic size={16} />
            </button>
            <button title="Bulleted list">
              <List size={16} />
            </button>
            <button title="Link">
              <Link size={16} />
            </button>
          </div>

          <textarea
            value={draftText}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, [selected.id]: event.target.value }))
            }
            aria-label="Generated reply"
          />

          <div className="send-actions">
            <button className="secondary-button">
              <RefreshCcw size={16} />
              Regenerate
              <ChevronDown size={15} />
            </button>
            <button
              className="send-button"
              onClick={sendReply}
              disabled={!draftText.trim() || selectedSent || queuePaused}
            >
              <Send size={18} />
              {selectedSent ? "Sent" : "Enviar"}
              <ChevronDown size={15} />
            </button>
          </div>

          <p className="draft-note">Draft-first mode - You review and send manually.</p>
        </section>

        <section className="automation-card">
          <div className="section-heading">
            <h2>Automation</h2>
            <span className={`running-pill ${queuePaused ? "paused" : ""}`}>
              {queuePaused ? "Paused" : "Running"}
            </span>
          </div>
          <div className="automation-grid">
            <Metric label="Next check in" value={queuePaused ? "--" : "2 min"} />
            <Metric label="Processed today" value="48" />
          </div>
        </section>

        <section className="activity-card">
          <div className="section-heading">
            <h2>Activity log</h2>
            <button>View all</button>
          </div>
          <div className="activity-list">
            {activityItems.map((item) => (
              <div key={item}>
                <time>10:24 AM</time>
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

function IntegrationRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="integration-row">
      <span>
        {icon}
        {label}
      </span>
      <strong>
        <Check size={12} />
        Connected
      </strong>
    </div>
  );
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AutoInboxApp />
  </React.StrictMode>,
);
