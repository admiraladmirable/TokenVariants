// Helper functions for interacting with dom

import EffectMappingForm from "../../applications/effectMappingForm";

export const select = (selector, scope = document) => scope.querySelector(selector);

export const onClick = (el, handler) => {
  if (el) el.addEventListener('click', handler);
};

export const handleEffectClick = (token) => (event) => {
  event.preventDefault();
  if (keyPressed('config')) {
    event.stopPropogation();
    new EffectMappingForm(token).render(true);
  }
};
