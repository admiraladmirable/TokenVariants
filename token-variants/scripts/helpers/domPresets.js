export function createToolbarButton({className, iconClass, labelText, onClick}) {
  const icon = new ElementBuilder("i")
    .className(iconClass)
    .build();

  const label = new ElementBuilder("label")
    .textContent(labelText)
    .build();

  const builder = new ElementBuilder("button")
    .className(className)
    .type("button")
    .children([icon, label]);

  if (onClick) builder.on("click", onClick);

  return builder.build();
}

export function createSearchInput({ className = "token-variants-side-search", placeholder = "" }) {
  return new ElementBuilder("input")
    .className(className)
    .type("text")
    .attr("placeholder", placeholder)
    .build();
}

export function createContextMenu() {
  const menu = new ElementBuilder("div")
    .className("token-variants-context-menu active")
    .children([
      createSearchInput({}),
      createToolbarButton({
        className: "flags",
        iconClass: "fab fa-font-awesome-flag",
        labelText: "Flags"
      }),
      createToolbarButton({
        className: "file-picker",
        iconClass: "fas fa-file-import fa-fw",
        labelText: "Browse Folders"
      }),
      createToolbarButton({
        className: "effectConfig",
        iconClass: "fas fa-sun",
        labelText: "Mappings"
      }),
      createToolbarButton({
        className: "randomizerConfig",
        iconClass: "fas fa-dice",
        labelText: "Randomizer"
      })
    ])
    .build();

  return new ElementBuilder("div")
    .className("token-variants-wrap contextmenu active")
    .child(menu)
    .build();
}

