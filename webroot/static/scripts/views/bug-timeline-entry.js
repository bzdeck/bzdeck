/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Timeline Entry View that represents each entry on the Bug Timeline: such as a comment,
 * comment+attachment, comment+attachment+change(s) or only change(s).
 * @extends BzDeck.BaseView
 */
BzDeck.BugTimelineEntryView = class BugTimelineEntryView extends BzDeck.BaseView {
  /**
   * Get a BugTimelineEntryView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - Proxified BugModel instance.
   * @param {Map.<String, Object>} data - Prepared entry data including the comment, attachment and history (change) if
   *  any.
   * @returns {BugTimelineEntryView} New BugTimelineEntryView instance.
   */
  constructor (id, bug, data) {
    super(id); // Assign this.id

    this.bug = bug;
    this.data = data;
  }

  /**
   * Create a timeline entry.
   * @returns {Promise.<Object>} Object containing the entry fragment and
   *  timestamp.
   */
  async create () {
    const comment = this.data.get('comment');
    const $fragment = new DocumentFragment();

    if (comment) {
      const dup = comment.text.match(/(?:Bug (\d+))? has been marked as a duplicate of (?:Bug (\d+))?\.?/i);

      if (!dup || !dup[1]) {
        const $comment = $fragment.appendChild(await this.create_comment_entry());
        const $comment_body = $comment.querySelector('[itemprop="text"]');

        if (this.data.get('attachment')) {
          $comment_body.insertAdjacentElement('afterend', await this.create_attachment_box());
        }
      }

      if (dup) {
        // Treat duplication comments like history items
        $fragment.appendChild(await this.create_history_entry(comment.creator, comment.creation_time, {
          field_name: dup[1] ? 'duplicates' : 'dupe_of',
          added: dup[1] || dup[2],
          removed: '',
        }, comment));
      }
    }

    if (this.data.get('history')) {
      $fragment.appendChild(await this.create_history_entries());
    }

    return { $outer: $fragment, time: this.data.get('time') };
  }

  /**
   * Create a comment entry that contains the author name/image, timestamp, comment body and Reply button.
   * @fires BugView#CommentSelected
   * @returns {Promise.<HTMLElement>} Generated entry node.
   */
  async create_comment_entry () {
    const click_event_type = FlareTail.env.device.mobile ? 'touchstart' : 'mousedown';
    const comment = this.data.get('comment');
    const time = comment.creation_time;
    const $entry = this.get_template('timeline-comment', `bug-${this.bug.id}-${this.id}-comment-${comment.id}`);
    const $header = $entry.querySelector('header');
    const $author = $entry.querySelector('[itemprop="author"]');
    const $roles = $author.querySelector('.roles');
    const $time = $entry.querySelector('[itemprop="creation_time"]');
    const $tag_list = $entry.querySelector('footer .tags .list');
    const $reply_button = $entry.querySelector('[data-command="reply"]');
    const $comment_body = $entry.querySelector('[itemprop="text"]');

    // The comment.count property is available on Bugzilla 5.0 and later
    // It starts with 0, which is the reporter's comment or description
    const count = isNaN(comment.count) ? this.bug.comments.findIndex(c => c.creation_time === time) : comment.count;

    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $entry.setAttribute('data-comment-count', count);
    $entry.setAttribute('aria-posinset', count + 1);
    $entry.setAttribute('aria-setsize', this.bug.comments.length);
    $entry.querySelector(':not([itemscope]) > [itemprop="name"]')
          .textContent = count > 0 ? `Comment ${count}` : 'Description'; // l10n
    $comment_body.innerHTML = BzDeck.presenters.global.parse_comment(comment.text, !!comment.is_markdown);
    $entry.querySelector('[itemprop="extract"]').textContent = this.bug.get_extract(comment.id);

    // Show tags
    for (const tag of comment.tags) {
      const $tag = document.createElement('div');

      $tag.setAttribute('itemprop', 'tag');
      $tag.textContent = tag;
      $tag_list.appendChild($tag);
    }

    const author = await BzDeck.collections.users.get(comment.creator, { name: comment.creator });

    // Append the comment number to the URL when clicked
    $entry.addEventListener(click_event_type, event => {
      if (!event.target.matches(':any-link')) {
        this.trigger('BugView#CommentSelected', { number: Number(count) });
      }
    });

    const reply = () => {
      const quote_header = `(In reply to ${author.name} from comment #${count})`;
      const quote_lines = comment.text.split(/\n/).map(line => `> ${line}`);
      const quote = [quote_header, ...quote_lines].join('\n');
      const $tabpanel = document.querySelector(`#bug-${this.bug.id}-${this.id}-comment-form-tabpanel-comment`);
      const $textbox = document.querySelector(`#bug-${this.bug.id}-${this.id}-comment-form [role="textbox"]`);

      $textbox.value += `${$textbox.value ? '\n\n' : ''}${quote}\n\n`;
      // Move focus on the textbox. Use async to make sure the event always works
      window.setTimeout(() => $textbox.focus(), 100);
      // Trigger an event to do something. Disable async to make sure the following lines work
      FlareTail.util.Event.trigger($textbox, 'input', {}, false);
      // Scroll to make sure the comment is visible
      $tabpanel.scrollTop = $tabpanel.scrollHeight;
      $entry.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    // Focus management
    const move_focus = async shift => {
      const order = await BzDeck.prefs.get('ui.timeline.sort.order');
      const ascending = order !== 'descending';
      const entries = [...document.querySelectorAll(`#${this.id}-timeline [itemprop="comment"]`)];

      if (!$entry.matches(':focus')) {
        $entry.focus();
        $entry.scrollIntoView({ block: ascending ? 'start' : 'end', behavior: 'smooth' });

        return;
      }

      entries = ascending && shift || !ascending && !shift ? entries.reverse() : entries;
      entries = entries.slice(entries.indexOf($entry) + 1);

      // Focus the next (or previous) visible entry
      for (const $_entry of entries) if ($_entry.clientHeight) {
        $_entry.focus();
        $_entry.scrollIntoView({ block: ascending ? 'start' : 'end', behavior: 'smooth' });

        break;
      }
    };

    // Activate the buttons
    (new FlareTail.widgets.Button($reply_button)).bind('Pressed', event => { reply(); event.stopPropagation(); });

    // Assign keyboard shortcuts
    FlareTail.util.Keybind.assign($entry, {
      R: event => reply(),
      // Collapse/expand the comment
      C: event => this.toggle_expanded($entry),
      // Focus management
      'ArrowUp|PageUp|Shift+Space': event => move_focus(true),
      'ArrowDown|PageDown|Space': event => move_focus(false),
    });

    // The author's role(s)
    {
      const roles = new Set();

      if (author.email === this.bug.creator) {
        roles.add('Reporter'); // l10n
      }

      if (author.email === this.bug.assigned_to) {
        roles.add('Assignee'); // l10n
      }

      if (this.bug.mentors.includes(author.email)) {
        roles.add('Mentor'); // l10n
      }

      if (author.email === this.bug.qa_contact) {
        roles.add('QA'); // l10n
      }

      for (const role of roles) {
        const $role = document.createElement('span');

        $role.setAttribute('itemprop', 'role'); // Not in Schema.org
        $role.textContent = role;
        $roles.appendChild($role);
      }
    }

    $author.title = `${author.original_name || author.name}\n${author.email}`;
    $author.querySelector('[itemprop="name"]').textContent = author.name;
    $author.querySelector('[itemprop="email"]').content = author.email;
    $author.querySelector('[itemprop="image"]').src = author.image;
    FlareTail.util.DateTime.fill_element($time, time);

    // Mark unread
    $entry.setAttribute('data-unread', 'true');

    // Expand the comment first
    this.toggle_expanded($entry, true);

    // Accept custom events to collapse/expand the comment
    $entry.addEventListener('ToggleExpanded', event => this.toggle_expanded($entry, event.detail.expanded));

    // Click the header to collapse/expand the comment
    $header.addEventListener(click_event_type, event => {
      if (event.target === $header) {
        this.toggle_expanded($entry);
      }
    });

    return $entry;
  }

  /**
   * Expand or collapse a comment entry.
   * @param {HTMLElement} $entry - Comment node of interest.
   * @param {Boolean} [expanded] - Whether the comment should be expanded.
   */
  toggle_expanded ($entry, expanded) {
    expanded = expanded !== undefined ? expanded : $entry.getAttribute('aria-expanded') === 'false';
    $entry.setAttribute('aria-expanded', expanded);

    // Disable focus on links and buttons when the comment is collapsed
    const tabindex = expanded ? 0 : -1;

    for (const $link of $entry.querySelectorAll('a, [role="link"], [role="button"]')) {
      $link.tabIndex = tabindex;
    }
  }

  /**
   * Create an Attachment box that will be added to the entry node.
   * @returns {Promise.<HTMLElement>} Rendered attachment item.
   */
  async create_attachment_box () {
    const attachment = await BzDeck.collections.attachments.get(this.data.get('attachment').id);
    const media_type = attachment.content_type.split('/')[0];
    const $attachment = this.get_template('timeline-attachment');
    const $outer = $attachment.querySelector('div');
    let $media;

    this.fill($attachment, {
      summary: attachment.summary,
      content_type: attachment.content_type,
      is_patch: !!attachment.is_patch,
    }, {
      'data-att-id': attachment.id,
    });

    $attachment.title = [
      attachment.summary,
      attachment.file_name,
      attachment.is_patch ? 'Patch' : attachment.content_type, // l10n
      FlareTail.util.Number.format_file_size(attachment.size),
    ].join('\n');

    if (media_type === 'image') {
      $media = document.createElement('img');
      $media.alt = attachment.summary;
    }

    if (media_type === 'audio' || media_type === 'video') {
      $media = document.createElement(media_type);
      $media.controls = true;

      if ($media.canPlayType(attachment.content_type) === '') {
        $media = null; // Cannot play the media
      }
    }

    const load_attachment = async () => {
      $outer.setAttribute('aria-busy', 'true');
      $outer.innerHTML = ''; // l10n

      try {
        const result = await attachment.get_data();

        $media.src = URL.createObjectURL(result.blob);
        $outer.appendChild($media);
      } catch (error) {
        $outer.appendChild(create_button(error.message + ' Click here to reload.')); // l10n
      }

      $outer.removeAttribute('aria-busy');
    };

    const add_placeholder = () => {
      $outer.appendChild(create_button('Click here to load the attachment')); // l10n
    };

    const create_button = str => {
      const $button = document.createElement('span');

      $button.textContent = str;
      $button.tabIndex = 0;
      $button.setAttribute('role', 'button');
      $button.addEventListener('click', event => { load_attachment(); event.stopPropagation(); });

      return $button;
    };

    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        observer.disconnect();
        load_attachment();
      }
    }), { root: document.querySelector(`#bug-${this.bug.id}-${this.id}-timeline`) });

    if ($media) {
      const pref = await BzDeck.prefs.get('ui.timeline.show_attachments');
      const cellular = navigator.connection && navigator.connection.type === 'cellular';

      if (pref === 0 || (pref === 1 && cellular)) {
        add_placeholder();
      } else {
        // Defer loading of the attachment
        observer.observe($outer);
      }
    } else {
      // TODO: support other attachment types
      $outer.remove();
    }

    return $attachment;
  }

  /**
   * Create history entries that show any changes to the bug.
   * @returns {Promise.<DocumentFragment>} Generated entries in a fragment.
   */
  async create_history_entries () {
    const comment = this.data.get('comment');
    const history = this.data.get('history');
    // Clone the objects so that the original data won't be affected
    const changes = history.changes.map(change => Object.assign({}, change))
                                   .filter(change => !['is_confirmed', 'cf_last_resolved'].includes(change.field_name));
    const changer_name = history.who;
    const time = history.when;
    const find_index = field => changes.findIndex(change => change.field_name === field);
    const $fragment = new DocumentFragment();

    // Simplify the change labels by combining several fields
    const combine = (f1, f2, spacer = ' / ') => {
      const f1i = find_index(f1);
      const f2i = find_index(f2);

      if (f1i > -1 && f2i > -1) {
        changes[f1i].added = [changes[f1i].added, changes[f2i].added].join(spacer).trim();
        changes[f1i].removed = [changes[f1i].removed, changes[f2i].removed].join(spacer).trim();
        changes.splice(f2i, 1);
      }
    };

    combine('status', 'resolution', ' ');
    combine('product', 'component');
    combine('severity', 'priority');
    combine('platform', 'op_sys');

    await Promise.all(changes.map(async change => {
      $fragment.appendChild(await this.create_history_entry(changer_name, time, change, comment));
    }));

    return $fragment;
  }

  /**
   * Create a history entry that shows a change to the bug.
   * @param {String} changer_name - Account name of the person who made the change.
   * @param {String} time - Timestamp of the change.
   * @param {Object} change - Change details.
   * @param {Object} [comment] - Comment posted at the same time as the change, if any.
   * @returns {Promise.<HTMLElement>} Rendered change item.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#bug-history Bugzilla API}
   */
  async create_history_entry (changer_name, time, change, comment) {
    const $change = this.get_template('timeline-change');
    const $changer = $change.querySelector('[itemprop="author"]');
    const $time = $change.querySelector('[itemprop="creation_time"]');
    const $how = $change.querySelector('[itemprop="how"]');
    const changer = await BzDeck.collections.users.get(changer_name, { name: changer_name });
    const conf_field = BzDeck.host.data.config.bzapi.field;
    const _field = conf_field[change.field_name] ||
                   // Bug 909055 - Field name mismatch in history: group vs groups
                   conf_field[change.field_name.replace(/s$/, '')] ||
                   // Bug 1078009 - Changes/history now include some wrong field names
                   conf_field[{
                     'flagtypes.name': 'flag',
                     'attachments.description': 'attachment.description',
                     'attachments.filename': 'attachment.file_name',
                     'attachments.ispatch': 'attachment.is_patch',
                     'attachments.isobsolete': 'attachment.is_obsolete',
                     'attachments.isprivate': 'attachment.is_private',
                     'attachments.mimetype': 'attachment.content_type',
                     'duplicates': 'duplicates', // for duplication comments
                     'dupe_of': 'dupe_of', // for duplication comments
                   }[change.field_name]] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change;
    const _field_label = {
      blocks: 'blocked bugs', // l10n
      depends_on: 'dependencies', // l10n
      duplicates: 'duplicates', // for duplication comments, unused
      dupe_of: 'dupe_of', // for duplication comments, unused
    }[change.field_name] || _field.description || _field.field_name;
    let field = `<span data-what="${change.field_name}">` + _field_label + '</span>';

    if (change.field_name.startsWith('cf_')) {
      field += ' flag'; // l10n
    }

    this.fill($changer, changer.properties, {
      title: `${changer.original_name || changer.name}\n${changer.email}`
    });

    $change.setAttribute('data-change-field', change.field_name);
    FlareTail.util.DateTime.fill_element($time, time);

    const _reviews = { added: new Set(), removed: new Set() };
    const _feedbacks = { added: new Set(), removed: new Set() };
    const _needinfos = { added: new Set(), removed: new Set() };

    const find_people = how => {
      for (const item of change[how].split(', ')) {
        const review = item.match(/^review\?\((.*)\)$/);
        const feedback = item.match(/^feedback\?\((.*)\)$/);
        const needinfo = item.match(/^needinfo\?\((.*)\)$/);

        if (review) {
          _reviews[how].add(review[1]);
        }

        if (feedback) {
          _feedbacks[how].add(feedback[1]);
        }

        if (needinfo) {
          _needinfos[how].add(needinfo[1]);
        }
      }
    };

    find_people('added');
    find_people('removed');

    const added_reviews = _reviews.added.size ? this.create_people_array(_reviews.added) : undefined;
    const removed_reviews = _reviews.removed.size ? this.create_people_array(_reviews.removed) : undefined;
    const added_feedbacks = _feedbacks.added.size ? this.create_people_array(_feedbacks.added) : undefined;
    const removed_feedbacks = _feedbacks.removed.size ? this.create_people_array(_feedbacks.removed) : undefined;
    const added_needinfos = _needinfos.added.size ? this.create_people_array(_needinfos.added) : undefined;
    const removed_needinfos = _needinfos.removed.size ? this.create_people_array(_needinfos.removed) : undefined;
    const get_removals = change.removed ?
            this.create_history_change_element(change, 'removed').then($elm => $elm.outerHTML) : undefined;
    const get_additions = change.added ?
            this.create_history_change_element(change, 'added').then($elm => $elm.outerHTML) : undefined;
    const render = str => $how.innerHTML = str;
    const att_id = change.attachment_id;
    const attachment = att_id ? `<a href="/attachment/${att_id}" data-att-id="${att_id}">Attachment ${att_id}</a>`
                              : undefined; // l10n

    // Addition only
    if (!change.removed && change.added) {
      if (_reviews.added.size && att_id) {
        added_reviews.then(reviews => render(`asked ${reviews} to review ${attachment}`)); // l10n
      } else if (_feedbacks.added.size && att_id) {
        added_feedbacks.then(feedbacks =>
            render(`asked ${feedbacks} for feedback on ${attachment}`)); // l10n
      } else if (_needinfos.added.size) {
        added_needinfos.then(needinfos => render(`asked ${needinfos} for information`)); // l10n
      } else if (att_id && change.added === 'review+') {
        render(`approved ${attachment}`); // l10n
      } else if (att_id && change.added === 'review-') {
        render(`rejected ${attachment}`); // l10n
      } else if (att_id && change.added === 'feedback+') {
        render(`gave positive feedback on ${attachment}`); // l10n
      } else if (att_id && change.added === 'feedback-') {
        render(`gave negative feedback on ${attachment}`); // l10n
      } else if (att_id && change.field_name === 'flagtypes.name') {
        get_additions.then(additions => render(`set ${additions} flag to ${attachment}`)); // l10n
      } else if (change.field_name === 'duplicates') {
        // for duplication comments, l10n
        get_additions.then(additions => render(`marked ${additions} as a duplicate of this bug`));
      } else if (change.field_name === 'dupe_of') {
        // for duplication comments, l10n
        get_additions.then(additions => render(`marked this bug as a duplicate of ${additions}`));
      } else if (change.field_name === 'keywords') {
        if (change.added.split(', ').length === 1) {
          get_additions.then(additions => render(`added ${additions} keyword`)); // l10n
        } else {
          get_additions.then(additions => render(`added ${additions} keywords`)); // l10n
        }
      } else if (change.field_name === 'cc' && change.added === changer.email) {
        render(`subscribed to the bug`); // l10n
      } else if (change.field_name === 'status' && change.added === 'REOPENED') {
        render(`reopened the bug`); // l10n
      } else if (change.field_name === 'resolution' && change.added === 'FIXED') {
        render(`marked the bug <strong>${change.added}</strong>`); // l10n
      } else {
        get_additions.then(additions => render(`added ${additions} to ${field}`)); // l10n
      }
    }

    // Removal only
    if (change.removed && !change.added) {
      if (att_id && _reviews.removed.size) {
        removed_reviews.then(reviews => render(`canceled ${attachment} review by ${reviews}`)); // l10n
      } else if (att_id && _feedbacks.removed.size) {
        removed_feedbacks.then(feedbacks =>
            render(`canceled ${attachment} feedback by ${feedbacks}`)); // l10n
      } else if (_needinfos.removed.size) {
        removed_needinfos.then(needinfos => {
          if (!comment) {
            render(`canceled information request from ${needinfos}`); // l10n
          } else if (_needinfos.removed.size === 1 && _needinfos.removed.has(changer.email)) {
            render(`provided information`); // l10n
          } else {
            render(`provided information on behalf of ${needinfos}`); // l10n
          }
        });
      } else if (att_id && change.field_name === 'flagtypes.name') {
        get_removals.then(removals => render(`removed ${removals} flag from ${attachment}`)); // l10n
      } else if (change.field_name === 'keywords') {
        if (change.removed.split(', ').length === 1) {
          get_removals.then(removals => render(`removed ${removals} keyword`)); // l10n
        } else {
          get_removals.then(removals => render(`removed ${removals} keywords`)); // l10n
        }
      } else if (change.field_name === 'cc' && change.removed === changer.email) {
        render(`unsubscribed from the bug`); // l10n
      } else {
        get_removals.then(removals => render(`removed ${removals} from ${field}`)); // l10n
      }
    }

    // Removal + Addition
    if (change.removed && change.added) {
      if ((['priority', 'target_milestone'].includes(change.field_name) || change.field_name.startsWith('cf_')) &&
          change.removed.startsWith('--')) {
        get_additions.then(additions => render(`set ${field} to ${additions}`)); // l10n
      } else if (att_id && change.added === 'review+' && _reviews.removed.size) {
        if (_reviews.removed.size === 1 && _reviews.removed.has(changer.email)) {
          render(`approved ${attachment}`); // l10n
        } else {
          removed_reviews.then(reviews => render(`approved ${attachment} on behalf of ${reviews}`)); // l10n
        }
      } else if (att_id && change.added === 'review-' && _reviews.removed.size) {
        if (_reviews.removed.size === 1 && _reviews.removed.has(changer.email)) {
          render(`rejected ${attachment}`); // l10n
        } else {
          removed_reviews.then(reviews => render(`rejected ${attachment} on behalf of ${reviews}`)); // l10n
        }
      } else if (att_id && _reviews.removed.size) {
        Promise.all([removed_reviews, added_reviews]).then(([removed, added]) =>
            render(`changed ${attachment} reviewer from ${added || 'nobody'} to ${removed || 'nobody'}`));
      } else if (att_id && change.added === 'feedback+' && _feedbacks.removed.size) {
        if (_feedbacks.removed.size === 1 && _feedbacks.removed.has(changer.email)) {
          render(`gave positive feedback on ${attachment}`); // l10n
        } else {
          removed_feedbacks.then(feedbacks =>
              render(`gave positive feedback on ${attachment} on behalf of ${feedbacks}`)); // l10n
        }
      } else if (att_id && change.added === 'feedback-' && _feedbacks.removed.size) {
        if (_feedbacks.removed.size === 1 && _feedbacks.removed.has(changer.email)) {
          render(`gave negative feedback on ${attachment}`); // l10n
        } else {
          removed_feedbacks.then(feedbacks =>
              render(`gave negative feedback on ${attachment} on behalf of ${feedbacks}`)); // l10n
        }
      } else if (att_id && change.field_name === 'flagtypes.name') {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed ${attachment} flag: ${removed} → ${added}`)); // l10n
      } else if (change.field_name.match(/^attachments?\.description$/)) {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed ${attachment} description: ${removed} → ${added}`)); // l10n
      } else if (change.field_name.match(/^attachments?\.file_?name$/)) {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed ${attachment} filename: ${removed} → ${added}`)); // l10n
      } else if (change.field_name.match(/^attachments?\.is_?patch$/)) {
        if (change.added === '1') {
          render(`marked ${attachment} as patch`); // l10n
        } else {
          render(`unmarked ${attachment} as patch`); // l10n
        }
      } else if (change.field_name.match(/^attachments?\.is_?obsolete$/)) {
        if (change.added === '1') {
          render(`marked ${attachment} as obsolete`); // l10n
        } else {
          render(`unmarked ${attachment} as obsolete`); // l10n
        }
      } else if (_needinfos.removed.size) {
        Promise.all([removed_needinfos, added_needinfos]).then(([removed, added]) =>
            render(`asked ${removed} for information instead of ${added}`)); // l10n
      } else if (change.field_name === 'assigned_to' && change.removed.match(/^(nobody@.+|.+@bugzilla\.bugs)$/)) {
        // TODO: nobody@mozilla.org and *@bugzilla.bugs are the default assignees on BMO. It might be different on
        // other Bugzilla instances. The API should provide the info...
        if (change.added === changer.email) {
          render(`self-assigned to the bug`); // l10n
        } else {
          get_additions.then(additions => render(`assigned ${additions} to the bug`)); // l10n
        }
      } else if (change.field_name === 'assigned_to' && change.added.match(/^(nobody@.+|.+@bugzilla\.bugs)$/)) {
        get_removals.then(removals => render(`removed ${removals} from the assignee`)); // l10n
      } else if (change.field_name === 'keywords') {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed the keywords: removed ${removed}, added ${added}`)); // l10n
      } else if (change.field_name === 'blocks') {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed the blocked bugs: removed ${removed}, added ${added}`)); // l10n
      } else if (change.field_name === 'depends_on') {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed the dependencies: removed ${removed}, added ${added}`)); // l10n
      } else {
        Promise.all([get_removals, get_additions]).then(([removed, added]) =>
            render(`changed ${field}: ${removed} → ${added}`)); // l10n
      }
    }

    return $change;
  }

  /**
   * Render one or more users in a pretty way, showing the avatar and real name and joining with a comma and "and".
   * @param {Set.<String>} set - List of user account names.
   * @returns {Promise.<String>} Rendered HTML string.
   */
  async create_people_array (set) {
    const people = await Promise.all([...set].map(name => BzDeck.collections.users.get(name, { name })));
    const array = people.map(person => {
      const title = `${person.original_name || person.name}\n${person.email}`;
      const $person = this.fill(this.get_template('person-with-image'), person.properties, { title });

      return $person.outerHTML;
    });

    const last = array.pop();

    return array.length ? array.join(', ') + ' and ' + last : last; // l10n
  }

  /**
   * Render a history change in a pretty way, converting Bug IDs to in-app links.
   * @param {Object} change - Change details.
   * @param {String} how - How the change was made: 'added' or 'removed'.
   * @returns {Promise.<HTMLElement>} Rendered element.
   */
  async create_history_change_element (change, how) {
    const $elm = document.createElement('span');
    const render = str => $elm.innerHTML = str;

    $elm.setAttribute('data-how', how);

    if (['assigned_to', 'qa_contact', 'mentors', 'cc'].includes(change.field_name)) {
      render(await this.create_people_array(change[how].split(', ')));
    } else if (['blocks', 'depends_on', 'duplicates', 'dupe_of'].includes(change.field_name)) {
      if (change[how].split(', ').length > 1) {
        render('Bug ' + change[how].replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>')); // l10n
      } else {
        render(change[how].replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">Bug $1</a>')); // l10n
      }
    } else if (change.field_name === 'url') {
      render(`<a href="${change[how]}">${change[how]}</a>`);
    } else if (change.field_name === 'see_also') {
      render(change[how].split(', ').map(url => {
        const prefix = BzDeck.host.origin + '/show_bug.cgi?id=';
        const bug_id = url.startsWith(prefix) ? Number(url.substr(prefix.length)) : undefined;

        if (bug_id) {
          return `<a href="/bug/${bug_id}" data-bug-id="${bug_id}">Bug ${bug_id}</a>`;
        }

        return `<a href="${url}">${url}</a>`;
      }).join(', '));
    } else {
      render(FlareTail.util.Array.join(change[how].split(', '), how === 'added' ? 'strong' : 'span'));
    }

    return $elm;
  }
}
