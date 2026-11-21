"use strict";

const sheetEditor = (() => {
  // Keep CRLF in defaultValue even though HTML input controls normalize it.
  const storedText = value => esc(value).replace(/\r/g, "&#13;");

  function stepper(value, label, id, { min = 0, max = Number.MAX_SAFE_INTEGER, whole = false } = {}) {
    const button = (delta, key, symbol) => {
      const title = attr(t(key) + " · " + label);
      return `<button type="button" class="secondary" data-step="${delta}" title="${title}" aria-label="${title}">${symbol}</button>`;
    };
    return `<span class="sheet-stepper">${button(-1, "decrease", "−")}
      <input id="${attr(id)}" aria-label="${attr(label)}" type="number" min="${min}" max="${max}" step="${whole ? 1 : "any"}" required value="${attr(value)}">
      ${button(1, "increase", "+")}</span>`;
  }

  function entryMarkup(format, entry, index) {
    const record = format !== "formatLines";
    const source = record && index !== undefined ? ` data-source-index="${index}"` : "";
    const move = (action, key, symbol) => `<button type="button" class="secondary" data-entry-action="${action}" title="${attr(t(key))}" aria-label="${attr(t(key))}">${symbol}</button>`;
    return `<li class="sheet-entry"${source}>
      <div class="entry-tools"><span class="entry-number"></span>
        ${move("up", "moveUp", "↑")}${move("down", "moveDown", "↓")}${move("remove", "remove", "×")}
      </div>
      ${record ? `<div class="entry-heading"><label>${esc(t("name"))}<textarea rows="1" class="entry-name" data-part="name" required>
${storedText(entry?.name)}</textarea></label>
        ${format === "formatRules" ? `<label>${esc(t("level"))}<input type="number" data-part="level" min="1" max="${Number.MAX_SAFE_INTEGER}" step="1" required value="${attr(entry?.level ?? 1)}"></label>` : ""}</div>
        <label>${esc(t("description"))}<textarea rows="3" data-part="description" required>
${storedText(entry?.description)}</textarea></label>` : `<textarea rows="2" data-part="text" aria-label="${attr(t("entry"))}">
${storedText(entry)}</textarea>`}
    </li>`;
  }

  function renderField(field, section, data, value, label) {
    const id = field.id;
    const key = `data-field="${attr(id)}"`;
    if (field.format) {
      const entries = section.kind === "multiline" ? data[section.id] : id.split(".").reduce((obj, part) => obj[part], data);
      return `<fieldset class="sheet-field wide entry-list" ${key} data-format="${field.format}"><legend>${esc(label)}</legend>
        <ol>${entries.map((entry, index) => entryMarkup(field.format, entry, index)).join("")}</ol>
        <button type="button" class="secondary add-entry" data-entry-action="add">+ ${esc(t("addEntry"))}</button></fieldset>`;
    }
    if (field.pair) {
      const pool = id.split(".").reduce((obj, part) => obj[part], data);
      const ap = id === "resources.ap";
      const parts = ["current", "max"].map(part => {
        const caption = t(part === "max" ? "maximum" : "current");
        const inputId = id + "." + part;
        return `<div><label for="${attr(inputId)}">${esc(caption)}</label>${stepper(pool[part], label + " · " + caption, inputId, { whole: ap, max: part === "max" ? field.maximum : undefined })}</div>`;
      });
      return `<fieldset class="sheet-field pair-field" ${key} data-pair><legend>${esc(label)}</legend><div class="pair-controls">${parts.join("")}</div></fieldset>`;
    }
    if (id === "level.value") {
      const options = Array.from({ length: 10 }, (_, i) => `<option${Number(value) === i + 1 ? " selected" : ""}>${i + 1}</option>`);
      return `<label class="sheet-field">${esc(label)}<select ${key}>${options.join("")}</select></label>`;
    }
    if (field.numeric) {
      return `<div class="sheet-field" ${key}><label for="${attr(id)}">${esc(label)}</label>${stepper(value, label, id, { max: 100 })}</div>`;
    }
    return `<label class="sheet-field${field.paragraph ? " wide" : ""}">${esc(label)}${field.paragraph
      ? `<textarea ${key} rows="4" maxlength="4000">\n${storedText(value)}</textarea>`
      : `<input ${key} value="${storedText(value)}" maxlength="256">`}</label>`;
  }

  function refreshEntries(list) {
    const rows = [...list.querySelector("ol").children];
    rows.forEach((row, index) => {
      const position = t("entry") + " " + (index + 1);
      row.querySelector(".entry-number").textContent = position;
      for (const button of row.querySelectorAll("[data-entry-action]"))
        button.setAttribute("aria-label", button.title + " · " + position);
      row.querySelector('[data-entry-action="up"]').disabled = index === 0;
      row.querySelector('[data-entry-action="down"]').disabled = index === rows.length - 1;
      const text = row.querySelector('[data-part="text"]');
      if (text) {
        text.required = !list.dataset.field.startsWith("gear.");
        text.setAttribute("aria-label", position);
      }
    });
  }

  function changeEntries(button) {
    const list = button.closest(".entry-list");
    const rows = list.querySelector("ol");
    const row = button.closest("li");
    let focus;
    switch (button.dataset.entryAction) {
      case "add":
        rows.insertAdjacentHTML("beforeend", entryMarkup(list.dataset.format));
        focus = rows.lastElementChild.querySelector("[data-part]");
        break;
      case "remove":
        focus = (row.nextElementSibling || row.previousElementSibling)?.querySelector("[data-part]") || list.querySelector(".add-entry");
        row.remove();
        break;
      case "up":
        rows.insertBefore(row, row.previousElementSibling);
        break;
      case "down":
        rows.insertBefore(row.nextElementSibling, row);
        break;
    }
    refreshEntries(list);
    (focus || (button.disabled ? row.querySelector("[data-part]") : button)).focus();
  }

  function adjust(button) {
    const input = button.parentElement.querySelector("input");
    const value = input.valueAsNumber || 0;
    const delta = Number(button.dataset.step);
    // A one-point adjustment should retain the entered decimal precision.
    const [mantissa, exponent = 0] = String(value).split("e");
    const decimals = Math.max(0, (mantissa.split(".")[1]?.length || 0) - Number(exponent));
    const adjusted = Number((value + delta).toFixed(Math.min(decimals, 100)));
    const next = Math.min(Number(input.max), Math.max(Number(input.min), adjusted));
    if (next === input.valueAsNumber) return false;
    input.value = String(next);
    return true;
  }

  function readControl(control) {
    if (control.type === "number") return control.valueAsNumber;
    if (control.tagName === "SELECT") return Number(control.value);
    const original = control.defaultValue;
    const displayed = control.tagName === "TEXTAREA"
      ? original.replace(/\r\n?/g, "\n")
      : original.replace(/[\r\n]/g, "");
    return control.value === displayed ? original : control.value;
  }

  function snapshot(container) {
    const fields = {};
    const recordRows = [];
    for (const field of container.querySelectorAll("[data-field]")) {
      const key = field.dataset.field;
      if (field.dataset.format) {
        const rows = [...field.querySelector("ol").children];
        fields[key] = rows.map(row => {
          if (field.dataset.format === "formatLines") return readControl(row.querySelector("textarea"));
          const record = Object.fromEntries([...row.querySelectorAll("[data-part]")].map(control => [control.dataset.part, readControl(control)]));
          if (row.hasAttribute("data-source-index")) record.sourceIndex = Number(row.dataset.sourceIndex);
          return record;
        });
        if (field.dataset.format !== "formatLines") recordRows.push(rows);
      } else if (field.hasAttribute("data-pair")) {
        const [current, max] = field.querySelectorAll("input");
        fields[key] = { current: readControl(current), max: readControl(max) };
      } else {
        fields[key] = readControl(field.matches("input,textarea,select") ? field : field.querySelector("input"));
      }
    }
    return { fields, recordRows };
  }

  function check(container) {
    for (const control of container.querySelectorAll("textarea[required]"))
      control.setCustomValidity(control.value.trim() ? "" : t("checkFields"));
    const load = container.querySelector('[data-field="gear.encumbrance"]');
    if (load) {
      const [current, max] = load.querySelectorAll("input");
      current.setCustomValidity(current.valueAsNumber > max.valueAsNumber ? t("overCapacity") : "");
    }
    return container.querySelector("input:invalid,textarea:invalid,select:invalid");
  }

  return { renderField, refreshEntries, changeEntries, adjust, snapshot, check };
})();
