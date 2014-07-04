/**
 * BzDeck Bug Panes
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

/* ----------------------------------------------------------------------------------------------
 * Bug View
 * ---------------------------------------------------------------------------------------------- */

BzDeck.bug = {};

BzDeck.bug.fill_data = function ($bug, bug, partial = false) {
  $bug.dataset.id = bug.id;

  if (!bug.summary && !bug._update_needed) {
    // The bug is being loaded
    return $bug;
  }

  let _bug = {};

  for (let { id: field, type: type } of BzDeck.options.grid.default_columns) {
    if (bug[field] !== undefined && !field.startsWith('_')) {
      if (field === 'keywords') {
        _bug['keyword'] = bug['keywords'] || [];
      } else {
        _bug[field] = type === 'person' ? { name: bug[field].real_name || bug[field].name || '' }
                                        : bug[field] || '';
      }
    }
  }

  FlareTail.util.content.fill($bug, _bug);

  this.set_product_tooltips($bug, bug);

  let $checkbox = $bug.querySelector('[data-field="_starred"]'),
      $timeline = $bug.querySelector('.bug-timeline');

  if ($checkbox) {
    $checkbox.setAttribute('aria-checked', bug._starred ? 'true' : 'false');
  }

  if (!$timeline) {
    return $bug;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.core.show_status('Loading...'); // l10n

  // Empty timeline while keeping the scrollbar
  if (!partial) {
    for (let $comment of $timeline.querySelectorAll('[itemprop="comment"], [role="form"], \
                                                     .read-comments-expander')) {
      $comment.remove();
    }
  }

  if (bug.comments && !bug._update_needed || partial) {
    this.fill_details($bug, bug, partial, false);
  } else {
    // Load comments, history, flags and attachments' metadata
    BzDeck.core.load_bug_details([bug.id], bug => {
      this.fill_details($bug, bug, false, true);
    });
  }

  return $bug;
};

BzDeck.bug.fill_details = function ($bug, bug, partial, delayed) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!$bug || Number.parseInt($bug.dataset.id) !== bug.id) {
    return;
  }

  let _bug = {
    'cc': [for (cc of bug.cc || []) { name: cc.real_name || cc.name }],
    'depends_on': bug.depends_on || [],
    'blocks': bug.blocks || [],
    'see_also': bug.see_also || '',
    'flag': [for (flag of bug.flags || []) {
      'creator': {
        'name': flag.setter.name
      },
      'name': flag.name,
      'status': flag.status
    }]
  };

  if (bug.dupe_of) {
    _bug.resolution = 'DUPLICATE of ' + bug.dupe_of;
  }

  FlareTail.util.content.fill($bug, _bug);

  // Depends on & Blocks
  for (let $li of $bug.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"]')) {
    $li.setAttribute('data-bug-id', $li.itemValue);

    (new FlareTail.widget.Button($li)).bind('Pressed', event =>
      BzDeck.detailspage = new BzDeck.DetailsPage(Number.parseInt(event.target.textContent)));
  }

  // See Also
  for (let $li of $bug.querySelectorAll('[itemprop="see_also"]')) {
    $li.textContent = $li.getAttribute('href');
  }

  // Flags
  let $flags = $bug.querySelector('[data-field="flags"]');

  if ($flags) {
    $flags.setAttribute('aria-hidden', !bug.flags || !bug.flags.length);
  }

  // TODO: Show Project Flags and Tracking Flags

  if (!partial) {
    // Timeline: comments, attachments & history
    BzDeck.bug.timeline.render(bug, $bug, delayed);

    // Attachments and History, only on the details tabs
    BzDeck.DetailsPage.attachments.render($bug, bug.attachments || []);
    BzDeck.DetailsPage.history.render($bug, bug.history || []);

    // Add tooltips to the related bugs
    this.set_bug_tooltips($bug, bug);
  }

  BzDeck.core.show_status('');
};

BzDeck.bug.set_product_tooltips = function ($bug, bug) {
  let config = BzDeck.data.bugzilla_config,
      strip_tags = str => FlareTail.util.string.strip_tags(str).replace(/\s*\(more\ info\)$/i, ''),
      classification = config.classification[bug.classification],
      product = config.product[bug.product],
      component,
      $classification = $bug.querySelector('[itemprop="classification"]'),
      $product = $bug.querySelector('[itemprop="product"]'),
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

  component = product.component[bug.component];
  $component = $bug.querySelector('[itemprop="component"]');

  if ($component && component) {
    $component.title = strip_tags(component.description);
  }
};

BzDeck.bug.set_bug_tooltips = function ($bug, bug) {
  let related_bug_ids = new Set([for ($element of $bug.querySelectorAll('[data-bug-id]'))
                                Number.parseInt($element.getAttribute('data-bug-id'))]);
  let set_tooltops = bugs => {
    for (let bug of bugs) {
      if (bug.summary) {
        let title = bug.status + ' ' + bug.resolution + ' – ' + bug.summary;

        for (let $element of $bug.querySelectorAll('[data-bug-id="' + bug.id + '"]')) {
          $element.title = title;
          $element.dataset.status = bug.status;
          $element.dataset.resolution = bug.resolution;
        }
      }
    }
  };

  if (related_bug_ids.size) {
    BzDeck.model.get_bugs_by_ids(related_bug_ids, bugs => {
      set_tooltops(bugs);

      let found_bug_ids = new Set([for (bug of bugs) bug.id]),
          lookup_bug_ids = new Set([for (id of related_bug_ids) if (!found_bug_ids.has(id)) id]);

      if (lookup_bug_ids.size) {
        BzDeck.model.fetch_bugs_by_ids(lookup_bug_ids, bugs => set_tooltops(bugs));
      }
    });
  }
};

BzDeck.bug.update = function ($bug, bug, changes) {
  let $timeline = $bug.querySelector('.bug-timeline');

  if ($timeline) {
    let $parent = $timeline.querySelector('section, .scrollable-area-content'),
        $entry = BzDeck.bug.timeline.create_entry($timeline.id, bug, changes),
        sort_desc = BzDeck.data.prefs['ui.timeline.sort.order'] === 'descending';

    $parent.insertBefore($entry, sort_desc ? $timeline.querySelector('[itemprop="comment"]')
                                           : $timeline.querySelector('[role="form"]'));
    $entry.scrollIntoView();
  }

  if (changes.has('attachment') && $bug.querySelector('[data-field="attachments"]')) {
    BzDeck.DetailsPage.attachments.render($bug, [changes.get('attachment')], true);
  }

  if (changes.has('history') && $bug.querySelector('[data-field="history"]')) {
    let _bug = { 'id': bug.id, '_update_needed': true };

    // Prep partial data
    for (let change in changes.get('history').changes) {
      _bug[change.field_name] = bug[change.field_name];
    }

    BzDeck.bug.fill_data($bug, _bug, true);
    BzDeck.DetailsPage.history.render($bug, [changes.get('history')], true);
  }
};

/* ----------------------------------------------------------------------------------------------
 * Timeline
 * ---------------------------------------------------------------------------------------------- */

BzDeck.bug.timeline = {};

BzDeck.bug.timeline.render = function (bug, $bug, delayed) {
  let entries = new Map([for (c of Iterator(bug.comments))
        [c[1].creation_time, new Map([['comment', c[1]], ['comment_number', c[0]]])]]),
      sort_desc = BzDeck.data.prefs['ui.timeline.sort.order'] === 'descending',
      read_entries_num = 0,
      $timeline = $bug.querySelector('.bug-timeline'),
      timeline_id = $timeline.id = $bug.id + '-timeline',
      comment_form = new this.CommentForm(bug, timeline_id),
      $parent = $timeline.querySelector('section, .scrollable-area-content');

  for (let attachment of bug.attachments || []) {
    entries.get(attachment.creation_time).set('attachment', attachment);
  }

  for (let history of bug.history || []) {
    if (entries.has(history.change_time)) {
      entries.get(history.change_time).set('history', history);
    } else {
      entries.set(history.change_time, new Map([['history', history]]));
    }
  }

  for (let [time, data] of entries) {
    data.set('$entry', this.create_entry(timeline_id, bug, data));
  }

  // Sort by time
  entries = [for (entry of entries) { time: entry[0], data: entry[1] }]
    .sort((a, b) => sort_desc ? a.time < b.time : a.time > b.time);

  // Append to the timeline
  for (let entry of entries) {
    let $entry = $parent.appendChild(entry.data.get('$entry'));

    // Collapse read comments
    // If the fill_bug_details function is called after the bug details are fetched,
    // the _last_viewed annotation is already true, so check the delayed argument here
    if (!delayed && bug._last_viewed && bug._last_viewed > (new Date(entry.time)).getTime()) {
      if (!$entry.mozMatchesSelector('[data-changes="cc"][data-nocomment]')) {
        read_entries_num++;
      }

      $entry.setAttribute('data-unread', 'false');
    } else {
      $entry.setAttribute('data-unread', 'true');
    }
  }

  // Show an expander if there are read comments
  if (read_entries_num > 1) {
    let $expander = document.createElement('div');

    $expander.textContent = read_entries_num === 2
                          ? '1 older comment'
                          : '%d older comments'.replace('%d', read_entries_num - 1);
    $expander.className = 'read-comments-expander';
    $expander.tabIndex = 0;
    $expander.setAttribute('role', 'button');
    $expander.addEventListener('click', event => {
      $timeline.removeAttribute('data-hide-read-comments');
      $timeline.focus();
      $expander.remove();
    });
    $timeline.setAttribute('data-hide-read-comments', 'true');

    sort_desc ? $parent.appendChild($expander)
              : $parent.insertBefore($expander, $parent.querySelector('[itemprop="comment"]'));
  }

  // Add a comment form
  $parent.insertBefore(comment_form.$form,
                       sort_desc ? $parent.querySelector('[itemprop="comment"]') : null),

  $parent.scrollTop = 0;
  $timeline.removeAttribute('aria-busy', 'false');
};

BzDeck.bug.timeline.create_entry = function (timeline_id, bug, data) {
  let datetime = FlareTail.util.datetime,
      comment = data.get('comment'),
      attachment = data.get('attachment'),
      history = data.get('history'),
      $entry = document.querySelector('template#timeline-comment').content
                       .cloneNode(true).firstElementChild,
      $author = $entry.querySelector('[itemprop="author"]'),
      $time = $entry.querySelector('[itemprop="datePublished"]'),
      $reply_button = $entry.querySelector('[data-command="reply"]'),
      $comment = $entry.querySelector('[itemprop="text"]'),
      $changes = $entry.querySelector('.changes'),
      $textbox = document.querySelector('#' + timeline_id + '-comment-form [role="textbox"]'),
      $image = new Image();

  $image.addEventListener('load', event =>
    $author.querySelector('[itemprop="image"]').src = $image.src);

  if (comment) {
    let author = comment.creator,
        time = comment.creation_time,
        text = comment.raw_text ||
               (comment.text || '').replace(/^Created\ attachment\ \d+\n.+(?:\n\n)?/m, '');

    $entry.id = timeline_id + '-comment-' + comment.id;
    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $comment.innerHTML = text ? BzDeck.core.parse_comment(text) : '';
    $author.title = $author.querySelector('[itemprop="name"]').itemValue
                  = author.real_name || author.name;
    datetime.fill_element($time, time);

    // Set the user's avatar if author.real_name is the email address
    if (author.real_name && author.real_name.contains('@')) {
      $author.querySelector('[itemprop="email"]').content = author.real_name;
      $image.src = 'https://www.gravatar.com/avatar/' + md5(author.real_name) + '?d=404';
    }

    // Make a quote
    let quote_header = FlareTail.util.string.format('(In reply to {name} from comment #{number})', {
          'name': comment.creator.real_name || comment.creator.name,
          'number': data.get('comment_number')
        }),
        quote_lines = [for (line of text.match(/^$|.{1,78}(?:\b|$)/gm) || []) '> ' + line],
        quote = quote_header + '\n' + quote_lines.join('\n');

    // Activate the Reply button
    $reply_button.addEventListener('click', event => {
      let $tabpanel = document.querySelector('#' + timeline_id + '-comment-form-tabpanel-write'),
          $textbox = document.querySelector('#' + timeline_id + '-comment-form [role="textbox"]');

      $textbox.focus();
      $textbox.value += ($textbox.value ? '\n\n' : '') + quote + '\n\n';
      // Trigger an event to do something. Disable async to make sure the following lines work
      FlareTail.util.event.trigger($textbox, 'input', {}, false);
      // Scroll unti the caret is visible
      $tabpanel.scrollTop = $tabpanel.scrollHeight;
      $entry.scrollIntoView();

      event.stopPropagation();
    });
  } else {
    $entry.dataset.nocomment = true;
    $reply_button.setAttribute('aria-hidden', 'true');
    $comment.remove();
  }

  if (attachment) {
    // TODO: load the attachment data via API
    let url = 'https://bug' + bug.id + '.bugzilla.mozilla.org/attachment.cgi?id=' + attachment.id,
        $attachment = document.querySelector('#timeline-attachment').content
                              .cloneNode(true).firstElementChild,
        $outer = $attachment.querySelector('div'),
        $media,
        load_event = 'load';

    FlareTail.util.content.fill($attachment, {
      'url': '/attachment/' + attachment.id,
      'description': attachment.description,
      'name': attachment.file_name,
      'contentSize': attachment.size,
      'contentUrl': url,
      'encodingFormat': attachment.is_patch ? '' : attachment.content_type
    }, {
      'data-attachment-id': attachment.id
    }),

    $attachment.title = [
      attachment.description,
      attachment.file_name,
      attachment.is_patch ? 'Patch' : attachment.content_type, // l10n
      (attachment.size / 1024).toFixed(2) + ' KB' // l10n
    ].join('\n');

    if (attachment.content_type.startsWith('image/')) {
      $media = document.createElement('img');
      $media.alt = attachment.description;
    }

    if (attachment.content_type.match(/^(audio|video)\//)) {
      $media = document.createElement(RegExp.$1);
      $media.controls = true;
      load_event = 'loadedmetadata';

      if ($media.canPlayType(attachment.content_type) === '') {
        $media = null; // Cannot play the media
      }
    }

    if ($media) {
      $outer.appendChild($media);
      $media.addEventListener(load_event, event => $outer.removeAttribute('aria-busy'));

      if (BzDeck.data.prefs['ui.timeline.display_attachments_inline'] !== false) {
        $outer.setAttribute('aria-busy', 'true');
        $media.src = url;
      }
    } else {
      // TODO: support other attachment types
      $outer.remove();
    }

    $entry.insertBefore($attachment, $changes);
  }

  if (history) {
    let author = history.changer,
        time = history.change_time,
        conf_field = BzDeck.data.bugzilla_config.field;

    let generate_element = (change, how) => {
      let $elm;

      if (['blocks', 'depends_on'].indexOf(change.field_name) > -1) {
        $elm = document.createElement('a');
        $elm.href = '/bug/' + change[how];
        $elm.setAttribute('data-bug-id', change[how]);
      } else {
        $elm = document.createElement('span');
      }

      $elm.setAttribute('data-how', how);
      $elm.textContent = change[how];

      return $elm;
    };

    if (comment) {
      if ($author.title !== author.name) {
        $author.title += '\n' + author.name;
      }
    } else {
      $entry.dataset.time = (new Date(time)).getTime();
      $author.title = $author.querySelector('[itemprop="name"]').itemValue = author.name;
      datetime.fill_element($time, time);
    }

    $entry.dataset.changes = [for (change of history.changes) change.field_name].join(' ');
    $author.querySelector('[itemprop="email"]').content = author.name;

    // Set the user's avatar assuming author.name is the email address
    if (!$image.src) {
      $image.src = 'https://www.gravatar.com/avatar/' + md5(author.name) + '?d=404';
    }

    for (let change of history.changes) {
      let $change = $changes.appendChild(document.createElement('li')),
          _field = conf_field[change.field_name] ||
                   // Bug 909055 - Field name mismatch in history: group vs groups
                   conf_field[change.field_name.replace(/s$/, '')] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change.field_name;

      $change.textContent = _field.description + ': ';
      $change.setAttribute('data-change-field', change.field_name);

      if (change.removed) {
        $change.appendChild(generate_element(change, 'removed'));
      }

      if (change.removed && change.added) {
        $change.appendChild(document.createTextNode(' → '));
      }

      if (change.added) {
        $change.appendChild(generate_element(change, 'added'));
      }
    }
  } else {
    $changes.remove();
  }

  // Mark unread
  $entry.setAttribute('data-unread', 'true');

  // Click to collapse/expand comments
  // TODO: Save the state in DB
  $entry.setAttribute('aria-expanded', 'true');
  $entry.querySelector('header').addEventListener('click', event =>
    $entry.setAttribute('aria-expanded', $entry.getAttribute('aria-expanded') === 'false'));

  return $entry;
};

BzDeck.bug.timeline.handle_keydown = function (event) {
  // this = a binded Scrollbar widget
  let key = event.keyCode,
      modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;

  // [Tab] move focus
  if (key === event.DOM_VK_TAB) {
    return true;
  }

  // [B] previous bug or [F] next bug
  if (document.documentElement.getAttribute('data-current-tab') === 'home' &&
      !modifiers && [event.DOM_VK_B, event.DOM_VK_F].indexOf(key) > -1) {
    let _event = document.createEvent("KeyboardEvent");

    _event.initKeyEvent('keydown', true, true, null, false, false, false, false, key, 0);
    document.querySelector('#home-list').dispatchEvent(_event);
    this.view.$owner.focus();

    return FlareTail.util.event.ignore(event);
  }

  // [M] toggle read or [S] toggle star
  if (!modifiers && [event.DOM_VK_M, event.DOM_VK_S].indexOf(key) > -1) {
    let $parent = this.view.$owner.parentElement,
        bug_id = Number.parseInt($parent.dataset.id || $parent.id.match(/^bug-(\d+)/)[1]);

    BzDeck.model.get_bug_by_id(bug_id, bug => {
      if (key === event.DOM_VK_M) {
        BzDeck.core.toggle_unread(bug_id, !bug._unread);
      }

      if (key === event.DOM_VK_S) {
        BzDeck.core.toggle_star(bug_id, !bug._starred);
      }
    });

    return FlareTail.util.event.ignore(event);
  }

  if (event.currentTarget !== this.view.$owner ||
      [event.DOM_VK_SPACE, event.DOM_VK_PAGE_UP, event.DOM_VK_PAGE_DOWN].indexOf(key) === -1) {
    this.scroll_with_keyboard(event); // Use default handler

    return FlareTail.util.event.ignore(event);
  }

  let shift = key === event.DOM_VK_PAGE_UP || key === event.DOM_VK_SPACE && event.shiftKey,
      $timeline = event.currentTarget,
      comments = [...$timeline.querySelectorAll('[itemprop="comment"]')];

  for (let $comment of shift ? comments.reverse() : comments) {
    if ($comment.clientHeight === 0) {
      continue; // The comment is collapsed
    }

    let top = Math.round($comment.getBoxQuads({ relativeTo: $timeline })[0].bounds.top);

    if (shift && top < 0 || !shift && top > 0) {
      $timeline.scrollTop += top;

      break;
    }
  }

  return FlareTail.util.event.ignore(event);
};

BzDeck.bug.timeline.CommentForm = function (bug, timeline_id) {
  let $fragment = document.querySelector('#timeline-comment-form').content.cloneNode(true);

  // Assign unique IDs first
  for (let attr of ['id', 'aria-controls', 'aria-labelledby']) {
    for (let $element of $fragment.querySelectorAll('[' + attr +']')) {
      $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, timeline_id));
    }
  }

  this.$form = $fragment.firstElementChild;
  this.$tabpanel = this.$form.querySelector('[role="tabpanel"]');
  this.$textbox = this.$form.querySelector('[id$="write"] [role="textbox"]');
  this.$preview_tab = this.$form.querySelector('[id$="tab-preview"]');
  this.$preview = this.$form.querySelector('[id$="preview"] [itemprop="text"]');
  this.$footer = this.$form.querySelector('footer');
  this.$status = this.$form.querySelector('[role="status"]');
  this.$submit = this.$form.querySelector('[data-command="submit"]');

  this.bug = bug;
  this.has_token = () => !!BzDeck.data.account.token;
  this.has_text = () => !!this.$textbox.value.match(/\S/);

  this.$form.addEventListener('wheel', event => event.stopPropagation());

  (new FlareTail.widget.TabList(this.$form.querySelector('[role="tablist"]')))
      .bind('Selected', event => {
    let tab_id = event.detail.items[0].id;

    if (tab_id.endsWith('write')) {
      this.$textbox.focus();
    }

    if (tab_id.endsWith('preview')) {
      this.$preview.innerHTML = BzDeck.core.parse_comment(this.$textbox.value);
    }
  });

  this.$preview_tab.setAttribute('aria-disabled', 'true');

  for (let $tabpanel of this.$form.querySelectorAll('[role="tabpanel"]')) {
    new FlareTail.widget.ScrollBar($tabpanel);
  }

  // Workaround a Firefox bug: the placeholder is not displayed in some cases
  this.$textbox.value = '';

  this.$textbox.addEventListener('keydown', event => {
    event.stopPropagation();

    if (this.has_text() && this.has_token() &&
        event.keyCode === event.DOM_VK_RETURN && (event.metaKey || event.ctrlKey)) {
      this.submit();
    }
  });

  this.$textbox.addEventListener('focus', event =>
    this.$footer.setAttribute('aria-hidden', 'false'));

  this.$textbox.addEventListener('blur', event =>
    this.$footer.setAttribute('aria-hidden', !this.has_text()));

  this.$textbox.addEventListener('input', event => this.oninput());

  this.$submit.addEventListener('click', event => this.submit());

  if (!this.has_token()) {
    this.$status.innerHTML = '<strong>Provide your auth token</strong> to post.';
    this.$status.querySelector('strong').addEventListener('click', event =>
      new BzDeck.SettingsPage());

    window.addEventListener('Account:AuthTokenVerified', event => {
      this.$status.textContent = '';
      this.$submit.setAttribute('aria-disabled', !this.has_text());
    });
  }
};

BzDeck.bug.timeline.CommentForm.prototype.oninput = function () {
  this.$textbox.style.removeProperty('height');
  this.$textbox.style.setProperty('height', this.$textbox.scrollHeight + 'px');
  this.$submit.setAttribute('aria-disabled', !this.has_text() || !this.has_token());
  this.$preview_tab.setAttribute('aria-disabled', !this.has_text());

  if (this.has_token() && this.$status.textContent) {
    this.$status.textContent = '';
  }
};

BzDeck.bug.timeline.CommentForm.prototype.submit = function () {
  let data = JSON.stringify({ text: this.$textbox.value });

  this.$textbox.setAttribute('aria-readonly', 'true');
  this.$submit.setAttribute('aria-disabled', 'true');
  this.$status.textContent = 'Submitting...';

  BzDeck.core.request('POST', 'bug/' + this.bug.id + '/comment', null, data, result => {
    if (result && result.ref) {
      // Comment successfully posted, the timeline will soon be updated via Bugzfeed
      this.$textbox.value = '';
      this.oninput();
    } else {
      // Something went wrong
      this.$submit.setAttribute('aria-disabled', 'false');
      this.$status.textContent = result.message ? 'ERROR: ' + result.message
                                                : 'Failed to post your comment. Try again later.';
    }

    this.$textbox.setAttribute('aria-readonly', 'false');
    this.$textbox.focus();
  }, true); // Enable auth
};

/* ----------------------------------------------------------------------------------------------
 * Bugzilla Push Notifications support
 * https://wiki.mozilla.org/BMO/ChangeNotificationSystem
 * ---------------------------------------------------------------------------------------------- */

BzDeck.bugzfeed = {
  subscription: new Set()
};

BzDeck.bugzfeed.connect = function () {
  let endpoint = BzDeck.options.api.endpoints.websocket;

  if (!endpoint || !navigator.onLine) {
    return;
  }

  this.websocket = new WebSocket(endpoint);

  this.websocket.addEventListener('open', event => {
    if (this.reconnector) {
      window.clearInterval(this.reconnector);
    }

    // Subscribe bugs once (re)connected
    if (this.subscription.size) {
      this.subscribe([...this.subscription]);
    }
  });

  this.websocket.addEventListener('close', event => {
    // Try to reconnect every 30 seconds when unexpectedly disconnected
    if (!(new Set([1000, 1005])).has(event.code)) {
      this.reconnector = window.setInterval(() => this.connect(), 30000);
    }
  });

  this.websocket.addEventListener('message', event => {
    let message = JSON.parse(event.data)

    if (message.command === 'update') {
      this.get_changes(message);
    }
  });
};

BzDeck.bugzfeed.send = function (command, bugs) {
  if (this.websocket.readyState === 1) {
    this.websocket.send(JSON.stringify({ 'command': command, 'bugs': bugs }));
  }
};

BzDeck.bugzfeed.subscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.add(bug);
  }

  this.send('subscribe', bugs);
};

BzDeck.bugzfeed.unsubscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.delete(bug);
  }

  this.send('unsubscribe', bugs);
};

BzDeck.bugzfeed.get_changes = function (message) {
  let api = BzDeck.options.api,
      id = message.bug,
      time = new Date(message.when + (message.when.endsWith('Z') ? '' : 'Z')),
      params = new URLSearchParams();

  params.append('include_fields', [...api.default_fields, ...api.extra_fields].join());
  params.append('exclude_fields', 'attachments.data');

  BzDeck.core.request('GET', 'bug/' + id, params, null, bug => {
    if (!bug || !bug.comments) {
      return;
    }

    let get_change = (field, time_field = 'creation_time') =>
          [for (item of bug[field] || []) if (new Date(item[time_field]) - time === 0) item][0],
        changes = new Map(),
        comment = get_change('comments'),
        attachment = get_change('attachments'),
        history = get_change('history', 'change_time');

    if (comment) {
      changes.set('comment', comment);
    }

    if (attachment) {
      changes.set('attachment', attachment);
    }

    if (history) {
      changes.set('history', history);
    }

    this.save_changes(bug, changes);

    FlareTail.util.event.trigger(window, 'bug:updated', { 'detail': {
      'bug': bug,
      'changes': changes
    }});
  });
};

BzDeck.bugzfeed.save_changes = function (bug, changes) {
  BzDeck.model.get_bug_by_id(bug.id, cache => {
    if (changes.has('comment')) {
      cache.comments.push(changes.get('comment'));
    }

    if (changes.has('attachment')) {
      cache.attachments = cache.attachments || [];
      cache.attachments.push(changes.get('attachment'));
    }

    if (changes.has('history')) {
      cache.history = cache.history || [];
      cache.history.push(changes.get('history'));

      for (let change in changes.get('history').changes) {
        cache[change.field_name] = bug[change.field_name];
      }
    }

    BzDeck.model.save_bug(cache);
  });
};
