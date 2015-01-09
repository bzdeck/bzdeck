/**
 * BzDeck Session Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

// Bootstrapper
BzDeck.controllers.Session = function SessionController () {
  this.processing = true;

  let form = BzDeck.views.login_form = new BzDeck.views.LoginForm(),
      status = message => form.show_status(message);

  // Delete the old DB
  indexedDB.deleteDatabase('BzDeck');

  BzDeck.controllers.bugzfeed = new BzDeck.controllers.BugzfeedClient();

  BzDeck.models.open_global_db().then(database => {
    BzDeck.models.databases.global = database;
  }, error => {
    status('Failed to open the database. Make sure you’re not using private browsing mode or IndexedDB doesn’t work.');
  }).then(() => {
    return BzDeck.models.accounts.get_active_account();
  }).then(account => {
    BzDeck.models.data.account = account;
  }).then(() => {
    return BzDeck.models.servers.get_server(BzDeck.models.data.account.host);
  }).then(server => {
    BzDeck.models.data.server = server;
  }).catch(() => {
    status('');

    return new Promise(resolve => {
      let user;

      form.show().then(account => {
        user = account.email;

        return BzDeck.models.servers.get_server(account.host);
      }).then(server => {
        BzDeck.models.data.server = server;
      }).then(() => {
        status('Verifying your account...'); // l10n

        return BzDeck.controllers.users.fetch_user(user);
      }).then(account => {
        account.active = true;
        account.loaded = Date.now(); // key
        account.host = BzDeck.models.data.server.name;
        BzDeck.models.data.account = account;
        BzDeck.models.accounts.save_account(account);
        resolve();
      }).catch(error => {
        if (error.message === 'Network Error') {
          status('Failed to sign in. Network error?'); // l10n
        } else if (error.message === 'User Not Found') {
          status('Your account could not be found. Please check your email adress and try again.'); // l10n
        } else {
          status(error.message);
        }

        form.enable_input();
      });
    });
  }).then(() => {
    return BzDeck.models.open_account_db();
  }).then(database => {
    BzDeck.models.databases.account = database;
  }, error => {
    status('Failed to open the database. Make sure you’re not using private browsing mode or IndexedDB doesn’t work.');
  }).then(() => {
    return BzDeck.models.prefs.load();
  }).then(() => {
    status('Loading Bugzilla config...'); // l10n

    form.hide();
    form.hide_intro();

    return Promise.all([
      BzDeck.controllers.bugs.fetch_subscriptions(),
      new Promise((resolve, reject) => BzDeck.models.config.load().then(config => {
        resolve(config);
      }, error => {
        BzDeck.controllers.config.fetch().then(config => {
          BzDeck.models.get_store('bugzilla').save({ 'host': BzDeck.models.data.server.name, config });
          resolve(config);
        }, error => {
          reject(error);
        });
      })).then(config => {
        BzDeck.models.data.server.config = config
        status('Loading your bugs...'); // l10n; fetch_subscriptions may be still working
      }, error => {
        form.disable_input();
        status(error.message);
      })
    ]);
  }).then(() => {
    status('Loading UI...'); // l10n

    if (!this.relogin) {
      // Finally load the UI modules
      new BzDeck.controllers.BaseController();
      BzDeck.controllers.toolbar = new BzDeck.controllers.Toolbar();
      BzDeck.controllers.sidebar = new BzDeck.controllers.Sidebar();
      BzDeck.controllers.statusbar = new BzDeck.controllers.Statusbar();
    }
  }, error => {
    status(error.message);
  }).then(() => {
    // Connect to the push notification server
    BzDeck.controllers.bugzfeed.connect();

    // Activate the router
    BzDeck.router.locate();

    // Timer to check for updates, call every 10 minutes
    BzDeck.controllers.core.timers.set('fetch_subscriptions',
        window.setInterval(() => BzDeck.controllers.bugs.fetch_subscriptions(), 600000));

    // Register the app for an activity on Firefox OS
    BzDeck.controllers.app.register_activity_handler();

    status('Loading complete.'); // l10n
    this.show_first_notification();
    this.login();
    this.processing = false;
  });
};

BzDeck.controllers.Session.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.Session.prototype.constructor = BzDeck.controllers.Session;

BzDeck.controllers.Session.prototype.show_first_notification = function () {
  // Authorize a notification
  FlareTail.util.app.auth_notification();

  // Update UI & Show a notification
  this.toggle_unread(true);

  // Notify requests
  BzDeck.models.bugs.get_subscription_by_id('requests').then(bugs => {
    let len = bugs.size;

    if (!len) {
      return;
    }

    let title = len > 1 ? `You have ${len} requests`
                        : 'You have 1 request'; // l10n
    let body = len > 1 ? 'Select the Requests folder to browse those bugs.'
                       : 'Select the Requests folder to browse the bug.'; // l10n

    // TODO: Improve the notification body to describe more about the requests,
    // e.g. There are 2 bugs awaiting your information, 3 patches awaiting your review.

    // Select the Requests folder when the notification is clicked
    this.show_notification(title, body).then(event => BzDeck.router.navigate('/home/requests'));
  });
};

BzDeck.controllers.Session.prototype.login = function () {
  this.view = new BzDeck.views.Session();
  this.view.login();
};

BzDeck.controllers.Session.prototype.logout = function () {
  this.view.logout();

  this.clean();

  // Delete the account data
  BzDeck.models.data.account.active = false;
  BzDeck.models.accounts.save_account(BzDeck.models.data.account);

  delete BzDeck.models.data.account;
};

BzDeck.controllers.Session.prototype.close = function () {
  window.close();
};

BzDeck.controllers.Session.prototype.clean = function () {
  // Terminate timers
  for (let timer of BzDeck.controllers.core.timers.values()) {
    window.clearInterval(timer);
  }

  BzDeck.controllers.core.timers.clear();

  // Destroy all notifications
  for (let notification of BzDeck.controllers.core.notifications) {
    notification.close()
  };

  BzDeck.controllers.core.notifications.clear();

  // Disconnect from the Bugzfeed server
  BzDeck.controllers.bugzfeed.disconnect();
}

/* ------------------------------------------------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', event => {
  if (FlareTail.util.compatible) {
    BzDeck.controllers.session = new BzDeck.controllers.Session();
  }
});

window.addEventListener('online', event => {
  BzDeck.controllers.bugzfeed.connect();
});

window.addEventListener('beforeunload', event => {
  BzDeck.controllers.session.clean();
});
