/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Markdown Editor View that works as the helper for a Markdown-enabled text form.
 * @extends BzDeck.BaseView
 */
BzDeck.MarkdownEditor = class MarkdownEditor extends BzDeck.BaseView {
  /**
   * Get a MarkdownEditor instance.
   * @constructor
   * @argument {HTMLElement} $form - Form container element.
   * @return {Object} view - New MarkdownEditor instance.
   */
  constructor ($form) {
    super(); // This does nothing but is required before using `this`

    this.$toolbar = $form.querySelector('.text-formatting-toolbar');
    this.$textbox = $form.querySelector('textarea');

    this.$toolbar.addEventListener('click', event => {
      if (event.target.matches('[data-command]')) {
        this.exec_command(event.target.getAttribute('data-command'));
        this.$textbox.focus();
      }

      return this.helpers.event.ignore(event);
    });

    // Change the shortcut labels depending on the user's platform
    let kbd_regex = /\(Cmd\+(\w)\)$/,
        kbd_suffix = this.helpers.env.platform.macintosh ? '\u2318' : 'Ctrl+';

    for (let $button of [...this.$toolbar.querySelectorAll('[role="button"]')]) {
      if ($button.title.match(kbd_regex)) {
        $button.title = $button.title.replace(kbd_regex, `(${kbd_suffix}$1)`);
      }
    }

    this.helpers.kbd.assign(this.$textbox, {
      'Accel+B': event => this.exec_command('strong'),
      'Accel+I': event => this.exec_command('em'),
      'Accel+K': event => this.exec_command('a'),
    });
  }

  /**
   * Update the text by adding marks.
   * @argument {String} tag - One of HTML tag names, such as strong, a, code, ul.
   * @return {undefined}
   */
  exec_command (tag) {
    let value = this.$textbox.value,
        start = this.$textbox.selectionStart,
        end = this.$textbox.selectionEnd,
        before = value.substring(0, start),
        selection = value.substring(start, end),
        after = value.substring(end),
        multiline = selection.includes('\n');

    let update = (text, new_start, new_end) => {
      this.$textbox.value = before + text + after;

      if (new_start) {
        this.$textbox.setSelectionRange(new_start, new_end || new_start);
      }

      // Fire an event to resize the textbox if needed
      this.helpers.event.trigger(this.$textbox, 'input', {}, false);
    };

    let bracket = (mark, mark2 = '') => {
      update(`${mark}${mark2}${selection}${mark2}${mark}`, start + mark.length, end + mark.length);
    };

    let quote = mark => {
      if (multiline) {
        update(selection.split('\n').map((line, i) => `${mark || (i + 1) + '.'} ${line}`).join('\n'));
      } else if (selection) {
        update(`${mark} ${selection}`, start + mark.length + 1, end + mark.length + 1);
      } else {
        update(`${start > 0 ? '\n' : ''}${mark} `, start + mark.length + 2);
      }
    };

    let anchor = () => {
      if (selection.match(/^(https?|ftp|mailto):/)) {
        update(`[](${selection})`, start + 1);
      } else {
        update(`[${selection}]()`, end + 3);
      }
    };

    let func = {
      strong: () => bracket('**'),
      em: () => bracket('_'),
      a: () => anchor(),
      h2: () => quote('##'),
      blockquote: () => quote('>'),
      code: () => multiline ? bracket('```', '\n') : bracket('`'),
      ul: () => quote('*'),
      ol: () => quote(multiline ? undefined : '1.'),
    }[tag];

    if (func) {
      func();
    }
  }
}
