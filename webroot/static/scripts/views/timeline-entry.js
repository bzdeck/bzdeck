/**
 * BzDeck Timeline Entry View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.TimelineEntry = function TimelineEntryView (timeline_id, bug, data) {
  let click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      $fragment = new DocumentFragment(),
      $comment;

  this.bug = bug;
  this.data = data;

  if (data.get('comment')) {
    $comment = $fragment.appendChild(this.create_comment_entry(timeline_id));
  }

  if (data.get('attachment')) {
    $comment.appendChild(this.create_attachment_box());
  }

  if (data.get('history')) {
    $fragment.appendChild(this.create_history_entries());
  }

  return $fragment;
};

BzDeck.views.TimelineEntry.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.TimelineEntry.prototype.constructor = BzDeck.views.TimelineEntry;

BzDeck.views.TimelineEntry.prototype.create_comment_entry = function (timeline_id) {
  let click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      comment = this.data.get('comment'),
      author = BzDeck.controllers.bugs.find_person(this.bug, comment.creator),
      author_pretty_name = BzDeck.controllers.users.get_name(author).pretty,
      time = comment.creation_time,
      $entry = this.get_fragment('timeline-comment').firstElementChild,
      $header = $entry.querySelector('header'),
      $author = $entry.querySelector('[itemprop="author"]'),
      $time = $entry.querySelector('[itemprop="datePublished"]'),
      $star_button = $entry.querySelector('[role="button"][data-command="star"]'),
      $reply_button = $entry.querySelector('[data-command="reply"]'),
      $comment_body = $entry.querySelector('[itemprop="text"]'),
      $textbox = document.querySelector(`#${timeline_id}-comment-form [role="textbox"]`);

  // TEMP: the message for a duplicated bug is currently only in the comment.text field
  let text = comment.text.includes('has been marked as a duplicate of this bug')
           ? comment.text : comment.raw_text;

  comment.number = this.data.get('comment_number');
  $entry.id = `${timeline_id}-comment-${comment.id}`;
  $entry.dataset.id = comment.id;
  $entry.dataset.time = (new Date(time)).getTime();
  $entry.setAttribute('data-comment-number', comment.number);
  $comment_body.innerHTML = text ? BzDeck.controllers.core.parse_comment(text) : '';

  // Append the comment number to the URL when clicked
  $entry.addEventListener(click_event_type, event => {
    if (location.pathname.startsWith('/bug/')) {
      window.history.replaceState({}, document.title, `${location.pathname}#c${comment.number}`);
    }
  });

  let reply = () => {
    let quote_header = `(In reply to ${author_pretty_name} from comment #${comment.number})`,
        quote_lines = [for (line of text.match(/^$|.{1,78}(?:\b|$)/gm) || []) `> ${line}`],
        quote = `${quote_header}\n${quote_lines.join('\n')}`,
        $tabpanel = document.querySelector(`#${timeline_id}-comment-form-tabpanel-write`),
        $textbox = document.querySelector(`#${timeline_id}-comment-form [role="textbox"]`);

    $textbox.focus();
    $textbox.value += `${$textbox.value ? '\n\n' : ''}${quote}\n\n`;
    // Trigger an event to do something. Disable async to make sure the following lines work
    FlareTail.util.event.trigger($textbox, 'input', {}, false);
    // Scroll unti the caret is visible
    $tabpanel.scrollTop = $tabpanel.scrollHeight;
    $entry.scrollIntoView();
  };

  let toggle_star = () => {
    if (!this.bug._starred_comments) {
      this.bug._starred_comments = new Set([comment.id]);
    } else if (this.bug._starred_comments.has(comment.id)) {
      this.bug._starred_comments.delete(comment.id);
    } else {
      this.bug._starred_comments.add(comment.id);
    }

    BzDeck.models.bugs.save_bug(this.bug);
    FlareTail.util.event.trigger(window, 'Bug:StarToggled', { 'detail': { 'bug': this.bug }});
  };

  // Collapse/expand the comment
  let collapse_comment = () => $entry.setAttribute('aria-expanded', $entry.getAttribute('aria-expanded') === 'false');

  // Focus management
  let move_focus = shift => {
    if (!$entry.matches(':focus')) {
      $entry.focus();
      $entry.scrollIntoView(ascending);

      return;
    }

    let ascending = BzDeck.models.data.prefs['ui.timeline.sort.order'] !== 'descending',
        entries = [...document.querySelectorAll(`#${timeline_id} [itemprop="comment"]`)];

    entries = ascending && shift || !ascending && !shift ? entries.reverse() : entries;
    entries = entries.slice(entries.indexOf($entry) + 1);

    // Focus the next (or previous) visible entry
    for (let $_entry of entries) if ($_entry.clientHeight) {
      $_entry.focus();
      $_entry.scrollIntoView(ascending);

      break;
    }
  };

  // Activate the buttons
  $star_button.addEventListener(click_event_type, event => { toggle_star(); event.stopPropagation(); });
  $star_button.setAttribute('aria-pressed', !!this.bug._starred_comments && this.bug._starred_comments.has(comment.id));
  $reply_button.addEventListener(click_event_type, event => { reply(); event.stopPropagation(); });

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign($entry, {
    'R': event => reply(),
    'S': event => toggle_star(),
    // Collapse/expand the comment
    'C': event => collapse_comment(),
    // Focus management
    'UP|PAGE_UP|SHIFT+SPACE': event => move_focus(true),
    'DOWN|PAGE_DOWN|SPACE': event => move_focus(false),
  });

  $author.title = `${author.real_name ? author.real_name + '\n' : ''}${author.email}`;
  $author.querySelector('[itemprop="name"]').itemValue = author_pretty_name;
  $author.querySelector('[itemprop="email"]').itemValue = author.email;
  BzDeck.views.BaseView.prototype.set_avatar(author, $author.querySelector('[itemprop="image"]'));
  FlareTail.util.datetime.fill_element($time, time);

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

BzDeck.views.TimelineEntry.prototype.create_attachment_box = function () {
  // TODO: load the attachment data via API
  let attachment = this.data.get('attachment'),
      media_type = attachment.content_type.split('/')[0],
      url = `${BzDeck.models.data.server.url}/attachment.cgi?id=${attachment.id}`,
      $attachment = this.get_fragment('timeline-attachment').firstElementChild,
      $outer = $attachment.querySelector('div'),
      $media,
      load_event = 'load';

  this.fill($attachment, {
    'url': `/attachment/${attachment.id}`,
    'description': attachment.summary,
    'name': attachment.file_name,
    'contentSize': attachment.size,
    'contentUrl': url,
    'encodingFormat': attachment.is_patch ? '' : attachment.content_type
  }, {
    'data-attachment-id': attachment.id
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
    load_event = 'loadedmetadata';

    if ($media.canPlayType(attachment.content_type) === '') {
      $media = null; // Cannot play the media
    }
  }

  if ($media) {
    $outer.appendChild($media);
    $media.addEventListener(load_event, event => $outer.removeAttribute('aria-busy'));

    if (BzDeck.models.data.prefs['ui.timeline.display_attachments_inline'] !== false) {
      $outer.setAttribute('aria-busy', 'true');
      $media.src = url;
    }
  } else {
    // TODO: support other attachment types
    $outer.remove();
  }

  return $attachment;
};

BzDeck.views.TimelineEntry.prototype.create_history_entries = function () {
  let comment = this.data.get('comment'),
      history = this.data.get('history'),
      changer = BzDeck.controllers.bugs.find_person(this.bug, history.who),
      time = history.when,
      $fragment = new DocumentFragment();

  for (let change of history.changes) {
    if (['is_confirmed', 'cf_last_resolved'].includes(change.field_name)) {
      continue; // This field is not added by the user
    }

    $fragment.appendChild(this.create_history_entry(changer, time, change, comment));
  }

  return $fragment;
};

BzDeck.views.TimelineEntry.prototype.create_history_entry = function (changer, time, change, comment) {
  let $change = this.get_fragment('timeline-change').firstElementChild,
      $changer = $change.querySelector('[itemprop="author"]'),
      $time = $change.querySelector('[itemprop="datePublished"]'),
      $how = $change.querySelector('[itemprop="how"]'),
      conf_field = BzDeck.models.data.server.config.field,
      _field = conf_field[change.field_name] ||
               // Bug 909055 - Field name mismatch in history: group vs groups
               conf_field[change.field_name.replace(/s$/, '')] ||
               // Bug 1078009 - Changes/history now include some wrong field names
               conf_field[{
                 'flagtypes.name': 'flag',
                 'attachments.description': 'attachment.description',
                 'attachments.ispatch': 'attachment.is_patch',
                 'attachments.isobsolete': 'attachment.is_obsolete',
                 'attachments.isprivate': 'attachment.is_private',
                 'attachments.mimetype': 'attachment.content_type',
               }[change.field_name]] ||
               // If the Bugzilla config is outdated, the field name can be null
               change,
      _field_label = {
        'blocks': 'blockers', // l10n
        'depends_on': 'dependencies', // l10n
      }[change.field_name] || _field.description || _field.field_name,
      field = `<span data-what="${change.field_name}">` + _field_label + '</span>';

  if (change.field_name.startsWith('cf_')) {
    field += ' flag'; // l10n
  }

  this.fill($changer, {
    'name': BzDeck.controllers.users.get_name(changer).first,
    'email': changer.email
  }, {
    'title': `${changer.real_name ? changer.real_name + '\n' : ''}${changer.email}`
  });

  $change.setAttribute('data-change-field', change.field_name);
  BzDeck.views.BaseView.prototype.set_avatar(changer, $changer.querySelector('[itemprop="image"]'));
  FlareTail.util.datetime.fill_element($time, time);

  let _reviews = { 'added': new Set(), 'removed': new Set() },
      _feedbacks = { 'added': new Set(), 'removed': new Set() },
      _needinfos = { 'added': new Set(), 'removed': new Set() };

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
      attachment = att_id ? `<a href="/attachment/${att_id}" data-attachment-id="${att_id}">Attachment ${att_id}</a>`
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
    } else if (change.field_name === 'assigned_to' && change.removed.startsWith('nobody@') &&
        change.added === changer.email) {
      // TODO: nobody@mozilla.org is the default assignee on BMO. It might be different on other Bugzilla instances
      $how.innerHTML = `self-assigned to the bug`; // l10n
    } else if (change.field_name === 'assigned_to' && change.added.startsWith('nobody@')) {
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

BzDeck.views.TimelineEntry.prototype.create_people_array = function (set) {
  let array = [...set].map(email => {
    let person = BzDeck.controllers.bugs.find_person(this.bug, email),
        $person = this.get_fragment('person-without-image').firstElementChild;

    this.fill($person, {
      'name': BzDeck.controllers.users.get_name(person).pretty,
      'email': email
    }, {
      'title': `${person.real_name ? person.real_name + '\n' : ''}${person.email}`
    });

    return $person.outerHTML;
  });

  let last = array.pop();

  return array.length ? array.join(', ') + ' and ' + last : last; // l10n
};

BzDeck.views.TimelineEntry.prototype.create_history_change_element = function (change, how) {
  let $elm = document.createElement('span'),
      ids;

  if (['blocks', 'depends_on'].includes(change.field_name)) {
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
      let prefix = BzDeck.models.data.server.url + '/show_bug.cgi?id=',
          bug_id = url.startsWith(prefix) ? Number(url.substr(prefix.length)) : undefined;

      if (bug_id) {
        return `<a href="/bug/${bug_id}" data-bug-id="${bug_id}">Bug ${bug_id}</a>`;
      }

      return `<a href="${url}">${url}</a>`;
    }).join(', ');
  } else {
    $elm.innerHTML = FlareTail.util.array.join(change[how].split(', '), how === 'added' ? 'strong' : 'span');
  }

  $elm.setAttribute('data-how', how);

  return $elm;
};
