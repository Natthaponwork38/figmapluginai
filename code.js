figma.showUI(__html__, { width: 360, height: 100 });

let referenceFrame = null;
let rootWrapper = null;
const LOG_KEY = "AI_GEN_FORM_LOG";
const SHEET_LINK_KEY = "GOOGLE_SHEET_LINK";
const LOG_SYNC_ENABLED_KEY = "GOOGLE_SHEET_SYNC_ENABLED";
const CONNECTOR_CONFIRMED_KEY = "GOOGLE_SHEET_CONNECT_CONFIRMED";
const GENERATE_TYPE_KEY = "GENERATE_TYPE_PRODUCTION";
const OPENAI_API_KEY_KEY = "OPENAI_API_KEY";
const CONNECTOR_ENDPOINT = "https://mfmgdwbxztiprplkgpgc.supabase.co/functions/v1/google-sheet-connector";

function isValidHttpUrl(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^https?:\/\/[\w.-]+(?:\:[0-9]+)?(?:\/.*)?$/i.test(v);
}

function isValidGoogleSheetUrl(value) {
  if (!isValidHttpUrl(value)) return false;
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+\/.+/i.test(value.trim());
}

// ── Message Types (must match CONFIG.MESSAGE_TYPES in ui.html) ───────────────
const MESSAGE_TYPES = {
  // Incoming (from ui.html)
  RESIZE:                    "resize",
  SELECT_FRAME:              "select-frame",
  LOGS_GET:                  "logs-get",
  LOGS_SAVE:                 "logs-save",
  API_KEY_GET:               "api-key-get",
  API_KEY_SET:               "api-key-set",
  GENERATE_TYPE_GET:         "generate-type-get",
  GENERATE_TYPE_SET:         "generate-type-set",
  CONNECTOR_CONFIG_GET:      "connector-config-get",
  CONNECTOR_CONFIG_SET:      "connector-config-set",
  CONNECTOR_SYNC_GET:        "connector-sync-get",
  CONNECTOR_SYNC_SET:        "connector-sync-set",
  CONNECTOR_LOG_SEND:        "connector-log-send",
  GENERATE:                  "generate",

  // Outgoing (to ui.html)
  SELECT_FRAME_RESULT:           "select-frame-result",
  LOGS_GET_RESULT:               "logs-get-result",
  LOGS_SAVE_RESULT:              "logs-save-result",
  API_KEY_GET_RESULT:            "api-key-get-result",
  API_KEY_SET_RESULT:            "api-key-set-result",
  GENERATE_TYPE_GET_RESULT:      "generate-type-get-result",
  GENERATE_TYPE_SET_RESULT:      "generate-type-set-result",
  CONNECTOR_CONFIG_GET_RESULT:   "connector-config-get-result",
  CONNECTOR_CONFIG_SET_RESULT:   "connector-config-set-result",
  CONNECTOR_SYNC_GET_RESULT:     "connector-sync-get-result",
  CONNECTOR_SYNC_SET_RESULT:     "connector-sync-set-result",
  CONNECTOR_LOG_SEND_RESULT:     "connector-log-send-result",
};

async function postToConnector(payload) {
  if (!CONNECTOR_ENDPOINT) {
    throw new Error("Connector endpoint is not configured");
  }

  const res = await fetch(CONNECTOR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Connector request failed: HTTP ${res.status}`);
  }
}

// ── Create / Get Wrapper ─────────────────────────────────────────────────────
function getOrCreateWrapper() {
  try {
    if (
      rootWrapper &&
      rootWrapper.type === "FRAME" &&
      rootWrapper.parent
    ) {
      return rootWrapper;
    }
  } catch (e) {
    rootWrapper = null;
  }

  const existing = figma.currentPage.findOne(
    (n) => n.type === "FRAME" && n.name === "AI Generated Forms"
  );

  if (existing) {
    rootWrapper = existing;
    return rootWrapper;
  }

  const frame = figma.createFrame();
  frame.name = "AI Generated Forms";

  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.itemSpacing = 100;
  frame.paddingTop = 40;
  frame.paddingBottom = 40;
  frame.paddingLeft = 40;
  frame.paddingRight = 40;

  figma.currentPage.appendChild(frame);

  rootWrapper = frame;
  return frame;
}

// ── Main Message Handler ──────────────────────────────────────────────────────
figma.ui.onmessage = async (msg) => {
  // ── Resize UI ──
  if (msg.type === MESSAGE_TYPES.RESIZE) {
    figma.ui.resize(360, msg.height);
    return;
  }

  // ── Select Reference Frame ──
  if (msg.type === MESSAGE_TYPES.SELECT_FRAME) {
    const node = figma.currentPage.selection[0];
    if (!node || node.type !== "FRAME") {
      figma.notify("Please select a Frame");
      figma.ui.postMessage({
        type: MESSAGE_TYPES.SELECT_FRAME_RESULT,
        selected: false
      });
      return;
    }
    referenceFrame = node;
    figma.notify("Reference frame selected");
    figma.ui.postMessage({
      type: MESSAGE_TYPES.SELECT_FRAME_RESULT,
      selected: true
    });
  }

  // ── Get Stored Logs ──
  if (msg.type === MESSAGE_TYPES.LOGS_GET) {
    try {
      const logs = await figma.clientStorage.getAsync(LOG_KEY);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.LOGS_GET_RESULT,
        reqId: msg.reqId,
        logs: Array.isArray(logs) ? logs : []
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.LOGS_GET_RESULT,
        reqId: msg.reqId,
        logs: [],
        error: err.message || "Failed to read logs"
      });
    }
    return;
  }

  // ── Save Log Entry ──
  if (msg.type === MESSAGE_TYPES.LOGS_SAVE) {
    try {
      const entry = msg.entry;
      if (!entry || typeof entry !== "object") {
        figma.ui.postMessage({
          type: MESSAGE_TYPES.LOGS_SAVE_RESULT,
          reqId: msg.reqId,
          ok: false,
          error: "Invalid log entry"
        });
        return;
      }

      const current = await figma.clientStorage.getAsync(LOG_KEY);
      const logs = Array.isArray(current) ? current : [];
      logs.push(entry);
      await figma.clientStorage.setAsync(LOG_KEY, logs);

      figma.ui.postMessage({
        type: MESSAGE_TYPES.LOGS_SAVE_RESULT,
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.LOGS_SAVE_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save log"
      });
    }
    return;
  }

  // ── Get API Key ──
  if (msg.type === MESSAGE_TYPES.API_KEY_GET) {
    try {
      const apiKey = await figma.clientStorage.getAsync(OPENAI_API_KEY_KEY);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.API_KEY_GET_RESULT,
        reqId: msg.reqId,
        apiKey: typeof apiKey === "string" ? apiKey : ""
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.API_KEY_GET_RESULT,
        reqId: msg.reqId,
        apiKey: "",
        error: err.message || "Failed to read API key"
      });
    }
    return;
  }

  // ── Save API Key ──
  if (msg.type === MESSAGE_TYPES.API_KEY_SET) {
    try {
      const apiKey = typeof msg.apiKey === "string" ? msg.apiKey.trim() : "";
      await figma.clientStorage.setAsync(OPENAI_API_KEY_KEY, apiKey);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.API_KEY_SET_RESULT,
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.API_KEY_SET_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save API key"
      });
    }
    return;
  }

  // ── Get Generate Type ──
  if (msg.type === MESSAGE_TYPES.GENERATE_TYPE_GET) {
    try {
      const enabled = await figma.clientStorage.getAsync(GENERATE_TYPE_KEY);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.GENERATE_TYPE_GET_RESULT,
        reqId: msg.reqId,
        enabled: enabled === undefined ? true : Boolean(enabled)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.GENERATE_TYPE_GET_RESULT,
        reqId: msg.reqId,
        enabled: true,
        error: err.message || "Failed to read generate type setting"
      });
    }
    return;
  }

  // ── Save Generate Type ──
  if (msg.type === MESSAGE_TYPES.GENERATE_TYPE_SET) {
    try {
      const enabled = Boolean(msg.enabled);
      await figma.clientStorage.setAsync(GENERATE_TYPE_KEY, enabled);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.GENERATE_TYPE_SET_RESULT,
        reqId: msg.reqId,
        ok: true,
        enabled
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.GENERATE_TYPE_SET_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save generate type setting"
      });
    }
    return;
  }

  // ── Get Connector Config ──
  if (msg.type === MESSAGE_TYPES.CONNECTOR_CONFIG_GET) {
    try {
      const sheetUrl = await figma.clientStorage.getAsync(SHEET_LINK_KEY);
      const connected = await figma.clientStorage.getAsync(CONNECTOR_CONFIRMED_KEY);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_CONFIG_GET_RESULT,
        reqId: msg.reqId,
        sheetUrl: typeof sheetUrl === "string" ? sheetUrl : "",
        connected: Boolean(connected)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_CONFIG_GET_RESULT,
        reqId: msg.reqId,
        sheetUrl: "",
        connected: false,
        error: err.message || "Failed to read connector config"
      });
    }
    return;
  }

  // ── Save Connector Config ──
  if (msg.type === MESSAGE_TYPES.CONNECTOR_CONFIG_SET) {
    try {
      const sheetUrl = typeof msg.sheetUrl === "string" ? msg.sheetUrl.trim() : "";
      if (!sheetUrl || !isValidGoogleSheetUrl(sheetUrl)) {
        figma.ui.postMessage({
          type: MESSAGE_TYPES.CONNECTOR_CONFIG_SET_RESULT,
          reqId: msg.reqId,
          ok: false,
          error: "Invalid Google Sheet link"
        });
        return;
      }

      await postToConnector({
        type: "connect-check",
        sheetUrl,
        source: "ai-gen-form-plugin",
        timestamp: new Date().toISOString()
      });
      await figma.clientStorage.setAsync(SHEET_LINK_KEY, sheetUrl);
      await figma.clientStorage.setAsync(CONNECTOR_CONFIRMED_KEY, true);

      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_CONFIG_SET_RESULT,
        reqId: msg.reqId,
        ok: true,
        sheetUrl
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_CONFIG_SET_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to connect Google Sheet"
      });
    }
    return;
  }

  // ── Get Sync Toggle ──
  if (msg.type === MESSAGE_TYPES.CONNECTOR_SYNC_GET) {
    try {
      const enabled = await figma.clientStorage.getAsync(LOG_SYNC_ENABLED_KEY);
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_SYNC_GET_RESULT,
        reqId: msg.reqId,
        enabled: Boolean(enabled)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_SYNC_GET_RESULT,
        reqId: msg.reqId,
        enabled: false,
        error: err.message || "Failed to read connector sync setting"
      });
    }
    return;
  }

  // ── Save Sync Toggle ──
  if (msg.type === MESSAGE_TYPES.CONNECTOR_SYNC_SET) {
    try {
      const enabled = Boolean(msg.enabled);
      await figma.clientStorage.setAsync(LOG_SYNC_ENABLED_KEY, enabled);
      if (!enabled) {
        await figma.clientStorage.setAsync(CONNECTOR_CONFIRMED_KEY, false);
      }
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_SYNC_SET_RESULT,
        reqId: msg.reqId,
        ok: true,
        enabled
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_SYNC_SET_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save connector sync setting"
      });
    }
    return;
  }

  // ── Send Connector Log ──
  if (msg.type === MESSAGE_TYPES.CONNECTOR_LOG_SEND) {
    try {
      const entry = msg.entry;
      if (!entry || typeof entry !== "object") {
        figma.ui.postMessage({
          type: MESSAGE_TYPES.CONNECTOR_LOG_SEND_RESULT,
          reqId: msg.reqId,
          ok: false,
          error: "Invalid log entry"
        });
        return;
      }

      const sheetUrl = await figma.clientStorage.getAsync(SHEET_LINK_KEY);
      if (!sheetUrl || typeof sheetUrl !== "string") {
        figma.ui.postMessage({
          type: MESSAGE_TYPES.CONNECTOR_LOG_SEND_RESULT,
          reqId: msg.reqId,
          ok: false,
          error: "Google Sheet is not configured"
        });
        return;
      }

      await postToConnector({
        type: "log",
        sheetUrl,
        source: "ai-gen-form-plugin",
        entry
      });

      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_LOG_SEND_RESULT,
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: MESSAGE_TYPES.CONNECTOR_LOG_SEND_RESULT,
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to send log via connector"
      });
    }
    return;
  }

  // ── Generate Form From JSON ──
  if (msg.type === MESSAGE_TYPES.GENERATE) {
    try {
      if (!referenceFrame) {
        figma.notify("No reference frame selected");
        return;
      }

      // Validate selected reference frame still exists
      if (!referenceFrame.parent) {
        figma.notify("Reference frame was deleted");
        referenceFrame = null;
        figma.ui.postMessage({
          type: MESSAGE_TYPES.SELECT_FRAME_RESULT,
          selected: false
        });
        return;
      }

      const wrapper = getOrCreateWrapper();

      const clean = msg.json
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let items;
      try {
        items = JSON.parse(clean);
      } catch (parseErr) {
        figma.notify(`Invalid JSON: ${parseErr.message}`);
        console.error("[Generate] JSON parse error:", parseErr.message);
        return;
      }

      // Validate response schema shape
      if (!Array.isArray(items)) {
        figma.notify("Response must be an array of elements");
        console.error("[Generate] Response is not an array");
        return;
      }

      if (items.length === 0) {
        figma.notify("No elements extracted from image");
        console.warn("[Generate] Empty elements array");
        return;
      }

      const normalizedItems = [];

      // Validate and normalize extracted elements
      for (let i = 0; i < items.length; i++) {
        const parsed = normalizeExtractedItem(items[i], i);
        if (!parsed.ok) {
          figma.notify(parsed.error);
          console.error(`[Generate] Element ${i} invalid:`, items[i]);
          return;
        }
        normalizedItems.push(parsed.item);
      }

      const newFrame = figma.createFrame();
      newFrame.name = msg.filename || "Generated Form";

      newFrame.layoutMode = "VERTICAL";
      newFrame.primaryAxisSizingMode = "AUTO";
      newFrame.counterAxisSizingMode = "AUTO";
      newFrame.itemSpacing = 16;
      newFrame.paddingTop = 16;
      newFrame.paddingBottom = 16;
      newFrame.paddingLeft = 16;
      newFrame.paddingRight = 16;

      const missingComponents = new Set();

      for (const item of normalizedItems) {
        const component = referenceFrame.findOne(
          (n) => n.type === "COMPONENT" && n.name === item.type
        );

        if (!component) {
          missingComponents.add(item.type);
          continue;
        }

        if (item.kind === "button") {
          const buttonInstance = component.createInstance();
          await setTextByAliases(buttonInstance, ["{Button}", "Button"], item.label);
          newFrame.appendChild(buttonInstance);
          continue;
        }

        const field = item;

        const needDetach =
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton";

        let instance = component.createInstance();

        if (needDetach) {
          instance = instance.detachInstance();
        }

        // ── Label ──
        await setText(instance, "{LabelName}", field.label);

        // ── Value / Placeholder ──
        const hasValue =
          field.value !== undefined &&
          field.value !== null &&
          field.value !== "";

        const displayText = hasValue
          ? field.value
          : field.placeholder;

        await setText(instance, "{Placeholder}", displayText);

        if (!needDetach) {
          applyValueVariant(instance, hasValue);
        }

        // ── Number Range Placeholder Fix ──
        if (field.type === "Input_NumberRange" && !hasValue) {
          await setText(instance, "{Placeholder}", "ระบุจำนวน");
        }

        // ── Radio / Checkbox Choices ──
        if (
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton"
        ) {
          await buildChoices(instance, field);
        }

        // ── Upload Condition / Description Variant ──
        if (field.type === "Input_Upload") {
          try {
            const target = instance.findOne(
              (n) =>
                n.type === "INSTANCE" &&
                (n.name === "Textfield" || n.name === "Textarea")
            );

            if (target && target.componentProperties) {
              const key = Object.keys(target.componentProperties).find((k) =>
                k.toLowerCase().includes("description")
              );

              if (key) {
                target.setProperties({
                  [key]:
                    typeof target.componentProperties[key].value === "string"
                      ? "True"
                      : true
                });
              }
            }
          } catch (e) {}

          await setText(instance, "{Condition}", field.condition || "");
        }

        newFrame.appendChild(instance);
      }

      if (newFrame.children.length === 0) {
        newFrame.remove();
        figma.notify("No matching components found in reference frame");
        return;
      }

      if (missingComponents.size > 0) {
        figma.notify(`Missing components: ${Array.from(missingComponents).join(", ")}`);
      }

      wrapper.appendChild(newFrame);

      figma.notify("Generated ✅");
    } catch (err) {
      console.error("[Generate] Unexpected error:", err.message, err);
      figma.notify(`Error: ${err.message || "Unknown error"}`);
    }
  }
};

function normalizeExtractedItem(raw, index) {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: `Element ${index + 1} is invalid`
    };
  }

  const kindRaw = typeof raw.kind === "string" ? raw.kind.trim().toLowerCase() : "field";

  if (kindRaw === "button") {
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const type =
      typeof raw.type === "string" && raw.type.trim()
        ? raw.type.trim()
        : "ButtonAction";

    if (!label) {
      return {
        ok: false,
        error: `Button ${index + 1} missing label`
      };
    }

    return {
      ok: true,
      item: {
        kind: "button",
        type,
        label
      }
    };
  }

  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";

  if (!type || !label) {
    return {
      ok: false,
      error: `Field ${index + 1} missing type or label`
    };
  }

  return {
    ok: true,
    item: {
      kind: "field",
      type,
      label,
      placeholder: raw.placeholder,
      value: raw.value,
      condition: raw.condition,
      choices: Array.isArray(raw.choices) ? raw.choices : []
    }
  };
}

// ── Value Variant ─────────────────────────────────────────────────────────────
function applyValueVariant(instance, hasValue) {
  try {
    const target = instance.findOne(
      (n) =>
        n.type === "INSTANCE" &&
        (n.name === "Textfield" || n.name === "Textarea")
    );

    if (!target) return;

    const props = target.componentProperties;
    if (!props) return;

    const valueKey = Object.keys(props).find((key) =>
      key.toLowerCase().includes("value")
    );

    if (!valueKey) return;

    const prop = props[valueKey];

    if (typeof prop.value === "string") {
      target.setProperties({
        [valueKey]: hasValue ? "True" : "False"
      });
    } else {
      target.setProperties({
        [valueKey]: hasValue
      });
    }

  } catch (e) {}
}

// ── Text Helpers ──────────────────────────────────────────────────────────────
async function loadFont(node) {
  if (node.fontName !== figma.mixed) {
    try {
      await figma.loadFontAsync(node.fontName);
    } catch (err) {
      console.warn(`[Font] Could not load ${node.fontName}: ${err.message}`);
      // Fallback to system font if loading fails
    }
  }
}

async function setText(instance, name, value) {
  return setTextByAliases(instance, [name], value);
}

async function setTextByAliases(instance, aliases, value) {
  if (!Array.isArray(aliases) || aliases.length === 0) return false;

  const node = instance.findAll(
    (n) =>
      n.type === "TEXT" &&
      (
        aliases.includes(n.name) ||
        (n.characters && aliases.includes(n.characters.trim()))
      )
  )[0];

  if (!node) return false;

  await loadFont(node);
  node.characters =
    typeof value === "string"
      ? value
      : value === undefined || value === null
        ? ""
        : String(value);

  return true;
}

// ── Choice Helpers ────────────────────────────────────────────────────────────
function normalizeChoices(choices) {
  if (!choices) return [];
  return choices
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean);
}

async function buildChoices(instance, field) {
  const choices = normalizeChoices(field.choices);
  if (!choices.length) return;

  const group = instance.findOne((n) => n.name === "Group");
  if (!group) return;

  const template = group.findOne(
    (n) => n.type === "INSTANCE" || n.type === "FRAME"
  );
  if (!template) return;

  const base = template.clone();

  for (const child of [...group.children]) child.remove();

  for (const choice of choices) {
    let item = base.clone();

    if (item.type === "INSTANCE") {
      item = item.detachInstance();
    }

    const text = item.findOne((n) => n.type === "TEXT");

    if (text) {
      await loadFont(text);
      text.characters = choice;
    }

    group.appendChild(item);
  }
}