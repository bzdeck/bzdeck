/**
 * BzDeck Settings Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 18
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.SettingsPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      existing_tab = tablist.view.members.filter(function (tab) tab.id === 'tab-settings')[0];

  if (existing_tab) {
    tablist.view.selected = tablist.view.focused = existing_tab;
    return;
  }

  let $template = document.querySelector('#tabpanel-settings-template'),
      $content = ($template.content || $template).cloneNode(),
      $tabpanel = $content.querySelector('[role="tabpanel"]'),
      $rgroup,
      id_suffix = this.id = (new Date()).getTime(),
      prefs = BzDeck.data.prefs;

  // Assign unique IDs to support older browsers where HTMLTemplateElement is not implemented
  for (let attr of ['id', 'aria-labelledby']) {
    for (let $element of $content.querySelectorAll('[' + attr +']')) {
      $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, id_suffix));
    }
  }

  let tab = tablist.add_tab(
    'settings',
    'Settings', // l10n
    'Settings', // l10n
    $tabpanel
  );

  tablist.view.selected = tablist.view.focused = tab;

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.

  let setup_radiogroup = function (id, default_value, callback = function (value) {}) {
    let $rgroup = $tabpanel.querySelector('[id$="{id}"]'.replace('{id}', id)),
        pref = $rgroup.dataset.pref;
    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.setAttribute('aria-checked', $radio.dataset.value === (prefs[pref] || default_value));
    }
    $rgroup.addEventListener('Selected', function (event) {
      let value = prefs[pref] = event.detail.items[0].dataset.value;
      callback(value);
    });
    new BriteGrid.widget.RadioGroup($rgroup); // Activate the widget
  };

  // Theme
  $rgroup = $tabpanel.querySelector('[id$="setting-theme"]');
  if ($rgroup) {
    let pref = $rgroup.dataset.pref;
    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.setAttribute('aria-checked', $radio.dataset.value === BriteGrid.util.theme.selected);
    }
    $rgroup.addEventListener('Selected', function (event) {
      BriteGrid.util.theme.selected = prefs[pref] = event.detail.items[0].dataset.value;
    });
    new BriteGrid.widget.RadioGroup($rgroup); // Activate the widget
  }

  let setup_date_setting = function (id, default_value) {
    let $rgroup = $tabpanel.querySelector('[id$="{id}"]'.replace('{id}', id)),
        pref = $rgroup.dataset.pref,
        i18n = BriteGrid.util.i18n;
    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.setAttribute('aria-checked', $radio.dataset.value === (prefs[pref] || default_value));
    }
    $rgroup.addEventListener('Selected', function (event) {
      prefs[pref] = i18n.options.date[pref.replace('ui.date.', '')]
                  = event.detail.items[0].dataset.value;
      // Update timezone & format on the current view
      for (let $element of document.querySelectorAll('time')) {
        $element.textContent = i18n.format_date($element.dateTime);
      }
    });
    new BriteGrid.widget.RadioGroup($rgroup);
  };

  // Timezone & Date Format
  setup_date_setting('setting-date-timezone', 'local');
  setup_date_setting('setting-date-format', 'relative');

  // Timeline
  setup_radiogroup('setting-timeline-order', 'ascending');
  setup_radiogroup('setting-timeline-font-family', 'monospace', function (value) {
    document.documentElement.setAttribute('data-setting-timeline-font-family', value);
  });
};
