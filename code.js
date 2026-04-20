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

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

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

// ==========================
// CREATE / GET WRAPPER
// ==========================
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

// ==========================
// MAIN
// ==========================
figma.ui.onmessage = async (msg) => {
  if (msg.type === "resize") {
    figma.ui.resize(360, msg.height);
    return;
  }

  if (msg.type === "select-frame") {
    const node = figma.currentPage.selection[0];
    if (!node || node.type !== "FRAME") {
      figma.notify("Please select a Frame");
      figma.ui.postMessage({
        type: "select-frame-result",
        selected: false
      });
      return;
    }
    referenceFrame = node;
    figma.notify("Reference frame selected");
    figma.ui.postMessage({
      type: "select-frame-result",
      selected: true
    });
  }

  if (msg.type === "logs-get") {
    try {
      const logs = await figma.clientStorage.getAsync(LOG_KEY);
      figma.ui.postMessage({
        type: "logs-get-result",
        reqId: msg.reqId,
        logs: Array.isArray(logs) ? logs : []
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "logs-get-result",
        reqId: msg.reqId,
        logs: [],
        error: err.message || "Failed to read logs"
      });
    }
    return;
  }

  if (msg.type === "logs-save") {
    try {
      const entry = msg.entry;
      if (!entry || typeof entry !== "object") {
        figma.ui.postMessage({
          type: "logs-save-result",
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
        type: "logs-save-result",
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "logs-save-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save log"
      });
    }
    return;
  }

  if (msg.type === "api-key-get") {
    try {
      const apiKey = await figma.clientStorage.getAsync(OPENAI_API_KEY_KEY);
      figma.ui.postMessage({
        type: "api-key-get-result",
        reqId: msg.reqId,
        apiKey: typeof apiKey === "string" ? apiKey : ""
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "api-key-get-result",
        reqId: msg.reqId,
        apiKey: "",
        error: err.message || "Failed to read API key"
      });
    }
    return;
  }

  if (msg.type === "api-key-set") {
    try {
      const apiKey = typeof msg.apiKey === "string" ? msg.apiKey.trim() : "";
      await figma.clientStorage.setAsync(OPENAI_API_KEY_KEY, apiKey);
      figma.ui.postMessage({
        type: "api-key-set-result",
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "api-key-set-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save API key"
      });
    }
    return;
  }

  if (msg.type === "generate-type-get") {
    try {
      const enabled = await figma.clientStorage.getAsync(GENERATE_TYPE_KEY);
      figma.ui.postMessage({
        type: "generate-type-get-result",
        reqId: msg.reqId,
        enabled: enabled === undefined ? true : Boolean(enabled)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "generate-type-get-result",
        reqId: msg.reqId,
        enabled: true,
        error: err.message || "Failed to read generate type setting"
      });
    }
    return;
  }

  if (msg.type === "generate-type-set") {
    try {
      const enabled = Boolean(msg.enabled);
      await figma.clientStorage.setAsync(GENERATE_TYPE_KEY, enabled);
      figma.ui.postMessage({
        type: "generate-type-set-result",
        reqId: msg.reqId,
        ok: true,
        enabled
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "generate-type-set-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save generate type setting"
      });
    }
    return;
  }

  if (msg.type === "connector-config-get") {
    try {
      const sheetUrl = await figma.clientStorage.getAsync(SHEET_LINK_KEY);
      const connected = await figma.clientStorage.getAsync(CONNECTOR_CONFIRMED_KEY);
      figma.ui.postMessage({
        type: "connector-config-get-result",
        reqId: msg.reqId,
        sheetUrl: typeof sheetUrl === "string" ? sheetUrl : "",
        connected: Boolean(connected)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "connector-config-get-result",
        reqId: msg.reqId,
        sheetUrl: "",
        connected: false,
        error: err.message || "Failed to read connector config"
      });
    }
    return;
  }

  if (msg.type === "connector-config-set") {
    try {
      const sheetUrl = typeof msg.sheetUrl === "string" ? msg.sheetUrl.trim() : "";
      if (!sheetUrl || !isValidGoogleSheetUrl(sheetUrl)) {
        figma.ui.postMessage({
          type: "connector-config-set-result",
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
        type: "connector-config-set-result",
        reqId: msg.reqId,
        ok: true,
        sheetUrl
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "connector-config-set-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to connect Google Sheet"
      });
    }
    return;
  }

  if (msg.type === "connector-sync-get") {
    try {
      const enabled = await figma.clientStorage.getAsync(LOG_SYNC_ENABLED_KEY);
      figma.ui.postMessage({
        type: "connector-sync-get-result",
        reqId: msg.reqId,
        enabled: Boolean(enabled)
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "connector-sync-get-result",
        reqId: msg.reqId,
        enabled: false,
        error: err.message || "Failed to read connector sync setting"
      });
    }
    return;
  }

  if (msg.type === "connector-sync-set") {
    try {
      const enabled = Boolean(msg.enabled);
      await figma.clientStorage.setAsync(LOG_SYNC_ENABLED_KEY, enabled);
      if (!enabled) {
        await figma.clientStorage.setAsync(CONNECTOR_CONFIRMED_KEY, false);
      }
      figma.ui.postMessage({
        type: "connector-sync-set-result",
        reqId: msg.reqId,
        ok: true,
        enabled
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "connector-sync-set-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to save connector sync setting"
      });
    }
    return;
  }

  if (msg.type === "connector-log-send") {
    try {
      const entry = msg.entry;
      if (!entry || typeof entry !== "object") {
        figma.ui.postMessage({
          type: "connector-log-send-result",
          reqId: msg.reqId,
          ok: false,
          error: "Invalid log entry"
        });
        return;
      }

      const sheetUrl = await figma.clientStorage.getAsync(SHEET_LINK_KEY);
      if (!sheetUrl || typeof sheetUrl !== "string") {
        figma.ui.postMessage({
          type: "connector-log-send-result",
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
        type: "connector-log-send-result",
        reqId: msg.reqId,
        ok: true
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "connector-log-send-result",
        reqId: msg.reqId,
        ok: false,
        error: err.message || "Failed to send log via connector"
      });
    }
    return;
  }

  if (msg.type === "generate") {
    try {
      if (!referenceFrame) {
        figma.notify("No reference frame selected");
        return;
      }

      // Check reference frame still exists
      if (!referenceFrame.parent) {
        figma.notify("Reference frame was deleted");
        referenceFrame = null;
        figma.ui.postMessage({
          type: "select-frame-result",
          selected: false
        });
        return;
      }

      const wrapper = getOrCreateWrapper();

      const clean = msg.json
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let fields;
      try {
        fields = JSON.parse(clean);
      } catch (parseErr) {
        figma.notify(`Invalid JSON: ${parseErr.message}`);
        console.error("[Generate] JSON parse error:", parseErr.message);
        return;
      }

      // Validate schema
      if (!Array.isArray(fields)) {
        figma.notify("Response must be an array of fields");
        console.error("[Generate] Response is not an array");
        return;
      }

      if (fields.length === 0) {
        figma.notify("No fields extracted from image");
        console.warn("[Generate] Empty fields array");
        return;
      }

      // Validate each field has required props
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field.type || !field.label) {
          figma.notify(`Field ${i + 1} missing type or label`);
          console.error(`[Generate] Field ${i} invalid:`, field);
          return;
        }
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

      for (const field of fields) {
        const component = referenceFrame.findOne(
          (n) => n.type === "COMPONENT" && n.name === field.type
        );

        if (!component) continue;

        const needDetach =
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton";

        let instance = component.createInstance();

        if (needDetach) {
          instance = instance.detachInstance();
        }

        // ==========================
        // LABEL
        // ==========================
        await setText(instance, "{LabelName}", field.label);

        // ==========================
        // VALUE / PLACEHOLDER
        // ==========================
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

        // ==========================
        // NUMBER RANGE FIX
        // ==========================
        if (field.type === "Input_NumberRange" && !hasValue) {
          await setText(instance, "{Placeholder}", "ระบุจำนวน");
        }

        // ==========================
        // RADIO / CHECKBOX
        // ==========================
        if (
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton"
        ) {
          await buildChoices(instance, field);
        }

        // ==========================
        // ✅ INPUT UPLOAD (FIX FINAL)
        // ==========================
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

      wrapper.appendChild(newFrame);

      figma.notify("Generated ✅");
    } catch (err) {
      console.error("[Generate] Unexpected error:", err.message, err);
      figma.notify(`Error: ${err.message || "Unknown error"}`);
    }
  }
};

// ==========================
// VALUE VARIANT
// ==========================
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

// ==========================
// TEXT
// ==========================
async function loadFont(node) {
  if (node.fontName !== figma.mixed) {
    try {
      await figma.loadFontAsync(node.fontName);
    } catch (err) {
      console.warn(`[Font] Could not load ${node.fontName}: ${err.message}`);
      // Fallback to system font - text will still render
    }
  }
}

async function setText(instance, name, value) {
  const node = instance.findAll(
    (n) =>
      n.type === "TEXT" &&
      (
        n.name === name ||
        (n.characters && n.characters.trim() === name)
      )
  )[0];

  if (!node) return;

  await loadFont(node);
  node.characters = value || "";
}

// ==========================
// CHOICES
// ==========================
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