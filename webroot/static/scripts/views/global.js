/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global View that provides some utility functions for views.
 * @extends BzDeck.BaseView
 */
BzDeck.GlobalView = class GlobalView extends BzDeck.BaseView {
  /**
   * Get a GlobalView instance. This should be called after user prefs are loaded.
   * @constructor
   * @returns {GlobalView} New GlobalView instance.
   */
  constructor () {
    super(); // Assign this.id

    const datetime = FlareTail.util.DateTime;
    const $root = document.documentElement;

    // Automatically update relative dates on the app
    datetime.options.updater_enabled = true;

    // Theme
    BzDeck.prefs.get('ui.theme.selected').then(theme => {
      // Change the theme
      if (theme && document.styleSheetSets.contains(theme)) {
        document.selectedStyleSheetSet = theme;
      }
    });

    // Date format
    BzDeck.prefs.get('ui.date.relative').then(value => {
      datetime.options.relative = value !== undefined ? value : true;
    });

    // Date timezone
    BzDeck.prefs.get('ui.date.timezone').then(value => {
      // Map legacy value for backward compatibility
      value = value === 'PST' ? 'America/Los_Angeles' : value;

      datetime.options.timezone = value === 'local' ? undefined : value;
    });

    // Timeline: Font
    BzDeck.prefs.get('ui.timeline.font.family').then(value => {
      $root.setAttribute('data-ui-timeline-font-family', value || 'proportional');
    });

    // Timeline: Sort order
    BzDeck.prefs.get('ui.timeline.sort.order').then(value => {
      $root.setAttribute('data-ui-timeline-sort-order', value || 'ascending');
    });

    // Timeline: Changes
    BzDeck.prefs.get('ui.timeline.show_cc_changes').then(value => {
      $root.setAttribute('data-ui-timeline-show-cc-changes', value !== undefined ? value : false);
    });

    // Update user name & image asynchronously
    this.subscribe('UserModel#GravatarProfileRequested', true);
    this.subscribe('UserModel#UserInfoUpdated', true);
    this.subscribe('P#UnreadBugsChanged');

    // General events
    window.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('dragenter', event => event.preventDefault());
    window.addEventListener('dragover', event => event.preventDefault());
    window.addEventListener('drop', event => event.preventDefault());
    window.addEventListener('wheel', event => event.preventDefault());
    window.addEventListener('popstate', event => this.onpopstate(event));
    window.addEventListener('click', event => this.onclick(event));
    window.addEventListener('keydown', event => this.onkeydown(event));

    // Initiate the corresponding presenter
    this.presenter = BzDeck.presenters.global = new BzDeck.GlobalPresenter(this.id);
  }

  /**
   * Add the Back button to the header of each page, only on mobile.
   * @param {HTMLElement} $parent - Tabpanel that contains the header.
   * @fires GlobalView#BackButtonClicked
   */
  add_back_button ($parent) {
    const $header = $parent.querySelector('header');
    const $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

    if (FlareTail.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
      $button.setAttribute('aria-label', 'Back'); // l10n
      $button.addEventListener('touchstart', event => {
        this.trigger('#BackButtonClicked');

        return FlareTail.util.Events.ignore(event);
      });

      $header.insertAdjacentElement('afterbegin', $button);
    }
  }

  /**
   * Update the document title and statusbar message when the number of unread bugs is changed.
   * @listens GlobalPresenter#ToggleUnread
   * @param {Array.<Number>} bug_ids - IDs of unread bugs.
   * @param {Boolean} loaded - Whether bug data is loaded at startup.
   */
  on_unread_bugs_changed ({ bug_ids, loaded } = {}) {
    const count = bug_ids.length;

    if (document.documentElement.getAttribute('data-current-tab') === 'home') {
      BzDeck.views.pages.home.update_title(
          document.title.replace(/(\s\(\d+\))?$/, count ? ` (${count})` : ''));
    }

    if (!loaded || !BzDeck.views.statusbar) {
      return;
    }

    if (count === 0) {
      BzDeck.views.statusbar.show('No new bugs to download'); // l10n

      return;
    }

    const status = count > 1 ? `You have ${count} unread bugs` : 'You have 1 unread bug'; // l10n

    BzDeck.views.statusbar.show(status);
  }

  /**
   * Update the document title based on the specified tab.
   * @param {HTMLElement} $tab - Tab to retrieve the label.
   */
  update_window_title ($tab) {
    if ($tab.id === 'tab-home') {
      BzDeck.views.pages.home.update_title($tab.title);
    } else {
      document.title = $tab.title.replace('\n', ' – ');
    }
  }

  /**
   * Called whenever the history state is updated. Hide the Navigator on mobile.
   * @param {PopStateEvent} event - The popstate event.
   */
  onpopstate (event) {
    if (FlareTail.env.device.mobile) {
      document.documentElement.setAttribute('data-navigator-hidden', 'true');
      document.querySelector('#navigator').setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Called whenever any item is clicked or tapped on the page. If the target element is a button or link, open the
   * relevant content in a new in-app tab or browser tab.
   * @param {MouseEvent} event - The click event.
   * @fires AnyView#OpeningBugRequested
   * @fires AnyView#OpeningAttachmentRequested
   * @fires AnyView#OpeningProfileRequested
   * @returns {Boolean} Whether the event should lead to the default action.
   */
  onclick (event) {
    const $target = event.target;
    const $parent = $target.parentElement;

    // Discard clicks on the fullscreen dialog
    if ($target === document) {
      return true;
    }

    if ($target.matches('[itemtype$="User"][role="link"]')) {
      this.trigger('AnyView#OpeningProfileRequested', { email: $target.querySelector('[itemprop="email"]').content });

      return FlareTail.util.Events.ignore(event);
    }

    // Support clicks on the avatar image in a comment
    if ($parent && $parent.matches('[itemtype$="User"][role="link"]')) {
      this.trigger('AnyView#OpeningProfileRequested', { email: $parent.querySelector('[itemprop="email"]').content });

      return FlareTail.util.Events.ignore(event);
    }

    if ($target.matches(':any-link, [role="link"]')) {
      if ($target.hasAttribute('data-bug-id')) {
        // Bug link: open in a new app tab
        this.trigger('AnyView#OpeningBugRequested', { id: Number($target.getAttribute('data-bug-id')) });
      } else if ($target.hasAttribute('data-att-id')) {
        // Attachment link: open in a new app tab
        const $content_type = $target.querySelector('[itemprop="content_type"]');
        const att_id = Number($target.getAttribute('data-att-id'));
        const att_type = $content_type ? ($content_type.content || $content_type.textContent) : undefined;

        if (att_type && ['text/x-github-pull-request', 'text/x-review-board-request'].includes(att_type)) {
          // Open the link directly in a new browser tab
          const new_win = window.open();

          new_win.opener = null;
          new_win.location = `${BzDeck.host.origin}/attachment.cgi?id=${att_id}`;
        } else {
          (async () => {
            const bugs = await BzDeck.collections.bugs.get_all();
            const bug_id = [...bugs.values()].find(bug => (bug.attachments || []).some(att => att.id === att_id)).id;

            if (!bug_id || (FlareTail.env.device.mobile && window.matchMedia('(max-width: 1023px)').matches)) {
              this.trigger('AnyView#OpeningAttachmentRequested', { id: att_id });
            } else {
              this.trigger('AnyView#OpeningBugRequested', { id: bug_id, att_id });
            }
          })();
        }
      } else {
        // Normal link: open in a new browser tab
        const new_win = window.open();

        new_win.opener = null;
        new_win.location = $target.href;
      }

      return FlareTail.util.Events.ignore(event);
    }

    return true;
  }

  /**
   * Called whenever any key is pressed on desktop. Prevent the browser's built-in keyboard shortcuts being triggered,
   * like Ctrl+F to find in page or Ctrl+S to save the page.
   * @param {KeyboardEvent} event - The keydown event.
   */
  onkeydown (event) {
    const modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
    const tab = event.key === 'Tab';

    if (!event.target.matches('[role="textbox"], [role="searchbox"]') && !modifiers && !tab) {
      event.preventDefault();
    }
  }

  /**
   * Called whenever a Gravatar profile is required. Retrieve the profile using JSONP because Gravatar doesn't support
   * CORS. Notify UserModel when the profile is ready.
   * @listens UserModel#GravatarProfileRequested
   * @param {String} hash - Hash value of the user's email.
   * @fires GlobalView#GravatarProfileProvided
   */
  async on_gravatar_profile_requested ({ hash } = {}) {
    const notify = profile => this.trigger('#GravatarProfileProvided', { hash, profile });

    try {
      const data = await FlareTail.util.Network.jsonp(`https://secure.gravatar.com/${hash}.json`);

      notify(data.entry[0]);
    } catch (error) {
      notify(undefined);
    }
  }

  /**
   * Called whenever any information of a user is updated. This may happen, for example, when the user's Gravatar is
   * retrieved. Find the user's node on the view and update the displayed information accordingly.
   * @listens UserModel#UserInfoUpdated
   * @param {String} name - Name of the updated person.
   */
  async on_user_info_updated ({ name } = {}) {
    const user = await BzDeck.collections.users.get(name, { name });

    for (const $email of [...document.querySelectorAll(`[itemprop="email"][content="${CSS.escape(user.email)}"]`)]) {
      const title = `${user.original_name || user.name}\n${user.email}`;
      const $person = $email.closest('[itemtype$="User"]');
      const $name = $person.querySelector('[itemprop="name"]');
      const $image = $person.querySelector('[itemprop="image"]');

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
  }
}
