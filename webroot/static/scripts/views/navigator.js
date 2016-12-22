/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Navigator View that represents the global application navigator.
 * @extends BzDeck.BaseView
 */
BzDeck.NavigatorView = class NavigatorView extends BzDeck.BaseView {
  /**
   * Get a NavigatorView instance.
   * @constructor
   * @fires NavigatorView#FolderSelected
   * @fires NavigatorView#AppMenuItemSelected
   * @returns {NavigatorView} New NavigatorView instance.
   */
  constructor () {
    super(); // Assign this.id

    const mobile = FlareTail.env.device.mobile;
    const $root = document.documentElement; // <html>
    const $navigator = document.querySelector('#navigator');

    $root.setAttribute('data-navigator-hidden', mobile);
    $navigator.setAttribute('aria-hidden', mobile);

    $navigator.addEventListener('click', event => {
      if (mobile) {
        const hidden = $navigator.getAttribute('aria-hidden') !== 'true';

        $root.setAttribute('data-navigator-hidden', hidden);
        $navigator.setAttribute('aria-hidden', hidden);
      }
    });

    new FlareTail.widgets.ScrollBar($navigator.querySelector('div'));

    this.$folders = document.querySelector('#navigator-folder-list');
    this.$$folders = new FlareTail.widgets.ListBox(this.$folders, BzDeck.config.folders);
    this.$$folders.view.members.forEach($option => {
      $option.setAttribute('aria-label', $option.textContent);
      $option.setAttribute('data-tooltip-position', 'right');
    });
    this.$$folders.bind('Selected', event => this.trigger('#FolderSelected', { id: event.detail.ids[0] }));

    this.on('P#FolderOpened', data => this.open_folder(data));
    this.on('P#UnreadToggled', data => this.toggle_unread(data.number));

    (new FlareTail.widgets.Button(document.querySelector('#main-menu-app-account'))).bind('Pressed', event => {
      this.trigger('#AppMenuItemSelected', { command: 'show-profile' });
    });

    this.$app_menu = document.querySelector('#main-menu-app-menu');
    this.$$app_menu = new FlareTail.widgets.Menu(this.$app_menu);

    this.$app_menu.addEventListener('MenuItemSelected', event => {
      this.trigger('#AppMenuItemSelected', { command: event.detail.command });
    });

    this.$app_menu.addEventListener('MenuClosed', event => {
      // Keep the menu open. Need a better way to handle this
      this.$app_menu.removeAttribute('aria-expanded');

      if (FlareTail.env.device.mobile) {
        // Hide the navigator
        document.documentElement.setAttribute('data-navigator-hidden', 'true');
        document.querySelector('#navigator').setAttribute('aria-hidden', 'true');
      }
    });

    // Subscribe to events
    this.subscribe('P#GravatarProfileFound');

    // Initiate the corresponding presenter
    this.presenter = BzDeck.presenters.navigator = new BzDeck.NavigatorPresenter(this.id);
  }

  /**
   * Open a specified folder by updating the document title and rendering the sidebar thread.
   * @listens NavigatorPresenter#FolderOpened
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @param {Array.<Number>} bug_ids - List of bug IDs to render.
   */
  async open_folder ({ folder_id, bug_ids } = {}) {
    const bugs = await BzDeck.collections.bugs.get_some(bug_ids); // Map
    const sidebar = BzDeck.views.sidebar_list;
    const main = BzDeck.views.main;
    const folder_label = BzDeck.config.folders.find(f => f.data.id === folder_id).label;
    const unread = [...bugs.values()].filter(bug => bug.unread).length;

    main.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
    sidebar.thread.filter ? sidebar.thread.filter(bugs) : sidebar.thread.update(bugs);
    document.querySelector('#sidebar-list-panel > footer').setAttribute('aria-hidden', !!bugs.size);

    // Mobile compact layout
    if (FlareTail.env.device.mobile &&
        main.$$tablist.view.selected[0].id !== 'tab-home') {
      // Select the home tab
      main.$$tablist.view.selected = main.$$tablist.view.members[0];
    }
  }

  /**
   * Show the number of unread bugs on the Inbox option.
   * @listens NavigatorPresenter#UnreadToggled
   * @param {Number} num - Number of unread bugs.
   */
  toggle_unread (num) {
    const $label = document.querySelector('#navigator-folder-inbox label');
    let $num = $label.querySelector('span');

    if (num) {
      $num = $num || $label.appendChild(document.createElement('span'));
      $num.textContent = num;
    } else if ($num) {
      $num.remove();
    }
  }

  /**
   * Set up the account label & avatar.
   * @listens NavigatorPresenter#GravatarProfileFound
   */
  async on_gravatar_profile_found () {
    const user = await BzDeck.collections.users.get(BzDeck.account.data.name);

    this.fill(document.querySelector('#main-menu-app-account label'), user);
    document.querySelector('#navigator-account')
            .style.setProperty('background-image', user.background_image ? `url(${user.background_image})` : 'none');
  }
}
