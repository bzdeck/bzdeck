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
      $existing_tab = document.querySelector('#tab-settings');

  if ($existing_tab) {
    tablist.view.selected = tablist.view.$focused = $existing_tab;
    return;
  }

  let $template = document.querySelector('#tabpanel-settings-template'),
      $content = ($template.content || $template).cloneNode(true),
      $tabpanel = this.$tabpanel = $content.querySelector('[role="tabpanel"]'),
      id_suffix = this.id = Date.now();

  // Assign unique IDs to support older browsers where HTMLTemplateElement is not implemented
  for (let attr of ['id', 'aria-labelledby']) {
    for (let $element of $content.querySelectorAll('[' + attr +']')) {
      $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, id_suffix));
    }
  }

  let $tab = tablist.add_tab(
    'settings',
    'Settings', // l10n
    'Settings', // l10n
    $tabpanel
  );

  tablist.view.selected = tablist.view.$focused = $tab;

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  this.activate_radiogroups();
};

BzDeck.SettingsPage.prototype.activate_radiogroups = function () {
  let $root = document.documentElement, // <html>
      i18n = FlareTail.util.i18n,
      activate = this.activate_radiogroup.bind(this);

  let update_date_format = function (option, value) {
    i18n.options.date[option] = value;

    // Update timezone & format on the current view
    for (let $element of document.querySelectorAll('time')) {
      $element.textContent = i18n.format_date($element.dateTime,
                                              $element.dataset.simple === 'true');
    }
  };

  // Theme
  activate('theme', 'Dark', function (value) FlareTail.util.theme.selected = value);

  // Timezone & Date Format
  activate('date-timezone', 'local', function (value) update_date_format('timezone', value));
  activate('date-format', 'relative', function (value) update_date_format('format', value));

  // Home
  activate('home-layout', 'classic', function (value) BzDeck.homepage.change_layout(value, true));

  // Timeline
  activate('timeline-order', 'ascending', function (value) {
    for (let $timeline of document.querySelectorAll('[id$="preview-bug-timeline"], \
                                                     [id$="tabpanel-timeline"] > section')) {
      $timeline.setAttribute('aria-busy', 'true');

      for (let $comment of [...$timeline.querySelectorAll('article[data-time]')].reverse()) {
        $timeline.appendChild($comment);
      }

      $timeline.removeAttribute('aria-busy');
    }
  });
  activate('timeline-font-family', 'monospace', function (value) {
    $root.setAttribute('data-timeline-font-family', value);
  });
};

BzDeck.SettingsPage.prototype.activate_radiogroup = function (id, default_value, callback) {
  let $rgroup = this.$tabpanel.querySelector('[id$="-setting-{id}"]'.replace('{id}', id)),
      prefs = BzDeck.data.prefs,
      pref = $rgroup.dataset.pref;

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === (prefs[pref] || default_value));
  }

  (new FlareTail.widget.RadioGroup($rgroup)).bind('Selected', function (event) {
    let value = prefs[pref] = event.detail.items[0].dataset.value;

    if (callback) {
      callback(value);
    }
  });
};
