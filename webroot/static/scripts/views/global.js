/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Global View that provides some utility functions for views.
 *
 * @constructor
 * @extends BaseView
 * @argument {undefined}
 * @return {Object} view - New GlobalView instance.
 */
BzDeck.views.Global = function GlobalView () {
  let datetime = this.helpers.datetime,
      value,
      theme = BzDeck.prefs.get('ui.theme.selected'),
      $root = document.documentElement;

  // Automatically update relative dates on the app
  datetime.options.updater_enabled = true;

  // Date format
  value = BzDeck.prefs.get('ui.date.relative');
  datetime.options.relative = value !== undefined ? value : true;

  // Date timezone
  value = BzDeck.prefs.get('ui.date.timezone');
  datetime.options.timezone = value || 'local';

  // Timeline: Font
  value = BzDeck.prefs.get('ui.timeline.font.family');
  $root.setAttribute('data-ui-timeline-font-family', value || 'proportional');

  // Timeline: Sort order
  value = BzDeck.prefs.get('ui.timeline.sort.order');
  $root.setAttribute('data-ui-timeline-sort-order', value || 'ascending');

  // Timeline: Changes
  value = BzDeck.prefs.get('ui.timeline.show_cc_changes');
  $root.setAttribute('data-ui-timeline-show-cc-changes', value !== undefined ? value : false);

  // Timeline: Attachments
  value = BzDeck.prefs.get('ui.timeline.display_attachments_inline');
  $root.setAttribute('data-ui-timeline-display-attachments-inline', value !== undefined ? value : true);

  // Change the theme
  if (theme && this.helpers.theme.list.contains(theme)) {
    this.helpers.theme.selected = theme;
  }

  // Preload images from CSS
  this.helpers.theme.preload_images();

  // Update user name & image asynchronously
  this.on('UserModel:UserInfoUpdated', data => {
    let user = BzDeck.collections.users.get(data.name, { name: data.name });

    for (let $email of [...document.querySelectorAll(`[itemprop="email"][content="${CSS.escape(user.email)}"]`)]) {
      let title = `${user.original_name || user.name}\n${user.email}`,
          $person = $email.closest('[itemtype$="User"]'),
          $name = $person.querySelector('[itemprop="name"]'),
          $image = $person.querySelector('[itemprop="image"]');

      if ($person.title && $person.title !== title) {
        $person.title = title;
      }

      if ($name && $name.textContent !== user.name) {
        $name.textContent = user.name;
      }

      if ($image && $image.src !== user.image) {
        $image.src = user.image; // Blob URL
      }
    }
  }, true);

  // General events
  window.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('dragenter', event => event.preventDefault());
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  window.addEventListener('wheel', event => event.preventDefault());
  window.addEventListener('popstate', event => this.onpopstate(event));
  window.addEventListener('click', event => this.onclick(event));
  window.addEventListener('keydown', event => this.onkeydown(event));
};

BzDeck.views.Global.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Global.prototype.constructor = BzDeck.views.Global;

/**
 * Update the document title and statusbar message when the number of unread bugs is changed.
 *
 * @argument {Array.<Proxy>} bugs - All unread bugs in the database.
 * @argument {Boolean} loaded - Whether bug data is loaded at startup.
 * @argument {Number} unread_num - Number of unread bugs currently displayed on the home page.
 * @return {undefined}
 */
BzDeck.views.Global.prototype.toggle_unread = function (bugs, loaded, unread_num) {
  if (document.documentElement.getAttribute('data-current-tab') === 'home') {
    BzDeck.views.pages.home.update_title(document.title.replace(/(\s\(\d+\))?$/, unread_num ? ` (${unread_num})` : ''));
  }

  if (!loaded) {
    return;
  }

  if (bugs.length === 0) {
    BzDeck.views.statusbar.show('No new bugs to download'); // l10n

    return;
  }

  bugs.sort((a, b) => new Date(b.last_change_time) - new Date(a.last_change_time));

  let status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug'; // l10n

  BzDeck.views.statusbar.show(status);
};

/**
 * Update the document title based on the specified tab.
 *
 * @argument {HTMLElement} $tab - Tab to retrieve the label.
 * @return {undefined}
 */
BzDeck.views.Global.prototype.update_window_title = function ($tab) {
  if ($tab.id === 'tab-home') {
    BzDeck.views.pages.home.update_title($tab.title);
  } else {
    document.title = $tab.title.replace('\n', ' – ');
  }
};

/**
 * Called whenever the history state is updated. Hide the Sidebar on mobile.
 *
 * @argument {PopStateEvent} event - The popstate event.
 * @return {undefined}
 */
BzDeck.views.Global.prototype.onpopstate = function (event) {
  if (this.helpers.env.device.mobile) {
    document.documentElement.setAttribute('data-sidebar-hidden', 'true');
    document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
  }
};

/**
 * Called whenever any item is clicked or tapped on the page. If the target element is a button or link, open the
 * relevant content in a new in-app tab or browser tab.
 *
 * @argument {MouseEvent} event - The click event.
 * @return {Boolean} default - Whether the event should lead to the default action.
 */
BzDeck.views.Global.prototype.onclick = function (event) {
  let $target = event.target,
      $parent = $target.parentElement;

  // Discard clicks on the fullscreen dialog
  if ($target === document) {
    return true;
  }

  if ($target.matches('[itemtype$="User"][role="link"]')) {
    this.trigger('GlobalView:OpenProfile', { email: $target.querySelector('[itemprop="email"]').content });

    return this.helpers.event.ignore(event);
  }

  // Support clicks on the avatar image in a comment
  if ($parent && $parent.matches('[itemtype$="User"][role="link"]')) {
    this.trigger('GlobalView:OpenProfile', { email: $parent.querySelector('[itemprop="email"]').content });

    return this.helpers.event.ignore(event);
  }

  if ($target.matches(':-moz-any-link, [role="link"]')) {
    // Bug link: open in a new app tab
    if ($target.hasAttribute('data-bug-id')) {
      this.trigger('GlobalView:OpenBug', { id: Number($target.getAttribute('data-bug-id')) });

      return this.helpers.event.ignore(event);
    }

    // Attachment link: open in a new app tab
    if ($target.hasAttribute('data-att-id')) {
      let $content_type = $target.querySelector('[itemprop="content_type"]'),
          att_id = Number($target.getAttribute('data-att-id')),
          att_type = $content_type ? ($content_type.content || $content_type.textContent) : undefined,
          bug_id = [...BzDeck.collections.bugs.get_all().values()]
                                .find(bug => (bug.attachments || []).some(att => att.id === att_id)).map(bug => bug.id);

      if (att_type && ['text/x-github-pull-request', 'text/x-review-board-request'].includes(att_type)) {
        // Open the link directly in a new browser tab
        window.open(`${BzDeck.models.server.url}/attachment.cgi?id=${att_id}`);
      } else if (!bug_id || (this.helpers.env.device.mobile && window.matchMedia('(max-width: 1023px)').matches)) {
        this.trigger('GlobalView:OpenAttachment', { id: att_id });
      } else {
        this.trigger('GlobalView:OpenBug', { id: bug_id, att_id });
      }

      return this.helpers.event.ignore(event);
    }

    // Normal link: open in a new browser tab
    $target.target = '_blank';

    return false;
  }

  return true;
};

/**
 * Called whenever any key is pressed on desktop. Prevent the browser's built-in keyboard shortcuts being triggered,
 * like Ctrl+F to find in page or Ctrl+S to save the page.
 *
 * @argument {KeyboardEvent} event - The keydown event.
 * @return {undefined}
 */
BzDeck.views.Global.prototype.onkeydown = function (event) {
  let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
      tab = event.key === 'Tab';

  if (!event.target.matches('[role="textbox"], [role="searchbox"]') && !modifiers && !tab) {
    event.preventDefault();
  }
};
