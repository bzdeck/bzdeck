/**
 * BzDeck Settings Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
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

  let $content = document.querySelector('#tabpanel-settings-template').content.cloneNode(true),
      $tabpanel = this.$tabpanel = $content.querySelector('[role="tabpanel"]');

  let $tab = tablist.add_tab(
    'settings',
    'Settings', // l10n
    'Settings', // l10n
    $tabpanel
  );

  tablist.view.selected = tablist.view.$focused = $tab;

  // Activate tabs
  if (FlareTail.util.device.type === 'desktop') {
    new FlareTail.widget.TabList(document.querySelector('#settings-tablist'));
  }

  // Activate token input
  this.activate_token_input();

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  this.activate_radiogroups();
};

BzDeck.SettingsPage.prototype.activate_token_input = function () {
  let userid = BzDeck.data.account.id,
      token = BzDeck.data.account.token,
      $input = document.querySelector('#tabpanel-settings-account-token'),
      $output = $input.nextElementSibling;

  if (token) {
    $input.value = token;
    $output.textContent = 'Verified'; // l10n
  }

  $input.addEventListener('input', event => {
    $output.textContent = '';

    if ($input.value.length !== 10) {
      return;
    }

    let params = new URLSearchParams();
    params.append('userid', userid);
    params.append('cookie', $input.value);

    $output.textContent = 'Verifying...'; // l10n

    BzDeck.core.request('GET', 'user/' + userid + '?' + params.toString(), user => {
      if (user.id) {
        // Save the token
        BzDeck.data.account.token = $input.value;
        BzDeck.model.db.transaction('accounts', 'readwrite')
                       .objectStore('accounts').put(BzDeck.data.account);
        // Update the view
        $input.setAttribute('aria-invalid', 'false');
        $output.textContent = 'Verified'; // l10n
      } else {
        $input.setAttribute('aria-invalid', 'true');
        $output.textContent = 'Invalid, try again'; // l10n
      }
    });
  });
};

BzDeck.SettingsPage.prototype.activate_radiogroups = function () {
  let $root = document.documentElement, // <html>
      activate = this.activate_radiogroup.bind(this);

  // Theme
  activate('ui.theme.selected', 'Light', value => FlareTail.util.theme.selected = value);

  // Timezone & Date Format
  activate('ui.date.timezone', 'local', value => FlareTail.util.datetime.options.timezone = value);
  activate('ui.date.relative', true, value => FlareTail.util.datetime.options.relative = value);

  // Notifications
  activate('notifications.show_desktop_notifications', true, value => {
    if (value === true && Notification.permission === 'default') {
      FlareTail.util.app.auth_notification();
    }
  });
  activate('notifications.ignore_cc_changes', true);

  // Home
  activate('ui.home.layout', 'vertical', value => BzDeck.homepage.change_layout(value, true));

  // Timeline
  activate('ui.timeline.sort.order', 'ascending', value => {
    for (let $timeline of document.querySelectorAll('.bug-timeline')) {
      $timeline.setAttribute('aria-busy', 'true');

      for (let $comment of [...$timeline.querySelectorAll('[itemprop="comment"], \
                                                           .read-comments-expander')].reverse()) {
        $comment.parentElement.appendChild($comment);
      }

      $timeline.removeAttribute('aria-busy');
    }

    $root.setAttribute('data-timeline-sort-order', value);
  });
  activate('ui.timeline.font.family', 'proportional', value => {
    $root.setAttribute('data-timeline-font-family', value);
  });
  activate('ui.timeline.show_cc_changes', false, value => {
    $root.setAttribute('data-timeline-show-cc-changes', String(value));
  });
  activate('ui.timeline.display_attachments_inline', true, value => {
    $root.setAttribute('data-timeline-display-attachments-inline', String(value));

    if (value === true) {
      // Show media
      for (let $attachment of document.querySelectorAll('[itemprop="associatedMedia"]')) {
        let $media = $attachment.querySelector('img, audio, video');

        if ($media && !$media.src) {
          $media.parentElement.setAttribute('aria-busy', 'true');
          $media.src = $attachment.querySelector('[itemprop="contentUrl"]').itemValue;
        }
      }
    }
  });
};

BzDeck.SettingsPage.prototype.activate_radiogroup = function (pref, default_value, callback) {
  let $rgroup = this.$tabpanel.querySelector('[data-pref="%s"]'.replace('%s', pref)),
      prefs = BzDeck.data.prefs,
      type = $rgroup.dataset.type || 'string',
      value = prefs[pref] !== undefined ? prefs[pref] : default_value;

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
  }

  (new FlareTail.widget.RadioGroup($rgroup)).bind('Selected', event => {
    let _value = event.detail.items[0].dataset.value,
        value = type === 'boolean' ? _value === 'true' : _value;

    prefs[pref] = value;

    if (callback) {
      callback(value);
    }
  });
};
