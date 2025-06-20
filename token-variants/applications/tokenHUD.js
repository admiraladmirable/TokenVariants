import {
  getFileName,
  isImage,
  isVideo,
  SEARCH_TYPE,
  keyPressed,
  updateActorImage,
  updateTokenImage,
  decodeURISafely,
} from "../scripts/utils.js";
import TokenCustomConfig from "./tokenCustomConfig.js";
import EffectMappingForm from "./effectMappingForm.js";
import { TVA_CONFIG } from "../scripts/settings.js";
import ElementBuilder from "../scripts/helpers/elementBuilder.js";
import UserList from "./userList.js";
import FlagsConfig from "./flagsConfig.js";
import RandomizerConfig from "./randomizerConfig.js";
import { doImageSearch, findImagesFuzzy } from "../scripts/search.js";
import { createContextMenu } from "../scripts/helpers/domPresets.js";

export const TOKEN_HUD_VARIANTS = { variants: null, actor: null };

export async function renderTokenHUD(
  hud,
  html,
  token,
  searchText = "",
  fp_files = null,
) {
  activateStatusEffectListeners(token);

  const hudSettings = TVA_CONFIG.hud;
  const FULL_ACCESS = TVA_CONFIG.permissions.hudFullAccess[game.user.role];
  const PARTIAL_ACCESS = TVA_CONFIG.permissions.hud[game.user.role];

  // Check if the HUD button should be displayed
  if (
    !hudSettings.enableSideMenu ||
    (!PARTIAL_ACCESS && !FULL_ACCESS) ||
    token.flags["token-variants"]?.disableHUDButton
  )
    return;

  const tokenActor = game.actors.get(token.actorId);

  // Disable button if Token HUD Wildcard is e enabled and appropriate setting is set
  if (
    TVA_CONFIG.worldHud.disableIfTHWEnabled &&
    game.modules.get("token-hud-wildcard")?.active
  ) {
    if (tokenActor && tokenActor.prototypeToken.randomImg) return;
  }

  const button = new ElementBuilder("button")
    .type("button")
    .className("control-icon")
    .dataset("action", "token-variants-side-selector")
    .appendChild(
      new ElementBuilder("div")
        .className("control-icon")
        .dataset("action", "token-variants-side-selector")
        .appendChild(
          new ElementBuilder("img")
            .attr("id", "token-variants-side-button")
            .attr(
              "src",
              "modules/token-variants/token-variants/img/token-images.svg",
            )
            .attr("width", "36")
            .attr("height", "36")
            .attr(
              "title",
              "Left-click: Image Menu&#013;Right-click: Search & Additional settings",
            )
            .build(),
        )
        .build(),
    )
    .on("click", (event) => _onButtonClick(event, token))
    .when(FULL_ACCESS, (builder) =>
      builder.on("contextmenu", (event) =>
        _onButtonRightClick(event, hud, html, token),
      ),
    )
    .build();

  const colRight = html.querySelector(".col.right");
  colRight.appendChild(button);
  colRight.click(_deactivateTokenVariantsSideSelector);
}

async function _onButtonClick(event, token) {
  const button = event.target.closest(".control-icon");

  // De-activate 'Status Effects'
  button
    .closest("div.right")
    .querySelector("div.control-icon.effects")
    .removeClass("active");
  button
    .closest("div.right")
    .querySelector(".status-effects")
    .removeClass("active");

  // Remove contextmenu
  button.querySelector(".contextmenu").remove();

  // Toggle variants side menu
  button.toggleClass("active");
  let variantsWrap = button.querySelector(".token-variants-wrap");
  if (button.hasClass("active")) {
    if (!variantsWrap.length) {
      variantsWrap = await renderSideSelect(token);
      if (variantsWrap) button.querySelector("img").after(variantsWrap);
      else return;
    }
    variantsWrap.addClass("active");
  } else {
    variantsWrap.removeClass("active");
  }
}

function _onButtonRightClick(event, hud, html, token) {
  // Display side menu if button is not active yet
  const button = event.target.closest(".control-icon");
  if (!button.hasClass("active")) {
    // button.trigger('click');
    button.addClass("active");
  }

  if (button.querySelector(".contextmenu").length) {
    // Contextmenu already displayed. Remove and activate images
    button.querySelector(".contextmenu").remove();
    button.removeClass("active").trigger("click");
    //button.querySelector('.token-variants-wrap.images').addClass('active');
  } else {
    // Contextmenu is not displayed. Hide images, create it and add it
    button.querySelector(".token-variants-wrap.images").removeClass("active");
    const contextMenu = createContextMenu();
    button.append(contextMenu);

    // Register contextmenu listeners
    contextMenu
      .querySelector(".token-variants-side-search")
      .on("keyup", (event) => _onImageSearchKeyUp(event, token))
      .on("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    contextMenu.querySelector(".flags").click((event) => {
      const tkn = canvas.tokens.get(token._id);
      if (tkn) {
        event.preventDefault();
        event.stopPropagation();
        new FlagsConfig(tkn).render(true);
      }
    });
    contextMenu.querySelector(".file-picker").click(async (event) => {
      event.preventDefault();
      event.stopPropagation();
      new FilePicker({
        type: "imagevideo",
        callback: async (path, fp) => {
          const content = await FilePicker.browse(
            fp.activeSource,
            fp.result.target,
          );
          let files = content.files.filter((f) => isImage(f) || isVideo(f));
          if (files.length) {
            button.querySelector(".token-variants-wrap").remove();
            const sideSelect = await renderSideSelect(token, "", files);
            if (sideSelect) {
              sideSelect.addClass("active");
              button.append(sideSelect);
            }
          }
        },
      }).render(true);
    });
    contextMenu.querySelector(".effectConfig").click((event) => {
      new EffectMappingForm(token).render(true);
    });
    contextMenu.querySelector(".randomizerConfig").click((event) => {
      new RandomizerConfig(token).render(true);
    });
  }
}

function _deactivateTokenVariantsSideSelector(event) {
  const controlIcon = event.target.closest(".control-icon");
  const dataAction = controlIcon.attr("data-action");

  switch (dataAction) {
    case "effects":
      break; // Effects button
    case "thwildcard-selector":
      break; // Token HUD Wildcard module button
    default:
      return;
  }

  event.target
    .closest("div.right")
    .querySelector('.control-icon[data-action="token-variants-side-selector"]')
    .removeClass("active");
  event.target
    .closest("div.right")
    .querySelector(".token-variants-wrap")
    .removeClass("active");
}

async function renderSideSelect(token, searchText = "", fp_files = null) {
  const hudSettings = TVA_CONFIG.hud;
  const worldHudSettings = TVA_CONFIG.worldHud;
  const FULL_ACCESS = TVA_CONFIG.permissions.hudFullAccess[game.user.role];
  const PARTIAL_ACCESS = TVA_CONFIG.permissions.hud[game.user.role];

  const tokenActor = game.actors.get(token.actorId);

  let images = [];
  let actorVariants = [];
  let imageDuplicates = new Set();
  const pushImage = (img) => {
    if (imageDuplicates.has(img.path)) {
      if (
        !images.querySelector(
          (obj) => obj.path === img.path && obj.name === img.name,
        )
      ) {
        images.push(img);
      }
    } else {
      images.push(img);
      imageDuplicates.add(img.path);
    }
  };

  actorVariants = getVariants(tokenActor);

  if (!fp_files) {
    if (!searchText) {
      // Insert current token image
      if (token.texture?.src && token.texture?.src !== CONST.DEFAULT_TOKEN) {
        pushImage({
          path: decodeURISafely(token.texture.src),
          name:
            token.flags?.["token-variants"]?.name ??
            getFileName(token.texture.src),
        });
      }

      if (tokenActor) {
        // Insert default token image
        const defaultImg =
          tokenActor.prototypeToken?.flags["token-variants"]?.[
            "randomImgDefault"
          ] ||
          tokenActor.prototypeToken?.flags["token-hud-wildcard"]?.["default"] ||
          "";
        if (defaultImg) {
          pushImage({
            path: decodeURISafely(defaultImg),
            name: getFileName(defaultImg),
          });
        }

        if (FULL_ACCESS || PARTIAL_ACCESS) {
          actorVariants.forEach((variant) => {
            for (const name of variant.names) {
              pushImage({ path: decodeURISafely(variant.imgSrc), name: name });
            }
          });
        }

        // Parse directory flag and include the images
        if (FULL_ACCESS || PARTIAL_ACCESS) {
          const directoryFlag = tokenActor.getFlag(
            "token-variants",
            "directory",
          );
          if (directoryFlag) {
            let dirFlagImages;
            try {
              let path = directoryFlag.path;
              let source = directoryFlag.source;
              let bucket = "";
              if (source.startsWith("s3:")) {
                bucket = source.substring(3, source.length);
                source = "s3";
              }
              const content = await FilePicker.browse(source, path, {
                type: "imagevideo",
                bucket,
              });
              dirFlagImages = content.files;
            } catch (err) {
              dirFlagImages = [];
            }
            dirFlagImages = dirFlagImages.forEach((f) => {
              if (isImage(f) || isVideo(f))
                pushImage({ path: decodeURISafely(f), name: getFileName(f) });
            });
          }
        }

        if (
          (FULL_ACCESS || PARTIAL_ACCESS) &&
          worldHudSettings.includeWildcard &&
          !worldHudSettings.displayOnlySharedImages
        ) {
          // Merge wildcard images
          const protoImg = tokenActor.prototypeToken.texture.src;
          if (tokenActor.prototypeToken.randomImg) {
            (await tokenActor.getTokenImages())
              .filter((img) => !img.includes("*"))
              .forEach((img) => {
                pushImage({
                  path: decodeURISafely(img),
                  name: getFileName(img),
                });
              });
          } else if (
            protoImg.includes("*") ||
            protoImg.includes("{") ||
            protoImg.includes("}")
          ) {
            // Modified version of Actor.getTokenImages()
            const getTokenImages = async () => {
              if (tokenActor._tokenImages) return tokenActor._tokenImages;

              let source = "data";
              let pattern = tokenActor.prototypeToken.texture.src;
              const browseOptions = { wildcard: true };

              // Support non-user sources
              if (/\.s3\./.test(pattern)) {
                source = "s3";
                const { bucket, keyPrefix } = FilePicker.parseS3URL(pattern);
                if (bucket) {
                  browseOptions.bucket = bucket;
                  pattern = keyPrefix;
                }
              } else if (pattern.startsWith("icons/")) source = "public";

              // Retrieve wildcard content
              try {
                const content = await FilePicker.browse(
                  source,
                  pattern,
                  browseOptions,
                );
                tokenActor._tokenImages = content.files;
              } catch (err) {
                tokenActor._tokenImages = [];
              }
              return tokenActor._tokenImages;
            };

            (await getTokenImages())
              .filter(
                (img) => !img.includes("*") && (isImage(img) || isVideo(img)),
              )
              .forEach((variant) => {
                pushImage({
                  path: decodeURISafely(variant),
                  name: getFileName(variant),
                });
              });
          }
        }
      }
    }

    // Perform image search if needed
    if (FULL_ACCESS) {
      let search;
      if (searchText) {
        search = searchText.length > 2 ? searchText : null;
      } else {
        if (
          worldHudSettings.displayOnlySharedImages ||
          tokenActor?.getFlag("token-variants", "disableNameSearch")
        ) {
          // No search
        } else if (token.name.length > 2) {
          search = token.name;
        }
      }

      if (search) {
        let artSearch = await doImageSearch(search, {
          searchType: SEARCH_TYPE.TOKEN,
          searchOptions: { keywordSearch: worldHudSettings.includeKeywords },
        });

        // Merge full search, and keywords into a single array
        if (artSearch) {
          artSearch.forEach((results) => {
            results.forEach((img) => pushImage(img));
          });
        }
      }
    }
  } else {
    images = fp_files.map((f) => {
      return { path: decodeURISafely(f), name: getFileName(f) };
    });
  }

  // Retrieving the possibly custom name attached as a flag to the token
  let tokenImageName = "";
  if (token.flags["token-variants"] && token.flags["token-variants"]["name"]) {
    tokenImageName = token.flags["token-variants"]["name"];
  } else {
    tokenImageName = getFileName(token.texture.src);
  }

  let imagesParsed = [];
  const tokenConfigs = (TVA_CONFIG.tokenConfigs || []).flat();
  const tkn = canvas.tokens.get(token._id);
  const userMappings =
    tkn.document.getFlag("token-variants", "userMappings") || {};

  for (const imageObj of images) {
    const img = isImage(imageObj.path);
    const vid = isVideo(imageObj.path);

    const hasConfig = Boolean(
      tokenConfigs.querySelector(
        (config) =>
          config.tvImgSrc === imageObj.path &&
          config.tvImgName === imageObj.name,
      ),
    );
    let shared = false;
    if (TVA_CONFIG.permissions.hudFullAccess[game.user.role]) {
      actorVariants.forEach((variant) => {
        if (
          variant.imgSrc === imageObj.path &&
          variant.names.includes(imageObj.name)
        ) {
          shared = true;
        }
      });
    }

    const [title, style] = genTitleAndStyle(
      userMappings,
      imageObj.path,
      imageObj.name,
    );

    imagesParsed.push({
      route: imageObj.path,
      name: imageObj.name,
      used:
        imageObj.path === token.texture.src && imageObj.name === tokenImageName,
      img,
      vid,
      unknownType: !img && !vid,
      shared: shared,
      hasConfig: hasConfig,
      title: title,
      style: game.user.isGM && style ? "box-shadow: " + style + ";" : null,
    });
  }

  //
  // Render
  //
  const imageDisplay = hudSettings.displayAsImage;
  const imageOpacity = hudSettings.imageOpacity / 100;

  const sideSelect = $(
    await renderTemplate(
      "modules/token-variants/token-variants/templates/sideSelect.html",
      {
        imagesParsed,
        imageDisplay,
        imageOpacity,
        tokenHud: true,
      },
    ),
  );

  // Activate listeners
  sideSelect.querySelector("video").hover(
    function () {
      if (TVA_CONFIG.playVideoOnHover) {
        this.play();
        this.siblings(".fa-play").hide();
      }
    },
    function () {
      if (TVA_CONFIG.pauseVideoOnHoverOut) {
        this.pause();
        this.currentTime = 0;
        this.siblings(".fa-play").show();
      }
    },
  );
  sideSelect
    .querySelector(".token-variants-button-select")
    .click((event) => _onImageClick(event, token._id));

  if (FULL_ACCESS) {
    sideSelect
      .querySelector(".token-variants-button-select")
      .on("contextmenu", (event) => _onImageRightClick(event, token._id));
  }

  return sideSelect;
}

async function _onImageClick(event, tokenId) {
  event.preventDefault();
  event.stopPropagation();

  const token = canvas.tokens.controlled.querySelector(
    (t) => t.document.id === tokenId,
  );
  if (!token) return;

  const worldHudSettings = TVA_CONFIG.worldHud;

  const imgButton = event.target.closest(".token-variants-button-select");
  const imgSrc = imgButton.attr("data-name");
  const name = imgButton.attr("data-filename");

  if (!imgSrc || !name) return;

  if (keyPressed("config") && game.user.isGM) {
    const toggleCog = (saved) => {
      const cog = imgbutton.querySelector(".fa-cog");
      if (saved) {
        cog.addClass("active");
      } else {
        cog.removeClass("active");
      }
    };
    new TokenCustomConfig(token, {}, imgSrc, name, toggleCog).render(true);
  } else if (token.document.texture.src === imgSrc) {
    let tokenImageName = token.document.getFlag("token-variants", "name");
    if (!tokenImageName)
      tokenImageName = getFileName(token.document.texture.src);
    if (tokenImageName !== name) {
      await updateTokenImage(imgSrc, {
        token: token,
        imgName: name,
        animate: worldHudSettings.animate,
      });
      if (token.actor && worldHudSettings.updateActorImage) {
        if (worldHudSettings.useNameSimilarity) {
          updateActorWithSimilarName(imgSrc, name, token.actor);
        } else {
          updateActorImage(token.actor, imgSrc, { imgName: name });
        }
      }
    }
  } else {
    await updateTokenImage(imgSrc, {
      token: token,
      imgName: name,
      animate: worldHudSettings.animate,
    });
    if (token.actor && worldHudSettings.updateActorImage) {
      if (worldHudSettings.useNameSimilarity) {
        updateActorWithSimilarName(imgSrc, name, token.actor);
      } else {
        updateActorImage(token.actor, imgSrc, { imgName: name });
      }
    }
  }
}

async function _onImageRightClick(event, tokenId) {
  event.preventDefault();
  event.stopPropagation();
  let token = canvas.tokens.controlled.querySelector(
    (t) => t.document.id === tokenId,
  );
  if (!token) return;

  const imgButton = event.target.closest(".token-variants-button-select");
  const imgSrc = imgButton.attr("data-name");
  const name = imgButton.attr("data-filename");

  if (!imgSrc || !name) return;

  if (keyPressed("config") && game.user.isGM) {
    const regenStyle = (token, img) => {
      const mappings =
        token.document.getFlag("token-variants", "userMappings") || {};
      const name = imgButton.attr("data-filename");
      const [title, style] = genTitleAndStyle(mappings, img, name);
      imgButton
        .closest(".token-variants-wrap")
        .querySelector(`.token-variants-button-select[data-name='${img}']`)
        .css("box-shadow", style)
        .prop("title", title);
    };
    new UserList(token, imgSrc, regenStyle).render(true);
  } else if (token.actor) {
    let tokenActor = game.actors.get(token.actor.id);
    let variants = getVariants(tokenActor);

    // Remove selected variant if present in the flag, add otherwise
    let del = false;
    let updated = false;
    for (let variant of variants) {
      if (variant.imgSrc === imgSrc) {
        let fNames = variant.names.filter((name) => name !== name);
        if (fNames.length === 0) {
          del = true;
        } else if (fNames.length === variant.names.length) {
          fNames.push(name);
        }
        variant.names = fNames;
        updated = true;
        break;
      }
    }
    if (del) variants = variants.filter((variant) => variant.imgSrc !== imgSrc);
    else if (!updated) variants.push({ imgSrc: imgSrc, names: [name] });

    // Set shared variants as an actor flag
    setVariants(tokenActor, variants);
    imgbutton.querySelector(".fa-share").toggleClass("active"); // Display green arrow
  }
}

async function _onImageSearchKeyUp(event, token) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Enter" || event.keyCode === 13) {
    if (event.target.value.length >= 3) {
      const button = event.target.closest(".control-icon");
      button.querySelector(".token-variants-wrap").remove();
      const sideSelect = await renderSideSelect(token, event.target.value);
      if (sideSelect) {
        sideSelect.addClass("active");
        button.append(sideSelect);
      }
    }
  }
}

function genTitleAndStyle(mappings, imgSrc, name) {
  let title = TVA_CONFIG.worldHud.showFullPath ? imgSrc : name;
  let style = "";
  let offset = 2;
  for (const [userId, img] of Object.entries(mappings)) {
    if (img === imgSrc) {
      const user = game.users.get(userId);
      if (!user) continue;
      if (style.length === 0) {
        style = `inset 0 0 0 ${offset}px ${user.color}`;
      } else {
        style += `, inset 0 0 0 ${offset}px ${user.color}`;
      }
      offset += 2;
      title += `\nDisplayed to: ${user.name}`;
    }
  }
  return [title, style];
}

async function updateActorWithSimilarName(imgSrc, imgName, actor) {
  const results = await findImagesFuzzy(
    imgName,
    SEARCH_TYPE.PORTRAIT,
    {
      algorithm: {
        fuzzyThreshold: 0.4,
        fuzzyLimit: 50,
      },
    },
    true,
  );

  if (results && results.length !== 0) {
    updateActorImage(actor, results[0].path, { imgName: results[0].name });
  } else {
    updateActorImage(actor, imgSrc, { imgName: imgName });
  }
}

function activateStatusEffectListeners(token) {
  if (
    TVA_CONFIG.permissions.statusConfig[game.user.role] &&
    token.actorId &&
    game.actors.get(token.actorId)
  ) {
    const iconEffects = document.querySelector(
      '.control-icon[data-action="effects"]',
    );
    if (iconEffects) {
      iconEffects.querySelector("img:first").click((event) => {
        event.preventDefault();
        if (keyPressed("config")) {
          event.stopPropagation();
          new EffectMappingForm(token).render(true);
        }
      });
    }

    const iconVisibility = document.querySelector(
      '.control-icon[data-action="visibility"]',
    );
    if (iconVisibility) {
      iconVisibility.querySelector("img").click((event) => {
        event.preventDefault();
        if (keyPressed("config")) {
          event.stopPropagation();
          new EffectMappingForm(token, {
            createMapping: {
              label: "In Combat",
              expression: "token-variants-visibility",
            },
          }).render(true);
        }
      });
    }

    const iconCombat = document.querySelector(
      '.control-icon[data-action="combat"]',
    );
    if (iconCombat) {
      iconCombat.querySelector("img").click((event) => {
        event.preventDefault();
        if (keyPressed("config")) {
          event.stopPropagation();
          new EffectMappingForm(token, {
            createMapping: {
              label: "In Combat",
              expression: "token-variants-combat",
            },
          }).render(true);
        }
      });
    }

    const statusEffects = document.querySelector(".status-effects");
    if (statusEffects) {
      statusEffects.querySelector("img").click((event) => {
        event.preventDefault();
        if (keyPressed("config")) {
          event.stopPropagation();

          let effectName = event.target.data("tooltip");
          if (game.system.id === "pf2e") {
            effectName = event.target.closest("picture").attr("title");
          }
          new EffectMappingForm(token, {
            createMapping: { label: effectName, expression: effectName },
          }).render(true);
        }
      });
    }
  }
}

function getVariants(actor) {
  if (TOKEN_HUD_VARIANTS.variants) return TOKEN_HUD_VARIANTS.variants;
  else return actor?.getFlag("token-variants", "variants") || [];
}

function setVariants(actor, variants) {
  TOKEN_HUD_VARIANTS.variants = variants;
  TOKEN_HUD_VARIANTS.actor = actor;
}
