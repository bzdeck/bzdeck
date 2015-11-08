/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.BugTimelineEntry = function BugTimelineEntryView (view_id, bug, data) {
  let click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown',
      comment = data.get('comment'),
      $fragment = new DocumentFragment(),
      $comment;

  this.id = view_id;
  this.bug = bug;
  this.data = data;

  if (comment) {
    let dup = comment.text.match(/(?:Bug (\d+))? has been marked as a duplicate of (?:Bug (\d+))?\.?/i);

    if (!dup || !dup[1]) {
      $comment = $fragment.appendChild(this.create_comment_entry());
    }

    if (dup) {
      // Treat duplication comments like history items
      $fragment.appendChild(this.create_history_entry(comment.creator, comment.creation_time, {
        field_name: dup[1] ? 'duplicates' : 'dupe_of',
        added: dup[1] || dup[2],
        removed: '',
      }, comment));
    }
  }

  if (data.get('attachment')) {
    $comment.appendChild(this.create_attachment_box());
  }

  if (data.get('history')) {
    $fragment.appendChild(this.create_history_entries());
  }

  return $fragment;
};

BzDeck.views.BugTimelineEntry.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugTimelineEntry.prototype.constructor = BzDeck.views.BugTimelineEntry;

BzDeck.views.BugTimelineEntry.prototype.create_comment_entry = function () {
  let click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown',
      comment = this.data.get('comment'),
      author = BzDeck.collections.users.get(comment.creator, { name: comment.creator }),
      time = comment.creation_time,
      text = comment.raw_text,
      $entry = this.get_template('timeline-comment'),
      $header = $entry.querySelector('header'),
      $author = $entry.querySelector('[itemprop="author"]'),
      $roles = $author.querySelector('.roles'),
      $time = $entry.querySelector('[itemprop="creation_time"]'),
      $reply_button = $entry.querySelector('[data-command="reply"]'),
      $comment_body = $entry.querySelector('[itemprop="text"]'),
      $textbox = document.querySelector(`#${this.id}-comment-form [role="textbox"]`);

  comment.number = this.data.get('comment_number');
  $entry.id = `${this.id}-comment-${comment.id}`;
  $entry.dataset.id = comment.id;
  $entry.dataset.time = (new Date(time)).getTime();
  $entry.setAttribute('data-comment-number', comment.number);
  $entry.querySelector(':not([itemscope]) > [itemprop="name"]').textContent = `Comment ${comment.number}`; // l10n
  $comment_body.innerHTML = text ? BzDeck.controllers.global.parse_comment(text) : '';

  // Append the comment number to the URL when clicked
  $entry.addEventListener(click_event_type, event => {
    if (location.pathname.startsWith('/bug/') && !event.target.matches(':-moz-any-link')) {
      window.history.replaceState({}, document.title, `${location.pathname}#c${comment.number}`);
    }
  });

  let reply = () => {
    let quote_header = `(In reply to ${author.name} from comment #${comment.number})`,
        quote_lines = (text.match(/^$|.{1,78}(?:\b|$)/gm) || []).map(line => `> ${line}`),
        quote = `${quote_header}\n${quote_lines.join('\n')}`,
        $tabpanel = document.querySelector(`#${this.id}-comment-form-tabpanel-comment`),
        $textbox = document.querySelector(`#${this.id}-comment-form [role="textbox"]`);

    $textbox.value += `${$textbox.value ? '\n\n' : ''}${quote}\n\n`;
    // Move focus on the textbox. Use async to make sure the event always works
    this.helpers.event.async(() => $textbox.focus());
    // Trigger an event to do something. Disable async to make sure the following lines work
    this.helpers.event.trigger($textbox, 'input', {}, false);
    // Scroll to make sure the comment is visible
    $tabpanel.scrollTop = $tabpanel.scrollHeight;
    $entry.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // Collapse/expand the comment
  let collapse_comment = () => $entry.setAttribute('aria-expanded', $entry.getAttribute('aria-expanded') === 'false');

  // Focus management
  let move_focus = shift => {
    if (!$entry.matches(':focus')) {
      $entry.focus();
      $entry.scrollIntoView({ block: ascending ? 'start' : 'end', behavior: 'smooth' });

      return;
    }

    let ascending = BzDeck.prefs.get('ui.timeline.sort.order') !== 'descending',
        entries = [...document.querySelectorAll(`#${this.id}-timeline [itemprop="comment"]`)];

    entries = ascending && shift || !ascending && !shift ? entries.reverse() : entries;
    entries = entries.slice(entries.indexOf($entry) + 1);

    // Focus the next (or previous) visible entry
    for (let $_entry of entries) if ($_entry.clientHeight) {
      $_entry.focus();
      $_entry.scrollIntoView({ block: ascending ? 'start' : 'end', behavior: 'smooth' });

      break;
    }
  };

  // Activate the buttons
  $reply_button.addEventListener(click_event_type, event => { reply(); event.stopPropagation(); });

  // Assign keyboard shortcuts
  this.helpers.kbd.assign($entry, {
    R: event => reply(),
    // Collapse/expand the comment
    C: event => collapse_comment(),
    // Focus management
    'ArrowUp|PageUp|Shift+Space': event => move_focus(true),
    'ArrowDown|PageDown|Space': event => move_focus(false),
  });

  // The author's role(s)
  {
    let roles = new Set();

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

    for (let role of roles) {
      let $role = document.createElement('span');

      $role.setAttribute('itemprop', 'role'); // Not in Schema.org
      $role.textContent = role;
      $roles.appendChild($role);
    }
  }

  $author.title = `${author.original_name || author.name}\n${author.email}`;
  $author.querySelector('[itemprop="name"]').textContent = author.name;
  $author.querySelector('[itemprop="email"]').content = author.email;
  $author.querySelector('[itemprop="image"]').src = author.image;
  this.helpers.datetime.fill_element($time, time);

  // Mark unread
  $entry.setAttribute('data-unread', 'true');

  // Click the header to collapse/expand the comment
  // TODO: Save the state in DB
  $entry.setAttribute('aria-expanded', 'true');
  $header.addEventListener(click_event_type, event => {
    if (event.target === $header) {
      collapse_comment();
    }
  });

  return $entry;
};

BzDeck.views.BugTimelineEntry.prototype.create_attachment_box = function () {
  let attachment = BzDeck.collections.attachments.get(this.data.get('attachment').id),
      media_type = attachment.content_type.split('/')[0],
      $attachment = this.get_template('timeline-attachment'),
      $outer = $attachment.querySelector('div'),
      $media;

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
    `${(attachment.size / 1024).toFixed(2)} KB` // l10n
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

  if ($media) {
    $outer.appendChild($media);

    if (BzDeck.prefs.get('ui.timeline.display_attachments_inline') !== false) {
      $outer.setAttribute('aria-busy', 'true');

      attachment.get_data().then(result => {
        $media.src = URL.createObjectURL(result.blob);
        attachment.data = result.attachment.data;
      }).then(() => {
        $outer.removeAttribute('aria-busy');
      });
    }
  } else {
    // TODO: support other attachment types
    $outer.remove();
  }

  return $attachment;
};

BzDeck.views.BugTimelineEntry.prototype.create_history_entries = function () {
  let comment = this.data.get('comment'),
      history = this.data.get('history'),
      changer_name = history.who,
      time = history.when,
      $fragment = new DocumentFragment();

  for (let change of history.changes) {
    if (['is_confirmed', 'cf_last_resolved'].includes(change.field_name)) {
      continue; // This field is not added by the user
    }

    $fragment.appendChild(this.create_history_entry(changer_name, time, change, comment));
  }

  return $fragment;
};

BzDeck.views.BugTimelineEntry.prototype.create_history_entry = function (changer_name, time, change, comment) {
  let $change = this.get_template('timeline-change'),
      $changer = $change.querySelector('[itemprop="author"]'),
      $time = $change.querySelector('[itemprop="creation_time"]'),
      $how = $change.querySelector('[itemprop="how"]'),
      changer = BzDeck.collections.users.get(changer_name, { name: changer_name }),
      conf_field = BzDeck.models.server.data.config.field,
      _field = conf_field[change.field_name] ||
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
               change,
      _field_label = {
        blocks: 'blockers', // l10n
        depends_on: 'dependencies', // l10n
        duplicates: 'duplicates', // for duplication comments, unused
        dupe_of: 'dupe_of', // for duplication comments, unused
      }[change.field_name] || _field.description || _field.field_name,
      field = `<span data-what="${change.field_name}">` + _field_label + '</span>';

  if (change.field_name.startsWith('cf_')) {
    field += ' flag'; // l10n
  }

  this.fill($changer, changer.properties, {
    title: `${changer.original_name || changer.name}\n${changer.email}`
  });

  $change.setAttribute('data-change-field', change.field_name);
  this.helpers.datetime.fill_element($time, time);

  let _reviews = { added: new Set(), removed: new Set() },
      _feedbacks = { added: new Set(), removed: new Set() },
      _needinfos = { added: new Set(), removed: new Set() };

  let find_people = how => {
    for (let item of change[how].split(', ')) {
      let review = item.match(/^review\?\((.*)\)$/),
          feedback = item.match(/^feedback\?\((.*)\)$/),
          needinfo = item.match(/^needinfo\?\((.*)\)$/);

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

  let reviews,
      added_reviews = _reviews.added.size ? this.create_people_array(_reviews.added) : undefined,
      removed_reviews = _reviews.removed.size ? this.create_people_array(_reviews.removed) : undefined,
      feedbacks,
      added_feedbacks = _feedbacks.added.size ? this.create_people_array(_feedbacks.added) : undefined,
      removed_feedbacks = _feedbacks.removed.size ? this.create_people_array(_feedbacks.removed) : undefined,
      needinfos,
      added_needinfos = _needinfos.added.size ? this.create_people_array(_needinfos.added) : undefined,
      removed_needinfos = _needinfos.removed.size ? this.create_people_array(_needinfos.removed) : undefined,
      removals = change.removed ? this.create_history_change_element(change, 'removed').outerHTML : undefined,
      additions = change.added ? this.create_history_change_element(change, 'added').outerHTML : undefined,
      att_id = change.attachment_id,
      attachment = att_id ? `<a href="/attachment/${att_id}" data-att-id="${att_id}">Attachment ${att_id}</a>`
                          : undefined; // l10n

  // Addition only
  if (!change.removed && change.added) {
    if (_reviews.added.size && att_id) {
      reviews = added_reviews;
      $how.innerHTML = `requested ${reviews} to review ${attachment}`; // l10n
    } else if (_feedbacks.added.size && att_id) {
      feedbacks = added_feedbacks;
      $how.innerHTML = `requested ${feedbacks} to give feedback on ${attachment}`; // l10n
    } else if (_needinfos.added.size) {
      needinfos = added_needinfos;
      $how.innerHTML = `requested information from ${needinfos}`; // l10n
    } else if (att_id && change.added === 'review+') {
      $how.innerHTML = `approved ${attachment}`; // l10n
    } else if (att_id && change.added === 'review-') {
      $how.innerHTML = `rejected ${attachment}`; // l10n
    } else if (att_id && change.added === 'feedback+') {
      $how.innerHTML = `gave positive feedback on ${attachment}`; // l10n
    } else if (att_id && change.added === 'feedback-') {
      $how.innerHTML = `gave negative feedback on ${attachment}`; // l10n
    } else if (att_id && change.field_name === 'flagtypes.name') {
      $how.innerHTML = `set the ${additions} flag to ${attachment}`; // l10n
    } else if (change.field_name === 'duplicates') {
      $how.innerHTML = `marked ${additions} as a duplicate of this bug`; // for duplication comments, l10n
    } else if (change.field_name === 'dupe_of') {
      $how.innerHTML = `marked this bug as a duplicate of ${additions}`; // for duplication comments, l10n
    } else if (change.field_name === 'keywords') {
      if (change.removed.split(', ').length === 1) {
        $how.innerHTML = `added the ${additions} keyword`; // l10n
      } else {
        $how.innerHTML = `added the ${additions} keywords`; // l10n
      }
    } else if (change.field_name === 'cc' && change.added === changer.email) {
      $how.innerHTML = `subscribed to the bug`; // l10n
    } else if (change.field_name === 'status' && change.added === 'REOPENED') {
      $how.innerHTML = `reopened the bug`; // l10n
    } else if (change.field_name === 'resolution' && change.added === 'FIXED') {
      $how.innerHTML = `marked the bug <strong>${change.added}</strong>`; // l10n
    } else {
      $how.innerHTML = `added ${additions} to the ${field}`; // l10n
    }
  }

  // Removal only
  if (change.removed && !change.added) {
    if (att_id && _reviews.removed.size) {
      reviews = removed_reviews;
      $how.innerHTML = `canceled ${attachment} review by ${reviews}`; // l10n
    } else if (att_id && _feedbacks.removed.size) {
      feedbacks = removed_feedbacks;
      $how.innerHTML = `canceled feedback of ${attachment} by ${feedbacks}`; // l10n
    } else if (_needinfos.removed.size) {
      needinfos = removed_needinfos;

      if (!comment) {
        $how.innerHTML = `canceled information request from ${needinfos}`; // l10n
      } else if (_needinfos.removed.size === 1 && _needinfos.removed.has(changer.email)) {
        $how.innerHTML = `provided information`; // l10n
      } else {
        $how.innerHTML = `provided information on behalf of ${needinfos}`; // l10n
      }
    } else if (att_id && change.field_name === 'flagtypes.name') {
      $how.innerHTML = `remvoed the ${additions} flag from ${attachment}`; // l10n
    } else if (change.field_name === 'keywords') {
      if (change.removed.split(', ').length === 1) {
        $how.innerHTML = `removed the ${removals} keyword`; // l10n
      } else {
        $how.innerHTML = `removed the ${removals} keywords`; // l10n
      }
    } else if (change.field_name === 'cc' && change.removed === changer.email) {
      $how.innerHTML = `unsubscribed from the bug`; // l10n
    } else {
      $how.innerHTML = `removed ${removals} from the ${field}`; // l10n
    }
  }

  // Removal + Addition
  if (change.removed && change.added) {
    if ((['priority', 'target_milestone'].includes(change.field_name) || change.field_name.startsWith('cf_')) &&
        change.removed.startsWith('--')) {
      $how.innerHTML = `set the ${field} to ${additions}`; // l10n
    } else if (att_id && change.added === 'review+' && _reviews.removed.size) {
      if (_reviews.removed.size === 1 && _reviews.removed.has(changer.email)) {
        $how.innerHTML = `approved ${attachment}`; // l10n
      } else {
        reviews = removed_reviews;
        $how.innerHTML = `approved ${attachment} on behalf of ${reviews}`; // l10n
      }
    } else if (att_id && change.added === 'review-' && _reviews.removed.size) {
      if (_reviews.removed.size === 1 && _reviews.removed.has(changer.email)) {
        $how.innerHTML = `rejected ${attachment}`; // l10n
      } else {
        reviews = removed_reviews;
        $how.innerHTML = `rejected ${attachment} on behalf of ${reviews}`; // l10n
      }
    } else if (att_id && _reviews.removed.size) {
      $how.innerHTML = `changed ${attachment} reviewer from ${added_reviews} to ${removed_reviews}`; // l10n
    } else if (att_id && change.added === 'feedback+' && _feedbacks.removed.size) {
      if (_feedbacks.removed.size === 1 && _feedbacks.removed.has(changer.email)) {
        $how.innerHTML = `gave positive feedback on ${attachment}`; // l10n
      } else {
        feedbacks = removed_feedbacks;
        $how.innerHTML = `gave positive feedback on ${attachment} on behalf of ${feedbacks}`; // l10n
      }
    } else if (att_id && change.added === 'feedback-' && _feedbacks.removed.size) {
      if (_feedbacks.removed.size === 1 && _feedbacks.removed.has(changer.email)) {
        $how.innerHTML = `gave negative feedback on ${attachment}`; // l10n
      } else {
        feedbacks = removed_feedbacks;
        $how.innerHTML = `gave negative feedback on ${attachment} on behalf of ${feedbacks}`; // l10n
      }
    } else if (att_id && change.field_name === 'flagtypes.name') {
      $how.innerHTML = `changed ${attachment} flag: ${removals} →︎ ${additions}`; // l10n
    } else if (change.field_name.match(/^attachments?\.description$/)) {
      $how.innerHTML = `changed ${attachment} description: ${removals} →︎ ${additions}`; // l10n
    } else if (change.field_name.match(/^attachments?\.file_?name$/)) {
      $how.innerHTML = `changed ${attachment} filename: ${removals} →︎ ${additions}`; // l10n
    } else if (change.field_name.match(/^attachments?\.is_?patch$/)) {
      if (change.added === '1') {
        $how.innerHTML = `marked ${attachment} as patch`; // l10n
      } else {
        $how.innerHTML = `unmarked ${attachment} as patch`; // l10n
      }
    } else if (change.field_name.match(/^attachments?\.is_?obsolete$/)) {
      if (change.added === '1') {
        $how.innerHTML = `marked ${attachment} as obsolete`; // l10n
      } else {
        $how.innerHTML = `unmarked ${attachment} as obsolete`; // l10n
      }
    } else if (_needinfos.removed.size) {
      $how.innerHTML = `requested information from ${added_needinfos} instead of ${removed_needinfos}`; // l10n
    } else if (change.field_name === 'assigned_to' && change.removed.match(/^(nobody@.+|.+@bugzilla\.bugs)$/)) {
      // TODO: nobody@mozilla.org and *@bugzilla.bugs are the default assignees on BMO. It might be different on other
      // Bugzilla instances. The API should provide the info...
      if (change.added === changer.email) {
        $how.innerHTML = `self-assigned to the bug`; // l10n
      } else {
        $how.innerHTML = `assigned ${additions} to the bug`; // l10n
      }
    } else if (change.field_name === 'assigned_to' && change.added.match(/^(nobody@.+|.+@bugzilla\.bugs)$/)) {
      $how.innerHTML = `removed ${removals} from the assignee`; // l10n
    } else if (change.field_name === 'keywords') {
      $how.innerHTML = `changed the keywords: removed ${removals}, added ${additions}`; // l10n
    } else if (change.field_name === 'blocks') {
      $how.innerHTML = `changed the blockers: removed ${removals}, added ${additions}`; // l10n
    } else if (change.field_name === 'depends_on') {
      $how.innerHTML = `changed the dependencies: removed ${removals}, added ${additions}`; // l10n
    } else {
      $how.innerHTML = `changed the ${field}: ${removals} → ${additions}`; // l10n
    }
  }

  return $change;
};

BzDeck.views.BugTimelineEntry.prototype.create_people_array = function (set) {
  let array = [...set].map(name => {
    let person = BzDeck.collections.users.get(name, { name }),
        $person = this.get_template('person-with-image');

    this.fill($person, person.properties, {
      title: `${person.original_name || person.name}\n${person.email}`
    });

    return $person.outerHTML;
  });

  let last = array.pop();

  return array.length ? array.join(', ') + ' and ' + last : last; // l10n
};

BzDeck.views.BugTimelineEntry.prototype.create_history_change_element = function (change, how) {
  let $elm = document.createElement('span'),
      ids;

  if (['blocks', 'depends_on', 'duplicates', 'dupe_of'].includes(change.field_name)) {
    if (change[how].split(', ').length > 1) {
      $elm.innerHTML = 'Bug ' + change[how].replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>'); // l10n
    } else {
      $elm.innerHTML = change[how].replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">Bug $1</a>'); // l10n
    }
  } else if (['assigned_to', 'qa_contact', 'mentors', 'cc'].includes(change.field_name)) {
    $elm.innerHTML = this.create_people_array(change[how].split(', '));
  } else if (change.field_name === 'url') {
    $elm.innerHTML = `<a href="${change[how]}">${change[how]}</a>`;
  } else if (change.field_name === 'see_also') {
    $elm.innerHTML = change[how].split(', ').map(url => {
      let prefix = BzDeck.models.server.url + '/show_bug.cgi?id=',
          bug_id = url.startsWith(prefix) ? Number(url.substr(prefix.length)) : undefined;

      if (bug_id) {
        return `<a href="/bug/${bug_id}" data-bug-id="${bug_id}">Bug ${bug_id}</a>`;
      }

      return `<a href="${url}">${url}</a>`;
    }).join(', ');
  } else {
    $elm.innerHTML = this.helpers.array.join(change[how].split(', '), how === 'added' ? 'strong' : 'span');
  }

  $elm.setAttribute('data-how', how);

  return $elm;
};
