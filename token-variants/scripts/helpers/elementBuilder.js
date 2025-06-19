class ElementBuilder {
  constructor(tagNameOrElement) {
    if (tagNameOrElement instanceof HTMLElement) {
      this.el = tagNameOrElement;
    } else {
      this.el = document.createElement(tagNameOrElement);
    }
  }

  className(className) {
    this.element.className = className;
    return this;
  }

  type(type) {
    this.element.type = type;
    return this;
  }

  title(title) {
    this.element.title = game.i18n.localize(title);
    return this;
  }

  textContent(text) {
    this.element.textContent = game.i18n.localize(text);
    return this;
  }

  innerHTML(html) {
    this.element.innerHTML = html;
    return this;
  }

  dataset(key, value) {
    this.element.dataset[key] = value;
    return this;
  }

  attr(name, value) {
    this.element.setAttribute(name, value);
    return this;
  }

  style(name, value) {
    this.element.style(name, value);
    return this;
  }

  on(event, handler, options) {
    this.element.addEventListener(event, handler, options);
    return this;
  }

  child(childElement) {
    this.element.appendChild(childElement);
    return this;
  }

  children(childElements) {
    childElements.array.forEach((child) => {
      this.element.appendChild(child);
    });
    return this;
  }

  when(condition, fn) {
    if (condition) fn(this);
    return this;
  }

  build() {
    return this.element;
  }
}
