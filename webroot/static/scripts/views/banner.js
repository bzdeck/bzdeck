/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Banner View that represents the global application header, containing the Quick Search bar (currently
 * disabled) and global tabs.
 * @extends BzDeck.BaseView
 */
BzDeck.BannerView = class BannerView extends BzDeck.BaseView {
  /**
   * Get a BannerView instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} view - New BannerView instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.$$tablist = new this.widgets.TabList(document.querySelector('#main-tablist'));
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail));
    this.$$tablist.bind('Opened', event => this.update_tab_count());
    this.$$tablist.bind('Closed', event => this.update_tab_count());
    this.tab_path_map = new Map([['tab-home', '/home/inbox']]);
  }

  /**
   * Open a new global tab and load the relevant tabpanel content. FIXME: Need refactoring (#232).
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
  open_tab (options, controller) {
    let page;
    let page_category = options.page_category;
    let page_id = options.page_id;
    let page_constructor = options.page_constructor;
    let page_constructor_args = options.page_constructor_args || [];
    let pages = BzDeck.views.pages[`${page_category}_list`];
    let tab_id = options.page_category + (page_id ? '-' + page_id : '');
    let tab_label = options.tab_label;
    let tab_desc = options.tab_desc || tab_label;
    let tab_position = options.tab_position || 'last';
    let $tab = document.querySelector(`#tab-${CSS.escape(tab_id)}`);
    let $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(tab_id)}`);

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
  }

  /**
   * Called whenever a global tab is selected.
   * @argument {Object} detail - Event detail.
   * @argument {Array.<HTMLElement>} detail.items - Newly selected nodes.
   * @argument {Array.<HTMLElement>} detail.oldval - Previously selected nodes.
   * @return {undefined}
   */
  on_tab_selected (detail) {
    let { items, oldval } = detail;
    let path = this.tab_path_map.get(items[0].id);
    let prev_tabpanel_id;

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
  }

  /**
   * Called whenever a global tab is opened or closed. Update the data-tab-count attribute on <html>.
   * @argument {undefined}
   * @return {undefined}
   */
  update_tab_count () {
    document.documentElement.setAttribute('data-tab-count', this.$$tablist.view.members.length);
  }

  /**
   * Add the Back button to the header of each page. Only on mobile, and the header is actually not in the global
   * banner.
   * @argument {HTMLElement} $parent - Tabpanel that contains the header.
   * @return {undefined}
   */
  add_back_button ($parent) {
    let $header = $parent.querySelector('header');
    let $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

    if (this.helpers.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
      $button.setAttribute('aria-label', 'Back'); // l10n
      $button.addEventListener('touchstart', event => {
        this.trigger(':BackButtonClicked');

        return this.helpers.event.ignore(event);
      });

      $header.insertBefore($button, $header.firstElementChild);
    }
  }
}
