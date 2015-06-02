/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Timeline = function TimelineView (view_id, bug, $bug, delayed) {
  this.id = view_id;
  this.bug = bug;
  this.$bug = $bug;

  let get_time = str => (new Date(str)).getTime(),
      entries = new Map([for (c of this.bug.comments.entries())
                             [get_time(c[1].creation_time), new Map([['comment', c[1]], ['comment_number', c[0]]])]]),
      show_cc_changes = BzDeck.prefs.get('ui.timeline.show_cc_changes') === true,
      click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown',
      read_comments_num = 0,
      last_comment_time,
      $timeline = this.$timeline = this.$bug.querySelector('.bug-timeline'),
      timeline_id = $timeline.id = `${this.id}-timeline`,
      comment_form = new BzDeck.views.TimelineCommentForm(this.id, this.bug),
      $expander,
      $fragment = new DocumentFragment(),
      $comments_wrapper = $timeline.querySelector('.comments-wrapper'),
      $parent = $timeline.querySelector('.scrollable-area-content');

  for (let attachment of this.bug.attachments) {
    entries.get(get_time(attachment.creation_time)).set('attachment', attachment);
  }

  for (let history of this.bug.history) if (entries.has(get_time(history.when))) {
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
    if (!delayed && this.bug._last_viewed && time < this.bug._last_viewed) {
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
    $fragment.appendChild(new BzDeck.views.TimelineEntry(this.id, this.bug, data));
    data.delete('rendering');
    data.set('rendered', true);
  }

  // Append entries to the timeline
  $comments_wrapper.appendChild($fragment);

  // Show an expander if there are read comments
  if (read_comments_num > 1) {
    // The last comment is rendered, so decrease the number
    read_comments_num--;

    $expander = this.$expander = document.createElement('div');
    $expander.textContent = read_comments_num === 1 ? '1 older comment'
                                                    : `${read_comments_num} older comments`; // l10n
    $expander.className = 'read-comments-expander';
    $expander.tabIndex = 0;
    $expander.setAttribute('role', 'button');
    $expander.addEventListener(click_event_type, event => {
      $expander.textContent = 'Loading...'; // l10n
      $fragment = new DocumentFragment();

      for (let [time, data] of entries) if (!data.get('rendered')) {
        $fragment.appendChild(new BzDeck.views.TimelineEntry(this.id, this.bug, data));
        data.set('rendered', true);
      }

      // Collapse comments by default
      for (let $comment of $fragment.querySelectorAll('[itemprop="comment"]')) {
        $comment.setAttribute('aria-expanded', 'false');
      }

      $timeline.focus();
      $comments_wrapper.replaceChild($fragment, $expander);
      delete this.$expander;

      return this.helpers.event.ignore(event);
    });
    $comments_wrapper.insertBefore($expander, $comments_wrapper.querySelector('article'));
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
  this.on('SettingsPageView:PrefValueChanged', data => {
    if (data.name === 'ui.timeline.display_attachments_inline' && data.value === true) {
      for (let $attachment of $timeline.querySelectorAll('[itemprop="attachment"]')) {
        let $media = $attachment.querySelector('img, audio, video');

        if ($media && !$media.src) {
          let att_id = Number($attachment.querySelector('[itemprop="url"]').getAttribute('data-attachment-id')),
              attachment = new BzDeck.models.Attachment(this.bug.attachments.find(att => att.id === att_id));

          $media.parentElement.setAttribute('aria-busy', 'true');

          attachment.get_data().then(result => {
            $media.src = URL.createObjectURL(result.blob);
            attachment.data = result.attachment.data;
          }).then(() => {
            $media.parentElement.removeAttribute('aria-busy');
          });
        }
      }
    }
  }, true);

  let check_fragment = () => {
    let match = location.hash.match(/^#c(\d+)$/),
        comment_number = match ? Number.parseInt(match[1]) : undefined;

    // If the URL fragment has a valid comment number, scroll the comment into view
    if (location.pathname === `/bug/${this.bug.id}` && comment_number) {
      let $comment = $timeline.querySelector(`[data-comment-number="${comment_number}"]`);

      if ($comment) {
        if (this.$expander) {
          // Expand all comments
          this.$expander.dispatchEvent(new CustomEvent(click_event_type));
        }

        $comment.scrollIntoView({ block: 'start', behavior: 'smooth' });
        $comment.focus();
      }
    }
  };

  // Check the fragment; use a timer to wait for rendering
  window.setTimeout(window => check_fragment(), 150);
  window.addEventListener('popstate', event => check_fragment());
  window.addEventListener('hashchange', event => check_fragment());
};

BzDeck.views.Timeline.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Timeline.prototype.constructor = BzDeck.views.Timeline;

BzDeck.views.Timeline.prototype.expand_comments = function () {
  if (this.$expander) {
    this.$expander.dispatchEvent(new CustomEvent(this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown'));
  }

  for (let $comment of this.$timeline.querySelectorAll('[itemprop="comment"][aria-expanded="false"]')) {
    $comment.setAttribute('aria-expanded', 'true')
  }
};

BzDeck.views.Timeline.prototype.collapse_comments = function () {
  for (let $comment of this.$timeline.querySelectorAll('[itemprop="comment"][aria-expanded="true"]')) {
    $comment.setAttribute('aria-expanded', 'false')
  }
};
