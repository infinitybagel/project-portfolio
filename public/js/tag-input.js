// Chip-style tag editor used in the project form.
import { MAX_TAGS, TAG_SUGGESTIONS, esc, normalizeTags } from "./ui.js";
import { icons } from "./components.js";

const SUGGESTION_COUNT = 8;

/**
 * Renders a tag editor into `container`.
 * Enter or "," adds the typed tag, Backspace on an empty input removes the last one,
 * pasting "a, b, c" adds several, and suggestion chips add common tags in one click.
 * @returns {{ getTags: () => string[] }} getTags also commits any half-typed tag.
 */
export function createTagInput(container, initialTags = [], { inputId = "f-tags", onChange = () => {} } = {}) {
  let tags = normalizeTags(initialTags);

  container.innerHTML = `
    <div class="tag-input">
      <ul class="tag-input-list" aria-live="polite"></ul>
      <input id="${inputId}" type="text" autocomplete="off" maxlength="40" aria-describedby="${inputId}-hint">
    </div>
    <div class="tag-input-meta">
      <p class="hint" id="${inputId}-hint">Press Enter or comma to add. Up to ${MAX_TAGS} tags.</p>
      <span class="hint tag-count"></span>
    </div>
    <div class="tag-suggestions" role="group" aria-label="Suggested tags"></div>`;

  const box = container.querySelector(".tag-input");
  const list = container.querySelector(".tag-input-list");
  const input = container.querySelector("input");
  const counter = container.querySelector(".tag-count");
  const suggestions = container.querySelector(".tag-suggestions");

  function draw() {
    list.innerHTML = tags
      .map(
        (t, i) => `<li class="tag tag-chip">${esc(t)}<button type="button" data-remove="${i}" aria-label="Remove tag ${esc(t)}">${icons.x(12)}</button></li>`
      )
      .join("");
    const full = tags.length >= MAX_TAGS;
    input.disabled = full;
    input.placeholder = full ? "Tag limit reached" : tags.length ? "Add another tag…" : "e.g. Embedded Systems, Robotics, IoT";
    counter.textContent = `${tags.length}/${MAX_TAGS}`;
    drawSuggestions();
  }

  function drawSuggestions() {
    if (tags.length >= MAX_TAGS) {
      suggestions.innerHTML = "";
      return;
    }
    const query = input.value.trim().toLowerCase();
    const chosen = new Set(tags.map((t) => t.toLowerCase()));
    const matches = TAG_SUGGESTIONS.filter(
      (s) => !chosen.has(s.toLowerCase()) && (!query || s.toLowerCase().includes(query))
    ).slice(0, SUGGESTION_COUNT);
    suggestions.innerHTML = matches
      .map((s) => `<button type="button" class="chip chip-sm" data-add="${esc(s)}">+ ${esc(s)}</button>`)
      .join("");
  }

  function add(values) {
    const before = tags.length;
    tags = normalizeTags([...tags, ...values]);
    input.value = "";
    draw();
    if (tags.length !== before) onChange(tags);
  }

  function commitPending() {
    const pending = input.value.split(",").map((t) => t.trim()).filter(Boolean);
    if (pending.length) add(pending);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault(); // Enter would otherwise submit the project form
      commitPending();
    } else if (e.key === "Backspace" && !input.value && tags.length) {
      tags = tags.slice(0, -1);
      draw();
      onChange(tags);
    }
  });
  input.addEventListener("input", () => {
    if (input.value.includes(",")) commitPending(); // handles paste of "a, b, c"
    else drawSuggestions();
  });
  input.addEventListener("blur", commitPending);

  box.addEventListener("click", (e) => {
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      tags = tags.filter((_, i) => i !== Number(remove.dataset.remove));
      draw();
      onChange(tags);
      input.focus();
    } else if (e.target === box || e.target === list) {
      input.focus();
    }
  });
  suggestions.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    add([b.dataset.add]);
    input.focus();
  });

  draw();
  return {
    getTags() {
      commitPending();
      return [...tags];
    },
  };
}
