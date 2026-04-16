figma.showUI(__html__, { width: 360, height: 520 });

let referenceFrame = null;
let rootWrapper = null;

// ==========================
// CREATE / GET WRAPPER
// ==========================
function getOrCreateWrapper() {
  if (rootWrapper && rootWrapper.parent) return rootWrapper;

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

  frame.x = 0;
  frame.y = 0;

  figma.currentPage.appendChild(frame);

  rootWrapper = frame;
  return frame;
}

// ==========================
// MAIN MESSAGE HANDLER
// ==========================
figma.ui.onmessage = async (msg) => {
  if (msg.type === "select-frame") {
    const node = figma.currentPage.selection[0];
    if (!node || node.type !== "FRAME") {
      figma.notify("Please select a Frame");
      return;
    }
    referenceFrame = node;
    figma.notify("Reference frame selected");
  }

  if (msg.type === "generate") {
    try {
      if (!referenceFrame) {
        figma.notify("No reference frame selected");
        return;
      }

      const wrapper = getOrCreateWrapper();

      const clean = msg.json
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const fields = JSON.parse(clean);

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

        let instance = component.createInstance().detachInstance();

        // ===== DEFAULT =====
        await setText(instance, "{LabelName}", field.label);
        await setText(instance, "{Placeholder}", field.placeholder);

        // ===== NUMBER RANGE (minimal override) =====
        if (field.type === "Input_NumberRange") {
          await setText(instance, "{Placeholder}", "ระบุจำนวน");
        }

        // ===== CHECKBOX / RADIO =====
        if (
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton"
        ) {
          await buildChoices(instance, field);
        }

        newFrame.appendChild(instance);
      }

      wrapper.appendChild(newFrame);

      figma.notify("Generated ✅");
    } catch (err) {
      console.error(err);
      figma.notify("Error");
    }
  }
};

// ==========================
// TEXT HELPERS
// ==========================
async function loadFont(node) {
  if (node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
  }
}

async function setText(instance, name, value) {
  const node = instance.findOne(
    (n) => n.type === "TEXT" && n.name === name
  );
  if (!node) return;

  await loadFont(node);
  node.characters = value || "";
}

// ==========================
// CHOICES BUILDER
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