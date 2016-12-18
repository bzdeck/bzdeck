/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session View that handles the app session-related UI.
 * @extends BzDeck.BaseView
 */
BzDeck.SessionView = class SessionView extends BzDeck.BaseView {
  /**
   * Get a SessionView instance.
   * @constructor
   * @returns {SessionView} New SessionView instance.
   */
  constructor () {
    super(); // Assign this.id

    const params = new URLSearchParams(location.search.substr(1));

    // Subscribe to events
    this.subscribe('P#DataLoaded');
    this.subscribe('P#Login');
    this.subscribe('P#Logout');

    // Initiate the corresponding presenter and sub-view
    this.presenter = BzDeck.presenters.session = new BzDeck.SessionPresenter(this.id, params);
    this.login_form_view = new BzDeck.LoginFormView(this.id, params);
  }

  /**
   * Called once the user data is loaded. Set up global UI modules.
   * @listens SessionPresenter#DataLoaded
   */
  on_data_loaded () {
    BzDeck.views.global = new BzDeck.GlobalView();
    BzDeck.views.banner = new BzDeck.BannerView();
    BzDeck.views.navigator = new BzDeck.NavigatorView();
    BzDeck.views.statusbar = new BzDeck.StatusbarView();

    // Activate the router once everything is ready
    BzDeck.router.locate();
  }

  /**
   * Called once the application is ready and the user is signed in. Hide the sign-in page and show the main application
   * page instead.
   * @listens SessionPresenter#Login
   * @todo Focus handling.
   */
  on_login () {
    this.$app_login = document.querySelector('#app-login');
    this.$app_body = document.querySelector('#app-body');

    this.$app_login.setAttribute('aria-hidden', 'true');
    this.$app_body.removeAttribute('aria-hidden');

    BzDeck.views.statusbar.$statusbar = this.$app_body.querySelector('.statusbar');
  }

  /**
   * Called once the user is signed out from the app. Hide the main application page and show the sign-in page instead.
   * @listens SessionPresenter#Logout
   */
  on_logout () {
    BzDeck.views.statusbar.$statusbar = this.$app_login.querySelector('.statusbar');
    BzDeck.views.statusbar.show('You have logged out.'); // l10n

    this.$app_login.removeAttribute('aria-hidden');
    this.$app_body.setAttribute('aria-hidden', 'true');
  }
}

window.addEventListener('DOMContentLoaded', event => {
  if (FlareTail.compatible && BzDeck.compatible) {
    // Define the router
    BzDeck.router = new FlareTail.app.Router(BzDeck.config.app, {
      '/attachment/(\\d+|[a-z0-9]{7})': { view: BzDeck.AttachmentPageView },
      '/bug/(\\d+)': { view: BzDeck.DetailsPageView },
      '/home/(\\w+)': { view: BzDeck.HomePageView, catch_all: true },
      '/profile/(.+)': { view: BzDeck.ProfilePageView },
      '/search/([a-z0-9]{7})': { view: BzDeck.SearchPageView },
      '/settings': { view: BzDeck.SettingsPageView },
    });

    // Bootstrapper
    BzDeck.views.session = new BzDeck.SessionView();
  }
}, { once: true });
