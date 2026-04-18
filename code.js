figma.showUI(__html__, { width: 360, height: 520 });

let referenceFrame = null;
let rootWrapper = null;

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

        const needDetach =
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton";

        let instance = component.createInstance();

        if (needDetach) {
          instance = instance.detachInstance();
        }

        // LABEL
        await setText(instance, "{LabelName}", field.label);

        // VALUE / PLACEHOLDER
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

        // NUMBER RANGE
        if (field.type === "Input_NumberRange" && !hasValue) {
          await setText(instance, "{Placeholder}", "ระบุจำนวน");
        }

        // RADIO / CHECKBOX
        if (
          field.type === "Input_Checkbox" ||
          field.type === "Input_RadioButton"
        ) {
          await buildChoices(instance, field);
        }

        // ================================
        // ✅ FIX INPUT_UPLOAD (REAL FINAL)
        // ================================
        if (field.type === "Input_Upload") {
          try {
            const textfield = instance.findOne(
              (n) =>
                n.type === "INSTANCE" &&
                (n.name === "Textfield" || n.name === "Textarea")
            );

            if (textfield) {
              const conditionNode = textfield.findOne(
                (n) =>
                  n.type === "TEXT" &&
                  n.name &&
                  n.name.includes("{Condition}")
              );

              if (conditionNode) {
                await loadFont(conditionNode);
                conditionNode.characters = "{Condition}";
              }
            }
          } catch (e) {
            console.warn("Upload condition fix failed", e);
          }
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

  } catch (e) {
    console.warn("Variant apply failed", e);
  }
}

// ==========================
// TEXT
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