/**
 * BzDeck Timeline View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.Timeline = function TimelineView (bug, $bug, delayed) {
  let get_time = str => (new Date(str)).getTime(),
      entries = new Map([for (c of bug.comments.entries())
                             [get_time(c[1].creation_time), new Map([['comment', c[1]], ['comment_number', c[0]]])]]),
      prefs = BzDeck.models.data.prefs,
      show_cc_changes = prefs['ui.timeline.show_cc_changes'] === true,
      click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      read_comments_num = 0,
      last_comment_time,
      $timeline = $bug.querySelector('.bug-timeline'),
      timeline_id = $timeline.id = `${$bug.id}-timeline`,
      comment_form = new BzDeck.views.TimelineCommentForm(bug, timeline_id),
      $expander,
      $fragment = new DocumentFragment(),
      $comments_wrapper = $timeline.querySelector('.comments-wrapper'),
      $parent = $timeline.querySelector('.scrollable-area-content');

  for (let attachment of bug.attachments) {
    entries.get(get_time(attachment.creation_time)).set('attachment', attachment);
  }

  for (let history of bug.history) if (entries.has(get_time(history.when))) {
    entries.get(get_time(history.when)).set('history', history);
  } else {
    entries.set(get_time(history.when), new Map([['history', history]]));
  }

  // Sort by time
  entries = new Map([for (entry of entries) [entry[0], entry[1]]].sort((a, b) => a[0] > b[0]));

  // Collapse read comments
  // If the fill_bug_details function is called after the bug details are fetched,
  // the _last_viewed annotation is already true, so check the delayed argument here
  for (let [time, data] of entries) {
    if (!delayed && bug._last_viewed && time < bug._last_viewed) {
      if (data.has('comment')) {
        read_comments_num++;
        last_comment_time = time;
      }
    } else {
      data.set('rendering', true);
    }
  }

  // Generate entries
  for (let [time, data] of entries) if (data.has('rendering') || time >= last_comment_time) {
    $fragment.appendChild(new BzDeck.views.TimelineEntry(timeline_id, bug, data));
    data.delete('rendering');
    data.set('rendered', true);
  }

  // Append entries to the timeline
  $comments_wrapper.appendChild($fragment);

  // Show an expander if there are read comments
  if (read_comments_num > 1) {
    // The last comment is rendered, so decrease the number
    read_comments_num--;

    $expander = document.createElement('div');
    $expander.textContent = read_comments_num === 1 ? '1 older comment'
                                                    : `${read_comments_num} older comments`; // l10n
    $expander.className = 'read-comments-expander';
    $expander.tabIndex = 0;
    $expander.setAttribute('role', 'button');
    $expander.addEventListener(click_event_type, event => {
      $expander.textContent = 'Loading...'; // l10n
      $fragment = new DocumentFragment();

      for (let [time, data] of entries) if (!data.get('rendered')) {
        $fragment.appendChild(new BzDeck.views.TimelineEntry(timeline_id, bug, data));
        data.set('rendered', true);
      }

      $timeline.focus();
      $comments_wrapper.replaceChild($fragment, $expander);

      return FlareTail.util.event.ignore(event);
    });
    $comments_wrapper.insertBefore($expander, $comments_wrapper.querySelector('[itemprop="comment"]'));
  }

  let $existing_form = $timeline.parentElement.querySelector('[id$="comment-form"]');

  if ($existing_form) {
    $existing_form.remove();
  }

  // Add a comment form
  $timeline.parentElement.appendChild(comment_form.$form);
  $parent.scrollTop = 0;
  $timeline.removeAttribute('aria-busy', 'false');

  // Show media when the pref is enabled
  this.subscribe('SettingsPageView:PrefValueChanged', data => {
    if (data.name === 'ui.timeline.display_attachments_inline' && data.value === true) {
      for (let $attachment of $timeline.querySelectorAll('[itemprop="attachment"]')) {
        let $media = $attachment.querySelector('img, audio, video');

        if ($media && !$media.src) {
          $media.parentElement.setAttribute('aria-busy', 'true');
          $media.src = $attachment.querySelector('[itemprop="contentUrl"]').itemValue;
        }
      }
    }
  });

  let check_fragment = () => {
    let match = location.hash.match(/^#c(\d+)$/),
        comment_number = match ? Number.parseInt(match[1]) : undefined;

    // If the URL fragment has a valid comment number, scroll the comment into view
    if (location.pathname === `/bug/${bug.id}` && comment_number) {
      let $comment = $timeline.querySelector(`[data-comment-number="${comment_number}"]`);

      if ($comment) {
        if ($expander) {
          // Expand all comments
          $expander.dispatchEvent(new CustomEvent(click_event_type));
        }

        $comment.scrollIntoView();
        $comment.focus();
      }
    }
  };

  // Check the fragment; use a timer to wait for rendering
  window.setTimeout(window => check_fragment(), 150);
  window.addEventListener('popstate', event => check_fragment());
  window.addEventListener('hashchange', event => check_fragment());
};

BzDeck.views.Timeline.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.Timeline.prototype.constructor = BzDeck.views.Timeline;
