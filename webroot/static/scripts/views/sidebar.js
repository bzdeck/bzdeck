/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar View that represents the global application sidebar.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarView = class SidebarView extends BzDeck.BaseView {
  /**
   * Get a SidebarView instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} view - New SidebarView instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    let mobile = this.helpers.env.device.mobile,
        $root = document.documentElement, // <html>
        $sidebar = document.querySelector('#sidebar');

    $root.setAttribute('data-sidebar-hidden', mobile);
    $sidebar.setAttribute('aria-hidden', mobile);

    $sidebar.addEventListener('click', event => {
      if (mobile) {
        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

        $root.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);
      }
    });

    new FlareTail.widgets.ScrollBar($sidebar.querySelector('div'));

    this.$$folders = new FlareTail.widgets.ListBox(document.querySelector('#sidebar-folder-list'), BzDeck.config.folders);
    this.$$folders.bind('Selected', event => this.trigger(':FolderSelected', { id: event.detail.ids[0] }));

    this.on('C:FolderOpened', data => this.open_folder(data.folder_id, data.bugs));
    this.on('C:UnreadToggled', data => this.toggle_unread(data.number));
  };

  /**
   * Open a specified folder by updating the document title and rendering the home page thread.
   *
   * @argument {String} folder_id - One of the folder identifiers defined in the app config.
   * @argument {Map.<Number, Proxy>} bugs - List of bugs to render.
   * @return {undefined}
   */
  open_folder (folder_id, bugs) {
    let home = BzDeck.views.pages.home,
        toolbar = BzDeck.views.banner,
        folder_label = BzDeck.config.folders.find(f => f.data.id === folder_id).label,
        unread = [...bugs.values()].filter(bug => bug.unread).length;

    home.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
    home.thread.filter ? home.thread.filter(bugs) : home.thread.update(bugs);
    document.querySelector('#home-list-pane > footer').setAttribute('aria-hidden', !!bugs.size);

    // Mobile compact layout
    if (this.helpers.env.device.mobile &&
        toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
      // Select the home tab
      toolbar.$$tablist.view.selected = toolbar.$$tablist.view.members[0];
    }
  }

  /**
   * Show the number of unread bugs on the Inbox option.
   *
   * @argument {Number} num - Number of unread bugs.
   * @return {undefined}
   */
  toggle_unread (num) {
    let $label = document.querySelector('#sidebar-folders--inbox label'),
        $num = $label.querySelector('span');

    if (num) {
      $num = $num || $label.appendChild(document.createElement('span'));
      $num.textContent = num;
    } else if ($num) {
      $num.remove();
    }
  }
}
