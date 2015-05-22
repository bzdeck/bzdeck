/**
 * BzDeck Bug Panes View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.Bug = function BugView ($bug, bug) {
  this.$bug = $bug;
  this.bug = bug;
  this.id = bug.id;

  this.init();
};

BzDeck.views.Bug.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Bug.prototype.constructor = BzDeck.views.Bug;

BzDeck.views.Bug.prototype.init = function () {
  this.render();

  // Custom scrollbars
  this.scrollbars = new Set([for ($area of this.$bug.querySelectorAll('[role="region"]'))
                                  new this.widget.ScrollBar($area)]);

  this.on('M:AnnotationUpdated', data => {
    if (this.$bug && data.type === 'starred') {
      this.$bug.querySelector('header [role="button"][data-command="star"]').setAttribute('aria-pressed', data.value);
    }
  });

  this.on('M:Updated', data => {
    this.update(data.bug, data.changes);
  });
};

BzDeck.views.Bug.prototype.setup_toolbar = function () {
  let $button = this.$bug.querySelector('[data-command="show-menu"]');

  if (!$button) {
    return;
  }

  new this.widget.Button($button);

  let $timeline = this.$bug.querySelector('.bug-timeline'),
      $menu = document.getElementById($button.getAttribute('aria-owns')),
      $toggle_comments = $menu.querySelector('[id$="--toggle-comments"]'),
      $toggle_cc = $menu.querySelector('[id$="--toggle-cc"]'),
      $bugzilla_link = $menu.querySelector('[data-command="open-bugzilla"]'),
      $tweet_link = $menu.querySelector('[data-command="tweet"]');

  let toggle_cc = value => {
    BzDeck.prefs.set('ui.timeline.show_cc_changes', value);
    document.documentElement.setAttribute('data-ui-timeline-show-cc-changes', String(value));
  };

  let handlers = {
    'show-cc': () => toggle_cc(true),
    'hide-cc': () => toggle_cc(false),
    'expand-comments': () => this.timeline.expand_comments(),
    'collapse-comments': () => this.timeline.collapse_comments(),
  };

  $menu.addEventListener('MenuOpened', event => {
    let collapsed = !!$timeline.querySelectorAll('.read-comments-expander, \
                                                  [itemprop="comment"][aria-expanded="false"]').length,
        cc_shown = !!BzDeck.prefs.get('ui.timeline.show_cc_changes');

    $toggle_comments.setAttribute('aria-disabled', !this.timeline);
    $toggle_comments.setAttribute('data-command', collapsed ? 'expand-comments' : 'collapse-comments');
    $toggle_comments.firstElementChild.textContent = collapsed ? 'Expand All Comments' : 'Collapse All Comments';
    $toggle_cc.setAttribute('aria-disabled', !this.timeline);
    $toggle_cc.setAttribute('data-command', cc_shown ? 'hide-cc': 'show-cc');
    $toggle_cc.firstElementChild.textContent = cc_shown ? 'Hide CC Changes' : 'Show CC Changes';
  });

  $menu.addEventListener('MenuItemSelected', event => (handlers[event.detail.command] || (() => {}))());

  if ($bugzilla_link) {
    $bugzilla_link.href = `${BzDeck.models.server.url}/show_bug.cgi?id=${this.bug.id}&redirect=no`;
  }

  if ($tweet_link) {
    // https://dev.twitter.com/web/tweet-button/web-intent
    let summary = this.bug.summary.substr(0, 80) + (this.bug.summary.length > 80 ? '...' : ''),
        href = 'https://twitter.com/intent/tweet?via=BzDeck'
             + '&text=' + encodeURIComponent(`Bug ${this.bug.id} - ${summary}`)
             + '&url=' + encodeURIComponent(`${location.origin}/bug/${this.bug.id}`);

    $tweet_link.href = href;
  }
};

BzDeck.views.Bug.prototype.render = function () {
  this.$bug.dataset.id = this.bug.id;

  if (!this.bug.summary && !this.bug._update_needed) {
    // The bug is being loaded
    return;
  }

  this.setup_toolbar();

  // TEMP: Add users when a bug is loaded; this should be in the controller
  BzDeck.collections.users.add_from_bug(this.bug);

  let _bug = {};

  for (let { 'id': field, type } of BzDeck.config.grid.default_columns) {
    if (this.bug[field] !== undefined) {
      if (field === 'keywords') {
        _bug.keyword = this.bug.keywords;
      } else if (field === 'mentors') {
        _bug.mentor = [for (name of this.bug.mentors) BzDeck.collections.users.get(name, { name }).properties];
      } else if (type === 'person') {
        if (this.bug[field]) {
          _bug[field] = BzDeck.collections.users.get(this.bug[field], { 'name': this.bug[field] }).properties;
        }
      } else {
        _bug[field] = this.bug[field] || '';
      }
    }
  }

  // Add contributor list
  _bug.contributor = [for (name of this.bug.contributors) BzDeck.collections.users.get(name, { name }).properties];

  this.fill(this.$bug, _bug);

  this.set_product_tooltips();

  let $button = this.$bug.querySelector('[role="button"][data-command="star"]'),
      $timeline = this.$bug.querySelector('.bug-timeline');

  // Star on the header
  if ($button) {
    $button.setAttribute('aria-pressed', this.bug.starred);
    (new this.widget.Button($button)).bind('Pressed', event => this.bug.starred = event.detail.pressed);
  }

  if (!$timeline) {
    return;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.views.statusbar.show('Loading...'); // l10n

  // Empty timeline while keeping the scrollbar
  for (let $comment of $timeline.querySelectorAll('article, [role="form"], .read-comments-expander')) {
    $comment.remove();
  }

  if (this.bug.comments && !this.bug._update_needed) {
    FlareTail.util.event.async(() => this.fill_details(false));
  } else {
    // Load comments, history, flags and attachments' metadata; Exclude metadata
    this.bug.fetch(false).then(bug => {
      this.bug = bug;
      FlareTail.util.event.async(() => this.fill_details(true));
    });
  }

  // Focus management
  let set_focus = shift => {
    let ascending = BzDeck.prefs.get('ui.timeline.sort.order') !== 'descending',
        entries = [...$timeline.querySelectorAll('[itemprop="comment"]')];

    entries = ascending && shift || !ascending && !shift ? entries.reverse() : entries;

    // Focus the first (or last) visible entry
    for (let $_entry of entries) if ($_entry.clientHeight) {
      $_entry.focus();
      $_entry.scrollIntoView({ 'block': ascending ? 'start' : 'end', 'behavior': 'smooth' });

      break;
    }
  };

  // Assign keyboard shortcuts
  if (!$timeline.hasAttribute('keyboard-shortcuts-enabled')) {
    FlareTail.util.kbd.assign($timeline, {
      // Toggle read
      'M': event => this.bug.unread = !this.bug.unread,
      // Toggle star
      'S': event => this.bug.starred = !this.bug.starred,
      // Reply
      'R': event => document.querySelector(`#${$timeline.id}-comment-form [role="textbox"]`).focus(),
      // Focus management
      'PageUp|Shift+Space': event => set_focus(true),
      'PageDown|Space': event => set_focus(false),
    });

    $timeline.setAttribute('keyboard-shortcuts-enabled', 'true');
  }
};

BzDeck.views.Bug.prototype.fill_details = function (delayed) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!this.$bug || Number.parseInt(this.$bug.dataset.id) !== this.bug.id) {
    return;
  }

  let _bug = {
    'cc': [for (name of this.bug.cc) BzDeck.collections.users.get(name, { name }).properties],
    'depends_on': this.bug.depends_on,
    'blocks': this.bug.blocks,
    'see_also': this.bug.see_also,
    'flag': [for (flag of this.bug.flags) {
      'creator': BzDeck.collections.users.get(flag.setter, { 'name': flag.setter }).properties,
      'name': flag.name,
      'status': flag.status
    }]
  };

  if (this.bug.dupe_of) {
    _bug.resolution = `DUPLICATE of ${this.bug.dupe_of}`;
  }

  this.fill(this.$bug, _bug);

  // Depends on & Blocks
  for (let $li of this.$bug.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"]')) {
    $li.setAttribute('data-bug-id', $li.itemValue);

    (new this.widget.Button($li)).bind('Pressed', event =>
      BzDeck.router.navigate('/bug/' + event.target.textContent));
  }

  // See Also
  for (let $link of this.$bug.querySelectorAll('[itemprop="see_also"]')) {
    let re = new RegExp(`^${BzDeck.models.server.url}/show_bug.cgi\\?id=(\\d+)$`.replace(/\./g, '\\.')),
        match = $link.href.match(re);

    if (match) {
      $link.text = match[1];
      $link.setAttribute('data-bug-id', match[1]);
      $link.setAttribute('role', 'button');
    } else {
      $link.text = $link.href;
    }
  }

  // Flags
  let $flags = this.$bug.querySelector('[data-field="flags"]');

  if ($flags) {
    $flags.setAttribute('aria-hidden', !this.bug.flags.length);
  }

  // TODO: Show Project Flags and Tracking Flags

  FlareTail.util.event.async(() => {
    // Timeline: comments, attachments & history
    this.timeline = new BzDeck.views.Timeline(this.bug, this.$bug, delayed);

    // Attachments, only on the details tabs
    if (this.render_attachments) {
      this.render_attachments();
    }

    // History, only on the details tabs
    if (this.render_history) {
      this.render_history();
    }

    // Add tooltips to the related bugs
    this.set_bug_tooltips();

    // Force updating the scrollbars because sometimes those are not automatically updated
    this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height());
  });

  BzDeck.views.statusbar.show('');
};

BzDeck.views.Bug.prototype.set_product_tooltips = function () {
  let config = BzDeck.models.server.data.config,
      strip_tags = str => FlareTail.util.string.strip_tags(str).replace(/\s*\(more\ info\)$/i, ''),
      classification = config.classification[this.bug.classification],
      product = config.product[this.bug.product],
      component,
      $classification = this.$bug.querySelector('[itemprop="classification"]'),
      $product = this.$bug.querySelector('[itemprop="product"]'),
      $component;

  if ($classification && classification) {
    $classification.title = strip_tags(classification.description);
  }

  if (!product) {
    return;
  }

  if ($product) {
    $product.title = strip_tags(product.description);
  }

  component = product.component[this.bug.component];
  $component = this.$bug.querySelector('[itemprop="component"]');

  if ($component && component) {
    $component.title = strip_tags(component.description);
  }
};

BzDeck.views.Bug.prototype.set_bug_tooltips = function () {
  let related_ids = new Set([for ($element of this.$bug.querySelectorAll('[data-bug-id]'))
                             Number.parseInt($element.getAttribute('data-bug-id'))]);

  let set_tooltops = bug => {
    if (bug && bug.summary) {
      let title = `${bug.status} ${bug.resolution || ''} – ${bug.summary}`;

      for (let $element of this.$bug.querySelectorAll(`[data-bug-id="${bug.id}"]`)) {
        $element.title = title;
        $element.dataset.status = bug.status;
        $element.dataset.resolution = bug.resolution || '';
      }
    }
  };

  if (related_ids.size) {
    let bugs = BzDeck.collections.bugs.get_some(related_ids),
        lookup_ids = new Set([for (id of related_ids) if (!bugs.get(id)) id]);

    bugs.forEach(bug => set_tooltops(bug));

    if (lookup_ids.size) {
      BzDeck.collections.bugs.fetch(lookup_ids).then(_bugs => {
        _bugs.forEach(_bug => {
          _bug._unread = true;
          set_tooltops(BzDeck.collections.bugs.get(_bug.id, _bug));
        });
      });
    }
  }
};

BzDeck.views.Bug.prototype.update = function (bug, changes) {
  this.bug = bug;

  let $timeline = this.$bug.querySelector('.bug-timeline');

  if ($timeline) {
    $timeline.querySelector('.comments-wrapper')
             .appendChild(new BzDeck.views.TimelineEntry($timeline.id, this.bug, changes));
    $timeline.querySelector('.comments-wrapper > article:last-of-type')
             .scrollIntoView({ 'block': 'start', 'behavior': 'smooth' });
  }

  if (changes.has('attachment') && this.render_attachments) {
    this.render_attachments([changes.get('attachment')]);
  }

  if (changes.has('history') && this.render_history) {
    let _bug = { 'id': this.bug.id, '_update_needed': true };

    // Prep partial data
    for (let change in changes.get('history').changes) {
      _bug[change.field_name] = this.bug[change.field_name];
    }

    this.fill(_bug, true);
    this.render_history([changes.get('history')]);
  }
};
