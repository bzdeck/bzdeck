/**
 * BzDeck Settings Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.SettingsPage = function SettingsPageController () {
  let tab_id = history.state ? history.state.tab_id : undefined,
      account = BzDeck.models.data.account,
      prefs = new Map();

  for (let [name, value] of Iterator(BzDeck.config.prefs)) {
    value.user = BzDeck.models.data.prefs[name];
    prefs.set(name, value);
  }

  BzDeck.views.toolbar.open_tab({
    'page_category': 'settings',
    'page_constructor': BzDeck.views.SettingsPage,
    'page_constructor_args': [tab_id, account.token, prefs],
    'tab_label': 'Settings',
  }, this);

  this.on('V:AuthTokenProvided', data => {
    let params = new URLSearchParams();

    params.append('names', account.name);
    params.append('token', [account.id, data.token].join('-'));

    BzDeck.controllers.core.request('GET', 'user', params).then(result => {
      if (result.users) {
        // Save the token
        account.token = data.token;
        BzDeck.models.accounts.save_account(account);
        // Update the view
        this.trigger(':AuthTokenVerified');
      } else {
        this.trigger(':AuthTokenInvalid');
      }
    }).catch(error => {
      this.trigger(':AuthTokenVerificationError', { error });
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
