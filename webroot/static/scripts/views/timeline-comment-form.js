/**
 * BzDeck Timeline Comment Form View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.TimelineCommentForm = function TimelineCommentFormView (bug, timeline_id) {
  let click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      $fragment = this.get_fragment('timeline-comment-form', timeline_id);

  this.$form = $fragment.firstElementChild;
  this.$tabpanel = this.$form.querySelector('[role="tabpanel"]');
  this.$textbox = this.$form.querySelector('[id$="tabpanel-write"] [role="textbox"]');
  this.$$tabs = new this.widget.TabList(this.$form.querySelector('[role="tablist"]'));
  this.$write_tab = this.$form.querySelector('[id$="tab-write"]');
  this.$preview_tab = this.$form.querySelector('[id$="tab-preview"]');
  this.$attachments_tab = this.$form.querySelector('[id$="tab-attachments"]');
  this.$preview = this.$form.querySelector('[id$="tabpanel-preview"] [itemprop="text"]');
  this.$status = this.$form.querySelector('[role="status"]');
  this.$attach_button = this.$form.querySelector('[data-command="attach"]');
  this.$file_picker = this.$form.querySelector('input[type="file"]');
  this.$attachments_tbody = this.$form.querySelector('[id$="tabpanel-attachments"] tbody');
  this.$attachments_row_tmpl = document.querySelector('#timeline-comment-form-attachments-row');
  this.$parallel_checkbox = this.$form.querySelector('[role="checkbox"]');
  this.$drop_target = this.$form.querySelector('[aria-dropeffect]');
  this.$submit = this.$form.querySelector('[data-command="submit"]');

  this.bug = bug;
  this.has_token = () => !!BzDeck.models.data.account.token;
  this.has_text = () => !!this.$textbox.value.match(/\S/);
  this.attachments = [];
  this.has_attachments = () => this.attachments.length > 0;
  this.parallel_upload = true;

  this.$form.addEventListener('wheel', event => event.stopPropagation());

  this.$$tabs.bind('Selected', event => {
    let tab_id = event.detail.items[0].id;

    if (tab_id.endsWith('write')) {
      this.$textbox.focus();
    }

    if (tab_id.endsWith('preview')) {
      this.$preview.innerHTML = BzDeck.controllers.core.parse_comment(this.$textbox.value);
    }
  });

  for (let $tabpanel of this.$form.querySelectorAll('[role="tabpanel"]')) {
    new this.widget.ScrollBar($tabpanel);
  }

  // Workaround a Firefox bug: the placeholder is not displayed in some cases
  this.$textbox.value = '';

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign(this.$textbox, {
    'ACCEL+RETURN': event => {
      if (this.has_text() && this.has_token()) {
        this.submit();
      }
    },
  });

  this.$textbox.addEventListener('input', event => this.oninput());

  // Attach files using a file picker
  // The event here should be click; others including touchstart and mousedown don't work
  this.$attach_button.addEventListener('click', event => this.$file_picker.click());
  this.$file_picker.addEventListener('change', event => this.onselect_files(event.target.files));

  // Attach files by drag & drop
  this.$form.addEventListener('dragover', event => {
    event.dataTransfer.dropEffect = 'copy';
    event.dataTransfer.effectAllowed = 'copy';
    event.preventDefault();

    this.$drop_target.setAttribute('aria-dropeffect', 'copy');
  });

  this.$form.addEventListener('drop', event => {
    let dt = event.dataTransfer;

    if (dt.types.contains('Files')) {
      this.onselect_files(dt.files);
    } else if (dt.types.contains('text/plain')) {
      this.attach_text(dt.getData('text/plain'));
    }

    this.$drop_target.setAttribute('aria-dropeffect', 'none');

    event.preventDefault();
  });

  (new this.widget.Checkbox(this.$parallel_checkbox)).bind('Toggled', event => {
    this.parallel_upload = event.detail.checked;
    this.update_parallel_ui();
  });

  this.$submit.addEventListener(click_event_type, event => this.submit());

  if (!this.has_token()) {
    this.$status.innerHTML = '<strong>Provide your auth token</strong> to post.';
    this.$status.querySelector('strong').addEventListener(click_event_type, event =>
      BzDeck.router.navigate('/settings', { 'tab_id': 'account' }));

    this.subscribe('SettingsPageController:AuthTokenVerified', data => {
      this.$status.textContent = '';
      this.$submit.setAttribute('aria-disabled', !this.has_text() || !this.has_attachments());
    });
  }
};

BzDeck.views.TimelineCommentForm.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.TimelineCommentForm.prototype.constructor = BzDeck.views.TimelineCommentForm;

BzDeck.views.TimelineCommentForm.prototype.oninput = function () {
  this.$textbox.style.removeProperty('height');
  this.$textbox.style.setProperty('height', `${this.$textbox.scrollHeight}px`);
  this.$submit.setAttribute('aria-disabled', !(this.has_text() || this.has_attachments()) || !this.has_token());
  this.$preview_tab.setAttribute('aria-disabled', !this.has_text());

  if (this.has_token() && this.$status.textContent) {
    this.$status.textContent = '';
  }
};

BzDeck.views.TimelineCommentForm.prototype.attach_text = function (str) {
  let reader = new FileReader(),
      blob = new Blob([str], { type: 'text/plain' }),
      is_ghpr = str.match(/^https:\/\/github\.com\/(.*)\/pull\/(\d+)$/),
      is_patch = str.match(/^diff\s/m);

  // Use FileReader instead of btoa() to avoid overflow
  reader.addEventListener('load', event => {
    this.add_attachment({
      'data': reader.result.replace(/^.*?,/, ''), // Drop data:text/plain;base64,
      'summary': is_ghpr ? `GitHub Pull Request, ${is_ghpr[1]}#${is_ghpr[2]}`
                         : is_patch ? 'Patch' : str.substr(0, 25) + (str.length > 25 ? '...' : ''),
      'file_name': URL.createObjectURL(blob).match(/\w+$/)[0] + '.txt',
      is_patch,
      'size': blob.size, // Not required for the API but used in find_attachment()
      'content_type': is_ghpr ? 'text/x-github-pull-request' : 'text/plain'
    });
  });

  reader.readAsDataURL(blob);
};

BzDeck.views.TimelineCommentForm.prototype.onselect_files = function (files) {
  let excess_files = new Set(),
      num_format = num => num.toLocaleString('en-US'),
      max_size = BzDeck.models.data.server.config.max_attachment_size,
      max = num_format(max_size),
      message;

  for (let _file of files) {
    let reader = new FileReader(),
        file = _file, // Redeclare the variable so it can be used in the following event
        is_patch = /\.(patch|diff)$/.test(file.name) || /^text\/x-(patch|diff)$/.test(file.type);

    // Check if the file has already been attached
    if (this.find_attachment(file) > -1) {
      continue;
    }

    // Check if the file is not exceeding the limit
    if (file.size > max_size) {
      excess_files.add(file);

      continue;
    }

    reader.addEventListener('load', event => {
      this.add_attachment({
        'data': reader.result.replace(/^.*?,/, ''), // Drop data:<type>;base64,
        'summary': is_patch ? 'Patch' : file.name,
        'file_name': file.name,
        is_patch,
        'size': file.size, // Not required for the API but used in find_attachment()
        'content_type': is_patch ? 'text/plain' : file.type || 'application/x-download'
      });
    });

    reader.readAsDataURL(file);
  }

  if (excess_files.size) {
    message = excess_files.size === 1
            ? `This file cannot be attached because it may exceed the maximum attachment size \
               (${max} bytes) specified by the current Bugzilla instance. You can upload the file \
               to an online storage and post the link instead.`
            : `These files cannot be attached because they may exceed the maximum attachment size \
               (${max} bytes) specified by the current Bugzilla instance. You can upload the files \
               to an online storage and post the links instead.`; // l10n
    message += '<br><br>';
    message += [for (file of excess_files) `&middot; ${file.name} (${num_format(file.size)} bytes)`].join('<br>');

    (new this.widget.Dialog({
      'type': 'alert',
      'title': 'Error on attaching files',
      message
    })).show();
  }
};

BzDeck.views.TimelineCommentForm.prototype.add_attachment = function (attachment) {
  let click_event_type = FlareTail.util.ua.touch.enabled ? 'touchstart' : 'mousedown',
      $tbody = this.$attachments_tbody,
      $row = this.$attachments_row_tmpl.content.cloneNode(true).firstElementChild,
      $desc = $row.querySelector('[data-field="description"]');

  this.attachments.push(attachment);

  $desc.value = $desc.placeholder = attachment.summary;
  $desc.addEventListener('keydown', event => event.stopPropagation());
  $desc.addEventListener('input', event => attachment.summary = $desc.value);

  $row.querySelector('[data-command="remove"]').addEventListener(click_event_type, event => {
    this.remove_attachment(attachment);
  });

  $row.querySelector('[data-command="move-up"]').addEventListener(click_event_type, event => {
    let index = this.find_attachment(attachment);

    this.attachments.splice(index - 1, 2, attachment, this.attachments[index - 1]);
    $tbody.insertBefore($row.previousElementSibling, $row.nextElementSibling);
  });

  $row.querySelector('[data-command="move-down"]').addEventListener(click_event_type, event => {
    let index = this.find_attachment(attachment);

    this.attachments.splice(index, 2, this.attachments[index + 1], attachment);
    $tbody.insertBefore($row.nextElementSibling, $row);
  });

  $tbody.appendChild($row);

  this.$attachments_tab.setAttribute('aria-disabled', 'false');
  this.$$tabs.view.selected = this.$attachments_tab;
  this.$submit.setAttribute('aria-disabled', !this.has_token());
  this.update_parallel_ui();
};

BzDeck.views.TimelineCommentForm.prototype.remove_attachment = function (attachment) {
  let index = this.find_attachment(attachment);

  this.attachments.splice(index, 1);

  this.$attachments_tbody.rows[index].remove();
  this.$attachments_tab.setAttribute('aria-disabled', !this.has_attachments());
  this.$submit.setAttribute('aria-disabled', !(this.has_text() || this.has_attachments()) || !this.has_token());
  this.update_parallel_ui();

  if (!this.has_attachments()) {
    this.$$tabs.view.selected = this.$write_tab;
  }
};

BzDeck.views.TimelineCommentForm.prototype.find_attachment = function (attachment) {
  // A file with the same name and size might be the same file
  let index = [for (entry of this.attachments.entries())
               if (entry[1].file_name === (attachment.file_name || attachment.name) &&
                   entry[1].size === attachment.size) entry[0]][0];

  return index === undefined ? -1 : index;
};

BzDeck.views.TimelineCommentForm.prototype.update_parallel_ui = function () {
  let disabled = this.attachments.length < 2 || this.parallel_upload;

  for (let $button of this.$attachments_tbody.querySelectorAll('[data-command|="move"]')) {
    $button.setAttribute('aria-disabled', disabled);
  }

  this.$parallel_checkbox.setAttribute('aria-hidden', this.attachments.length < 2);
};

BzDeck.views.TimelineCommentForm.prototype.submit = function () {
  let data,
      hash = att => md5(att.file_name + String(att.size)),
      map_sum = map => [...map.values()].reduce((p, c) => p + c),
      comment = this.$textbox.value,
      att_num = this.attachments.length,
      att_total = 0,
      att_uploaded = new Map([for (att of this.attachments) [hash(att), 0]]),
      percentage;

  let update_status = (att, uploaded) => {
    att_uploaded.set(hash(att), uploaded);
    percentage = Math.round(map_sum(att_uploaded) / att_total * 100);
    this.$status.textContent = `${percentage}% uploaded`;
  };

  let post = data => new Promise((resolve, reject) => {
    let method = data.file_name ? 'attachment' : 'comment',
        length_computable,
        size = 0;

    // If there is no comment, go ahead with attachments
    if (method === 'comment' && !data.comment) {
      resolve();

      return;
    }

    BzDeck.controllers.core.request('POST', `bug/${this.bug.id}/${method}`, null, JSON.stringify(data), {
      'upload': {
        'progress': event => {
          if (method === 'attachment') {
            if (!size) {
              length_computable = event.lengthComputable;
              size = event.total;
              att_total += size;
            }

            if (length_computable) {
              update_status(data, event.loaded);
            }
          }
        }
      }
    }, {
      'auth': true // Enable auth
    }).then(result => {
      if (result.ids) {
        if (method === 'attachment') {
          this.remove_attachment(data);

          if (!length_computable) {
            update_status(data, size);
          }
        }

        resolve();
      } else {
        reject(new Error(result));
      }
    }).catch(event => {
      reject(new Error());
    });
  });

  this.$textbox.setAttribute('aria-readonly', 'true');
  this.$submit.setAttribute('aria-disabled', 'true');
  this.$status.textContent = 'Submitting...';

  if (att_num === 1) {
    // If there's a single attachment, send it with the comment
    data = this.attachments[0];
    data.comment = comment;
  } else {
    // If there's no attachment, just send the comment. If there are 2 or more attachments,
    // send the comment first then send the attachments in parallel
    data = { comment };
  }

  post(data).then(value => {
    if (att_num < 2) {
      return true;
    }

    // Upload files in parallel
    if (this.parallel_upload) {
      return Promise.all([for (att of this.attachments) post(att)]);
    }

    // Upload files in series
    return this.attachments.reduce((sequence, att) => sequence.then(() => post(att)), Promise.resolve());
  }, error => {
    // Failed to post
    this.$submit.setAttribute('aria-disabled', 'false');
    this.$status.textContent = error && error.message ? `ERROR: ${error.message}`
                             : 'Failed to post your comment or attachment. Try again later.';
  }).then(() => {
    // All done, the timeline will soon be updated via Bugzfeed
    this.$textbox.value = '';
    this.oninput();
  }, errors => {
    // Failed to post at least one attachment
    this.$submit.setAttribute('aria-disabled', 'false');
    this.$status.textContent = 'Failed to post your attachments. Try again later.';
  }).then(() => {
    // The textbox should be focused anyway
    this.$textbox.setAttribute('aria-readonly', 'false');
    this.$textbox.focus();
  });
};
