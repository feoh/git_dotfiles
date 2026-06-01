/**
 * Trello Extension for Pi
 *
 * Provides tools to interact with Trello boards:
 *   - trello_list_lists: List all lists on a board
 *   - trello_list_cards: List cards (optionally filtered by list)
 *   - trello_get_card: Get full card details
 *   - trello_create_card: Create a new card
 *   - trello_update_card: Update card name, description, or due date
 *   - trello_move_card: Move a card to a different list (and optionally reposition)
 *   - trello_archive_card: Archive (close) a card
 *
 * Required env vars:
 *   TRELLO_API_KEY  – your Trello API key  (https://trello.com/power-ups/admin)
 *   TRELLO_TOKEN    – your Trello API token
 *
 * Default board: YgbriLHZ (Board Numero Uno)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const DEFAULT_BOARD_ID = "YgbriLHZ";
const BASE_URL = "https://api.trello.com/1";

function getCredentials(): { key: string; token: string } {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error(
      "Missing TRELLO_API_KEY and/or TRELLO_TOKEN environment variables. " +
        "Get them at https://trello.com/power-ups/admin and " +
        "https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_KEY"
    );
  }
  return { key, token };
}

async function trelloFetch(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const { key, token } = getCredentials();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}key=${key}&token=${token}`;

  const options: RequestInit = { method, signal };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  due: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
  pos: number;
  closed: boolean;
  shortUrl: string;
}

function formatCard(c: TrelloCard, listName?: string): string {
  const parts = [`• **${c.name}**`];
  if (listName) parts.push(`  List: ${listName}`);
  if (c.desc) parts.push(`  Desc: ${c.desc.slice(0, 120)}${c.desc.length > 120 ? "…" : ""}`);
  if (c.due) parts.push(`  Due: ${c.due}`);
  if (c.labels.length) parts.push(`  Labels: ${c.labels.map((l) => l.name || l.color).join(", ")}`);
  parts.push(`  ID: ${c.id}`);
  parts.push(`  URL: ${c.shortUrl}`);
  return parts.join("\n");
}

// ── Extension ────────────────────────────────────────────────────────

export default function trelloExtension(pi: ExtensionAPI) {
  // ── trello_list_lists ──────────────────────────────────────────────

  pi.registerTool({
    name: "trello_list_lists",
    label: "Trello: List Lists",
    description:
      "List all open lists on a Trello board. Returns list IDs and names. " +
      "Defaults to Board Numero Uno if no boardId is given.",
    promptSnippet: "List the lists (columns) on a Trello board",
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({ description: "Board short ID (default: YgbriLHZ)" })
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const board = params.boardId || DEFAULT_BOARD_ID;
      const lists = (await trelloFetch(
        `/boards/${board}/lists?filter=open`,
        "GET",
        undefined,
        signal
      )) as TrelloList[];

      const text = lists
        .map((l) => `• ${l.name}  (id: ${l.id})`)
        .join("\n");

      return {
        content: [{ type: "text", text: text || "No lists found." }],
        details: { lists },
      };
    },
  });

  // ── trello_list_cards ──────────────────────────────────────────────

  pi.registerTool({
    name: "trello_list_cards",
    label: "Trello: List Cards",
    description:
      "List cards on a Trello board, optionally filtered to a specific list. " +
      "Returns card names, IDs, and brief details.",
    promptSnippet: "List cards on a Trello board, optionally filtered by list",
    parameters: Type.Object({
      boardId: Type.Optional(
        Type.String({ description: "Board short ID (default: YgbriLHZ)" })
      ),
      listId: Type.Optional(
        Type.String({ description: "Filter to cards in this list ID" })
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const board = params.boardId || DEFAULT_BOARD_ID;

      // Fetch lists for name mapping
      const lists = (await trelloFetch(
        `/boards/${board}/lists?filter=open`,
        "GET",
        undefined,
        signal
      )) as TrelloList[];
      const listMap = new Map(lists.map((l) => [l.id, l.name]));

      let cards: TrelloCard[];
      if (params.listId) {
        cards = (await trelloFetch(
          `/lists/${params.listId}/cards?filter=open`,
          "GET",
          undefined,
          signal
        )) as TrelloCard[];
      } else {
        cards = (await trelloFetch(
          `/boards/${board}/cards?filter=open`,
          "GET",
          undefined,
          signal
        )) as TrelloCard[];
      }

      const text = cards.length
        ? cards.map((c) => formatCard(c, listMap.get(c.idList))).join("\n\n")
        : "No cards found.";

      return {
        content: [{ type: "text", text }],
        details: { count: cards.length },
      };
    },
  });

  // ── trello_get_card ────────────────────────────────────────────────

  pi.registerTool({
    name: "trello_get_card",
    label: "Trello: Get Card",
    description: "Get full details for a single Trello card by ID.",
    promptSnippet: "Get full details for a Trello card",
    parameters: Type.Object({
      cardId: Type.String({ description: "Card ID" }),
    }),
    async execute(_toolCallId, params, signal) {
      const card = (await trelloFetch(
        `/cards/${params.cardId}?fields=name,desc,idList,due,labels,pos,closed,shortUrl`,
        "GET",
        undefined,
        signal
      )) as TrelloCard;

      return {
        content: [{ type: "text", text: formatCard(card) }],
        details: { card },
      };
    },
  });

  // ── trello_create_card ─────────────────────────────────────────────

  pi.registerTool({
    name: "trello_create_card",
    label: "Trello: Create Card",
    description:
      "Create a new card on a Trello board. You must specify the list ID " +
      "(use trello_list_lists first to find it).",
    promptSnippet: "Create a new card on a Trello board",
    promptGuidelines: [
      "Before calling trello_create_card, call trello_list_lists to find the correct listId.",
    ],
    parameters: Type.Object({
      listId: Type.String({ description: "ID of the list to create the card in" }),
      name: Type.String({ description: "Card title" }),
      desc: Type.Optional(Type.String({ description: "Card description (Markdown)" })),
      due: Type.Optional(
        Type.String({ description: "Due date in ISO 8601 format, e.g. 2025-06-01T12:00:00Z" })
      ),
      pos: Type.Optional(
        Type.String({ description: "'top', 'bottom', or a positive number" })
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const body: Record<string, unknown> = {
        idList: params.listId,
        name: params.name,
      };
      if (params.desc) body.desc = params.desc;
      if (params.due) body.due = params.due;
      if (params.pos) body.pos = params.pos;

      const card = (await trelloFetch("/cards", "POST", body, signal)) as TrelloCard;

      return {
        content: [
          {
            type: "text",
            text: `Created card **${card.name}**\nID: ${card.id}\nURL: ${card.shortUrl}`,
          },
        ],
        details: { card },
      };
    },
  });

  // ── trello_update_card ─────────────────────────────────────────────

  pi.registerTool({
    name: "trello_update_card",
    label: "Trello: Update Card",
    description:
      "Update an existing Trello card's name, description, or due date.",
    promptSnippet: "Update a Trello card's name, description, or due date",
    parameters: Type.Object({
      cardId: Type.String({ description: "Card ID to update" }),
      name: Type.Optional(Type.String({ description: "New card title" })),
      desc: Type.Optional(Type.String({ description: "New card description (Markdown)" })),
      due: Type.Optional(
        Type.String({
          description: "New due date (ISO 8601) or empty string to clear",
        })
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const body: Record<string, unknown> = {};
      if (params.name !== undefined) body.name = params.name;
      if (params.desc !== undefined) body.desc = params.desc;
      if (params.due !== undefined) body.due = params.due || null;

      if (Object.keys(body).length === 0) {
        return {
          content: [{ type: "text", text: "Nothing to update — provide at least one field." }],
          details: {},
        };
      }

      const card = (await trelloFetch(
        `/cards/${params.cardId}`,
        "PUT",
        body,
        signal
      )) as TrelloCard;

      return {
        content: [
          {
            type: "text",
            text: `Updated card **${card.name}**\nID: ${card.id}\nURL: ${card.shortUrl}`,
          },
        ],
        details: { card },
      };
    },
  });

  // ── trello_move_card ───────────────────────────────────────────────

  pi.registerTool({
    name: "trello_move_card",
    label: "Trello: Move Card",
    description:
      "Move a Trello card to a different list and/or reposition it. " +
      "Use trello_list_lists to find the target list ID.",
    promptSnippet: "Move a Trello card to a different list or position",
    promptGuidelines: [
      "Before calling trello_move_card, call trello_list_lists to find the target listId.",
    ],
    parameters: Type.Object({
      cardId: Type.String({ description: "Card ID to move" }),
      listId: Type.String({ description: "Destination list ID" }),
      pos: Type.Optional(
        Type.String({ description: "'top', 'bottom', or a positive number" })
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const body: Record<string, unknown> = { idList: params.listId };
      if (params.pos) body.pos = params.pos;

      const card = (await trelloFetch(
        `/cards/${params.cardId}`,
        "PUT",
        body,
        signal
      )) as TrelloCard;

      return {
        content: [
          {
            type: "text",
            text: `Moved card **${card.name}** → list ${params.listId}\nURL: ${card.shortUrl}`,
          },
        ],
        details: { card },
      };
    },
  });

  // ── trello_archive_card ────────────────────────────────────────────

  pi.registerTool({
    name: "trello_archive_card",
    label: "Trello: Archive Card",
    description: "Archive (close) a Trello card.",
    promptSnippet: "Archive a Trello card",
    parameters: Type.Object({
      cardId: Type.String({ description: "Card ID to archive" }),
    }),
    async execute(_toolCallId, params, signal) {
      const card = (await trelloFetch(
        `/cards/${params.cardId}`,
        "PUT",
        { closed: true },
        signal
      )) as TrelloCard;

      return {
        content: [
          {
            type: "text",
            text: `Archived card **${card.name}**\nID: ${card.id}`,
          },
        ],
        details: { card },
      };
    },
  });

  // ── Startup notification ───────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    const hasKey = !!process.env.TRELLO_API_KEY;
    const hasToken = !!process.env.TRELLO_TOKEN;
    if (!hasKey || !hasToken) {
      ctx.ui.notify(
        "Trello extension loaded but credentials are missing. " +
          "Set TRELLO_API_KEY and TRELLO_TOKEN env vars.",
        "warn"
      );
    }
  });
}
