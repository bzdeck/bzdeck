/**
 * BzDeck Timeline Entry View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.TimelineEntry = function TimelineEntryView (timeline_id, bug, data) {
  let datetime = FlareTail.util.datetime,
      click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      author,
      time,
      comment = data.get('comment'),
      attachment = data.get('attachment'),
      history = data.get('history'),
      $entry = FlareTail.util.content.get_fragment('timeline-comment').firstElementChild,
      $header = $entry.querySelector('header'),
      $author = $entry.querySelector('[itemprop="author"]'),
      $time = $entry.querySelector('[itemprop="datePublished"]'),
      $star_button = $entry.querySelector('[role="button"][data-command="star"]'),
      $reply_button = $entry.querySelector('[data-command="reply"]'),
      $comment = $entry.querySelector('[itemprop="text"]'),
      $changes = $entry.querySelector('.changes'),
      $textbox = document.querySelector(`#${timeline_id}-comment-form [role="textbox"]`);

  if (comment) {
    // TEMP: the message for a duplicated bug is currently only in the comment.text field
    let text = comment.text.includes('has been marked as a duplicate of this bug')
             ? comment.text : comment.raw_text;

    comment.number = data.get('comment_number');
    author = BzDeck.controllers.bugs.find_person(bug, comment.creator);
    time = comment.creation_time;
    $entry.id = `${timeline_id}-comment-${comment.id}`;
    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $entry.setAttribute('data-comment-number', comment.number);
    $comment.innerHTML = text ? BzDeck.controllers.core.parse_comment(text) : '';

    // Append the comment number to the URL when clicked
    $entry.addEventListener(click_event_type, event => {
      if (location.pathname.startsWith('/bug/')) {
        window.history.replaceState({}, document.title, `${location.pathname}#c${comment.number}`);
      }
    });

    let toggle_star = () => {
      if (!bug._starred_comments) {
        bug._starred_comments = new Set([comment.id]);
      } else if (bug._starred_comments.has(comment.id)) {
        bug._starred_comments.delete(comment.id);
      } else {
        bug._starred_comments.add(comment.id);
      }

      BzDeck.models.bugs.save_bug(bug);
      FlareTail.util.event.trigger(window, 'Bug:StarToggled', { 'detail': { bug }});
    };

    let reply = () => {
      let quote_header = `(In reply to ${author.real_name || author.email} from comment #${comment.number})`,
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

    // Activate the buttons
    $star_button.addEventListener(click_event_type, event => { toggle_star(); event.stopPropagation(); });
    $star_button.setAttribute('aria-pressed', !!bug._starred_comments && bug._starred_comments.has(comment.id));
    $reply_button.addEventListener(click_event_type, event => { reply(); event.stopPropagation(); });

    // Assign keyboard shortcuts
    FlareTail.util.kbd.assign($entry, {
      'R': event => reply(),
      'S': event => toggle_star(),
    });
  } else {
    $entry.dataset.nocomment = true;
    $star_button.setAttribute('aria-hidden', 'true');
    $reply_button.setAttribute('aria-hidden', 'true');
    $comment.remove();
  }

  if (attachment) {
    // TODO: load the attachment data via API
    let url = `${BzDeck.models.data.server.url}/attachment.cgi?id=${attachment.id}`,
        media_type = attachment.content_type.split('/')[0],
        $attachment = FlareTail.util.content.get_fragment('timeline-attachment').firstElementChild,
        $outer = $attachment.querySelector('div'),
        $media,
        load_event = 'load';

    FlareTail.util.content.render($attachment, {
      'url': `/attachment/${attachment.id}`,
      'description': attachment.summary,
      'name': attachment.file_name,
      'contentSize': attachment.size,
      'contentUrl': url,
      'encodingFormat': attachment.is_patch ? '' : attachment.content_type
    }, {
      'data-attachment-id': attachment.id
    }),

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

    $entry.insertBefore($attachment, $changes);
  }

  if (history) {
    let conf_field = BzDeck.models.data.server.config.field;

    let generate_element = (change, how) => {
      let $elm = document.createElement('span');

      if (['blocks', 'depends_on'].includes(change.field_name)) {
        $elm.innerHTML = change[how].replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>');
      } else {
        $elm.textContent = change[how];
      }

      $elm.setAttribute('data-how', how);

      return $elm;
    };

    author = author || BzDeck.controllers.bugs.find_person(bug, history.who);
    time = time || history.when;
    $entry.dataset.changes = [for (change of history.changes) change.field_name].join(' ');

    for (let change of history.changes) {
      let $change = $changes.appendChild(document.createElement('li')),
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
                   change;

      $change.textContent = `${_field.description || _field.field_name}: `;
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

  $author.title = `${author.real_name ? author.real_name + '\n' : ''}${author.email}`;
  $author.querySelector('[itemprop="name"]').itemValue = author.real_name || author.email;
  $author.querySelector('[itemprop="email"]').itemValue = author.email;
  BzDeck.views.core.set_avatar(author, $author.querySelector('[itemprop="image"]'));
  datetime.fill_element($time, time);

  // Mark unread
  $entry.setAttribute('data-unread', 'true');

  // Collapse/expand the comment
  let collapse_comment = () => $entry.setAttribute('aria-expanded', $entry.getAttribute('aria-expanded') === 'false');

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign($entry, {
    // Collapse/expand the comment
    'C': event => collapse_comment(),
    // Focus management
    'UP|PAGE_UP|SHIFT+SPACE': event => move_focus(true),
    'DOWN|PAGE_DOWN|SPACE': event => move_focus(false),
  });

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
