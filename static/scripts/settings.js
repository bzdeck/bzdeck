/**
 * BzDeck Settings Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.SettingsPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      existing_tab = tablist.view.members.filter(tab => tab.id === 'tab-settings')[0];

  if (existing_tab) {
    tablist.view.selected = tablist.view.focused = existing_tab;
    return;
  }

  let $content = document.querySelector('#tabpanel-settings-template').content.cloneNode(),
      $tabpanel = $content.querySelector('[role="tabpanel"]'),
      $rgroup,
      prefs = BzDeck.data.prefs;

  let tab = tablist.add_tab(
    'settings',
    'Settings', // l10n
    'Settings', // l10n
    $tabpanel
  );

  tablist.view.selected = tablist.view.focused = tab;

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.

  // Theme
  $rgroup = $tabpanel.querySelector('#setting-theme');
  if ($rgroup) {
    let pref = $rgroup.dataset.pref;
    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.setAttribute('aria-checked', $radio.dataset.value === BriteGrid.util.theme.selected);
    }
    $rgroup.addEventListener('Selected', event => {
      BriteGrid.util.theme.selected = prefs[pref] = event.detail.items[0].dataset.value;
    });
    new BriteGrid.widget.RadioGroup($rgroup); // Activate the widget
  }
};
