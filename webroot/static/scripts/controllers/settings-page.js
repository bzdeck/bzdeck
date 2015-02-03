/**
 * BzDeck Settings Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.SettingsPage = function SettingsPageController () {
  let tab_id = history.state ? history.state.tab_id : undefined,
      account = BzDeck.models.data.account,
      api_key_link = BzDeck.models.data.server.url + '/userprefs.cgi?tab=apikey',
      prefs = new Map();

  for (let [name, value] of Iterator(BzDeck.config.prefs)) {
    value.user = BzDeck.models.data.prefs[name];
    prefs.set(name, value);
  }

  BzDeck.views.toolbar.open_tab({
    'page_category': 'settings',
    'page_constructor': BzDeck.views.SettingsPage,
    'page_constructor_args': [tab_id, account.api_key, api_key_link, prefs],
    'tab_label': 'Settings',
  }, this);

  this.on('V:APIKeyProvided', data => {
    let params = new URLSearchParams();

    params.append('names', account.name);
    params.append('api_key', data.api_key);

    BzDeck.controllers.core.request('GET', 'user', params).then(result => {
      if (result.users) {
        // Delete the previously-used auth token
        delete account.token;
        // Save the new API Key
        account.api_key = data.api_key;
        BzDeck.models.accounts.save_account(account);
        // Update the view
        this.trigger(':APIKeyVerified');
      } else {
        this.trigger(':APIKeyInvalid');
      }
    }).catch(error => {
      this.trigger(':APIKeyVerificationError', { error });
    });
  });

  this.on('V:PrefValueChanged', data => {
    let { name, value } = data;

    BzDeck.models.data.prefs[name] = value;

    if (name === 'ui.theme.selected') {
      FlareTail.util.theme.selected = value;
    }

    if (name === 'ui.date.timezone') {
      FlareTail.util.datetime.options.timezone = value;
    }

    if (name === 'ui.date.relative') {
      FlareTail.util.datetime.options.relative = value
    }

    if (name === 'notifications.show_desktop_notifications') {
      if (value === true && Notification.permission === 'default') {
        FlareTail.util.app.auth_notification();
      }
    }
  });
};

BzDeck.controllers.SettingsPage.route = '/settings';

BzDeck.controllers.SettingsPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.SettingsPage.prototype.constructor = BzDeck.controllers.SettingsPage;
