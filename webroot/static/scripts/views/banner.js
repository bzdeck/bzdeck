/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Banner View that represents the global application header, containing the Quick Search bar, global
 * tabs and application menu.
 *
 * @constructor
 * @extends BaseView
 * @argument {Proxy} user - UserModel instance of the application user.
 * @return {Object} view - New BannerView instance.
 */
BzDeck.views.Banner = function BannerView (user) {
  this.$$tablist = new this.widgets.TabList(document.querySelector('#main-tablist'));
  this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail));
  this.tab_path_map = new Map([['tab-home', '/home/inbox']]);

  // Make the logo clickable
  this.$logo = document.querySelector('[role="banner"] h1');
  this.$logo.addEventListener('mousedown', event => this.trigger(':LogoClicked'));

  this.$$menu = new this.widgets.MenuBar(document.querySelector('#main-menu'));
  this.$app_menu = document.querySelector('#main-menu--app-menu');

  this.$app_menu.addEventListener('MenuItemSelected', event => {
    this.trigger(':AppMenuItemSelected', { command: event.detail.command });
  });

  if (this.helpers.env.device.mobile) {
    this.apply_mobile_layout();
  }

  if (this.helpers.app.fullscreen_enabled) {
    this.activate_fullscreen_menuitem();
  }

  // Show the Quit menu item if the app runs on WebAppRT
  if (!window.locationbar.visible) {
    document.querySelector('#main-menu--app--quit').removeAttribute('aria-hidden');
  }

  this.setup_account_label(user);
  this.setup_app_install_menuitem();
  this.setup_throbber();
};

BzDeck.views.Banner.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Banner.prototype.constructor = BzDeck.views.Banner;

/**
 * Switch to the mobile layout.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.apply_mobile_layout = function () {
  document.querySelector('#sidebar-account').appendChild(document.querySelector('#main-menu--app--account'));
  document.querySelector('#sidebar-menu').appendChild(this.$app_menu);
  document.querySelector('#tabpanel-home [role="toolbar"]').appendChild(document.querySelector('#quicksearch'));
  document.querySelector('#tabpanel-home [role="toolbar"]').appendChild(document.querySelector('#toolbar-buttons'));
  this.$app_menu.setAttribute('aria-expanded', 'true');

  this.$app_menu.addEventListener('MenuClosed', event => {
    // Keep the menu open
    this.$app_menu.removeAttribute('aria-expanded');
    // Hide the sidebar
    document.documentElement.setAttribute('data-sidebar-hidden', 'true');
    document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
  });
};

/**
 * Activate the fullscreen menu item.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.activate_fullscreen_menuitem = function () {
  let $menuitem = document.querySelector('#main-menu--app--fullscreen'),
      $label = $menuitem.querySelector('label');

  let toggle = () => {
    document.mozFullScreenElement ? document.mozCancelFullScreen() : document.body.mozRequestFullScreen();
  };

  $menuitem.removeAttribute('aria-hidden');

  // A workaround for Bug 779324
  $menuitem.addEventListener('mousedown', event => toggle());
  this.helpers.kbd.assign($menuitem, { Enter: event => toggle() });

  window.addEventListener('mozfullscreenchange', event => {
    $label.textContent = document.mozFullScreenElement ? 'Exit Full Screen' : 'Enter Full Screen'; // l10n
  });
};

/**
 * Set up the account label & avatar.
 *
 * @argument {Object} user - User info.
 * @argument {String} user.name - User's full name.
 * @argument {String} user.email - User's email address.
 * @argument {String} user.image - User's avatar image URL.
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.setup_account_label = function (user) {
  let $menu_label = document.querySelector('#main-menu--app label'),
      $account_label = document.querySelector('#main-menu--app--account label');

  $account_label.innerHTML = `<strong>${user.name}</strong><br>${user.email}`;
  $account_label.style['background-image'] = $menu_label.style['background-image'] = `url(${user.image})`;

  this.on('C:GravatarProfileFound', data => {
    document.querySelector('#sidebar-account').style['background-image'] = data.style['background-image'];
  });
};

/**
 * Set up the app install menu item.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.setup_app_install_menuitem = function () {
  let $menuitem = document.querySelector('#main-menu--app--install');

  this.on('AppInstalled', () => $menuitem.setAttribute('aria-disabled', 'true'), true);
  this.helpers.app.can_install().then(() => $menuitem.removeAttribute('aria-hidden')).catch(error => {});
};

/**
 * Set up the activity indicator or "throbber" displayed while loading bugs.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.setup_throbber = function () {
  let $throbber = document.querySelector('#throbber');

  this.on('SubscriptionCollection:FetchingSubscriptionsStarted', () => $throbber.textContent = 'Loading...', true);
  this.on('SubscriptionCollection:FetchingSubscriptionsComplete', () => $throbber.textContent = '', true);
};

/**
 * Open a new global tab and load the relevant tabpanel content. FIXME: Need refactoring (#232).
 *
 * @argument {Object} options - Defining tab details.
 * @argument {String} options.page_category - Category of the tabpanel content, such as 'details' or 'settings'.
 * @argument {(String|Number)} options.page_id - Unique identifier for the tab. Can be generated with Date.now().
 * @argument {Object} options.page_constructor - View constructor for the tabpanel content.
 * @argument {Array} [options.page_constructor_args] - Arguments used to create a new View instance.
 * @argument {String} options.tab_label - Text displayed on the label
 * @argument {String} [options.tab_desc] - Optional text displayed as the tooltip of the tab.
 * @argument {String} [options.tab_position] - Where to show the tab: 'next' or 'last' (default).
 * @argument {Object} controller - Controller instance that requests the tab.
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.open_tab = function (options, controller) {
  let page,
      page_category = options.page_category,
      page_id = options.page_id,
      page_constructor = options.page_constructor,
      page_constructor_args = options.page_constructor_args || [],
      pages = BzDeck.views.pages[`${page_category}_list`],
      tab_id = options.page_category + (page_id ? '-' + page_id : ''),
      tab_label = options.tab_label,
      tab_desc = options.tab_desc || tab_label,
      tab_position = options.tab_position || 'last',
      $tab = document.querySelector(`#tab-${CSS.escape(tab_id)}`),
      $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(tab_id)}`);

  if (!pages) {
    pages = BzDeck.views.pages[`${page_category}_list`] = new Map();
  }

  // Reuse a tabpanel if possible
  if ($tabpanel) {
    page = pages.get(page_id || 'default');
    $tab = $tab || this.$$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
  } else {
    $tabpanel = this.get_template(`tabpanel-${page_category}-template`, page_id);
    $tab = this.$$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
    page = controller.view = new page_constructor(...page_constructor_args);
    page.controller = controller;
    pages.set(page_id || 'default', page);

    // Prepare the Back button on the mobile banner
    this.add_back_button($tabpanel);
  }

  this.$$tablist.view.selected = this.$$tablist.view.$focused = $tab
  $tabpanel.focus();

  BzDeck.views.global.update_window_title($tab);
  BzDeck.views.pages[page_category] = page;
  this.tab_path_map.set($tab.id, location.pathname + location.search);
};

/**
 * Called whenever a global tab is selected.
 *
 * @argument {Object} detail - Event detail.
 * @argument {Array.<HTMLElement>} detail.items - Newly selected nodes.
 * @argument {Array.<HTMLElement>} detail.oldval - Previously selected nodes.
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.on_tab_selected = function (detail) {
  let { items, oldval } = detail,
      path = this.tab_path_map.get(items[0].id),
      prev_tabpanel_id;

  document.documentElement.setAttribute('data-current-tab', path.match(/^\/(\w+)/)[1]);

  // Do not apply transition to the previous tabpanel. This is a tricky part!
  if (!path.startsWith('/home/') && history.state && oldval.length &&
      history.state.previous === this.tab_path_map.get(oldval[0].id)) {
    prev_tabpanel_id = oldval[0].id.replace(/^tab-/, 'tabpanel-');
  }

  for (let $tabpanel of document.querySelectorAll('#main-tabpanels > [role="tabpanel"]')) {
    if ($tabpanel.id === prev_tabpanel_id) {
      $tabpanel.classList.add('fixed');
    } else {
      $tabpanel.classList.remove('fixed');
    }
  }

  this.trigger(':TabSelected', { path });
};

/**
 * Add the Back button to the header of each page. Only on mobile, and the header is actually not in the global banner.
 *
 * @argument {HTMLElement} $parent - Tabpanel that contains the header.
 * @return {undefined}
 */
BzDeck.views.Banner.prototype.add_back_button = function ($parent) {
  let $header = $parent.querySelector('header'),
      $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

  if (this.helpers.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
    $button.setAttribute('aria-label', 'Back'); // l10n
    $button.addEventListener('touchstart', event => {
      this.trigger(':BackButtonClicked');

      return this.helpers.event.ignore(event);
    });

    $header.insertBefore($button, $header.firstElementChild);
  }
};
